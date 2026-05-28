import { useMemo } from "react"

import { hasJiraIssueContext, resolveJiraIssueContext } from "~src/session/jira"
import type { JiraIssueContext } from "~src/session/types"

import styles from "./JiraIssueLauncher.module.css"

export interface JiraIssueLauncherProps {
  onStartSession: (params: JiraIssueContext) => void
}

export function JiraIssueLauncher({ onStartSession }: JiraIssueLauncherProps) {
  const jiraIssue = useMemo(
    () => resolveJiraIssueContext(window.location.href),
    []
  )
  const canStart = hasJiraIssueContext(jiraIssue)

  function handleClick() {
    if (!canStart) {
      return
    }

    onStartSession({
      jiraOrg: jiraIssue.jiraOrg,
      jiraIssueKey: jiraIssue.jiraIssueKey
    })
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
