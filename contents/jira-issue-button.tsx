import type { PlasmoCSConfig, PlasmoGetInlineAnchor } from "plasmo"

import { JiraIssueLauncher } from "~src/features/jira/JiraIssueLauncher"

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

export default JiraIssueLauncher
