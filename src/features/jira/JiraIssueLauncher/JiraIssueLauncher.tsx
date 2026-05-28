import { useMemo } from "react"

import {
  hasJiraIssueContext,
  resolveJiraIssueContext
} from "~src/session/jira"

import styles from "./JiraIssueLauncher.module.css"

function getCreateSessionUrl(params: {
  jiraOrg: string
  jiraIssueKey: string
}): string {
  const url = new URL(chrome.runtime.getURL("tabs/create-session.html"))
  url.searchParams.set("jiraOrg", params.jiraOrg)
  url.searchParams.set("jiraIssueKey", params.jiraIssueKey)
  return url.toString()
}

export function JiraIssueLauncher() {
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
