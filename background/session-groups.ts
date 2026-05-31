import { captureVisibleTabScreenshot } from "~background/capture-visible-tab"
import {
  captureTabScreenshot,
  getTabCaptureStatus,
  snapshotTabCapture,
  startTabCapture,
  stopTabCapture
} from "~background/debugger-capture"
import {
  createBugbashJiraIssue,
  enrichBugbashJiraIssue,
  fetchBugbashJiraIssues
} from "~src/session/jira-api"
import {
  appendCachedJiraIssue,
  getCachedJiraIssues,
  saveCachedJiraIssues
} from "~src/session/jira-issue-storage"
import {
  getActionBadgeTextForIssueCount,
  isJiraIssueCacheFresh,
  type BugBashJiraIssue
} from "~src/session/jira-issues"
import {
  clearPreviewFeedback,
  createPreviewFeedback,
  listPreviewFeedback
} from "~src/session/preview-feedback-storage"
import {
  getRecentSessions,
  getSessionByGroupId,
  removeSessionByGroupId,
  saveRecentSessions,
  saveSession
} from "~src/session/storage"
import {
  buildTelemetryArtifact,
  createBugBashTimelineEvent
} from "~src/session/telemetry"
import { sanitizeTimelineEvents } from "~src/session/telemetry-redaction"
import {
  BUGBASH_GROUP_COLOR,
  BUGBASH_GROUP_TITLE_PREFIX,
  BUGBASH_WEB_URL,
  type ActionControlState,
  type BugBashSession,
  type JiraIssueContext,
  type RecentSession,
  type RuntimeMessage,
  type RuntimeResponse
} from "~src/session/types"

function createSessionId(jiraOrg: string, jiraIssueKey: string): string {
  return `${jiraOrg}:${jiraIssueKey}:${Date.now()}`
}

function getGroupTitle(jiraIssueKey: string): string {
  return `${BUGBASH_GROUP_TITLE_PREFIX} ${jiraIssueKey}`
}

async function getActiveTab(): Promise<chrome.tabs.Tab | null> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  return tab ?? null
}

async function getTab(tabId: number): Promise<chrome.tabs.Tab | null> {
  try {
    return await chrome.tabs.get(tabId)
  } catch {
    return null
  }
}

async function getTabSession(tabId?: number): Promise<BugBashSession | null> {
  const tab = tabId ? await getTab(tabId) : await getActiveTab()
  const groupId = tab?.groupId

  if (groupId === undefined || groupId === chrome.tabGroups.TAB_GROUP_ID_NONE) {
    return null
  }

  return getSessionByGroupId(groupId)
}

async function updateBadgeForTab(tabId?: number): Promise<void> {
  const tab = tabId ? await getTab(tabId) : await getActiveTab()
  const session = tab?.id ? await getTabSession(tab.id) : null

  if (tab?.id) {
    const cachedIssues = session ? await getCachedJiraIssues(session) : null

    await chrome.action.setBadgeText({
      tabId: tab.id,
      text: session
        ? getActionBadgeTextForIssueCount(cachedIssues?.issues.length ?? 0)
        : ""
    })

    if (session && (!cachedIssues || !isJiraIssueCacheFresh(cachedIssues))) {
      void refreshJiraIssues(session)
        .then(() => updateBadgeForTab(tab.id))
        .catch(() => {})
    }
  } else {
    await chrome.action.setBadgeText({ text: "" })
  }

  await chrome.action.setBadgeBackgroundColor({ color: "#2fbf71" })
}

async function createSession(
  message: Extract<RuntimeMessage, { type: "bugbash:create-session" }>
): Promise<BugBashSession> {
  const createdTab = await chrome.tabs.create({
    url: message.targetUrl,
    active: true
  })

  if (!createdTab.id) {
    throw new Error("Chrome did not return a tab id for the review page.")
  }

  const tabGroupId = await chrome.tabs.group({ tabIds: [createdTab.id] })

  await chrome.tabGroups.update(tabGroupId, {
    title: getGroupTitle(message.jiraIssueKey),
    color: BUGBASH_GROUP_COLOR
  })

  const now = Date.now()
  const session: BugBashSession = {
    id: createSessionId(message.jiraOrg, message.jiraIssueKey),
    jiraOrg: message.jiraOrg,
    jiraIssueKey: message.jiraIssueKey,
    targetUrl: message.targetUrl,
    tabGroupId,
    createdAt: now,
    lastActiveAt: now,
    lastKnownTabId: createdTab.id,
    title: message.jiraIssueKey
  }

  await saveSession(session)
  void startTabCapture(createdTab.id).catch(() => {})
  await updateBadgeForTab(createdTab.id)
  void refreshJiraIssues(session)
    .then(() => updateBadgeForTab(createdTab.id))
    .catch(() => {})

  return session
}

async function getActionControlState(): Promise<ActionControlState> {
  const activeSession = await getTabSession()

  if (activeSession) {
    return { kind: "active-session", session: activeSession }
  }

  return {
    kind: "no-active-session",
    recentSessions: await getRecentSessions()
  }
}

async function openCreateSessionPage(
  message: Extract<RuntimeMessage, { type: "bugbash:open-create-session-page" }>
): Promise<void> {
  const url = new URL(chrome.runtime.getURL("tabs/create-session.html"))
  url.searchParams.set("jiraOrg", message.jiraOrg)
  url.searchParams.set("jiraIssueKey", message.jiraIssueKey)

  await chrome.tabs.create({
    url: url.toString(),
    active: true
  })
}

async function resumeSession(sessionId: string): Promise<RecentSession> {
  const recentSessions = await getRecentSessions()
  const session = recentSessions.find((item) => item.id === sessionId)

  if (!session) {
    throw new Error("Recent session was not found.")
  }

  if (session.lastKnownTabId) {
    const existingTab = await getTab(session.lastKnownTabId)
    if (existingTab?.id) {
      await chrome.tabs.update(existingTab.id, { active: true })
      if (existingTab.windowId) {
        await chrome.windows.update(existingTab.windowId, { focused: true })
      }
      return session
    }
  }

  const createdTab = await chrome.tabs.create({
    url: session.targetUrl,
    active: true
  })

  if (!createdTab.id) {
    throw new Error("Chrome did not return a tab id for the resumed session.")
  }

  const tabGroupId = await chrome.tabs.group({ tabIds: [createdTab.id] })
  await chrome.tabGroups.update(tabGroupId, {
    title: getGroupTitle(session.jiraIssueKey),
    color: BUGBASH_GROUP_COLOR
  })

  const restoredSession: BugBashSession = {
    ...session,
    tabGroupId,
    lastKnownTabId: createdTab.id,
    lastActiveAt: Date.now()
  }

  await saveSession(restoredSession)
  void startTabCapture(createdTab.id).catch(() => {})
  return restoredSession
}

async function openSidePanel(tabId?: number): Promise<void> {
  const tab = tabId ? await getTab(tabId) : await getActiveTab()
  if (!tab?.id || !tab.windowId) {
    throw new Error("No active tab is available for the side panel.")
  }

  await chrome.sidePanel.open({ windowId: tab.windowId })

  const session = await getTabSession(tab.id)
  if (session) {
    void refreshJiraIssues(session)
      .then(() => updateBadgeForTab(tab.id))
      .catch(() => {})
  }
}

async function captureVisibleTab(
  sender?: chrome.runtime.MessageSender
): Promise<string> {
  const activeTab = sender?.tab ?? (await getActiveTab())
  const windowId = activeTab?.windowId
  let visibleTabError: unknown

  if (!windowId) {
    throw new Error("No active window is available for screenshot capture.")
  }

  try {
    return await captureVisibleTabScreenshot(windowId)
  } catch (error) {
    visibleTabError = error
  }

  if (typeof activeTab?.id === "number") {
    try {
      return await captureTabScreenshot(activeTab.id)
    } catch (debuggerError) {
      throw new Error(
        `Screenshot capture failed: ${String(
          (visibleTabError as Error)?.message ?? visibleTabError
        )}; debugger fallback failed: ${String(
          (debuggerError as Error)?.message ?? debuggerError
        )}`
      )
    }
  }

  throw new Error(
    `Screenshot capture failed: ${String(
      (visibleTabError as Error)?.message ?? visibleTabError
    )}`
  )
}

async function endSession(sessionId: string): Promise<void> {
  const recentSessions = await getRecentSessions()
  const session = recentSessions.find((item) => item.id === sessionId)
  if (session?.tabGroupId) {
    const groupedTabs = await chrome.tabs.query({ groupId: session.tabGroupId })
    await Promise.all(
      groupedTabs
        .map((tab) => tab.id)
        .filter((tabId): tabId is number => typeof tabId === "number")
        .map((tabId) => stopTabCapture(tabId))
    )
  }
  if (session?.tabGroupId) {
    await removeSessionByGroupId(session.tabGroupId)
  }
  await saveRecentSessions(
    recentSessions.filter((item) => item.id !== sessionId)
  )
  await clearPreviewFeedback(sessionId)
  await updateBadgeForTab()
}

async function refreshJiraIssues(
  context: JiraIssueContext
): Promise<BugBashJiraIssue[]> {
  const issues = await fetchBugbashJiraIssues(context)
  await saveCachedJiraIssues(context, issues)
  return issues
}

async function listJiraIssues(
  message: Extract<RuntimeMessage, { type: "bugbash:list-jira-issues" }>
): Promise<BugBashJiraIssue[]> {
  const context: JiraIssueContext = {
    jiraOrg: message.jiraOrg,
    jiraIssueKey: message.jiraIssueKey
  }
  const cached = await getCachedJiraIssues(context)

  if (!message.forceRefresh && cached) {
    if (!isJiraIssueCacheFresh(cached)) {
      void refreshJiraIssues(context)
        .then(() => updateBadgeForTab())
        .catch(() => {})
    }

    return cached.issues
  }

  return refreshJiraIssues(context)
}

async function createJiraIssue(
  message: Extract<RuntimeMessage, { type: "bugbash:create-jira-issue" }>
): Promise<BugBashJiraIssue> {
  const context: JiraIssueContext = {
    jiraOrg: message.jiraOrg,
    jiraIssueKey: message.jiraIssueKey
  }
  const activeTab = await getActiveTab()
  const tabId = activeTab?.id ?? 0
  const capture = snapshotTabCapture(tabId)
  const timeline = capture.events.slice()

  if (!message.screenshotDataUrl) {
    timeline.push(
      createBugBashTimelineEvent("warn", "Screenshot capture was unavailable.")
    )
  }

  const sanitized = sanitizeTimelineEvents(timeline)
  const issue = await createBugbashJiraIssue({
    ...context,
    summary: message.summary,
    annotation: message.annotation
  })
  const telemetry = buildTelemetryArtifact({
    capture: {
      id: `capture-${tabId}-${Date.now()}`,
      sessionId: `${message.jiraOrg}:${message.jiraIssueKey}`,
      tabId,
      startedAt: capture.startedAt,
      endedAt: capture.endedAt
    },
    page: message.page,
    browser: message.browser,
    environment: message.environment,
    annotation: message.annotation,
    timeline: sanitized.events,
    redactions: sanitized.redactions,
    warnings: capture.warnings,
    hasScreenshot: Boolean(message.screenshotDataUrl)
  })

  void enrichBugbashJiraIssue({
    jiraOrg: message.jiraOrg,
    issueKey: issue.issueKey,
    telemetry,
    screenshotDataUrl: message.screenshotDataUrl
  }).catch(() => {})

  await appendCachedJiraIssue(context, issue)
  await updateBadgeForTab()
  void refreshJiraIssues(context)
    .then(() => updateBadgeForTab())
    .catch(() => {})

  return issue
}

export async function handleRuntimeMessage(
  message: RuntimeMessage,
  sender?: chrome.runtime.MessageSender
): Promise<RuntimeResponse> {
  try {
    switch (message.type) {
      case "bugbash:create-session":
        return { ok: true, value: await createSession(message) }
      case "bugbash:get-tab-session":
        return { ok: true, value: await getTabSession(message.tabId) }
      case "bugbash:get-action-control-state":
        return { ok: true, value: await getActionControlState() }
      case "bugbash:get-capture-status": {
        const tab = message.tabId
          ? await getTab(message.tabId)
          : await getActiveTab()
        return {
          ok: true,
          value: getTabCaptureStatus(tab?.id)
        }
      }
      case "bugbash:open-create-session-page":
        await openCreateSessionPage(message)
        return { ok: true, value: null }
      case "bugbash:open-side-panel":
        await openSidePanel(message.tabId)
        return { ok: true, value: null }
      case "bugbash:open-home":
        await openBugbashHome()
        return { ok: true, value: null }
      case "bugbash:capture-visible-tab":
        return {
          ok: true,
          value: await captureVisibleTab(sender)
        }
      case "bugbash:list-preview-feedback":
        return {
          ok: true,
          value: await listPreviewFeedback(message.sessionId)
        }
      case "bugbash:create-preview-feedback":
        return {
          ok: true,
          value: await createPreviewFeedback(message.feedback)
        }
      case "bugbash:list-jira-issues":
        return {
          ok: true,
          value: await listJiraIssues(message)
        }
      case "bugbash:create-jira-issue":
        return {
          ok: true,
          value: await createJiraIssue(message)
        }
      case "bugbash:resume-session":
        return { ok: true, value: await resumeSession(message.sessionId) }
      case "bugbash:end-session":
        await endSession(message.sessionId)
        return { ok: true, value: null }
      default:
        return { ok: false, error: "Unknown BugBash runtime message." }
    }
  } catch (error) {
    return {
      ok: false,
      error: String((error as Error)?.message ?? error)
    }
  }
}

export async function refreshActiveTabBadge(): Promise<void> {
  await updateBadgeForTab()
}

export async function reconcileTabCapture(tabId: number): Promise<void> {
  const session = await getTabSession(tabId)

  if (session) {
    await startTabCapture(tabId)
    return
  }

  await stopTabCapture(tabId)
}

export async function cleanupGroupSession(groupId: number): Promise<void> {
  const session = await getSessionByGroupId(groupId)
  if (session?.lastKnownTabId) {
    await stopTabCapture(session.lastKnownTabId)
  }
  await removeSessionByGroupId(groupId)
}

export async function openBugbashHome(): Promise<void> {
  await chrome.tabs.create({ url: BUGBASH_WEB_URL, active: true })
}
