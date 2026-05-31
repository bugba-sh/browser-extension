import type { FeedbackAnnotation, FeedbackItem } from "./feedback"

export const BUGBASH_ANNOTATION_PROPERTY_KEY = "bugbash_annotation"
export const JIRA_ISSUE_CACHE_MAX_AGE_MS = 30_000

export interface BugBashJiraIssue {
  id: string
  issueKey: string
  issueUrl: string
  summary: string
  annotation: FeedbackAnnotation
  status?: string
  warnings?: string[]
}

export interface JiraIssueCache {
  jiraOrg: string
  jiraIssueKey: string
  issues: BugBashJiraIssue[]
  updatedAt: number
}

export interface JiraIssueResponse {
  id?: string
  key?: string
  fields?: {
    summary?: unknown
    status?: {
      name?: unknown
    }
  }
  properties?: Record<string, unknown>
}

export function getJiraApiUrl(jiraOrg: string, resourcePath = ""): string {
  const normalizedResourcePath = resourcePath
    ? resourcePath.startsWith("/")
      ? resourcePath
      : `/${resourcePath}`
    : ""

  return `https://${jiraOrg}.atlassian.net/rest/api/3${normalizedResourcePath}`
}

export function getIssueApiUrl(
  jiraOrg: string,
  issueKey: string,
  resourcePath = ""
): string {
  const normalizedResourcePath = resourcePath
    ? resourcePath.startsWith("/")
      ? resourcePath
      : `/${resourcePath}`
    : ""

  return getJiraApiUrl(
    jiraOrg,
    `/issue/${encodeURIComponent(issueKey)}${normalizedResourcePath}`
  )
}

export function getJiraIssueUrl(jiraOrg: string, issueKey: string): string {
  return `https://${jiraOrg}.atlassian.net/browse/${encodeURIComponent(issueKey)}`
}

export function getProjectKeyFromIssueKey(jiraIssueKey: string): string {
  const [projectKey = ""] = jiraIssueKey.split("-")
  return projectKey
}

function isFeedbackAnnotation(value: unknown): value is FeedbackAnnotation {
  if (!value || typeof value !== "object") {
    return false
  }

  const annotation = value as Partial<FeedbackAnnotation>
  return (
    typeof annotation.selector === "string" &&
    typeof annotation.xPercent === "number" &&
    typeof annotation.yPercent === "number" &&
    (annotation.pageUrl === undefined || typeof annotation.pageUrl === "string")
  )
}

export function normalizeJiraIssueResponse(
  jiraOrg: string,
  issue: JiraIssueResponse
): BugBashJiraIssue | null {
  if (!issue.key) {
    return null
  }

  const annotation = issue.properties?.[BUGBASH_ANNOTATION_PROPERTY_KEY] ?? null

  if (!isFeedbackAnnotation(annotation)) {
    return null
  }

  const summary =
    typeof issue.fields?.summary === "string" ? issue.fields.summary.trim() : ""
  const status =
    typeof issue.fields?.status?.name === "string"
      ? issue.fields.status.name
      : undefined

  return {
    id: issue.id ?? issue.key,
    issueKey: issue.key,
    issueUrl: getJiraIssueUrl(jiraOrg, issue.key),
    summary: summary || issue.key,
    annotation,
    ...(status ? { status } : {})
  }
}

export function isJiraIssueCacheFresh(
  cache: JiraIssueCache,
  now = Date.now()
): boolean {
  return now - cache.updatedAt <= JIRA_ISSUE_CACHE_MAX_AGE_MS
}

export function getActionBadgeTextForIssueCount(count: number): string {
  if (count > 99) {
    return "99+"
  }

  return String(Math.max(0, count))
}

export function jiraIssueToFeedbackItem(
  sessionId: string,
  issue: BugBashJiraIssue
): FeedbackItem {
  return {
    id: `jira-${issue.id}`,
    sessionId,
    status: "saved",
    summary: issue.summary,
    annotation: issue.annotation,
    createdAt: 0,
    issueKey: issue.issueKey,
    issueUrl: issue.issueUrl
  }
}
