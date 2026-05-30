import type { FeedbackAnnotation } from "./feedback"
import {
  BUGBASH_ANNOTATION_PROPERTY_KEY,
  getIssueApiUrl,
  getJiraApiUrl,
  getJiraIssueUrl,
  getProjectKeyFromIssueKey,
  normalizeJiraIssueResponse,
  type BugBashJiraIssue,
  type JiraIssueResponse
} from "./jira-issues"
import type { JiraIssueContext } from "./types"

interface ParentSubtask {
  id: string
  key: string
}

interface ParentIssueResponse {
  fields?: {
    subtasks?: ParentSubtask[]
  }
}

interface CreateMetaResponse {
  projects?: Array<{
    issuetypes?: Array<{
      id?: string
      name?: string
      subtask?: boolean
    }>
  }>
}

interface CreateIssueResponse {
  id: string
  key: string
  self: string
}

export interface CreateBugbashJiraIssueInput extends JiraIssueContext {
  summary: string
  annotation: FeedbackAnnotation
}

async function readResponseText(response: Response): Promise<string> {
  try {
    return await response.text()
  } catch {
    return ""
  }
}

async function assertOk(response: Response, action: string): Promise<void> {
  if (response.ok) {
    return
  }

  const body = await readResponseText(response)
  throw new Error(
    `${action}: ${response.status} ${response.statusText}${
      body ? ` - ${body}` : ""
    }`
  )
}

async function fetchJson<T>(url: string, init: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    credentials: "include",
    headers: {
      Accept: "application/json",
      ...init.headers
    }
  })

  await assertOk(response, "Jira request failed")
  return (await response.json()) as T
}

async function getSubtaskIssueTypeId({
  jiraOrg,
  jiraIssueKey
}: JiraIssueContext): Promise<string> {
  const projectKey = getProjectKeyFromIssueKey(jiraIssueKey)
  if (!projectKey) {
    throw new Error("Could not resolve Jira project key from issue key.")
  }

  const url = new URL(getJiraApiUrl(jiraOrg, "/issue/createmeta"))
  url.searchParams.set("projectKeys", projectKey)
  url.searchParams.set("expand", "projects.issuetypes.fields")

  const data = await fetchJson<CreateMetaResponse>(url.toString(), {
    method: "GET"
  })
  const issueType = data.projects?.[0]?.issuetypes?.find(
    (item) => item.subtask && item.id
  )

  if (!issueType?.id) {
    throw new Error("No Jira subtask issue type is available for this issue.")
  }

  return issueType.id
}

export async function fetchBugbashJiraIssues({
  jiraOrg,
  jiraIssueKey
}: JiraIssueContext): Promise<BugBashJiraIssue[]> {
  const parentUrl = new URL(getIssueApiUrl(jiraOrg, jiraIssueKey))
  parentUrl.searchParams.set("fields", "subtasks")

  const parentIssue = await fetchJson<ParentIssueResponse>(
    parentUrl.toString(),
    {
      method: "GET"
    }
  )

  const subtasks = parentIssue.fields?.subtasks ?? []
  const issues = await Promise.all(
    subtasks.map(async ({ key }) => {
      const issueUrl = new URL(getIssueApiUrl(jiraOrg, key))
      issueUrl.searchParams.set("fields", "summary,status")
      issueUrl.searchParams.set("properties", BUGBASH_ANNOTATION_PROPERTY_KEY)

      const issue = await fetchJson<JiraIssueResponse>(issueUrl.toString(), {
        method: "GET"
      })

      return normalizeJiraIssueResponse(jiraOrg, issue)
    })
  )

  return issues.filter((issue): issue is BugBashJiraIssue => issue !== null)
}

export async function createBugbashJiraIssue({
  jiraOrg,
  jiraIssueKey,
  summary,
  annotation
}: CreateBugbashJiraIssueInput): Promise<BugBashJiraIssue> {
  const projectKey = getProjectKeyFromIssueKey(jiraIssueKey)
  if (!projectKey) {
    throw new Error("Could not resolve Jira project key from issue key.")
  }

  const issueTypeId = await getSubtaskIssueTypeId({ jiraOrg, jiraIssueKey })
  const trimmedSummary = summary.trim()

  if (!trimmedSummary) {
    throw new Error("A Jira issue summary is required.")
  }

  const issue = await fetchJson<CreateIssueResponse>(
    getJiraApiUrl(jiraOrg, "/issue"),
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        fields: {
          project: {
            key: projectKey
          },
          parent: {
            key: jiraIssueKey
          },
          summary: trimmedSummary,
          issuetype: {
            id: issueTypeId
          }
        },
        properties: [
          {
            key: BUGBASH_ANNOTATION_PROPERTY_KEY,
            value: annotation
          }
        ]
      })
    }
  )

  return {
    id: issue.id,
    issueKey: issue.key,
    issueUrl: getJiraIssueUrl(jiraOrg, issue.key),
    summary: trimmedSummary,
    annotation
  }
}
