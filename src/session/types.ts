export const BUGBASH_WEB_URL = "https://bugba.sh"
export const BUGBASH_GROUP_TITLE_PREFIX = "BugBash"
export const BUGBASH_GROUP_COLOR: chrome.tabGroups.ColorEnum = "green"

export interface JiraIssueContext {
  jiraOrg: string
  jiraIssueKey: string
}

export interface BugBashSession {
  id: string
  jiraOrg: string
  jiraIssueKey: string
  targetUrl: string
  tabGroupId: number
  createdAt: number
  lastActiveAt: number
  lastKnownTabId?: number
  title?: string
}

export interface RecentSession {
  id: string
  jiraOrg: string
  jiraIssueKey: string
  targetUrl: string
  createdAt: number
  lastActiveAt: number
  tabGroupId?: number
  lastKnownTabId?: number
  title?: string
}

export type ActionControlState =
  | {
      kind: "active-session"
      session: BugBashSession
    }
  | {
      kind: "no-active-session"
      recentSessions: RecentSession[]
    }

export type RuntimeMessage =
  | {
      type: "bugbash:create-session"
      jiraOrg: string
      jiraIssueKey: string
      targetUrl: string
    }
  | {
      type: "bugbash:get-tab-session"
      tabId?: number
    }
  | {
      type: "bugbash:get-action-control-state"
    }
  | {
      type: "bugbash:open-side-panel"
      tabId?: number
    }
  | {
      type: "bugbash:resume-session"
      sessionId: string
    }
  | {
      type: "bugbash:end-session"
      sessionId: string
    }

export type RuntimeResponse<T = unknown> =
  | {
      ok: true
      value: T
    }
  | {
      ok: false
      error: string
    }
