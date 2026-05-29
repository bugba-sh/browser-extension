export interface FeedbackAnnotation {
  selector: string
  xPercent: number
  yPercent: number
  pageUrl: string
}

export type FeedbackItemStatus = "preview" | "saving" | "saved" | "failed"

export interface FeedbackItem {
  id: string
  sessionId: string
  status: FeedbackItemStatus
  summary: string
  annotation: FeedbackAnnotation
  createdAt: number
  issueKey?: string
  issueUrl?: string
}

export interface CreatePreviewFeedbackInput {
  sessionId: string
  summary: string
  annotation: FeedbackAnnotation
}

export function getPageScope(urlValue: string): string | null {
  try {
    const url = new URL(urlValue)
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return null
    }

    const normalizedPath = url.pathname.replace(/\/+$/, "") || "/"
    return `${url.origin}${normalizedPath}`
  } catch {
    return null
  }
}

export function isFeedbackVisibleOnPage(
  feedback: FeedbackItem,
  pageUrl: string
): boolean {
  return getPageScope(feedback.annotation.pageUrl) === getPageScope(pageUrl)
}
