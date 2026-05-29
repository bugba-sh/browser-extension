import { useEffect, useState } from "react"

import type { FeedbackItem } from "~src/session/feedback"
import { sendRuntimeMessage } from "~src/session/messages"
import type { ActionControlState } from "~src/session/types"

import styles from "./SessionPanel.module.css"

export function SessionPanel() {
  const [state, setState] = useState<ActionControlState | null>(null)
  const [feedbackItems, setFeedbackItems] = useState<FeedbackItem[]>([])
  const [selectedFeedbackId, setSelectedFeedbackId] = useState<string | null>(
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
      } else {
        setState(response.value)
        setError("")

        if (response.value.kind === "active-session") {
          const feedbackResponse = await sendRuntimeMessage<FeedbackItem[]>({
            type: "bugbash:list-preview-feedback",
            sessionId: response.value.session.id
          })

          if (!cancelled && feedbackResponse.ok) {
            setFeedbackItems(feedbackResponse.value)
          }
        } else {
          setFeedbackItems([])
          setSelectedFeedbackId(null)
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
                {feedbackItems.length} feedback item
                {feedbackItems.length === 1 ? "" : "s"}
              </div>
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
