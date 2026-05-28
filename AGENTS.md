# Local Agent Instructions

This repository is developed from a private parent workspace.

Before planning or implementing browser extension work, read the parent workspace
instructions at:

```text
../docs/browser-extension/AGENTS.md
```

Private planning docs may be available at:

```text
../docs/browser-extension/
```

When using Superpowers from this subdirectory, keep planning artifacts in the
private parent workspace:

```text
../docs/browser-extension/docs/superpowers/specs/
../docs/browser-extension/docs/superpowers/plans/
```

For new feature work, prefer this flow:

1. Start the chat from this `browser-extension` repository.
2. Read this file, then read the parent workspace instructions above.
3. Use Superpowers brainstorming and planning skills as needed.
4. Save specs and plans to the private parent paths listed above.
5. Implement and commit code changes only in this public repository.

Use those private docs as implementation guidance only. Do not copy private docs,
private planning notes, local absolute paths, credentials, personal details, or
workspace-specific metadata into this public repository.

UI code should stay headless by default. Create strict `bugbash--` BEM class
hooks and add short comments for intended roles, but avoid visual design CSS
such as colors, typography, borders, radius, shadows, or decorative styling.
Small structural layout declarations are acceptable when they make an extension
surface usable.
