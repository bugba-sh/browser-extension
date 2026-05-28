import type { RuntimeMessage, RuntimeResponse } from "./types"

export function sendRuntimeMessage<T>(
  message: RuntimeMessage
): Promise<RuntimeResponse<T>> {
  return chrome.runtime.sendMessage(message)
}
