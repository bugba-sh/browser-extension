import type { PlasmoCSConfig, PlasmoGetInlineAnchor } from "plasmo"

import { JiraIssueLauncher } from "~src/features/jira/JiraIssueLauncher"
import type { JiraIssueContext } from "~src/session/types"

const JIRA_ACTION_ANCHOR_SELECTOR =
  'button[data-testid="issue-view-foundation.quick-add.quick-add-items-compact.apps-button-dropdown--trigger"]'

export const config: PlasmoCSConfig = {
  matches: ["https://*.atlassian.net/*"],
  all_frames: false
}

export const getInlineAnchor: PlasmoGetInlineAnchor = async () => ({
  element: document
    .querySelector<HTMLButtonElement>(JIRA_ACTION_ANCHOR_SELECTOR)
    ?.closest('div[role="presentation"]'),
  insertPosition: "afterend"
})

function getCreateSessionUrl(params: JiraIssueContext): string {
  const url = new URL(chrome.runtime.getURL("tabs/create-session.html"))
  url.searchParams.set("jiraOrg", params.jiraOrg)
  url.searchParams.set("jiraIssueKey", params.jiraIssueKey)
  return url.toString()
}

export default function JiraIssueButton() {
  return <JiraIssueLauncher getCreateSessionUrl={getCreateSessionUrl} />
}
