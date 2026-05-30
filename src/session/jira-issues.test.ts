import * as assert from "node:assert/strict"
import { test } from "node:test"

import {
  getActionBadgeTextForIssueCount,
  isJiraIssueCacheFresh,
  normalizeJiraIssueResponse
} from "./jira-issues"

test("normalizes Jira issue responses into BugBash issue summaries", () => {
  const issue = normalizeJiraIssueResponse("acme", {
    id: "10001",
    key: "APP-42",
    fields: {
      summary: "  Button is broken  ",
      status: {
        name: "To Do"
      }
    },
    properties: {
      bugbash_annotation: {
        selector: "#submit",
        xPercent: 25,
        yPercent: 75,
        pageUrl: "https://example.com/login"
      }
    }
  })

  assert.deepEqual(issue, {
    id: "10001",
    issueKey: "APP-42",
    issueUrl: "https://acme.atlassian.net/browse/APP-42",
    summary: "Button is broken",
    status: "To Do",
    annotation: {
      selector: "#submit",
      xPercent: 25,
      yPercent: 75,
      pageUrl: "https://example.com/login"
    }
  })
})

test("uses issue key as fallback summary and rejects invalid annotation data", () => {
  assert.equal(
    normalizeJiraIssueResponse("acme", {
      id: "10002",
      key: "APP-43",
      fields: {},
      properties: {
        bugbash_annotation: {
          selector: "#submit",
          xPercent: "25",
          yPercent: 75
        }
      }
    }),
    null
  )

  const issue = normalizeJiraIssueResponse("acme", {
    key: "APP-44",
    fields: {},
    properties: {
      bugbash_annotation: {
        selector: "#submit",
        xPercent: 25,
        yPercent: 75
      }
    }
  })

  assert.equal(issue?.id, "APP-44")
  assert.equal(issue?.summary, "APP-44")
})

test("treats cached Jira issues as fresh only inside the max age window", () => {
  assert.equal(
    isJiraIssueCacheFresh(
      {
        jiraOrg: "acme",
        jiraIssueKey: "APP-1",
        issues: [],
        updatedAt: 10_000
      },
      39_999
    ),
    true
  )

  assert.equal(
    isJiraIssueCacheFresh(
      {
        jiraOrg: "acme",
        jiraIssueKey: "APP-1",
        issues: [],
        updatedAt: 10_000
      },
      40_001
    ),
    false
  )
})

test("formats action badge issue counts for Chrome badge constraints", () => {
  assert.equal(getActionBadgeTextForIssueCount(0), "0")
  assert.equal(getActionBadgeTextForIssueCount(9), "9")
  assert.equal(getActionBadgeTextForIssueCount(100), "99+")
})
