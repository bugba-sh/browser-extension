import type { PlasmoCSConfig, PlasmoGetInlineAnchor } from "plasmo"

import { JiraIssueLauncher } from "~src/features/jira/JiraIssueLauncher"
import { sendRuntimeMessage } from "~src/session/messages"
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

function openCreateSessionPage(params: JiraIssueContext): void {
  void sendRuntimeMessage({
    type: "bugbash:open-create-session-page",
    jiraOrg: params.jiraOrg,
    jiraIssueKey: params.jiraIssueKey
  })
}

export default function JiraIssueButton() {
  return <JiraIssueLauncher onStartSession={openCreateSessionPage} />
}
