import type { JiraIssueContext } from "./types"

const ISSUE_KEY_REGEX = /([A-Z][A-Z0-9]+-\d+)/
const ISSUE_BREADCRUMB_TEST_ID =
  "issue.views.issue-base.foundation.breadcrumbs.current-issue.item"

export type PartialJiraIssueContext = {
  jiraOrg: string | null
  jiraIssueKey: string | null
}

export function getJiraOrgFromHostname(hostname: string): string | null {
  const match = hostname.match(/^([a-z0-9][a-z0-9-]*)\.atlassian\.net$/i)
  return match?.[1] ?? null
}

export function getJiraIssueFromUrl(urlString: string): PartialJiraIssueContext {
  try {
    const url = new URL(urlString)
    const jiraOrg = getJiraOrgFromHostname(url.hostname)

    if (!jiraOrg) {
      return { jiraOrg: null, jiraIssueKey: null }
    }

    const browseMatch = url.pathname.match(/\/browse\/([A-Z0-9]+-\d+)/)
    if (browseMatch?.[1]) {
      return { jiraOrg, jiraIssueKey: browseMatch[1] }
    }

    const detailedMatch = url.pathname.match(
      /\/projects\/([A-Z0-9]+)\/(?:c\/)?issues\/([A-Z0-9]+-\d+)/
    )
    if (detailedMatch?.[2]) {
      return { jiraOrg, jiraIssueKey: detailedMatch[2] }
    }

    const selectedIssue = url.searchParams.get("selectedIssue")
    if (selectedIssue && ISSUE_KEY_REGEX.test(selectedIssue)) {
      return { jiraOrg, jiraIssueKey: selectedIssue }
    }

    return { jiraOrg, jiraIssueKey: null }
  } catch {
    return { jiraOrg: null, jiraIssueKey: null }
  }
}

export function getJiraIssueFromDom(): string | null {
  if (typeof document === "undefined") {
    return null
  }

  const issueAnchor = document.querySelector<HTMLAnchorElement>(
    `[data-testid="${ISSUE_BREADCRUMB_TEST_ID}"]`
  )

  return issueAnchor?.getAttribute("href")?.match(ISSUE_KEY_REGEX)?.[1] ?? null
}

export function resolveJiraIssueContext(
  urlString: string
): PartialJiraIssueContext {
  const fromUrl = getJiraIssueFromUrl(urlString)

  if (fromUrl.jiraOrg && fromUrl.jiraIssueKey) {
    return fromUrl
  }

  return {
    jiraOrg: fromUrl.jiraOrg,
    jiraIssueKey: getJiraIssueFromDom()
  }
}

export function hasJiraIssueContext(
  value: PartialJiraIssueContext
): value is JiraIssueContext {
  return Boolean(value.jiraOrg && value.jiraIssueKey)
}
