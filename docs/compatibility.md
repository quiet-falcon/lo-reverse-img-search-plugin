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

## P3 gates

| # | Question | Status |
| --- | --- | --- |
| 15 | SauceNAO limits and keyless behaviour | Open. The key stays required |
| 16 | SauceNAO `hide` meaning | Open. The plugin sends `hide=0` and filters on `hidden` |
| 23 | Hand-built multipart upload works from the phone | Passed: SauceNAO returned results and quota |

## P3 results (alpha1)

Tested with `0.3.0-alpha1` (commit `f452b12`, dev build) on 2026-11-06.

| Check | Result |
| --- | --- |
| Key saved in settings, search button names both services | Passed |
| SauceNAO upload and parse | Passed: 7 SauceNAO matches on an anime frame, with live quota |
| Manga cover (*Let's Go Nirvana!*) | No confident match from either service. The upload worked, so this is index coverage, not a fault |
| Result opens its source page | Passed |
| Merged results, one best match, duplicates collapsed | Passed: trace.moe's 4 identical rows became 1 |
| Per-service status lines with quota | Passed |
| Rate limit | Passed: fifth quick search showed the limit message and did not retry |
| Remove key | Passed: button named trace.moe only |
| Artwork returns a confident SauceNAO match | Passed with alpha2: fan art from Konachan matched at 91.3%, with artist and site. The Danbooru source page opened, though the site was down for maintenance |

Untitled Twitter results showed "Twitter" as the title, and one site showed as "Anime*". alpha2 names them "<author> on <site>" and drops the asterisk.

alpha2 showed the same SauceNAO post twice, as two mirrors with different links. alpha3 also collapses rows that read identically.

**P3 passed on 2026-11-06.**

## Pre-P4 link checks

Run by Sensei on 2026-11-06 from his browser.

| # | Check | Result |
| --- | --- | --- |
| 24 | TinEye site honours `sort=crawl_date&order=asc` | Passed: results sorted oldest first |
| 25 | Wayback CDX returns the earliest capture | Passed: `example.com` returned `20020120142510`, which is 20 Jan 2002 |

## P4 device checks

Google Vision was skipped by Sensei on 2026-11-06, before any live call. Its checks wait until it returns.

| Check | Result |
| --- | --- |
| TinEye row opens sorted by oldest | Not run |
| Hand-off rows show their labels | Not run |
| No Vision setting or row appears | Not run |

Run these when Vision returns:

| Check | Result |
| --- | --- |
| Vision key saves, and the setup text shows cost | Not run |
| Search with Google Vision returns pages | Not run |
| Exact pages rank above similar images | Not run |
| Widely used image shows the right band, with "at least" counts | Not run |
| Fresh photo shows No copies found | Not run |
| What this means shows the limits | Not run |
| Show pages lists pages that open | Not run |
| Image with text shows Text in image | Not run |
| Bad key shows a clear message | Not run |
| Encoding a normal image doesn't visibly freeze the app | Not run |

## P5 device checks

Tested with `0.5.0-alpha1` (commit `2e6ad72`) on 2026-11-06, Discord 352.6 canary, Valenced 1.3.0, Android SDK 34. This was a dev build packaged by hand from that commit, SHA-256 `05835155b61f974e58c5fa568c283790640be56b769bd2fca85972af149542fb`, with no probe errors. Sensei reported every check below as done, except the webhook check.

| Check | Result |
| --- | --- |
| Check Profile row and account age | Passed |
| Avatar opens in TinEye, sorted oldest first | Passed |
| Banner for a user who has one | Passed |
| Webhook message shows no Check Profile row | Not run. `webhookId` is on the message record, and automated tests cover the skip |
| SD tag PNG after upload | Passed: tag survived |
| AI label JPEG after upload | Tag did not survive: No AI tags found |
| Tagless PNG | Passed: No AI tags found |
| SynthID row opens the checker | Passed |
| Signal icons | Passed: warning and profile icons seen |
| No Vision option in settings | Passed |

Gates closed by this run:

| # | Question | Status |
| --- | --- | --- |
| 26 | Which metadata survives Discord's upload? | Partly passed: PNG text survived and JPEG XMP did not, on one upload each |
| 30 | Author and user record fields | Passed: both hold `avatar`, `banner`, `globalName`, `bot`, and `discriminator` |

## P6 device checks

Tested with `0.6.0-alpha1` (commit `eca3f1f`) on 2026-11-06, Discord 352.6 canary, Valenced 1.3.0. This was a dev build packaged by hand from that commit, SHA-256 `931a3892a76407d0a8d42660c8d9408f07c7337768b6f7b274b2d06e96c06e16`.

| Check | Result |
| --- | --- |
| Save an image, and it appears in settings | Passed, reported by Sensei |
| Same image matches | Passed |
| Resized JPEG copy matches | Passed |
| Mirrored copy matches | Passed |
| Different image does not match | Passed |
| Plain image does not match | Passed. Its exact wording was not confirmed |
| Both pictures show side by side | Passed, screenshot |
| Saved avatar matches on Check Profile, 0 of 256 bits | Passed, screenshot |
| Hashing doesn't visibly freeze the app | Passed, reported by Sensei |
| List survives a reload, and an entry can be removed | Passed, reported by Sensei |

Gates closed by this run:

| # | Question | Status |
| --- | --- | --- |
| 28 | Is PDQ fast enough on the phone? | Passed |
| 31 | Does the media proxy return a PNG with `format=png`? | Passed: PNG and JPEG uploads both hashed |
