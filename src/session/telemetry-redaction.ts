import { TELEMETRY_LIMITS, type TelemetryTimelineEvent } from "./telemetry"

export interface RedactionContext {
  count: number
  categories: string[]
}

const SENSITIVE_HEADERS = new Map<string, string>([
  ["authorization", "authorization-header"],
  ["cookie", "cookie-header"],
  ["proxy-authorization", "proxy-authorization-header"],
  ["set-cookie", "set-cookie-header"],
  ["x-api-key", "x-api-key-header"],
  ["x-auth-token", "x-auth-token-header"]
])

const EMAIL_PATTERN = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi
const BEARER_PATTERN = /\bBearer\s+([A-Za-z0-9._~+/=-]{8,})\b/g
const JWT_PATTERN =
  /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/g
const SECRET_ASSIGNMENT_PATTERN =
  /\b(password|passwd|token|secret|api[_-]?key|access[_-]?token)=([^\s&]{6,})/gi
const LONG_SECRET_PATTERN = /\b[A-Za-z0-9+/=_-]{32,}\b/g

export function createEmptyRedactionContext(): RedactionContext {
  return {
    count: 0,
    categories: []
  }
}

function recordRedaction(context: RedactionContext, category: string): void {
  context.count += 1
  context.categories.push(category)
}

function isValidTimestamp(value: string): boolean {
  return !Number.isNaN(new Date(value).getTime())
}

function truncate(value: string, context: RedactionContext): string {
  if (value.length <= TELEMETRY_LIMITS.maxConsoleMessageLength) {
    return value
  }

  recordRedaction(context, "truncated")
  return `${value.slice(0, TELEMETRY_LIMITS.maxConsoleMessageLength)}...`
}

export function sanitizeUrlParts(urlValue: string): {
  origin: string
  path: string
  queryKeys: string[]
} {
  try {
    const url = new URL(urlValue)
    return {
      origin: url.origin,
      path: url.pathname || "/",
      queryKeys: Array.from(url.searchParams.keys()).slice(
        0,
        TELEMETRY_LIMITS.maxQueryKeys
      )
    }
  } catch {
    return {
      origin: "",
      path: String(urlValue || "").split("?")[0] || "",
      queryKeys: []
    }
  }
}

export function sanitizeHeaderNames(
  headerNames: string[],
  context: RedactionContext
): string[] {
  const safeNames: string[] = []

  for (const headerName of headerNames) {
    const normalized = headerName.trim().toLowerCase()
    if (!normalized) {
      continue
    }

    const category = SENSITIVE_HEADERS.get(normalized)
    if (category) {
      recordRedaction(context, category)
      continue
    }

    if (!safeNames.includes(normalized)) {
      safeNames.push(normalized)
    }

    if (safeNames.length >= TELEMETRY_LIMITS.maxHeaderNames) {
      break
    }
  }

  return safeNames
}

export function redactConsoleMessage(
  value: string,
  context: RedactionContext
): string {
  let output = value

  output = output.replace(EMAIL_PATTERN, () => {
    recordRedaction(context, "email")
    return "[redacted:email]"
  })

  output = output.replace(BEARER_PATTERN, () => {
    recordRedaction(context, "token")
    return "Bearer [redacted:token]"
  })

  output = output.replace(JWT_PATTERN, () => {
    recordRedaction(context, "token")
    return "[redacted:token]"
  })

  output = output.replace(SECRET_ASSIGNMENT_PATTERN, (_match, key) => {
    recordRedaction(context, "secret-assignment")
    return `${key}=[redacted:secret]`
  })

  output = output.replace(LONG_SECRET_PATTERN, (match) => {
    if (
      /^\d+$/.test(match) ||
      !/[A-Za-z]/.test(match) ||
      !/[0-9+/=_-]/.test(match)
    ) {
      return match
    }

    recordRedaction(context, "long-secret")
    return "[redacted:secret]"
  })

  return truncate(output, context)
}

function sanitizePath(path: string): string {
  return path.split("?")[0] || "/"
}

export function beforeSendTelemetryEvent(
  event: TelemetryTimelineEvent,
  context: RedactionContext
): TelemetryTimelineEvent | null {
  if (!isValidTimestamp(event.timestamp)) {
    return null
  }

  if (event.type === "network") {
    return {
      ...event,
      method: event.method.toUpperCase(),
      path: sanitizePath(event.path),
      queryKeys: event.queryKeys.slice(0, TELEMETRY_LIMITS.maxQueryKeys),
      requestHeaderNames: sanitizeHeaderNames(event.requestHeaderNames, context),
      ...(event.failureText
        ? { failureText: redactConsoleMessage(event.failureText, context) }
        : {})
    }
  }

  if (event.type === "console") {
    return {
      ...event,
      message: redactConsoleMessage(event.message, context)
    }
  }

  if (event.type === "exception") {
    return {
      ...event,
      message: redactConsoleMessage(event.message, context),
      ...(event.stack
        ? { stack: redactConsoleMessage(event.stack, context) }
        : {})
    }
  }

  if (event.type === "log" || event.type === "bugbash") {
    return {
      ...event,
      message: redactConsoleMessage(event.message, context)
    }
  }

  return null
}

export function sanitizeTimelineEvents(events: TelemetryTimelineEvent[]): {
  events: TelemetryTimelineEvent[]
  redactions: RedactionContext
} {
  const context = createEmptyRedactionContext()
  const sanitizedEvents = events
    .map((event) => beforeSendTelemetryEvent(event, context))
    .filter((event): event is TelemetryTimelineEvent => event !== null)

  return {
    events: sanitizedEvents,
    redactions: {
      count: context.count,
      categories: context.categories
    }
  }
}
