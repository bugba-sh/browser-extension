import { useEffect, useState } from "react"

import { sendRuntimeMessage } from "~src/session/messages"
import {
  BUGBASH_WEB_URL,
  type ActionControlState,
  type RuntimeResponse
} from "~src/session/types"

import styles from "./SessionControlSurface.module.css"

export function SessionControlSurface() {
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

  async function runAction(action: Promise<RuntimeResponse>) {
    const response = await action
    if (response.ok === false) {
      setError(response.error)
    }
  }

  function openBugbashHome() {
    window.open(BUGBASH_WEB_URL, "_blank", "noopener,noreferrer")
  }

  return (
    <main className={styles["bugbash--session-control"]}>
      <h1 className={styles["bugbash--session-control__title"]}>BugBash</h1>
      {error ? <p>{error}</p> : null}
      {!state ? (
        <p className={styles["bugbash--session-control__muted"]}>Loading...</p>
      ) : null}

      {state?.kind === "active-session" ? (
        <section className={styles["bugbash--session-control__section"]}>
          <strong>{state.session.jiraIssueKey}</strong>
          <span className={styles["bugbash--session-control__muted"]}>
            {state.session.targetUrl}
          </span>
          <button
            className={`${styles["bugbash--session-control__button"]} ${styles["bugbash--session-control__button--primary"]}`}
            onClick={() =>
              runAction(sendRuntimeMessage({ type: "bugbash:open-side-panel" }))
            }
            type="button">
            Open session panel
          </button>
        </section>
      ) : null}

      {state?.kind === "no-active-session" ? (
        <section className={styles["bugbash--session-control__section"]}>
          <button
            className={`${styles["bugbash--session-control__button"]} ${styles["bugbash--session-control__button--primary"]}`}
            onClick={openBugbashHome}
            type="button">
            Start session
          </button>
          {state.recentSessions.length > 0 ? <strong>Recent sessions</strong> : null}
          {state.recentSessions.map((session) => (
            <button
              className={styles["bugbash--session-control__button"]}
              key={session.id}
              onClick={() =>
                runAction(
                  sendRuntimeMessage({
                    type: "bugbash:resume-session",
                    sessionId: session.id
                  })
                )
              }
              type="button">
              {session.title ?? session.jiraIssueKey}
            </button>
          ))}
        </section>
      ) : null}
    </main>
  )
}
