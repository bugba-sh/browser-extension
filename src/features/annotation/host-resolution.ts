const VOID_TAGS = new Set([
  "area",
  "base",
  "br",
  "col",
  "embed",
  "hr",
  "img",
  "input",
  "link",
  "meta",
  "param",
  "source",
  "track",
  "wbr"
])

function isValidHostCandidate(element: HTMLElement): boolean {
  if (VOID_TAGS.has(element.tagName.toLowerCase())) {
    return false
  }

  return window.getComputedStyle(element).display !== "contents"
}

export function resolveTargetElement(selector: string): Element | null {
  try {
    return document.querySelector(selector)
  } catch {
    return null
  }
}

export function resolvePortalHost(target: Element | null): HTMLElement | null {
  if (!target) {
    return null
  }

  const initialTarget =
    target instanceof HTMLElement ? target : target.parentElement
  let current: Element | null = initialTarget
  let fallback: HTMLElement | null = initialTarget ?? null
  let positionedAncestorFallback: HTMLElement | null = null

  while (current) {
    if (current instanceof HTMLElement && isValidHostCandidate(current)) {
      // Prefer an ancestor positioning context above the clicked node so the
      // marker is less likely to be trapped under sibling paint layers.
      if (
        current !== initialTarget &&
        window.getComputedStyle(current).position !== "static"
      ) {
        return current
      }

      if (
        !positionedAncestorFallback &&
        window.getComputedStyle(current).position !== "static"
      ) {
        positionedAncestorFallback = current
      }

      if (!fallback) {
        fallback = current
      }
    }

    current = current.parentElement
  }

  return positionedAncestorFallback ?? fallback
}
