import { useEffect, useState } from "react"

import type { FeedbackItem } from "~src/session/feedback"
import type { BugBashJiraIssue } from "~src/session/jira-issues"
import { sendRuntimeMessage } from "~src/session/messages"
import type { CaptureStatus } from "~src/session/telemetry"
import type { ActionControlState } from "~src/session/types"

import styles from "./SessionPanel.module.css"

export function SessionPanel() {
  const [state, setState] = useState<ActionControlState | null>(null)
  const [feedbackItems, setFeedbackItems] = useState<FeedbackItem[]>([])
  const [jiraIssues, setJiraIssues] = useState<BugBashJiraIssue[]>([])
  const [selectedFeedbackId, setSelectedFeedbackId] = useState<string | null>(
    null
  )
  const [captureStatus, setCaptureStatus] = useState<CaptureStatus | null>(
    null
  )
  const [error, setError] = useState("")

  useEffect(() => {
    let cancelled = false

    async function loadState() {
      const response = await sendRuntimeMessage<ActionControlState>({
        type: "bugbash:get-action-control-state"
      })

      if (cancelled) {
        return
      }

      if (response.ok === false) {
        setError(response.error)
        setFeedbackItems([])
        setCaptureStatus(null)
      } else {
        setState(response.value)
        setError("")

        if (response.value.kind === "active-session") {
          const [
            feedbackResponse,
            jiraIssuesResponse,
            captureStatusResponse
          ] = await Promise.all([
            sendRuntimeMessage<FeedbackItem[]>({
              type: "bugbash:list-preview-feedback",
              sessionId: response.value.session.id
            }),
            sendRuntimeMessage<BugBashJiraIssue[]>({
              type: "bugbash:list-jira-issues",
              jiraOrg: response.value.session.jiraOrg,
              jiraIssueKey: response.value.session.jiraIssueKey
            }),
            sendRuntimeMessage<CaptureStatus>({
              type: "bugbash:get-capture-status"
            })
          ])

          if (!cancelled && feedbackResponse.ok) {
            setFeedbackItems(feedbackResponse.value)
          }
          if (!cancelled && jiraIssuesResponse.ok) {
            setJiraIssues(jiraIssuesResponse.value)
          }
          if (!cancelled && captureStatusResponse.ok) {
            setCaptureStatus(captureStatusResponse.value)
          }
        } else {
          setFeedbackItems([])
          setJiraIssues([])
          setSelectedFeedbackId(null)
          setCaptureStatus(null)
        }
      }
    }

    void loadState()
    const handleStorageChange = () => {
      void loadState()
    }
    chrome.storage.onChanged.addListener(handleStorageChange)

    return () => {
      cancelled = true
      chrome.storage.onChanged.removeListener(handleStorageChange)
    }
  }, [])

  const selectedFeedback =
    selectedFeedbackId === null
      ? null
      : feedbackItems.find((feedback) => feedback.id === selectedFeedbackId) ??
        null

  return (
    <main className={styles["bugbash--session-panel"]}>
      <h1 className={styles["bugbash--session-panel__title"]}>BugBash</h1>
      {error ? <p>{error}</p> : null}
      {!state ? (
        <p className={styles["bugbash--session-panel__muted"]}>
          Loading session...
        </p>
      ) : null}
      {state?.kind === "active-session" ? (
        <section className={styles["bugbash--session-panel__stack"]}>
          <strong>{state.session.jiraIssueKey}</strong>
          <span className={styles["bugbash--session-panel__muted"]}>
            {state.session.targetUrl}
          </span>
          {captureStatus ? (
            <div className={styles["bugbash--session-panel__capture-status"]}>
              <span>Capture: {captureStatus.kind}</span>
              {captureStatus.error ? <span>{captureStatus.error}</span> : null}
            </div>
          ) : null}
          {selectedFeedback ? (
            <section className={styles["bugbash--session-panel__stack"]}>
              <button
                className={styles["bugbash--session-panel__button"]}
                type="button"
                onClick={() => setSelectedFeedbackId(null)}>
                Back to feedback
              </button>
              <strong>{selectedFeedback.summary}</strong>
              {selectedFeedback.issueKey ? (
                <span>{selectedFeedback.issueKey}</span>
              ) : null}
              {selectedFeedback.issueUrl ? (
                <a
                  href={selectedFeedback.issueUrl}
                  target="_blank"
                  rel="noreferrer">
                  View in Jira
                </a>
              ) : null}
            </section>
          ) : (
            <>
              <div className={styles["bugbash--session-panel__meta"]}>
                {jiraIssues.length} Jira issue
                {jiraIssues.length === 1 ? "" : "s"}
              </div>
              {jiraIssues.length > 0 ? (
                <ul className={styles["bugbash--session-panel__jira-list"]}>
                  {jiraIssues.map((issue) => (
                    <li
                      className={styles["bugbash--session-panel__jira-item"]}
                      key={issue.id}>
                      <a
                        className={styles["bugbash--session-panel__jira-link"]}
                        href={issue.issueUrl}
                        target="_blank"
                        rel="noreferrer">
                        <span>{issue.summary}</span>
                        <span>{issue.issueKey}</span>
                        {issue.status ? <span>{issue.status}</span> : null}
                      </a>
                    </li>
                  ))}
                </ul>
              ) : null}
              {feedbackItems.length > 0 ? (
                <ul className={styles["bugbash--session-panel__feedback-list"]}>
                  {feedbackItems.map((feedback) => (
                    <li
                      className={
                        styles["bugbash--session-panel__feedback-item"]
                      }
                      key={feedback.id}>
                      <button
                        className={
                          styles["bugbash--session-panel__feedback-button"]
                        }
                        type="button"
                        onClick={() => setSelectedFeedbackId(feedback.id)}>
                        <span>{feedback.summary}</span>
                        {feedback.issueKey ? (
                          <span>{feedback.issueKey}</span>
                        ) : null}
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
              <button
                className={styles["bugbash--session-panel__button"]}
                onClick={() =>
                  sendRuntimeMessage({
                    type: "bugbash:end-session",
                    sessionId: state.session.id
                  })
                }
                type="button">
                End local session
              </button>
            </>
          )}
        </section>
      ) : null}
      {state?.kind === "no-active-session" ? (
        <section className={styles["bugbash--session-panel__stack"]}>
          <p className={styles["bugbash--session-panel__muted"]}>
            No active BugBash session.
          </p>
          <button
            className={styles["bugbash--session-panel__button"]}
            onClick={() =>
              sendRuntimeMessage({
                type: "bugbash:open-home"
              })
            }
            type="button">
            Start session
          </button>
          {state.recentSessions.map((session) => (
            <button
              className={styles["bugbash--session-panel__button"]}
              key={session.id}
              onClick={() =>
                sendRuntimeMessage({
                  type: "bugbash:resume-session",
                  sessionId: session.id
                })
              }
              type="button">
              Resume {session.title ?? session.jiraIssueKey}
            </button>
          ))}
        </section>
      ) : null}
    </main>
  )
}
