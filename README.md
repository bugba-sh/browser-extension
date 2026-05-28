# BugBash Browser Extension

Chrome-first MV3 prototype for validating BugBash browser-native review sessions.

## V1 Runtime

- Start from an existing Jira issue.
- The extension injects a `Start BugBash` action into the Jira issue action area.
- The setup page asks for the review URL.
- The extension opens the review URL in a Chrome tab group.
- The side panel, badge, and overlay resolve state from the tab group session mapping.

## Development

```bash
pnpm install
pnpm dev
```

Load the Chrome MV3 dev build from `build/chrome-mv3-dev`.

## Verification

```bash
pnpm build
```

Manual checks:

- Open a Jira issue on `https://*.atlassian.net/*`.
- Confirm the BugBash button appears near the Jira issue action area.
- Click it and enter a review URL.
- Confirm the review URL opens inside a `BugBash <ISSUE-KEY>` Chrome tab group.
- Confirm the extension action opens the side panel.
- Confirm the side panel shows the active session inside the grouped tab.
- Confirm the overlay appears only inside grouped review tabs.
- Confirm tabs outside the group do not show the overlay.
- Confirm the side panel shows recent sessions outside an active session.
- Confirm the no-session start path opens `https://bugba.sh`.
