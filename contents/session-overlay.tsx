import type { PlasmoCSConfig } from "plasmo"

import { SessionOverlay } from "~src/features/session/SessionOverlay"

export const config: PlasmoCSConfig = {
  matches: ["http://*/*", "https://*/*"],
  exclude_matches: ["https://*.atlassian.net/*"],
  all_frames: false
}

export default SessionOverlay
