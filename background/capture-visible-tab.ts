export async function captureVisibleTabScreenshot(
  windowId?: number
): Promise<string> {
  return new Promise((resolve, reject) => {
    chrome.tabs.captureVisibleTab(windowId, { format: "png" }, (dataUrl) => {
      const lastError = chrome.runtime.lastError

      if (lastError) {
        reject(new Error(lastError.message))
        return
      }

      if (!dataUrl) {
        reject(new Error("Screenshot capture returned no data."))
        return
      }

      resolve(dataUrl)
    })
  })
}
