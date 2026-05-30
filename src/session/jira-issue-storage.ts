import type { BugBashJiraIssue, JiraIssueCache } from "./jira-issues"
import type { JiraIssueContext } from "./types"

const JIRA_ISSUE_CACHE_PREFIX = "bugbash.jiraIssues."

function getJiraIssueCacheKey({
  jiraOrg,
  jiraIssueKey
}: JiraIssueContext): string {
  return `${JIRA_ISSUE_CACHE_PREFIX}${jiraOrg}.${jiraIssueKey}`
}

export async function getCachedJiraIssues(
  context: JiraIssueContext
): Promise<JiraIssueCache | null> {
  const key = getJiraIssueCacheKey(context)
  const value = await chrome.storage.local.get(key)
  return (value[key] as JiraIssueCache | undefined) ?? null
}

export async function saveCachedJiraIssues(
  context: JiraIssueContext,
  issues: BugBashJiraIssue[]
): Promise<JiraIssueCache> {
  const cache: JiraIssueCache = {
    jiraOrg: context.jiraOrg,
    jiraIssueKey: context.jiraIssueKey,
    issues,
    updatedAt: Date.now()
  }

  await chrome.storage.local.set({
    [getJiraIssueCacheKey(context)]: cache
  })

  return cache
}

export async function appendCachedJiraIssue(
  context: JiraIssueContext,
  issue: BugBashJiraIssue
): Promise<JiraIssueCache> {
  const current = await getCachedJiraIssues(context)
  const issues = [
    issue,
    ...(current?.issues ?? []).filter(
      (item) => item.issueKey !== issue.issueKey
    )
  ]

  return saveCachedJiraIssues(context, issues)
}

export async function clearCachedJiraIssues(
  context: JiraIssueContext
): Promise<void> {
  await chrome.storage.local.remove(getJiraIssueCacheKey(context))
}
