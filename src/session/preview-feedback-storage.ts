import type { CreatePreviewFeedbackInput, FeedbackItem } from "./feedback"

const PREVIEW_FEEDBACK_PREFIX = "bugbash.previewFeedback."

function getPreviewFeedbackKey(sessionId: string): string {
  return `${PREVIEW_FEEDBACK_PREFIX}${sessionId}`
}

function parseFeedbackItems(value: unknown): FeedbackItem[] {
  return Array.isArray(value) ? (value as FeedbackItem[]) : []
}

function createPreviewFeedbackId(): string {
  return `preview-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

export async function listPreviewFeedback(
  sessionId: string
): Promise<FeedbackItem[]> {
  const key = getPreviewFeedbackKey(sessionId)
  const value = await chrome.storage.session.get(key)
  return parseFeedbackItems(value[key])
}

export async function createPreviewFeedback(
  input: CreatePreviewFeedbackInput
): Promise<FeedbackItem> {
  const key = getPreviewFeedbackKey(input.sessionId)
  const currentFeedback = await listPreviewFeedback(input.sessionId)
  const feedback: FeedbackItem = {
    id: createPreviewFeedbackId(),
    sessionId: input.sessionId,
    status: "preview",
    summary: input.summary,
    annotation: input.annotation,
    createdAt: Date.now()
  }

  await chrome.storage.session.set({
    [key]: [...currentFeedback, feedback]
  })

  return feedback
}

export async function clearPreviewFeedback(sessionId: string): Promise<void> {
  await chrome.storage.session.remove(getPreviewFeedbackKey(sessionId))
}
