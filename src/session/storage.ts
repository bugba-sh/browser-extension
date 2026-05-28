import type { BugBashSession, RecentSession } from "./types"

const SESSION_BY_GROUP_PREFIX = "bugbash.session.group."
const RECENT_SESSIONS_KEY = "bugbash.session.recent"
const MAX_RECENT_SESSIONS = 5

function getGroupSessionKey(tabGroupId: number): string {
  return `${SESSION_BY_GROUP_PREFIX}${tabGroupId}`
}

export function mergeRecentSessions(
  currentSessions: RecentSession[],
  session: BugBashSession
): RecentSession[] {
  const recentSession: RecentSession = {
    id: session.id,
    jiraOrg: session.jiraOrg,
    jiraIssueKey: session.jiraIssueKey,
    targetUrl: session.targetUrl,
    createdAt: session.createdAt,
    lastActiveAt: session.lastActiveAt,
    tabGroupId: session.tabGroupId,
    lastKnownTabId: session.lastKnownTabId,
    title: session.title
  }

  return [
    recentSession,
    ...currentSessions.filter((item) => item.id !== session.id)
  ]
    .sort((left, right) => right.lastActiveAt - left.lastActiveAt)
    .slice(0, MAX_RECENT_SESSIONS)
}

function parseArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : []
}

export async function getSessionByGroupId(
  tabGroupId: number
): Promise<BugBashSession | null> {
  const key = getGroupSessionKey(tabGroupId)
  const value = await chrome.storage.local.get(key)
  return (value[key] as BugBashSession | undefined) ?? null
}

export async function saveSession(session: BugBashSession): Promise<void> {
  const recentSessions = await getRecentSessions()
  await chrome.storage.local.set({
    [getGroupSessionKey(session.tabGroupId)]: session,
    [RECENT_SESSIONS_KEY]: mergeRecentSessions(recentSessions, session)
  })
}

export async function removeSessionByGroupId(tabGroupId: number): Promise<void> {
  await chrome.storage.local.remove(getGroupSessionKey(tabGroupId))
}

export async function getRecentSessions(): Promise<RecentSession[]> {
  const value = await chrome.storage.local.get(RECENT_SESSIONS_KEY)
  return parseArray<RecentSession>(value[RECENT_SESSIONS_KEY])
}

export async function saveRecentSessions(
  sessions: RecentSession[]
): Promise<void> {
  await chrome.storage.local.set({
    [RECENT_SESSIONS_KEY]: sessions.slice(0, MAX_RECENT_SESSIONS)
  })
}
