import { useMemo } from "react"

import {
  hasJiraIssueContext,
  resolveJiraIssueContext
} from "~src/session/jira"
import type { JiraIssueContext } from "~src/session/types"

import styles from "./JiraIssueLauncher.module.css"

export interface JiraIssueLauncherProps {
  getCreateSessionUrl: (params: JiraIssueContext) => string
}

export function JiraIssueLauncher({
  getCreateSessionUrl
}: JiraIssueLauncherProps) {
  const jiraIssue = useMemo(
    () => resolveJiraIssueContext(window.location.href),
    []
  )
  const canStart = hasJiraIssueContext(jiraIssue)

  function handleClick() {
    if (!canStart) {
      return
    }

    window.open(
      getCreateSessionUrl({
        jiraOrg: jiraIssue.jiraOrg,
        jiraIssueKey: jiraIssue.jiraIssueKey
      }),
      "_blank",
      "noopener,noreferrer"
    )
  }

  return (
    <button
      className={styles["bugbash--jira-issue-launcher"]}
      disabled={!canStart}
      onClick={handleClick}
      type="button">
      {canStart ? "Start BugBash" : "BugBash unavailable"}
    </button>
  )
}
