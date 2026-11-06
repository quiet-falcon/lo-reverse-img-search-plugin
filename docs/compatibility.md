# Compatibility

## Pinned upstream

Rechecked on 2026-11-06. All six pins in `CLAUDE.md` still match upstream `HEAD`.

## Device record

Fill this in from the probe report. Never paste signed URLs here.

| Field | Value |
| --- | --- |
| Commit | `8449e52` |
| ZIP SHA-256 | `1ca07056616771d325ed2f270438841345de694436de0063f084cda99d2b980c` |
| Device | Motorola G40s |
| Android SDK | 34 |
| Valenced version | 1.3.0, commit `0f9c6d9` |
| Valenced build type | Production |
| Discord version and build | 352.6 (352206), canary |

## Gates

| # | Question | Status | Evidence |
| --- | --- | --- | --- |
| 1 | GitHub owner that hides personal details | Passed | Sensei created `quiet-falcon` on 2026-11-06 |
| 2 | Device versions | Passed | Two probe reports |
| 3 | Pinned Git install and CLI peer | Passed | [Actions run 42139455426](https://github.com/quiet-falcon/lo-reverse-img-search-plugin/actions/runs/42139455426): frozen install passed, `bun.lock` unchanged |
| 4 | Gradle packages with no token | Passed | Same run: production and probe ZIPs built with no secrets |
| 5 | `MediaModalOverlayHeader` exists | Passed | Plain function export, plugins off run |
| 6 | `MediaShareActionSheet` exists | Passed | Sheet key seen, plugins off run |
| 7 | Attachment, embed, and video fields | Partly passed | Attachment and embed captured. Video and stickers still open |

Alpha2 passed with plugins on: the viewer report had no errors, and switching the plugin off showed none. **P0 passed on 2026-11-06.**

## P1 hand-off results

Record pass or fail for each engine, on the default link and on the original link.

| Engine | Default link | Original link |
| --- | --- | --- |
| Google Lens | Not run | Not run |
| Yandex | Not run | Not run |
| Bing | Not run | Not run |
| TinEye | Not run | Not run |
| SauceNAO | Not run | Not run |
| IQDB | Not run | Not run |
| trace.moe | Not run | Not run |
| ImgOps | Not run | Not run |
