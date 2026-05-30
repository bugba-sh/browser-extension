import type { BrowserMetadata, PageMetadata } from "./telemetry"

function parseBrowserName(userAgent: string): { name: string; version: string } {
  const chromeMatch = userAgent.match(/Chrome\/([0-9.]+)/)
  if (chromeMatch) {
    return { name: "Chrome", version: chromeMatch[1] ?? "" }
  }

  return { name: "Unknown", version: "" }
}

function parseOs(userAgent: string): string {
  if (userAgent.includes("Mac OS X")) return "macOS"
  if (userAgent.includes("Windows NT")) return "Windows"
  if (userAgent.includes("Linux")) return "Linux"
  if (userAgent.includes("Android")) return "Android"
  if (userAgent.includes("iPhone") || userAgent.includes("iPad")) return "iOS"
  return "Unknown"
}

export function collectPageMetadata(): {
  page: PageMetadata
  browser: BrowserMetadata
} {
  const browser = parseBrowserName(navigator.userAgent)
  const locale =
    Intl.DateTimeFormat().resolvedOptions().locale || navigator.language || ""

  return {
    page: {
      url: window.location.href,
      title: document.title,
      referrer: document.referrer,
      viewport: {
        width: window.innerWidth,
        height: window.innerHeight
      },
      screen: {
        width: window.screen.width,
        height: window.screen.height,
        availableWidth: window.screen.availWidth,
        availableHeight: window.screen.availHeight,
        pixelDensity: window.devicePixelRatio || 1
      }
    },
    browser: {
      name: browser.name,
      version: browser.version,
      os: parseOs(navigator.userAgent),
      platform: navigator.platform || "",
      locale,
      language: navigator.language || "",
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "",
      userAgent: navigator.userAgent
    }
  }
}
