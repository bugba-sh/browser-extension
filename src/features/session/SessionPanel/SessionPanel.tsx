import { useEffect, useState } from "react"

import { sendRuntimeMessage } from "~src/session/messages"
import type { ActionControlState } from "~src/session/types"

import styles from "./SessionPanel.module.css"

export function SessionPanel() {
  const [state, setState] = useState<ActionControlState | null>(null)
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
      } else {
        setState(response.value)
      }
    }

    void loadState()

    return () => {
      cancelled = true
    }
  }, [])

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
