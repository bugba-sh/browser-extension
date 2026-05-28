import { useEffect, useState } from "react"

import { sendRuntimeMessage } from "~src/session/messages"
import type { BugBashSession } from "~src/session/types"

import styles from "./SessionOverlay.module.css"

export function SessionOverlay() {
  const [session, setSession] = useState<BugBashSession | null>(null)

  useEffect(() => {
    let cancelled = false

    async function loadSession() {
      const response = await sendRuntimeMessage<BugBashSession | null>({
        type: "bugbash:get-tab-session"
      })

      if (!cancelled && response.ok) {
        setSession(response.value)
      }
    }

    void loadSession()

    return () => {
      cancelled = true
    }
  }, [])

  if (!session) {
    return null
  }

  return (
    <div className={styles["bugbash--session-overlay"]}>
      <span>BugBash</span>
      <span>{session.jiraIssueKey}</span>
    </div>
  )
}
