import { type FormEvent, useMemo, useState } from "react"

import { sendRuntimeMessage } from "~src/session/messages"
import type { BugBashSession } from "~src/session/types"
import { normalizeReviewUrl } from "~src/session/url"

import styles from "./SessionCreatePage.module.css"

function getParam(name: string): string {
  return new URLSearchParams(window.location.search).get(name) ?? ""
}

export function SessionCreatePage() {
  const jiraOrg = useMemo(() => getParam("jiraOrg"), [])
  const jiraIssueKey = useMemo(() => getParam("jiraIssueKey"), [])
  const [targetUrl, setTargetUrl] = useState("")
  const [error, setError] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  const canSubmit = Boolean(jiraOrg && jiraIssueKey && !isSubmitting)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError("")

    const normalizedUrl = normalizeReviewUrl(targetUrl)
    if (!normalizedUrl.ok) {
      setError(normalizedUrl.error)
      return
    }

    if (!jiraOrg || !jiraIssueKey) {
      setError("Missing Jira issue context. Start BugBash from a Jira issue.")
      return
    }

    setIsSubmitting(true)
    const response = await sendRuntimeMessage<BugBashSession>({
      type: "bugbash:create-session",
      jiraOrg,
      jiraIssueKey,
      targetUrl: normalizedUrl.url
    })
    setIsSubmitting(false)

    if (!response.ok) {
      setError(response.error)
      return
    }

    window.close()
  }

  return (
    <main className={styles["bugbash--session-create"]}>
      <h1 className={styles["bugbash--session-create__heading"]}>
        Start BugBash
      </h1>
      <p className={styles["bugbash--session-create__meta"]}>
        {jiraIssueKey ? `Session for ${jiraIssueKey}` : "Missing Jira issue context"}
      </p>
      <form
        className={styles["bugbash--session-create__form"]}
        onSubmit={handleSubmit}>
        <label
          className={styles["bugbash--session-create__label"]}
          htmlFor="target-url">
          Review URL
        </label>
        <input
          id="target-url"
          className={styles["bugbash--session-create__input"]}
          value={targetUrl}
          onChange={(event) => setTargetUrl(event.currentTarget.value)}
          placeholder="https://example.com/page-to-review"
        />
        {error ? (
          <div className={styles["bugbash--session-create__error"]}>{error}</div>
        ) : null}
        <button
          className={styles["bugbash--session-create__button"]}
          disabled={!canSubmit}
          type="submit">
          {isSubmitting ? "Starting..." : "Start session"}
        </button>
      </form>
    </main>
  )
}
