import {
  handleDebuggerDetach,
  handleDebuggerEvent,
  stopTabCapture
} from "~background/debugger-capture"
import {
  cleanupGroupSession,
  handleRuntimeMessage,
  reconcileTabCapture,
  refreshActiveTabBadge
} from "~background/session-groups"
import type { RuntimeMessage } from "~src/session/types"

chrome.runtime.onMessage.addListener(
  (message: RuntimeMessage, sender, sendResponse) => {
    void handleRuntimeMessage(message, sender).then(sendResponse)
    return true
  }
)

void chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true })

chrome.tabs.onActivated.addListener(() => {
  void refreshActiveTabBadge()
})

chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.groupId !== undefined) {
    void reconcileTabCapture(tabId)
  }

  if (changeInfo.status === "complete") {
    void refreshActiveTabBadge()
    void reconcileTabCapture(tabId)
  }
})

chrome.tabs.onRemoved.addListener((tabId) => {
  void stopTabCapture(tabId)
})

chrome.debugger.onEvent.addListener((source, method, params) => {
  handleDebuggerEvent(source, method, params)
})

chrome.debugger.onDetach.addListener((source, reason) => {
  handleDebuggerDetach(source, reason)
})

chrome.tabGroups.onRemoved.addListener((group) => {
  void cleanupGroupSession(group.id)
})

chrome.runtime.onInstalled.addListener(() => {
  void chrome.sidePanel.setOptions({
    path: "sidepanel.html",
    enabled: true
  })
  void chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true })
})
