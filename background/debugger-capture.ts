import {
  createBugBashTimelineEvent,
  TELEMETRY_LIMITS,
  type CaptureStatus,
  type TelemetryTimelineEvent
} from "~src/session/telemetry"
import {
  normalizeDebuggerEvent,
  type DebuggerEventPayload,
  type PendingNetworkRequest
} from "~src/session/telemetry-normalization"

interface TabCaptureState {
  tabId: number
  target: chrome.debugger.Debuggee
  status: CaptureStatus
  events: TelemetryTimelineEvent[]
  pendingRequests: Map<string, PendingNetworkRequest>
}

const DEBUGGER_VERSION = "1.3"
const captureByTabId = new Map<number, TabCaptureState>()

function now(): string {
  return new Date().toISOString()
}

function getTarget(tabId: number): chrome.debugger.Debuggee {
  return { tabId }
}

function pushEvent(
  state: TabCaptureState,
  event: TelemetryTimelineEvent
): void {
  state.events.push(event)
  if (state.events.length > TELEMETRY_LIMITS.maxTimelineEvents) {
    state.events.splice(
      0,
      state.events.length - TELEMETRY_LIMITS.maxTimelineEvents
    )
  }
}

async function sendCommand(
  target: chrome.debugger.Debuggee,
  command: string,
  params?: Record<string, unknown>
): Promise<void> {
  await chrome.debugger.sendCommand(target, command, params)
}

export async function startTabCapture(tabId: number): Promise<CaptureStatus> {
  const existing = captureByTabId.get(tabId)
  if (
    existing?.status.kind === "active" ||
    existing?.status.kind === "attaching"
  ) {
    return existing.status
  }

  const target = getTarget(tabId)
  const status: CaptureStatus = {
    kind: "attaching",
    tabId,
    updatedAt: now()
  }
  const state: TabCaptureState = existing ?? {
    tabId,
    target,
    status,
    events: [],
    pendingRequests: new Map()
  }

  state.target = target
  state.status = status
  state.pendingRequests.clear()

  captureByTabId.set(tabId, state)

  try {
    await chrome.debugger.attach(target, DEBUGGER_VERSION)
    await sendCommand(target, "Network.enable")
    await sendCommand(target, "Runtime.enable")
    await sendCommand(target, "Log.enable")

    state.status = {
      kind: "active",
      tabId,
      startedAt: now(),
      updatedAt: now()
    }
    pushEvent(
      state,
      createBugBashTimelineEvent("info", "Debugger capture started")
    )
    return state.status
  } catch (error) {
    state.status = {
      kind: "unavailable",
      tabId,
      updatedAt: now(),
      error: String((error as Error)?.message ?? error)
    }
    pushEvent(
      state,
      createBugBashTimelineEvent(
        "warn",
        `Debugger capture unavailable: ${state.status.error}`
      )
    )
    return state.status
  }
}

export async function stopTabCapture(tabId: number): Promise<void> {
  const state = captureByTabId.get(tabId)
  if (!state) {
    return
  }

  if (
    state.status.kind !== "active" &&
    state.status.kind !== "attaching" &&
    state.status.kind !== "detaching"
  ) {
    captureByTabId.delete(tabId)
    return
  }

  state.status = {
    ...state.status,
    kind: "detaching",
    updatedAt: now()
  }

  try {
    await chrome.debugger.detach(state.target)
  } catch (error) {
    state.status = {
      kind: "error",
      tabId,
      updatedAt: now(),
      error: String((error as Error)?.message ?? error)
    }
    return
  }

  captureByTabId.delete(tabId)
}

export function getTabCaptureStatus(tabId?: number): CaptureStatus {
  if (typeof tabId !== "number") {
    return {
      kind: "inactive",
      updatedAt: now()
    }
  }

  return (
    captureByTabId.get(tabId)?.status ?? {
      kind: "inactive",
      tabId,
      updatedAt: now()
    }
  )
}

export function snapshotTabCapture(tabId: number): {
  startedAt: string
  endedAt: string
  events: TelemetryTimelineEvent[]
  warnings: string[]
} {
  const state = captureByTabId.get(tabId)
  if (!state) {
    return {
      startedAt: now(),
      endedAt: now(),
      events: [
        createBugBashTimelineEvent("warn", "No debugger capture was available")
      ],
      warnings: ["No debugger capture was available for this tab."]
    }
  }

  const warnings =
    state.status.kind === "active"
      ? []
      : [state.status.error ?? `Capture status was ${state.status.kind}.`]

  return {
    startedAt: state.status.startedAt ?? now(),
    endedAt: now(),
    events: state.events.slice(),
    warnings
  }
}

export function handleDebuggerEvent(
  source: chrome.debugger.Debuggee,
  method: string,
  params?: object
): void {
  if (typeof source.tabId !== "number") {
    return
  }

  const state = captureByTabId.get(source.tabId)
  if (!state || state.status.kind !== "active") {
    return
  }

  const event = normalizeDebuggerEvent(
    {
      method,
      params: params as Record<string, unknown>
    } satisfies DebuggerEventPayload,
    state.pendingRequests
  )

  if (event) {
    pushEvent(state, event)
  }
}

export function handleDebuggerDetach(
  source: chrome.debugger.Debuggee,
  reason: string
): void {
  if (typeof source.tabId !== "number") {
    return
  }

  const state = captureByTabId.get(source.tabId)
  if (!state) {
    return
  }

  state.status = {
    kind: "inactive",
    tabId: source.tabId,
    updatedAt: now(),
    error: reason
  }
  state.pendingRequests.clear()
  pushEvent(
    state,
    createBugBashTimelineEvent("warn", `Debugger capture detached: ${reason}`)
  )
}
