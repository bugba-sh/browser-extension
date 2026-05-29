import annotationOverlayStyles from "data-text:~src/components/AnnotationOverlay/AnnotationOverlay.module.css"
import feedbackMarkerStyles from "data-text:~src/components/FeedbackMarker/FeedbackMarker.module.css"
import pendingFeedbackDialogStyles from "data-text:~src/components/PendingFeedbackDialog/PendingFeedbackDialog.module.css"
import sessionOverlayStyles from "data-text:~src/features/session/SessionOverlay/SessionOverlay.module.css"
import type {
  PlasmoCSConfig,
  PlasmoGetOverlayAnchor,
  PlasmoGetStyle
} from "plasmo"

import { SessionOverlay } from "~src/features/session/SessionOverlay"

export const config: PlasmoCSConfig = {
  matches: ["http://*/*", "https://*/*"],
  exclude_matches: ["https://*.atlassian.net/*"],
  all_frames: false
}

export const getOverlayAnchor: PlasmoGetOverlayAnchor = async () =>
  document.body

export const getStyle: PlasmoGetStyle = () => {
  const style = document.createElement("style")

  // Plasmo mounts this UI inside a shadow root, so inject component CSS there.
  style.textContent = [
    annotationOverlayStyles,
    feedbackMarkerStyles,
    pendingFeedbackDialogStyles,
    sessionOverlayStyles
  ].join("\n")

  return style
}

export default SessionOverlay
