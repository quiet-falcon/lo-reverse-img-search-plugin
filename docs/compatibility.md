# Compatibility

## Pinned upstream

Rechecked on 2026-11-06. All six pins in `CLAUDE.md` still match upstream `HEAD`.

## Device record

Fill this in from the probe report. Never paste signed URLs here.

| Field | Value |
| --- | --- |
| Commit | Pending |
| ZIP SHA-256 | Pending |
| Device | Pending |
| Android SDK | Pending |
| Valenced version | Pending |
| Valenced build type | Pending |
| Discord version and build | Pending |

## Gates

| # | Question | Status | Evidence |
| --- | --- | --- | --- |
| 1 | GitHub owner that hides personal details | Passed | Sensei created `quiet-falcon` on 2026-11-06 |
| 2 | Device versions | Not run | Needs probe report |
| 3 | Pinned Git install and CLI peer | Passed | [Actions run 42139455426](https://github.com/quiet-falcon/lo-reverse-img-search-plugin/actions/runs/42139455426): frozen install passed, `bun.lock` unchanged |
| 4 | Gradle packages with no token | Passed | Same run: production and probe ZIPs built with no secrets |
| 5 | `MediaModalOverlayHeader` exists | Not run | Needs probe report |
| 6 | `MediaShareActionSheet` exists | Not run | Needs probe report |
| 7 | Attachment, embed, and video fields | Not run | Needs probe report |
