import type { TelemetryTimelineEvent } from "./telemetry"
import { sanitizeUrlParts } from "./telemetry-redaction"

export interface DebuggerEventPayload {
  method: string
  params?: Record<string, unknown>
}

export interface PendingNetworkRequest {
  requestId: string
  timestamp: string
  method: string
  origin: string
  path: string
  queryKeys: string[]
  requestHeaderNames: string[]
  resourceType: string
}

export function normalizeTimestamp(value: unknown): string {
  if (typeof value === "number") {
    const milliseconds = value > 10_000_000_000 ? value : value * 1000
    return new Date(milliseconds).toISOString()
  }

  if (typeof value === "string") {
    const date = new Date(value)
    if (!Number.isNaN(date.getTime())) {
      return date.toISOString()
    }
  }

  return new Date().toISOString()
}

export function toSafeHeaderNames(headers: unknown): string[] {
  if (!headers || typeof headers !== "object") {
    return []
  }

  return Object.keys(headers as Record<string, unknown>).map((name) =>
    name.toLowerCase()
  )
}

function getString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback
}

function getNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value)
    ? value
    : undefined
}

function getRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : {}
}

function serializeConsoleArg(value: unknown): string {
  const arg = getRecord(value)
  const directValue = arg.value

  if (
    typeof directValue === "string" ||
    typeof directValue === "number" ||
    typeof directValue === "boolean"
  ) {
    return String(directValue)
  }

  return getString(arg.description, getString(arg.type, ""))
}

function normalizeConsoleLevel(
  value: string
): Extract<TelemetryTimelineEvent, { type: "console" }>["level"] {
  if (
    value === "debug" ||
    value === "info" ||
    value === "log" ||
    value === "warn" ||
    value === "error"
  ) {
    return value
  }

  return "log"
}

function normalizeNetworkRequestWillBeSent(
  params: Record<string, unknown>
): PendingNetworkRequest | null {
  const requestId = getString(params.requestId)
  const request = getRecord(params.request)
  const urlParts = sanitizeUrlParts(getString(request.url))

  if (!requestId) {
    return null
  }

  return {
    requestId,
    timestamp: normalizeTimestamp(params.timestamp),
    method: getString(request.method, "GET").toUpperCase(),
    origin: urlParts.origin,
    path: urlParts.path,
    queryKeys: urlParts.queryKeys,
    requestHeaderNames: toSafeHeaderNames(request.headers),
    resourceType: getString(params.type, "Other")
  }
}

export function normalizeDebuggerEvent(
  event: DebuggerEventPayload,
  pendingRequests = new Map<string, PendingNetworkRequest>()
): TelemetryTimelineEvent | null {
  const params = getRecord(event.params)

  if (event.method === "Network.requestWillBeSent") {
    const pending = normalizeNetworkRequestWillBeSent(params)
    if (pending) {
      pendingRequests.set(pending.requestId, pending)
    }
    return null
  }

  if (event.method === "Network.responseReceived") {
    const requestId = getString(params.requestId)
    const pending = pendingRequests.get(requestId)
    const response = getRecord(params.response)
    const urlParts = sanitizeUrlParts(getString(response.url))

    return {
      type: "network",
      timestamp: pending?.timestamp ?? normalizeTimestamp(params.timestamp),
      method: pending?.method ?? "GET",
      origin: pending?.origin || urlParts.origin,
      path: pending?.path || urlParts.path,
      queryKeys: pending?.queryKeys ?? urlParts.queryKeys,
      requestHeaderNames: pending?.requestHeaderNames ?? [],
      resourceType: getString(params.type, pending?.resourceType ?? "Other"),
      status: getNumber(response.status)
    }
  }

  if (event.method === "Network.loadingFinished") {
    pendingRequests.delete(getString(params.requestId))
    return null
  }

  if (event.method === "Network.loadingFailed") {
    const requestId = getString(params.requestId)
    const pending = pendingRequests.get(requestId)
    pendingRequests.delete(requestId)

    return {
      type: "network",
      timestamp: pending?.timestamp ?? normalizeTimestamp(params.timestamp),
      method: pending?.method ?? "GET",
      origin: pending?.origin ?? "",
      path: pending?.path ?? "",
      queryKeys: pending?.queryKeys ?? [],
      requestHeaderNames: pending?.requestHeaderNames ?? [],
      resourceType: getString(params.type, pending?.resourceType ?? "Other"),
      failureText: getString(params.errorText, "Network request failed")
    }
  }

  if (event.method === "Runtime.consoleAPICalled") {
    const args = Array.isArray(params.args) ? params.args : []
    return {
      type: "console",
      timestamp: normalizeTimestamp(params.timestamp),
      level: normalizeConsoleLevel(getString(params.type, "log")),
      message: args.map(serializeConsoleArg).filter(Boolean).join(" ")
    }
  }

  if (event.method === "Runtime.exceptionThrown") {
    const details = getRecord(params.exceptionDetails)
    const exception = getRecord(details.exception)
    return {
      type: "exception",
      timestamp: normalizeTimestamp(params.timestamp),
      message: getString(details.text, "Runtime exception"),
      ...(exception.description
        ? { stack: getString(exception.description) }
        : {})
    }
  }

  if (event.method === "Log.entryAdded") {
    const entry = getRecord(params.entry)
    const level = getString(entry.level, "info")
    return {
      type: "log",
      timestamp: normalizeTimestamp(entry.timestamp),
      level:
        level === "verbose" ||
        level === "info" ||
        level === "warning" ||
        level === "error"
          ? level
          : "info",
      message: getString(entry.text, "Log entry")
    }
  }

  return null
}
