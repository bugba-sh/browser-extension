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
import {
  SCREENSHOT_ATTACHMENT_NAME,
  TELEMETRY_ATTACHMENT_NAME,
  type TelemetryArtifact
} from "./telemetry"
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

interface JiraAttachment {
  id: string
  filename: string
  content: string
  mimeType?: string
}

type AdfTextNode = {
  type: "text"
  text: string
}

type AdfParagraph = {
  type: "paragraph"
  content: AdfTextNode[]
}

type AdfDocument = {
  type: "doc"
  version: 1
  content: AdfParagraph[]
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

function createTextDocument(lines: string[]): AdfDocument {
  return {
    type: "doc",
    version: 1,
    content: lines.map((line) => ({
      type: "paragraph",
      content: line ? [{ type: "text", text: line }] : []
    }))
  }
}

function dataUrlToBlob(dataUrl: string): Blob {
  const match = dataUrl.match(/^data:([^;,]+)?(;base64)?,(.*)$/)
  if (!match) {
    throw new Error("Failed to decode screenshot data URL.")
  }

  const [, mimeType = "application/octet-stream", encoding, payload = ""] =
    match
  if (encoding !== ";base64") {
    throw new Error("Screenshot data URL was not base64 encoded.")
  }

  const binary = atob(payload)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index)
  }

  return new Blob([bytes], { type: mimeType })
}

async function uploadIssueAttachments(
  jiraOrg: string,
  jiraIssueKey: string,
  attachments: Array<{ filename: string; body: Blob }>
): Promise<JiraAttachment[]> {
  if (attachments.length === 0) {
    return []
  }

  const formData = new FormData()
  for (const attachment of attachments) {
    formData.append("file", attachment.body, attachment.filename)
  }

  const response = await fetch(
    getIssueApiUrl(jiraOrg, jiraIssueKey, "/attachments"),
    {
      method: "POST",
      credentials: "include",
      headers: {
        Accept: "application/json",
        "X-Atlassian-Token": "no-check"
      },
      body: formData
    }
  )

  await assertOk(response, "Failed to upload Jira attachments")
  return (await response.json()) as JiraAttachment[]
}

async function updateIssueFields(
  jiraOrg: string,
  jiraIssueKey: string,
  fields: Record<string, unknown>
): Promise<void> {
  const response = await fetch(getIssueApiUrl(jiraOrg, jiraIssueKey), {
    method: "PUT",
    credentials: "include",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ fields })
  })

  await assertOk(response, "Failed to update Jira issue")
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

export async function enrichBugbashJiraIssue({
  jiraOrg,
  issueKey,
  telemetry,
  screenshotDataUrl
}: {
  jiraOrg: string
  issueKey: string
  telemetry: TelemetryArtifact
  screenshotDataUrl?: string
}): Promise<string[]> {
  const warnings: string[] = []

  try {
    const attachments: Array<{ filename: string; body: Blob }> = [
      {
        filename: TELEMETRY_ATTACHMENT_NAME,
        body: new Blob([JSON.stringify(telemetry, null, 2)], {
          type: "application/json"
        })
      }
    ]

    if (screenshotDataUrl) {
      attachments.push({
        filename: SCREENSHOT_ATTACHMENT_NAME,
        body: dataUrlToBlob(screenshotDataUrl)
      })
    }

    await uploadIssueAttachments(jiraOrg, issueKey, attachments)
  } catch (error) {
    warnings.push(
      `Attachments could not be uploaded: ${String((error as Error)?.message ?? error)}`
    )
  }

  try {
    await updateIssueFields(jiraOrg, issueKey, {
      description: createTextDocument([
        `BugBash feedback captured on ${telemetry.page.url}`,
        `Browser: ${telemetry.browser.name} ${telemetry.browser.version}`.trim(),
        `OS: ${telemetry.browser.os}`,
        `Viewport: ${telemetry.page.viewport.width}x${telemetry.page.viewport.height}`,
        `Telemetry events: ${telemetry.timeline.length}`,
        screenshotDataUrl ? "Screenshot attached." : "Screenshot unavailable."
      ])
    })
  } catch (error) {
    warnings.push(
      `Description could not be updated: ${String((error as Error)?.message ?? error)}`
    )
  }

  return warnings
}
