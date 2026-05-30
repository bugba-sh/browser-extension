import * as assert from "node:assert/strict"
import { test } from "node:test"

import {
  normalizeDebuggerEvent,
  normalizeTimestamp,
  toSafeHeaderNames
} from "./telemetry-normalization"

test("normalizes CDP timestamps to ISO strings", () => {
  assert.equal(
    normalizeTimestamp(1_717_070_400),
    "2024-05-30T12:00:00.000Z"
  )
})

test("extracts safe header names without values", () => {
  assert.deepEqual(
    toSafeHeaderNames({
      Authorization: "Bearer secret",
      "Content-Type": "application/json",
      Cookie: "sid=abc"
    }),
    ["authorization", "content-type", "cookie"]
  )
})

test("normalizes failed network loading events", () => {
  const event = normalizeDebuggerEvent({
    method: "Network.loadingFailed",
    params: {
      requestId: "abc",
      timestamp: 1_717_070_400,
      type: "Fetch",
      errorText: "net::ERR_FAILED"
    }
  })

  assert.deepEqual(event, {
    type: "network",
    timestamp: "2024-05-30T12:00:00.000Z",
    method: "GET",
    origin: "",
    path: "",
    queryKeys: [],
    requestHeaderNames: [],
    resourceType: "Fetch",
    failureText: "net::ERR_FAILED"
  })
})

test("normalizes console API events and serializes arguments without raw objects", () => {
  const event = normalizeDebuggerEvent({
    method: "Runtime.consoleAPICalled",
    params: {
      timestamp: 1_717_070_400_000,
      type: "error",
      args: [
        { type: "string", value: "failed" },
        { type: "object", description: "Object" }
      ]
    }
  })

  assert.deepEqual(event, {
    type: "console",
    timestamp: "2024-05-30T12:00:00.000Z",
    level: "error",
    message: "failed Object"
  })
})

test("normalizes exception events", () => {
  const event = normalizeDebuggerEvent({
    method: "Runtime.exceptionThrown",
    params: {
      timestamp: 1_717_070_400_000,
      exceptionDetails: {
        text: "Uncaught",
        exception: {
          description: "Error: boom\n    at app.js:1:1"
        }
      }
    }
  })

  assert.deepEqual(event, {
    type: "exception",
    timestamp: "2024-05-30T12:00:00.000Z",
    message: "Uncaught",
    stack: "Error: boom\n    at app.js:1:1"
  })
})
