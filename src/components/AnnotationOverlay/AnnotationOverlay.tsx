import type { MouseEvent, MutableRefObject, WheelEvent } from "react"

import styles from "./AnnotationOverlay.module.css"

export interface AnnotationOverlayProps {
  innerRef: MutableRefObject<HTMLDivElement | null>
  onClick: (event: MouseEvent<HTMLDivElement>) => void
  onWheel: (event: WheelEvent<HTMLDivElement>) => void
  onMouseDown: (event: MouseEvent<HTMLDivElement>) => void
  onMouseUp: (event: MouseEvent<HTMLDivElement>) => void
}

export function AnnotationOverlay({
  innerRef,
  onClick,
  onWheel,
  onMouseDown,
  onMouseUp
}: AnnotationOverlayProps) {
  return (
    <div
      ref={innerRef}
      className={styles["bugbash--annotation-overlay"]}
      data-bugbash-annotation-overlay=""
      onClick={onClick}
      onWheel={onWheel}
      onMouseDown={onMouseDown}
      onMouseUp={onMouseUp}
    />
  )
}
