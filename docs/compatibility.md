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
| Viewer button | Passed on alpha5: button shows, opens the sheet over the viewer, and Lens works |

Alpha4 confirmed trace.moe works on the original link without the switch.

IQDB can queue for a long time under load. The page showed the image fetched in under a second, so the delay is on IQDB's side.

**P1 passed on 2026-11-06.**

## P2 results

Tested with `0.2.0-alpha2` (commit `890eae2`, dev build) on 2026-11-06, same device and versions as above.

| Check | Result |
| --- | --- |
| Anime frame, in-app trace.moe, no key | Passed: Exact match, 99.2%, title, episode, and time shown |
| Result opens AniList | Passed |
| Manga cover | Passed: no confident match, weaker guesses hidden, quota shown |
| Show weaker matches switch | Passed: possible matches shown with "likely wrong", adult result stays hidden |
| Cancel a search | Passed: no late result |
| Image older than a day, link refresh | Passed |
| PNG and GIF | Passed |
| Viewer button | Passed: probe shows `button added` |
| Over-limit file aborts before upload | Automated tests only. Device not run |
| Non-image rejected with a clear message | Automated tests only. Device not run |

Gates closed by these runs:

| # | Question | Status |
| --- | --- | --- |
| 12 | Binary XHR responses work | Passed: downloads reached the byte check |
| 13 | Raw `Uint8Array` XHR upload works | Passed: trace.moe returned results |
| 14 | Providers accept uploads from the phone's network | Passed for trace.moe, on 4G |
| 10 | `format=jpeg` on the media proxy | Not proven. Searches worked, but the plugin does not record which download step succeeded |
| 11 | Video still frames | Not run. Video stays out of search targets |

trace.moe often returns the same scene several times, a few seconds apart. P3's fusion step dedupes them.

**P2 passed on 2026-11-06.**
