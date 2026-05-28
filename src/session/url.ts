export type NormalizedReviewUrl =
  | {
      ok: true
      url: string
    }
  | {
      ok: false
      error: string
    }

export function normalizeReviewUrl(value: string): NormalizedReviewUrl {
  const trimmedValue = value.trim()

  if (!trimmedValue) {
    return { ok: false, error: "Enter a URL to review." }
  }

  const candidate = /^[a-z][a-z\d+\-.]*:\/\//i.test(trimmedValue)
    ? trimmedValue
    : `https://${trimmedValue}`

  try {
    const url = new URL(candidate)

    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return { ok: false, error: "Use an http or https URL." }
    }

    return { ok: true, url: url.toString() }
  } catch {
    return { ok: false, error: "Enter a valid URL." }
  }
}
