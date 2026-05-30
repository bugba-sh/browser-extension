import * as assert from "node:assert/strict"
import { test } from "node:test"

import type { TelemetryTimelineEvent } from "./telemetry"
import {
  beforeSendTelemetryEvent,
  createEmptyRedactionContext,
  redactConsoleMessage,
  sanitizeHeaderNames,
  sanitizeUrlParts
} from "./telemetry-redaction"

test("strips query values and keeps only bounded query keys", () => {
  const result = sanitizeUrlParts(
    "https://api.example.com/search?token=secret&q=shoes&email=user@example.com"
  )

  assert.deepEqual(result, {
    origin: "https://api.example.com",
    path: "/search",
    queryKeys: ["token", "q", "email"]
  })
})

test("drops sensitive header names and deduplicates safe names", () => {
  const context = createEmptyRedactionContext()
  const result = sanitizeHeaderNames(
    [
      "Authorization",
      "Content-Type",
      "Cookie",
      "content-type",
      "X-Request-ID",
      "Set-Cookie",
      "X-Api-Key"
    ],
    context
  )

  assert.deepEqual(result, ["content-type", "x-request-id"])
  assert.equal(context.count, 4)
  assert.deepEqual(context.categories.sort(), [
    "authorization-header",
    "cookie-header",
    "set-cookie-header",
    "x-api-key-header"
  ])
})

test("redacts emails, bearer tokens, jwt-like values, assignments, and long secrets", () => {
  const context = createEmptyRedactionContext()
  const message = redactConsoleMessage(
    "user alice@example.com Authorization: Bearer abc.def.ghi password=supersecret token=1234567890abcdef1234567890abcdef",
    context
  )

  assert.equal(
    message,
    "user [redacted:email] Authorization: Bearer [redacted:token] password=[redacted:secret] token=[redacted:secret]"
  )
  assert.equal(context.count, 4)
  assert.deepEqual(context.categories.sort(), [
    "email",
    "secret-assignment",
    "secret-assignment",
    "token"
  ])
})

test("truncates oversized console messages", () => {
  const context = createEmptyRedactionContext()
  const message = redactConsoleMessage("x".repeat(1200), context)

  assert.equal(message.length, 1003)
  assert.equal(message.endsWith("..."), true)
  assert.equal(context.categories.includes("truncated"), true)
})

test("sanitizes network events through beforeSendTelemetryEvent", () => {
  const context = createEmptyRedactionContext()
  const event: TelemetryTimelineEvent = {
    type: "network",
    timestamp: "2026-05-30T12:00:00.000Z",
    method: "post",
    origin: "https://api.example.com",
    path: "/checkout?secret=value",
    queryKeys: ["secret"],
    requestHeaderNames: ["Authorization", "Content-Type"],
    resourceType: "fetch",
    status: 500,
    durationMs: 125,
    failureText: "Bearer abc.def.ghi failed"
  }

  assert.deepEqual(beforeSendTelemetryEvent(event, context), {
    type: "network",
    timestamp: "2026-05-30T12:00:00.000Z",
    method: "POST",
    origin: "https://api.example.com",
    path: "/checkout",
    queryKeys: ["secret"],
    requestHeaderNames: ["content-type"],
    resourceType: "fetch",
    status: 500,
    durationMs: 125,
    failureText: "Bearer [redacted:token] failed"
  })
})

test("drops invalid timeline events", () => {
  const context = createEmptyRedactionContext()

  assert.equal(
    beforeSendTelemetryEvent(
      {
        type: "network",
        timestamp: "not-a-date",
        method: "GET",
        origin: "https://example.com",
        path: "/",
        queryKeys: [],
        requestHeaderNames: [],
        resourceType: "fetch"
      },
      context
    ),
    null
  )
})
