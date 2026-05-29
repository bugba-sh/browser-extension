import type { MutableRefObject } from "react"

import styles from "./PendingFeedbackDialog.module.css"

export interface PendingFeedbackDialogProps {
  innerRef: MutableRefObject<HTMLFormElement | null>
  summary: string
  error: string
  isSubmitting: boolean
  onSummaryChange: (value: string) => void
  onSubmit: () => void
  onCancel: () => void
}

export function PendingFeedbackDialog({
  innerRef,
  summary,
  error,
  isSubmitting,
  onSummaryChange,
  onSubmit,
  onCancel
}: PendingFeedbackDialogProps) {
  return (
    <form
      ref={innerRef}
      className={styles["bugbash--pending-feedback"]}
      data-bugbash-pending-feedback=""
      onSubmit={(event) => {
        event.preventDefault()
        onSubmit()
      }}>
      <label className={styles["bugbash--pending-feedback__label"]}>
        <span className={styles["bugbash--pending-feedback__label-text"]}>
          Feedback
        </span>
        <textarea
          className={styles["bugbash--pending-feedback__input"]}
          value={summary}
          rows={4}
          maxLength={255}
          autoFocus
          onChange={(event) => onSummaryChange(event.currentTarget.value)}
        />
      </label>
      <div className={styles["bugbash--pending-feedback__actions"]}>
        <button type="submit" disabled={!summary.trim() || isSubmitting}>
          {isSubmitting ? "Creating..." : "Create"}
        </button>
        <button type="button" disabled={isSubmitting} onClick={onCancel}>
          Cancel
        </button>
      </div>
      {error ? (
        <div className={styles["bugbash--pending-feedback__error"]}>
          {error}
        </div>
      ) : null}
    </form>
  )
}
