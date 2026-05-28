import {
  BUGBASH_GROUP_COLOR,
  BUGBASH_GROUP_TITLE_PREFIX,
  BUGBASH_WEB_URL,
  type ActionControlState,
  type BugBashSession,
  type RecentSession,
  type RuntimeMessage,
  type RuntimeResponse
} from "~src/session/types"
import {
  getRecentSessions,
  getSessionByGroupId,
  removeSessionByGroupId,
  saveRecentSessions,
  saveSession
} from "~src/session/storage"

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
    await chrome.action.setBadgeText({
      tabId: tab.id,
      text: session ? "BB" : ""
    })
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
  await updateBadgeForTab(createdTab.id)

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
  return restoredSession
}

async function openSidePanel(tabId?: number): Promise<void> {
  const tab = tabId ? await getTab(tabId) : await getActiveTab()
  if (!tab?.id || !tab.windowId) {
    throw new Error("No active tab is available for the side panel.")
  }

  await chrome.sidePanel.open({ windowId: tab.windowId })
}

async function endSession(sessionId: string): Promise<void> {
  const recentSessions = await getRecentSessions()
  const session = recentSessions.find((item) => item.id === sessionId)
  if (session?.tabGroupId) {
    await removeSessionByGroupId(session.tabGroupId)
  }
  await saveRecentSessions(recentSessions.filter((item) => item.id !== sessionId))
  await updateBadgeForTab()
}

export async function handleRuntimeMessage(
  message: RuntimeMessage
): Promise<RuntimeResponse> {
  try {
    switch (message.type) {
      case "bugbash:create-session":
        return { ok: true, value: await createSession(message) }
      case "bugbash:get-tab-session":
        return { ok: true, value: await getTabSession(message.tabId) }
      case "bugbash:get-action-control-state":
        return { ok: true, value: await getActionControlState() }
      case "bugbash:open-side-panel":
        await openSidePanel(message.tabId)
        return { ok: true, value: null }
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

export async function cleanupGroupSession(groupId: number): Promise<void> {
  await removeSessionByGroupId(groupId)
}

export async function openBugbashHome(): Promise<void> {
  await chrome.tabs.create({ url: BUGBASH_WEB_URL, active: true })
}
