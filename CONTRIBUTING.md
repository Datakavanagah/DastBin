# Contributing to Dastbin AI

Thanks for helping improve Dastbin AI. Bug reports, accessibility fixes, documentation improvements and focused feature contributions are all welcome.

## Before you start

For a substantial feature, open an issue first so the approach and scope can be discussed. For a small bug or documentation fix, feel free to open a pull request directly.

## Local setup

1. Install Node.js 22.13 or newer.
2. Fork and clone the repository.
3. Run `npm ci`.
4. Run `npm run dev` and open `http://localhost:3000`.

Camera access works on localhost. Test gesture-related changes with at least two lighting conditions and, when practical, both left and right hands.

## Quality checks

Before submitting a pull request, run:

```bash
npm run check
npm run build
```

Keep pull requests focused. Explain the user-visible behavior, include screenshots for UI changes, and describe how you tested camera or model changes.

## Privacy expectations

Do not add remote image upload, analytics, telemetry or third-party tracking without an explicit design discussion. New persistence must be documented, minimal, and local by default.

Never commit camera captures, personal datasets, credentials or environment files.

## Commit style

Use short, imperative commit messages, for example:

- `Improve low-light hand feedback`
- `Document custom gesture training`
- `Fix duplicate history entries`

By contributing, you agree that your contribution is licensed under the project's MIT License.
