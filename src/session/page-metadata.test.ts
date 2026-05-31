import * as assert from "node:assert/strict"
import { test } from "node:test"

import { buildEnvironmentMetadata } from "./page-metadata"

test("builds POC-shaped environment metadata for Jira and telemetry", () => {
  const environment = buildEnvironmentMetadata({
    capturedAt: "2026-05-31T10:00:00.000Z",
    url: "https://example.com/checkout",
    title: "Checkout",
    referrer: "https://example.com/cart",
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
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
    maxTouchPoints: 0
  })

  assert.deepEqual(environment, {
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
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36"
  })
})
