import * as assert from "node:assert/strict"
import { test } from "node:test"

import { createPngDataUrlFromBase64 } from "./screenshot"

test("converts debugger screenshot payloads into PNG data URLs", () => {
  assert.equal(
    createPngDataUrlFromBase64("abc123"),
    "data:image/png;base64,abc123"
  )
})
