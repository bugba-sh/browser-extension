import {
  cleanupGroupSession,
  handleRuntimeMessage,
  refreshActiveTabBadge
} from "~background/session-groups"
import type { RuntimeMessage } from "~src/session/types"

chrome.runtime.onMessage.addListener((message: RuntimeMessage, _sender, sendResponse) => {
  void handleRuntimeMessage(message).then(sendResponse)
  return true
})

chrome.tabs.onActivated.addListener(() => {
  void refreshActiveTabBadge()
})

chrome.tabs.onUpdated.addListener((_tabId, changeInfo) => {
  if (changeInfo.status === "complete") {
    void refreshActiveTabBadge()
  }
})

chrome.tabGroups.onRemoved.addListener((group) => {
  void cleanupGroupSession(group.id)
})

chrome.runtime.onInstalled.addListener(() => {
  void chrome.sidePanel.setOptions({
    path: "sidepanel.html",
    enabled: true
  })
})
