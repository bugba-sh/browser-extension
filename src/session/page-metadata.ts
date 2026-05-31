import type {
  BrowserMetadata,
  EnvironmentMetadata,
  PageMetadata
} from "./telemetry"

export interface BuildEnvironmentMetadataInput {
  capturedAt: string
  url: string
  title: string
  referrer: string
  userAgent: string
  platform: string
  viewportWidth: number
  viewportHeight: number
  screenWidth: number
  screenHeight: number
  availScreenWidth: number
  availScreenHeight: number
  pixelDensity: number
  locale: string
  language: string
  timezone: string
  maxTouchPoints: number
}

function parseBrowserName(userAgent: string): {
  name: string
  version: string
} {
  const edgeMatch = userAgent.match(/Edg\/([0-9.]+)/)
  if (edgeMatch) {
    return { name: "Edge", version: edgeMatch[1] ?? "" }
  }

  const chromeMatch = userAgent.match(/Chrome\/([0-9.]+)/)
  if (chromeMatch) {
    return { name: "Chrome", version: chromeMatch[1] ?? "" }
  }

  const firefoxMatch = userAgent.match(/Firefox\/([0-9.]+)/)
  if (firefoxMatch) {
    return { name: "Firefox", version: firefoxMatch[1] ?? "" }
  }

  const safariMatch = userAgent.match(/Version\/([0-9.]+).*Safari\//)
  if (safariMatch) {
    return { name: "Safari", version: safariMatch[1] ?? "" }
  }

  return { name: "Unknown", version: "" }
}

function parseOs(userAgent: string): { name: string; version: string } {
  const macMatch = userAgent.match(/Mac OS X ([0-9_]+)/)
  if (macMatch) {
    return {
      name: "macOS",
      version: (macMatch[1] ?? "").replace(/_/g, ".")
    }
  }

  const windowsMatch = userAgent.match(/Windows NT ([0-9.]+)/)
  if (windowsMatch) {
    return { name: "Windows", version: windowsMatch[1] ?? "" }
  }

  const androidMatch = userAgent.match(/Android ([0-9.]+)/)
  if (androidMatch) {
    return { name: "Android", version: androidMatch[1] ?? "" }
  }

  const iosMatch = userAgent.match(/OS ([0-9_]+) like Mac OS X/)
  if (/iPhone|iPad|iPod/.test(userAgent) && iosMatch) {
    return { name: "iOS", version: (iosMatch[1] ?? "").replace(/_/g, ".") }
  }

  if (userAgent.includes("Linux")) {
    return { name: "Linux", version: "" }
  }

  return { name: "Unknown", version: "" }
}

function getDeviceLabel({
  maxTouchPoints,
  screenWidth,
  screenHeight,
  userAgent
}: Pick<
  BuildEnvironmentMetadataInput,
  "maxTouchPoints" | "screenWidth" | "screenHeight" | "userAgent"
>): string {
  if (/iPhone|Android.*Mobile/.test(userAgent)) {
    return "mobile"
  }

  const smallestScreenDimension = Math.min(screenWidth || 0, screenHeight || 0)

  if (
    /iPad/.test(userAgent) ||
    (maxTouchPoints > 0 && smallestScreenDimension >= 600)
  ) {
    return "tablet"
  }

  if (maxTouchPoints > 0 && smallestScreenDimension < 600) {
    return "mobile"
  }

  return "desktop"
}

export function buildEnvironmentMetadata(
  input: BuildEnvironmentMetadataInput
): EnvironmentMetadata {
  const browser = parseBrowserName(input.userAgent)
  const os = parseOs(input.userAgent)

  return {
    capturedAt: input.capturedAt,
    url: input.url,
    title: input.title,
    referrer: input.referrer,
    browserName: browser.name,
    browserVersion: browser.version,
    osName: os.name,
    osVersion: os.version,
    device: getDeviceLabel(input),
    platform: input.platform,
    viewportWidth: input.viewportWidth,
    viewportHeight: input.viewportHeight,
    screenWidth: input.screenWidth,
    screenHeight: input.screenHeight,
    availScreenWidth: input.availScreenWidth,
    availScreenHeight: input.availScreenHeight,
    pixelDensity: input.pixelDensity,
    locale: input.locale,
    language: input.language,
    timezone: input.timezone,
    userAgent: input.userAgent
  }
}

export function collectPageMetadata(): {
  page: PageMetadata
  browser: BrowserMetadata
  environment: EnvironmentMetadata
} {
  const locale =
    Intl.DateTimeFormat().resolvedOptions().locale || navigator.language || ""
  const navigatorWithUserAgentData = navigator as Navigator & {
    userAgentData?: {
      platform?: string
    }
  }
  const environment = buildEnvironmentMetadata({
    capturedAt: new Date().toISOString(),
    url: window.location.href,
    title: document.title,
    referrer: document.referrer,
    userAgent: navigator.userAgent,
    platform:
      navigatorWithUserAgentData.userAgentData?.platform ||
      navigator.platform ||
      navigator.userAgent,
    viewportWidth: window.innerWidth,
    viewportHeight: window.innerHeight,
    screenWidth: window.screen.width,
    screenHeight: window.screen.height,
    availScreenWidth: window.screen.availWidth,
    availScreenHeight: window.screen.availHeight,
    pixelDensity: window.devicePixelRatio || 1,
    locale,
    language: navigator.language || "",
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "",
    maxTouchPoints: navigator.maxTouchPoints || 0
  })

  return {
    page: {
      url: environment.url,
      title: environment.title,
      referrer: environment.referrer,
      viewport: {
        width: environment.viewportWidth,
        height: environment.viewportHeight
      },
      screen: {
        width: environment.screenWidth,
        height: environment.screenHeight,
        availableWidth: environment.availScreenWidth,
        availableHeight: environment.availScreenHeight,
        pixelDensity: environment.pixelDensity
      }
    },
    browser: {
      name: environment.browserName,
      version: environment.browserVersion,
      os: environment.osName,
      platform: environment.platform,
      locale: environment.locale,
      language: environment.language,
      timezone: environment.timezone,
      userAgent: environment.userAgent
    },
    environment
  }
}
