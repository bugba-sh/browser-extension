import type { Point } from "~src/features/annotation"

import styles from "./FeedbackMarker.module.css"

export interface FeedbackMarkerProps {
  point: Point
}

export function FeedbackMarker({ point }: FeedbackMarkerProps) {
  return (
    <div
      className={styles["bugbash--feedback-marker"]}
      data-bugbash-feedback-marker=""
      style={{
        left: point.x,
        top: point.y
      }}
    />
  )
}
