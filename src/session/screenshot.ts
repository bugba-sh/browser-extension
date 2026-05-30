export interface ScreenshotMarker {
  clientX: number
  clientY: number
}

export interface CaptureAnnotatedScreenshotOptions {
  marker: ScreenshotMarker
  hiddenSelector?: string
  hiddenElements?: Array<HTMLElement | null | undefined>
  captureVisibleTab: () => Promise<string>
}

function waitForNextPaint(): Promise<void> {
  return new Promise((resolve) => {
    window.requestAnimationFrame(() => resolve())
  })
}

function hideMatchingElements(selector: string): () => void {
  const nodes = Array.from(document.querySelectorAll<HTMLElement>(selector))
  const previous = nodes.map((node) => ({
    node,
    visibility: node.style.visibility
  }))

  for (const item of previous) {
    item.node.style.visibility = "hidden"
  }

  return () => {
    for (const item of previous) {
      item.node.style.visibility = item.visibility
    }
  }
}

function hideElements(
  elements: Array<HTMLElement | null | undefined>
): () => void {
  const previous = elements
    .filter((element): element is HTMLElement => Boolean(element))
    .map((node) => ({
      node,
      visibility: node.style.visibility
    }))

  for (const item of previous) {
    item.node.style.visibility = "hidden"
  }

  return () => {
    for (const item of previous) {
      item.node.style.visibility = item.visibility
    }
  }
}

function loadImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error("Could not load screenshot image."))
    image.src = dataUrl
  })
}

async function drawMarker(
  dataUrl: string,
  marker: ScreenshotMarker
): Promise<string> {
  const image = await loadImage(dataUrl)
  const canvas = document.createElement("canvas")
  canvas.width = image.naturalWidth
  canvas.height = image.naturalHeight

  const context = canvas.getContext("2d")
  if (!context) {
    throw new Error("Could not create screenshot canvas.")
  }

  context.drawImage(image, 0, 0)

  const scaleX = image.naturalWidth / Math.max(window.innerWidth, 1)
  const scaleY = image.naturalHeight / Math.max(window.innerHeight, 1)
  const scale = Math.max((scaleX + scaleY) / 2, 1)
  const x = marker.clientX * scaleX
  const y = marker.clientY * scaleY

  context.beginPath()
  context.fillStyle = "rgba(255, 73, 156, 0.28)"
  context.arc(x, y, 18 * scale, 0, Math.PI * 2)
  context.fill()

  context.beginPath()
  context.fillStyle = "rgba(255, 73, 156, 0.92)"
  context.arc(x, y, 6 * scale, 0, Math.PI * 2)
  context.fill()

  context.beginPath()
  context.lineWidth = 2 * scale
  context.strokeStyle = "rgba(255, 73, 156, 0.98)"
  context.arc(x, y, 10 * scale, 0, Math.PI * 2)
  context.stroke()

  return canvas.toDataURL("image/png")
}

export async function captureAnnotatedScreenshot({
  marker,
  hiddenSelector,
  hiddenElements,
  captureVisibleTab
}: CaptureAnnotatedScreenshotOptions): Promise<string> {
  const restoreSelector = hiddenSelector
    ? hideMatchingElements(hiddenSelector)
    : () => {}
  const restoreElements = hideElements(hiddenElements ?? [])

  try {
    await waitForNextPaint()
    await waitForNextPaint()
    return drawMarker(await captureVisibleTab(), marker)
  } finally {
    restoreElements()
    restoreSelector()
  }
}
