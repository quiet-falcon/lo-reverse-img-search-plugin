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
| Google Lens | Passed | Not run |
| Yandex | Passed | Not run |
| Bing | Passed | Not run |
| TinEye | Passed | Not run |
| SauceNAO | Passed | Not run |
| IQDB | Passed | Not run |
| trace.moe | Failed | Passed |
| ImgOps | Passed | Not run |

Tested with alpha3 on 2026-11-06, using a signed attachment image. trace.moe now starts on the original link.

### Other alpha3 results

| Check | Result |
| --- | --- |
| Row only on image messages, no duplicates, Discord rows intact | Passed |
| Picker for several images | Passed |
| PNG uploaded from the phone, through Lens | Passed |
| Video message shows no row | Passed |
| Plugin off removes the row | Passed |
| Spoiler image | Passed: preview stayed hidden until tapped, and search worked |
| Link preview | Passed with a direct link. A Google search page link has no image to search |
| Viewer button | Failed on alpha4: button slot found, icon lookup failed. Fixed in alpha5, device test pending |

Alpha4 confirmed trace.moe works on the original link without the switch.
