import type { FeedbackAnnotation } from "./feedback"

export const TELEMETRY_SCHEMA_VERSION = 1
export const TELEMETRY_ATTACHMENT_NAME = "bugbash-telemetry.json"
export const SCREENSHOT_ATTACHMENT_NAME = "bugbash-screenshot.png"

export const TELEMETRY_LIMITS = {
  maxTimelineEvents: 300,
  maxConsoleMessageLength: 1000,
  maxQueryKeys: 20,
  maxHeaderNames: 20
} as const

export type CaptureStatusKind =
  | "inactive"
  | "attaching"
  | "active"
  | "unavailable"
  | "detaching"
  | "error"

export interface CaptureStatus {
  kind: CaptureStatusKind
  tabId?: number
  startedAt?: string
  updatedAt: string
  error?: string
}

export interface PageMetadata {
  url: string
  title: string
  referrer: string
  viewport: {
    width: number
    height: number
  }
  screen: {
    width: number
    height: number
    availableWidth: number
    availableHeight: number
    pixelDensity: number
  }
}

export interface BrowserMetadata {
  name: string
  version: string
  os: string
  platform: string
  locale: string
  language: string
  timezone: string
  userAgent: string
}

export interface EnvironmentMetadata {
  capturedAt: string
  url: string
  title: string
  referrer: string
  browserName: string
  browserVersion: string
  osName: string
  osVersion: string
  device: string
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
  userAgent: string
}

export interface CaptureMetadata {
  id: string
  sessionId: string
  tabId: number
  startedAt: string
  endedAt: string
}

export interface TelemetryRedactions {
  count: number
  categories: string[]
}

export type TelemetryTimelineEvent =
  | {
      type: "network"
      timestamp: string
      method: string
      origin: string
      path: string
      queryKeys: string[]
      requestHeaderNames: string[]
      resourceType: string
      status?: number
      durationMs?: number
      failureText?: string
    }
  | {
      type: "console"
      timestamp: string
      level: "debug" | "info" | "log" | "warn" | "error"
      message: string
    }
  | {
      type: "exception"
      timestamp: string
      message: string
      stack?: string
    }
  | {
      type: "log"
      timestamp: string
      level: "verbose" | "info" | "warning" | "error"
      message: string
    }
  | {
      type: "bugbash"
      timestamp: string
      level: "info" | "warn" | "error"
      message: string
    }

export interface TelemetryArtifact {
  schemaVersion: typeof TELEMETRY_SCHEMA_VERSION
  capture: CaptureMetadata
  page: PageMetadata
  browser: BrowserMetadata
  environment: EnvironmentMetadata
  annotation: FeedbackAnnotation
  timeline: TelemetryTimelineEvent[]
  attachments: {
    screenshot?: {
      filename: typeof SCREENSHOT_ATTACHMENT_NAME
      contentType: "image/png"
    }
  }
  limits: typeof TELEMETRY_LIMITS
  redactions: TelemetryRedactions
  warnings: string[]
}

export interface BuildTelemetryArtifactInput {
  capture: CaptureMetadata
  page: PageMetadata
  browser: BrowserMetadata
  environment: EnvironmentMetadata
  annotation: FeedbackAnnotation
  timeline: TelemetryTimelineEvent[]
  redactions: TelemetryRedactions
  warnings: string[]
  hasScreenshot: boolean
}

export function createBugBashTimelineEvent(
  level: "info" | "warn" | "error",
  message: string,
  timestamp = new Date().toISOString()
): TelemetryTimelineEvent {
  return {
    type: "bugbash",
    timestamp,
    level,
    message
  }
}

export function buildTelemetryArtifact({
  capture,
  page,
  browser,
  environment,
  annotation,
  timeline,
  redactions,
  warnings,
  hasScreenshot
}: BuildTelemetryArtifactInput): TelemetryArtifact {
  return {
    schemaVersion: TELEMETRY_SCHEMA_VERSION,
    capture,
    page,
    browser,
    environment,
    annotation,
    timeline: timeline
      .slice()
      .sort(
        (left, right) =>
          new Date(left.timestamp).getTime() -
          new Date(right.timestamp).getTime()
      )
      .slice(-TELEMETRY_LIMITS.maxTimelineEvents),
    attachments: hasScreenshot
      ? {
          screenshot: {
            filename: SCREENSHOT_ATTACHMENT_NAME,
            contentType: "image/png"
          }
        }
      : {},
    limits: TELEMETRY_LIMITS,
    redactions,
    warnings
  }
}
