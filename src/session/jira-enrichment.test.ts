import * as assert from "node:assert/strict"
import { test } from "node:test"

import {
  buildDescriptionDocument,
  buildEnvironmentRows
} from "./jira-enrichment"
import type { EnvironmentMetadata } from "./telemetry"

const environment: EnvironmentMetadata = {
  capturedAt: "2026-05-31T10:00:00.000Z",
  url: "https://example.com/checkout",
  title: "Checkout",
  referrer: "https://example.com/cart",
  browserName: "Chrome",
  browserVersion: "125.0.0.0",
  osName: "macOS",
  osVersion: "10.15.7",
  device: "desktop",
  platform: "MacIntel",
  viewportWidth: 1440,
  viewportHeight: 900,
  screenWidth: 1728,
  screenHeight: 1117,
  availScreenWidth: 1728,
  availScreenHeight: 1079,
  pixelDensity: 2,
  locale: "en-IE",
  language: "en-IE",
  timezone: "Europe/Dublin",
  userAgent: "Chrome test user agent"
}

test("builds POC environment rows for Jira", () => {
  assert.deepEqual(buildEnvironmentRows(environment), [
    ["URL", "https://example.com/checkout"],
    ["Title", "Checkout"],
    ["Captured At", "2026-05-31T10:00:00.000Z"],
    ["Browser", "Chrome 125.0.0.0"],
    ["OS", "macOS 10.15.7"],
    ["Device", "desktop"],
    ["Platform", "MacIntel"],
    ["Viewport", "1440x900"],
    ["Screen", "1728x1117"],
    ["Available Screen", "1728x1079"],
    ["Pixel Density", "2"],
    ["Locale", "en-IE"],
    ["Language", "en-IE"],
    ["Timezone", "Europe/Dublin"],
    ["Referrer", "https://example.com/cart"],
    ["User Agent", "Chrome test user agent"]
  ])
})

test("includes an environment table in the Jira description", () => {
  const document = buildDescriptionDocument({
    telemetryEvents: 12,
    screenshotAttached: true,
    environment
  })

  assert.equal(document.type, "doc")
  assert.equal(document.content.at(-1)?.type, "table")
})
