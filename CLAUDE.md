# CLAUDE.md: Reverse Image Search for Valenced

Baseline verified 2026-11-06. Valenced moves quickly, so re-verify anything you rely on before building on it.

Evidence labels used throughout:

- **[S]** Read in pinned source or official docs.
- **[C]** Seen in a community plugin. Not yet tested by this project.
- **[A]** Assumption. Must pass the named gate before anyone relies on it.

## 1. Purpose and chosen method

This repository builds a reverse image search (RIS) plugin for [Valenced](https://github.com/Valenced/valenced), the Discord mobile client mod. It is a new plugin, not a Revenge port. Never apply Vencord, Equicord, BetterDiscord, Vendetta, or Revenge plugin patterns here.

**Chosen method: a byte-first hybrid aggregator, JavaScript only.**

1. The user picks an image from a message or the media viewer.
2. The plugin refreshes the signed URL if needed, then asks Discord's media proxy for a normalised image.
3. It downloads that image with hard limits and checks its real type from its bytes.
4. It uploads the image directly to the API providers the user chose: trace.moe and SauceNAO.
5. It merges the answers into one native results sheet.
6. Lens, Yandex, Bing, TinEye, and others stay available as one-tap browser hand-offs.

**Why this method:**

- It removes the failure that ended the old plugin. Providers never need to fetch Discord's CDN for in-app results, so signed URLs and `application/octet-stream` stop mattering.
- It leaks less. A URL exposes channel, attachment, and filename details. An upload named `image.jpg` does not.
- It covers anime and art in the app, and browser hand-offs cover everything else. trace.moe handles anime frames, and SauceNAO handles art.
- It uses documented APIs for in-app results, so routine Discord or website changes are less likely to break it.
- It needs no server, no scraping, and no native build.

**What it finds:** where an image or its copies appear, plus signals about the image, the account, and its links. A photo already on the web can lead to a page that names whoever is in it, so never claim the plugin cannot reveal an identity.

**Main use cases:** finding the source of art, anime, and memes, checking whether a profile photo is copied from elsewhere, and spotting scam and fake profiles. Section 8 covers the copy check, and section 13 covers the profile check.

## 2. Hard rules

- Image uploads to outside services start from a user tap. Local checks and list updates can run on their own.
- The UI names every provider before any image leaves the device.
- Send the image only to providers selected for that search. Never add a provider as a silent fallback.
- API keys live in plugin settings only. Never hard-code, log, or commit them.
- Never read, request, or transmit the Discord token. Authenticated Discord calls go through the client's own `HTTP` module.
- Every patch, listener, timer, in-flight request, and open sheet is cleaned up on stop.
- Do not invent Valenced or Discord APIs. Unverified means labelled and gated.
- No face-recognition engines, such as PimEyes, FaceCheck.ID, or Search4Faces.
- No telemetry or analytics. Every network host is listed in `docs/privacy.md`.
- No self-bot behaviour.

## 3. Verified platform baseline

### Pinned sources

Reviewed on 2026-11-06, and all six still matched upstream `HEAD` when P0 started.

| Source | Commit | Notes |
| --- | --- | --- |
| [`Valenced/valenced`](https://github.com/Valenced/valenced/tree/0f9c6d9ffd75a8845b14f99274be5a7ad059921f) | `0f9c6d9ffd75a8845b14f99274be5a7ad059921f` | Bundle `1.3.0`, native API `1.0.0` |
| [`Valenced/valenced-types`](https://github.com/Valenced/valenced-types/tree/c67dd726d1ec28b38d8ac93862fdd3b6029b1d29) | `c67dd726d1ec28b38d8ac93862fdd3b6029b1d29` | Types `1.3.0` |
| [`Valenced/valenced-plugin-cli`](https://github.com/Valenced/valenced-plugin-cli/tree/9ea9f9bfc91319e2b18c6b1c9ac0b993f8600c1d) | `9ea9f9bfc91319e2b18c6b1c9ac0b993f8600c1d` | CLI `0.1.0`, needs Node 22.18+ or Bun |
| [`Valenced/valenced-plugin-template`](https://github.com/Valenced/valenced-plugin-template/tree/9a4f9187137a75d86fe552d0e594889a6e6fd7e5) | `9a4f9187137a75d86fe552d0e594889a6e6fd7e5` | Gradle 9.6.1, JDK 25 |
| [`Valenced/valenced-community-plugins`](https://github.com/Valenced/valenced-community-plugins/tree/ef8f4ff782033ade38aa555b751dfb8e2350ad31) | `ef8f4ff782033ade38aa555b751dfb8e2350ad31` | Current coding examples |
| [`Valenced/valenced-website`](https://github.com/Valenced/valenced-website/tree/6c60166df76d545ccf0d05f3b0bec635656d95a4/content/docs/plugin-development) | `6c60166df76d545ccf0d05f3b0bec635656d95a4` | Docs source for valenced.app |

### Constraints

- [S] Manifest `format` is `1`.
- [S] `valenced.api` range: `>=1 <2`.
- [S] Version ranges support `<`, `<=`, `=`, `>=`, `>`, and `*`. They do not support `^` or `~`.
- [S] Discord 352.2 and later rename most native classes and members with R8. A JS-only plugin avoids that risk.
- [S] `stop` has a 5-second teardown limit. Keep teardown synchronous.
- [S] A `before` hook must return the args array.
- [S] Finder results, including misses, are cached by filter key. Prefer `getModules` at start over `lookupModule` when a sheet opens.
- [S] If you change a filter with `keyAs()`, change its key too.
- [S] `discord` is a real dependency check against the host app, so a wrong range can block the plugin.
- [S] Tested target: Discord 352.6 canary on Valenced 1.3.0. The manifest uses `>=352.6`, matching the lower-bound style of community plugins.

Revalidate these pins when a phase starts. If upstream has moved, record old and new commits in `docs/compatibility.md`.

### Priority of evidence

1. Live Valenced source and docs.
2. `valenced-community-plugins`.
3. Other Valenced plugins and this project's context files.
4. Old Revenge plugins, for UX ideas only.
5. Memory or assumptions.

## 4. Repository layout

Target repository: `quiet-falcon/lo-reverse-img-search-plugin`. Make it public, because Pages hosts the plugin repository and the code is GPL-3.0.

The repository sits under the `quiet-falcon` organisation, so its URLs carry no personal details. Sensei's membership stays private. Commit with a `noreply` address, never a personal email.

```text
.
├── CLAUDE.md
├── README.md
├── LICENSE                         GPL-3.0, kept from the template
├── NOTICE.md                       Attribution for adapted code
├── package.json
├── bun.lock
├── biome.json
├── tsconfig.base.json
├── repo.config.json
├── build.gradle.kts
├── settings.gradle.kts
├── gradle/ gradlew gradlew.bat
├── docs/
│   ├── compatibility.md            Tested versions and evidence
│   ├── privacy.md                  What each provider receives
│   └── provider-contracts.md       Verified requests and sanitised samples
├── tests/
│   ├── tsconfig.json
│   ├── fixtures/                   Synthetic data only
│   └── *.test.ts
├── .github/
│   ├── scripts/                    From the template, plus check-zip.sh
│   └── workflows/
│       ├── validate.yml
│       ├── release.yml
│       └── publish-index.yml
└── plugins/
    └── reverse-image-search/
        ├── manifest.json
        ├── tsconfig.json
        └── js/
            ├── index.ts            Lifecycle wiring only
            ├── core/               Pure logic with no host imports
            ├── providers/          Request builders and response parsers
            ├── adapters/           All host and network access
            └── ui/                 React components
```

Keep source under `js/`. The template's Gradle inputs exclude `src/**`, so edits there can be missed.

## 5. Manifest and identity

**Permanent plugin ID: `lo-reverse-img-search-plugin`**

Never change it after the first release. Changing it makes a new plugin and loses user settings.

Folder `plugins/reverse-image-search` gives the Gradle task `packageReverseImageSearch`.

```json
{
	"format": 1,
	"id": "lo-reverse-img-search-plugin",
	"name": "Reverse Image Search",
	"description": "Search Discord images across multiple engines, with results inside the app.",
	"author": "LO",
	"icon": "ImageIcon",
	"version": "0.8.0-alpha2",
	"dependencies": {
		"valenced.api": { "version": ">=1 <2" },
		"discord": { "version": ">=352.6" }
	},
	"dist": { "script": "index.js" }
}
```

`plugins/reverse-image-search/tsconfig.json`:

```json
{ "extends": "../../tsconfig.base.json" }
```

## 6. Commands

### Bootstrap

Done in P0. Keep these rules when upgrading the template or pins:

- Import the template at a pinned commit, without its Git history.
- Keep `plugins/` free of samples, and keep `themes/` and `@valenced/themes-api` out.
- Keep Git dependencies pinned to full commits in `package.json`.
- Commit `bun.lock`.

The lockfile was generated from local clones of the pinned commits, so its two GitHub entries carry no tarball hash. The commits are pinned and installs stay stable. Bun may add the hashes the next time `bun.lock` is regenerated against GitHub, which is safe to commit after review.

The CLI's peer dependency on `@valenced/types` has no commit of its own. The lockfile holds it at the pinned commit.

### Everyday use

```sh
bun install --frozen-lockfile
bun run lint
bun run typecheck
bun run test
bun run build reverse-image-search
bun run build:dev reverse-image-search
./gradlew --no-daemon packageReverseImageSearch
./gradlew --no-daemon packageReverseImageSearch -Pdev
bun run verify
```

The installable output is `build/dist/lo-reverse-img-search-plugin@<version>.zip`.

Run the Gradle package step after `verify`. `bun run build` alone does not make an installable plugin.

Packaging empties `build/dist/`. Copy any candidate elsewhere before rebuilding.

### Local plugin repository

```sh
bun run serve -- --base-url http://127.0.0.1:8080
adb reverse tcp:8080 tcp:8080
```

Add `http://127.0.0.1:8080/index.json` in Valenced. Same-version rebuilds show as updates because Valenced also compares SHA-256.

### Toolchain status

P0 run on 2026-11-06:

| Step | Result |
| --- | --- |
| `bun run verify` | **Passed:** lint, type-check, 111 tests, build |
| Pinned install and `--frozen-lockfile` | **Passed** on GitHub Actions against real GitHub, and `bun.lock` did not change |
| Gradle packaging | **Passed** on GitHub Actions for production and probe ZIPs, with no token |
| Hand-built probe ZIP | **Passed** `generate-index`, with `manifest.json` and `index.js` at its root |
| Actions ZIP contents | **Passed:** `check-zip.sh` found only `manifest.json` and `index.js`. The probe's two files match the hand-built ZIP by SHA-256 |
| Device install | **Passed** on Valenced 1.3.0, production build, Discord 352.6 canary, Android SDK 34 |
| Device stop and viewer with plugins on | **Passed** with alpha2, no errors |

**P0 passed on 2026-11-06.**

### Where to build

- **GitHub Actions:** the main build path, and the only one needed when working from the phone. `validate.yml` uploads a probe ZIP and a production ZIP.
- **ThinkPad (WSL2):** optional local builds. Install Bun, JDK 25, and ADB.
- **Phone (Termux):** edit, commit, install ZIPs, and test. [A] JDK 25 and Bun are unverified there, so do not plan around packaging on the phone.

[S] JS-only plugins do not need the Android SDK or a GitHub Packages token. The first Actions run confirmed this. If a token is ever requested, find what triggered it before adding one.

## 7. Architecture

### Flow

```text
Long-press message ─┐
                    ├─> Target extraction ─> Search sheet ─> User taps Search
Media viewer button ┘                                             │
                                                                  v
                            Refresh signed URL if stale, using Discord's HTTP
                                                                  │
                                                                  v
                        Bounded download from media proxy, then byte sniffing
                                                                  │
                                                                  v
                                     Temporary file in Discord's cache
                                                                  │
                               ┌──────────────────┼──────────────────┐
                               v                  v                  v
                           trace.moe           SauceNAO         Cloud Vision
                               └──────────────────┼──────────────────┘
                                                  v
                             Normalise, dedupe, rank, then show results
                                                  │
                                                  v
                             Delete temporary file and clear signed URLs
```

Browser hand-off skips the upload path. It opens one provider with the encoded image URL, after showing what will be disclosed.

### Module boundaries

| Area | Files | May import | Must not import |
| --- | --- | --- | --- |
| Lifecycle | `js/index.ts` | Everything | Provider logic |
| Core | `js/core/*.ts` | Standard JS only | React, React Native, `@valenced/*` |
| Providers | `js/providers/*.ts` | Core types | React, React Native, `@valenced/*` |
| Adapters | `js/adapters/*` | Host APIs and core | UI state |
| UI | `js/ui/*` | React, Design, core types, adapter interfaces | `XMLHttpRequest`, provider URLs |

### Core modules

- `probe.ts`: Field-name capture and the device report. Remove with the probe once P1 no longer needs it.
- `types.ts`: `ImageTarget`, `ProviderResult`, `SearchSession`, and error categories.
- `target.ts`: Finds searchable images from messages and media sources.
- `signed-url.ts`: Host checks, expiry, proxy URL building, and hand-off encoding.
- `tree.ts`: Finds and edits nodes in React element trees.
- `sniff.ts`: Magic-byte detection for JPEG, PNG, GIF, WebP, and ISO BMFF formats.
- `limits.ts`: Size, time, and cache limits.
- `session.ts`: Search state machine with cancellation.
- `fusion.ts`: Tiering, dedupe, and ranking.
- `copy-check.ts`: Counts sites and sets the copy band from Vision's lists.
- `base64.ts`: Encodes image bytes for Vision.
- `features.ts`: Switches for parked features.
- `account-age.ts`: Reads an account's creation date from its ID.
- `profile.ts`: Reads a message author, then builds avatar and banner targets and signals.
- `signals.ts`: Signal type and wording.
- `image-tags.ts`: Finds AI tags in PNG, JPEG, and WebP metadata. It returns fixed labels only and never parses EXIF.
- `inflate.ts` and `pixels.ts`: Read PNGs with no outside package, and build small thumbnails.
- `pdq.ts`: PDQ hash, quality, flips, and distance. Tests match the reference tool exactly.
- `hash-list.ts`: The saved list, matching, and its signals.
- `community-list.ts`: Signed list parsing, matching, signals, and report links.
- `link-risk.ts`: Finds domains in a message, then checks them against the scam list and for lookalikes.
- `sha256.ts` and `ed25519.ts`: Verify the community list with no outside package. Tests check them against Node's crypto.
- `settings.ts`: Defaults, validation, and migration.
- `redact.ts`: Removes URLs, query strings, and keys from diagnostics.
- `acquire.ts`: Lists the download URLs to try, in order.
- `messages.ts`: User-facing state, error, and tier text.

### Provider interface

```ts
export interface ApiProvider {
	id: ProviderId
	name: string
	requiresKey: boolean
	maxBytes: number
	buildRequest(input: ProviderInput): ProviderRequest
	parseResponse(status: number, body: string): ProviderOutcome
}

export interface HandoffProvider {
	id: ProviderId
	name: string
	buildUrl(imageUrl: string): string
}
```

Providers build plain request data and parse plain text. Only `adapters/http.ts` touches the network.

### Adapters

- `probe.ts`: Dev-build observation of versions, entry points, and field names.
- `session.ts`: Holds the probe's in-memory state.
- `discord-modules.ts`: Finds `HTTP` and `Endpoints`, and exposes attachment URL refresh.
- `http.ts`: The only network path for downloads and provider calls.
- `cache-file.ts`: Temporary file writes and cleanup through `FileModule`. Only needed if a later provider requires multipart upload.
- `search.ts`: Runs one in-app search: refresh, bounded download, sniff, upload, parse.
- `message-sheet.tsx`: Adds the long-press row.
- `media-viewer.tsx`: Adds the viewer button.
- `external.ts`: Lists hand-offs and opens them. Keeps provider URLs out of the UI.
- `profile.ts`: Reads the author from Discord's stores, with every store guarded.
- `image-check.ts`: Downloads an original file from Discord and reads its tags.
- `hash-check.ts`: Downloads a small PNG from Discord and hashes it on the phone.
- `icons.ts`: Finds the search icon, with a fallback. [S] `lookupGeneratedIconComponent` treats extra arguments as one icon's asset names, so each fallback name needs its own call.

### Search states

`idle` → `resolving` → `ready` → `refreshing` → `downloading` → `searching` → `done`

Any active state can move to `failed` or `cancelled`. `done` can include partial provider failures.

Rules:

- One active search at a time.
- Each search has a generation token. Late callbacks from an old generation do nothing.
- Closing the sheet or stopping the plugin aborts active requests.
- Do not auto-retry uploads. Retrying means a new user tap.

### Entry points

| Priority | Entry point | Evidence | Plan |
| --- | --- | --- | --- |
| 1 | `LongPressMessageActionSheet` row | [S] [Message Logger](https://github.com/Valenced/valenced-community-plugins/blob/ef8f4ff782033ade38aa555b751dfb8e2350ad31/plugins/message-logger/js/actionsheet.tsx) | Primary |
| 2 | `MediaModalOverlayHeader` button | [S] Device-tested on 352.6, after [Pop Out Player, Discord 350.4](https://github.com/bleelblep/bleel-bazinga-repo/blob/b3dc168208e6de58027af420f5fbb4d730681ce5/plugins/pocket-browser/js/popout/viewerButton.tsx) | Add after P0 confirms it |
| 3 | `openLazy` key `MediaShareActionSheet` | [Old Revenge plugin](https://github.com/Angelix1/MP/blob/770b1f903b6f4d880d535beb27067552efd92cdf/vendetta/ris/index.jsx) | Use only if P0 finds it |

If one entry point fails, keep the others working. Never let a patch failure break Discord's own sheet.

### Image targets

- [S] Device report, Discord 352.6. Attachments: `id`, `url`, `proxy_url`, `filename`, `content_type`, `original_content_type` (not always present), `size`, `width`, `height`, `placeholder`.
- [S] Embeds: `type`, `url`, `image`, `thumbnail`, `video`. Embed images use camelCase: `url`, `proxyURL`, `contentType`, `width`, `height`, `srcIsAnimated`.
- [S] Viewer source: `uri`, `sourceURI`, `shareURI`, `attachmentId`, `messageId`, `channelId`, `guildId`, `contentType`, `filename`, `width`, `height`, `spoiler`, `obscure`, `mediaIndex`.
- [A, gate P1] Sticker and video shapes. The report did not sample them, so P1 leaves both out of search targets.

Show a picker when a message has more than one image. Spoilered images stay blurred until tapped. Videos use a single still frame.

## 8. Providers

### In-app providers

| Provider | Default | Key | Best for | Request | Evidence |
| --- | --- | --- | --- | --- | --- |
| trace.moe | On | None | Anime screenshots | `POST https://api.trace.moe/search?anilistInfo&cutBorders`, raw image bytes with the sniffed `Content-Type` | [S] [Docs](https://github.com/soruly/trace.moe-api/blob/1b64f4b8ceca8b9e3b4cbe7f6479603e61bff2b6/docs/docs.md), [limits](https://github.com/soruly/trace.moe-api/blob/1b64f4b8ceca8b9e3b4cbe7f6479603e61bff2b6/docs/limits.md) |
| SauceNAO | On when a key exists | Free | Art, manga, booru | `POST https://saucenao.com/search.php`, query `output_type=2`, `api_key`, `db=999`, `numres=8`, `hide`, multipart field `file` | [C] [PicImageSearch](https://github.com/kitUIN/PicImageSearch/blob/784713e546273a09aae4b247a8b6f798825efafa/PicImageSearch/engines/saucenao.py) |
| Cloud Vision Web Detection | Parked, hidden | Your own Google Cloud key | Photos, memes, screenshots, products | `POST https://vision.googleapis.com/v1/images:annotate`, header `x-goog-api-key`, features `WEB_DETECTION` and `TEXT_DETECTION`, base64 image | [Request and response](https://docs.cloud.google.com/vision/docs/detecting-web) [S], [key header](https://docs.cloud.google.com/docs/authentication/api-keys-use) [S], [pricing](https://cloud.google.com/vision/docs/pricing?hl=es) [S], [size limits](https://docs.cloud.google.com/vision/docs/supported-files) [S], live call [A, parked with Vision] |

**Google Vision is parked.** Sensei skipped it on 2026-11-06 because it needs a billing account and is probably weaker than Lens. Its code stays in the repo and in the tests, hidden by `VisionAvailable` in `core/features.ts`. No live call has been made. To bring it back, set that to `true`, then run the Vision checks in `docs/compatibility.md`.

Provider facts:

- [S] trace.moe free tier: 100 searches in a rolling 24 hours, concurrency 1, 25 MB maximum.
- [S] trace.moe returns HTTP 402 for quota or concurrency limits, 429 for rate limits, 413 for size, and 503 when its queue is full.
- [S] trace.moe says similarity below 90% is most likely wrong.
- [S] trace.moe's docs say mobile apps should send requests directly from clients.
- [S] trace.moe accepts a raw `image/*` request body, so it needs no temporary file or multipart form.
- [C] SauceNAO reports `short_remaining`, `long_remaining`, and `minimum_similarity` in its response header. Show those live values. Do not hard-code limits.
- [C] Secondary sources report 150 searches a day and 4 per 30 seconds for free keys. Device run on 2026-11-06: the fifth quick search was rate limited, and `long_remaining` read 94 then 92 after a few searches, which suggests 100 a day for this key. Keep showing the live value.
- [A, gate P3] Whether SauceNAO JSON works without a key. Until proven, API mode requires a key and hand-off still works.
- [S] Vision pricing: each feature on an image is one unit. Web Detection's first 1,000 units a month are free, then US$3.50 per 1,000. Text Detection's first 1,000 are free, then US$1.50 per 1,000.
- [S] Vision limits: 20 MB per image and 10 MB per JSON request.
- [S] The Vision API and billing must both be enabled on the Google Cloud project.
- [S] `pageTitle` can contain HTML tags, so strip them before showing it.
- [A, parked with Vision] Vision JSON requests work from the phone, and encoding a normal image doesn't visibly freeze the app.
- [S] Web Detection returns lists only: `fullMatchingImages`, `partialMatchingImages`, `pagesWithMatchingImages`, `visuallySimilarImages`, `webEntities`, and `bestGuessLabels`. It has no total-count field.

Research limit: no live provider call has been made yet, and SauceNAO's official API page could not be reached. Its contract above comes from a maintained client library. Confirm it before relying on it.

Keep verified requests and sanitised sample shapes in `docs/provider-contracts.md`.

### Browser hand-offs

URL templates are taken from [Vencord's plugin](https://github.com/Vendicated/Vencord/blob/383409e6a6ec9008ee8a7496500f1e75f17824d1/src/plugins/reverseImageSearch/index.tsx) and the [old RIS plugin](https://github.com/Angelix1/MP/blob/770b1f903b6f4d880d535beb27067552efd92cdf/vendetta/ris/index.jsx).

| Provider | URL prefix |
| --- | --- |
| Google Lens | `https://lens.google.com/uploadbyurl?url=` |
| Yandex | `https://yandex.com/images/search?rpt=imageview&url=` |
| Bing | `https://www.bing.com/images/search?view=detailv2&iss=sbi&q=imgurl:` |
| TinEye | `https://www.tineye.com/search?url=<image>&sort=crawl_date&order=asc` |
| SauceNAO | `https://saucenao.com/search.php?url=` |
| IQDB | `https://iqdb.org/?url=` |
| trace.moe | `https://trace.moe/?url=` |
| ImgOps | `https://imgops.com/start?url=` |

- [C] Lens `uploadbyurl` was [recently confirmed working](https://github.com/brave/brave-browser/issues/57455).
- [C] `google.com/searchbyimage` was reported returning 404. Do not use it.
- [A, gate P1] Each engine's handling of signed Discord URLs. Record pass or fail per engine in `docs/compatibility.md`, and hide any engine that consistently fails.

Open links with `Linking.openURL`. It is already used by [community plugins](https://github.com/Valenced/valenced-community-plugins/blob/ef8f4ff782033ade38aa555b751dfb8e2350ad31/plugins/global-badges/settings.tsx).

### Copy check

Answers one question: has this image been used across the web? It is for spotting a profile photo that may be copied, and for warning someone their own photo is being reused.

Evidence: [Vision fields](https://docs.cloud.google.com/dotnet/docs/reference/Google.Cloud.Vision.V1/latest/Google.Cloud.Vision.V1.WebDetection) [S], [TinEye totals and sorting](https://help.tineye.com/article/265-tineye-tutorial) [S].

**In-app route, parked with Vision.** The search sheet gets a **Check copies with Google Vision** button. It sends the image to Vision only.

- Count distinct sites by hostname from `pagesWithMatchingImages`.
- Show exact copies from `fullMatchingImages` and edited or cropped copies from `partialMatchingImages` as separate numbers.
- Ignore `visuallySimilarImages`, because a similar image is not a copy.
- Vision has no total, so always write the count as "at least". If a list reaches the requested limit, say more may exist.
- Request 50 results. [A, parked with Vision] Confirm the effect of `maxResults` on Web Detection.

| Band | Distinct sites | Label |
| --- | --- | --- |
| None | 0 | No copies found |
| Few | 1 to 4 | Found on a few sites |
| Several | 5 to 19 | Found on several sites |
| Wide | 20 or more | Widely used online |

Band limits are starting values. [A, gate P10] Tune them with real results.

**Free route, the current one.** TinEye shows a total match count at the top of its page and can sort by oldest, so its hand-off row says **See total and oldest copy**. Lens is the second choice.

Display rules:

- Show the band and counts first. Keep the page list behind a **Show pages** tap.
- Show `webEntities`, `bestGuessLabels`, and any text Vision reads in the image, such as a watermark or a handle.
- Say what a result is based on, like "Matches a reported scam avatar".
- Keep limits behind one **What this means** tap: copies don't prove who owns a photo, no copies doesn't prove it's real, and new, private, and AI-generated photos can have no copies.
- Label oldest dates as when an engine first found the image, not when it was made.

### Result ranking

Provider scores are not comparable, so do not average them.

| Tier | trace.moe | SauceNAO | Vision |
| --- | --- | --- | --- |
| Exact | Similarity ≥ 0.97 | Similarity ≥ 90 | Full matching image or page |
| Strong | 0.90 to below 0.97 | 70 to below 90 | Partial matching image |
| Possible | Hidden by default below 0.90 | Above provider minimum, below 70 | Visually similar image |

Thresholds are starting values. [A, gate P10] Tune them with the test set.

Rules:

- Rank by tier, then provider score, then source order.
- Dedupe by host and path, without query strings.
- Show a best-match card only for an Exact or Strong result.
- Always show each provider's status: results, no match, limited, needs key, or failed.

## 9. Security, privacy, and signed URLs

### Signed URL rules

Evidence: [Favorite Anything URL helpers](https://github.com/Valenced/valenced-community-plugins/blob/ef8f4ff782033ade38aa555b751dfb8e2350ad31/plugins/favorite-anything/js/urls.ts) and [renewal logic](https://github.com/Valenced/valenced-community-plugins/blob/ef8f4ff782033ade38aa555b751dfb8e2350ad31/plugins/favorite-anything/js/renewal.ts), which is MIT-licensed. Keep its notice if code is copied.

1. Never strip `ex`, `is`, or `hm`. There is no "remove tracking" option.
2. Never rebuild a signed URL with `URL` or `URLSearchParams`. Use string operations and preserve the original parameters.
3. When adding proxy parameters, keep every signature parameter.
4. Encode the whole image URL exactly once when placing it in a provider URL.
5. Parse `ex` as hexadecimal seconds. Treat a URL as stale when it expires within 5 minutes.
6. Refresh stale attachment URLs with `HTTP.post` to `Endpoints.ATTACHMENTS_REFRESH_URLS`, falling back to `/attachments/refresh-urls`, with body `{ attachment_urls: [url] }`.
7. Read `body.refreshed_urls[].refreshed`. Refresh only the selected attachment.
8. Keep signed URLs in memory for the active search only. Never store or log them.
9. Tests, fixtures, screenshots, and issues use fake URLs only.

### Image acquisition

Try these in order, stopping at the first valid image:

1. Media proxy, JPEG, longest edge 1600 px.
2. Media proxy, PNG, same bounds.
3. Original attachment, only if its declared size is within the limit.

- [C] Favorite Anything uses signed `media.discordapp.net` URLs with `format`, `width`, and `height`.
- [A, gate P2] `format=jpeg` works and a signed media proxy URL returns an image content type.
- [A, gate P2] A video attachment returns a still frame the same way.

For hand-offs, prefer the media proxy URL, because it returns a proper image type. [S] trace.moe rejects it, so trace.moe starts on the original URL. The **Switch image link** row tries the other link, and for external embeds it switches to Discord's `images-ext` copy.

### Limits

| Limit | Value |
| --- | --- |
| Downloaded image | 8 MiB |
| Provider response | 1 MiB |
| Download timeout | 20 seconds |
| Provider timeout | 30 seconds |
| Result cache | 16 entries, memory only, 30-minute expiry |

Use `XMLHttpRequest` with `responseType = 'arraybuffer'`. Check `Content-Length` when headers arrive, abort in `onprogress` when over the limit, and check the final length again.

- [C] [ElevenLabs Transcription](https://github.com/Anezium/valenced-elevenlabs-transcription/blob/a50a7bf09ed8f11464276c523e554f8cda2717cb/plugins/elevenlabs-transcription/js/transport.ts) uses this design, but says it has not been validated on a device.
- [S] [PetPet](https://github.com/Valenced/valenced-community-plugins/blob/ef8f4ff782033ade38aa555b751dfb8e2350ad31/plugins/petpet/js/index.ts) shows `fetch`, `FormData` with a file URI, and `FileModule.writeFile`.
- [A, gate P2] Binary XHR responses, progress events, and multipart upload to non-Discord hosts all work on the device.

### File handling

- Detect type from magic bytes. Ignore filename and declared MIME type.
- Reject unknown bytes. Never default to JPEG.
- Use the generic upload name `image.jpg`, or the matching extension for the detected type.
- Write to `cache` under `ris/`, with a random filename.
- Delete the file in `finally`, and clear the folder at start.

### Network rules

- Allow downloads only from `cdn.discordapp.com`, `media.discordapp.net`, and `images-ext-1` or `images-ext-2.discordapp.net`.
- Allow API calls only to each provider's exact HTTPS host.
- The community list and scam domain list only come from `raw.githubusercontent.com`.
- Check `xhr.responseURL` after redirects.
- Set `withCredentials = false`.
- Never send provider keys to any other host.
- Only open `https:` result links. Reject every other scheme.
- Treat all provider text as untrusted. Render as plain text.

### Privacy

| Path | What leaves the device |
| --- | --- |
| In-app provider | Image bytes and your IP address go to that provider |
| Browser hand-off | The image URL goes to that provider, including channel ID, attachment ID, filename, and a temporary access signature |
| Avatar or banner hand-off | The image URL goes to that provider, including the user's ID |
| AI tag check | The file downloads from Discord only, and nothing goes to outside services |
| My list | The image downloads from Discord only, and its hash and small thumbnail stay on the phone |
| URL refresh | The attachment URL goes to Discord, as normal client traffic |
| Result thumbnails | Your IP address goes to the host serving each thumbnail |

Show a short notice on first use of each provider, and link `docs/privacy.md` from settings. Sensei asked for calm wording on 2026-11-06: the in-app notice says the provider "sees your connection details", and `docs/privacy.md` names the IP address plainly. Never promise that a provider deletes images, except where its terms say so. trace.moe's [terms](https://github.com/soruly/trace.moe-api/blob/1b64f4b8ceca8b9e3b4cbe7f6479603e61bff2b6/docs/terms.md) say it does not keep search images, and that IP addresses are logged.

API keys are stored as plain JSON in the plugin's data folder. Say so in settings. Other plugins may be able to read them, because plugins share the client's process.

### Logging

Log category and stage only, such as `provider=saucenao stage=upload error=rate-limited`.

Never log URLs, keys, filenames, message content, raw provider bodies, or user IDs.

## 10. UI and settings

### Main flow

1. Long-press a message and tap **Search Image**.
2. Pick an image if there are several.
3. Review the sheet, which shows the image, selected providers, and hand-off rows.
4. Tap **Search with trace.moe and SauceNAO**. The button names the actual providers.
5. See a best match, ranked results, and provider status.

To check a profile photo, tap **Check Profile** on a message, then use the TinEye and Lens hand-offs.

After setup, a normal search takes two taps from the long-press sheet: **Search Image**, then **Search**.

### Settings

- Provider switches and key fields.
- Default provider selection.
- Entry point switches.
- Minimum tier to show.
- Adult content filter. Hide adult-flagged results by default, using SauceNAO `hidden` and trace.moe `anilist.isAdult`.
- Result thumbnails on or off.
- Live quota display where a provider reports it.
- Privacy summary.
- Clear keys and clear cached results.

### UI rules

- Use `Design`, `Page`, `TableRowGroup`, `ActionSheetRow`, and host tokens.
- Open plugin sheets with `ActionSheetActionCreators.openLazy` and a stable key.
- Use `jsonStorage.use()` in settings, not hand-rolled state.
- Call hooks only inside real React components.
- Never communicate state by colour alone, and never use a red and green pair. Pair every state with a text label and an icon.
- Keep labels short and readable by screen readers.
- Say what happened and what to do next in every error.

Toasts use `ToastActionCreators.open('KEY', { text, icon })`.

## 11. Coding style

Follow `biome.json` and current community plugins.

- Tabs, single quotes, no semicolons, and trailing commas.
- Omit parentheses around single arrow function parameters.
- Use separate `import type` statements.
- Use PascalCase for module constants, such as `BatchSize` and `FlushDelayMs`.
- Export the plugin with `export default plugin<{ jsonStorage: Settings }>({ ... })`.
- Destructure `start({ cleanup, plugin, jsonStorage, logger })`.
- Register unpatches directly through `cleanup(...)`.
- Use `plugin.reportError(error)` for recoverable errors.
- Guard every value from Discord. Check shapes before use.
- Keep functions small, and put pure logic in `core/`.
- Keep comments short, and explain why rather than what.
- Do not refactor unrelated code.

Patch pattern for the message sheet:

```tsx
cleanup(
	getModules(
		withName<LongPressMessageActionSheet>('LongPressMessageActionSheet'),
		mod => {
			const module = mod as { default: LongPressMessageActionSheet }

			cleanup(
				instead(module, 'default', (args, Sheet) => {
					const tree = Reflect.apply(Sheet, undefined, args)

					try {
						addSearchRow(tree, args[0])
					} catch (error) {
						plugin.reportError(error)
					}

					return tree
				}),
			)
		},
		{ returnNamespace: true },
	),
)
```

Adapted code keeps its licence notice and gets an entry in `NOTICE.md`. Check licences before copying from third-party repositories. One reviewed repository's `NOTICE.md` says CC0 while its `LICENSE` is GPL-3.0, so use it as reference only.

## 12. Test plan

### Automated tests

Run with `bun run test`. Tests never touch Discord, real accounts, or real provider APIs.

| Area | Must cover |
| --- | --- |
| Signed URLs | Parameters kept in order, trailing `&` kept, expiry parsing, stale margin, one-time encoding, no double encoding |
| Proxy URLs | Signature preserved, existing parameters preserved, duplicate parameters avoided |
| Target extraction | Attachments, embeds, video, spoilers, multiple images, malformed records |
| Byte sniffing | JPEG, PNG, GIF, WebP, AVIF or HEIC headers, short files, HTML, unknown bytes, fake extensions |
| Limits | Oversized `Content-Length`, missing length, over-limit progress, oversized final body |
| Providers | Valid results, empty results, malformed JSON, 401, 402, 403, 404, 413, 429, 503 |
| Fusion | Tier rules, dedupe, ordering, adult filtering, unsafe URL rejection |
| Copy check | Band edges, hostname dedupe, exact and partial counts, capped lists, similar images ignored, empty results |
| Session | Double taps, cancel in each stage, stop during request, late callbacks, partial failure |
| Settings | Defaults, malformed values, old versions, failed writes |
| Redaction | Signed URLs, keys, filenames, and nested errors removed |
| Cleanup | Repeated start and stop leaves no patches, timers, requests, or temp files |

Keep runtime adapters thin, and test them with fake `XMLHttpRequest`, `FormData`, `FileModule`, and `HTTP` objects.

Fixture URL example:

```text
https://cdn.discordapp.com/attachments/1/2/test.png?ex=ffffffff&is=00000000&hm=deadbeef&
```

### Build checks

- Clean checkout passes `bun run verify`.
- `bun.lock` does not change during packaging.
- The ZIP has `manifest.json` and `index.js` at its root.
- The ZIP name, ID, and version match the manifest.
- The bundle has no bundled React, token strings, or real keys.
- `generate-index` reports the same size and SHA-256 as the ZIP.

### Real-device tests

Use images you created or are allowed to share, in a private test server. Never post real signed URLs in issues or logs.

Record for each run: commit, ZIP SHA-256, Android version, device, Valenced version, Discord version and build, and debug or production build.

1. Install with **Settings > Valenced > Plugins > settings gear > Install from file**.
2. Enable the plugin and confirm it starts with no errors.
3. Reload, then confirm settings persist.
4. Confirm the row appears only for messages with images.
5. Reopen sheets repeatedly and check for duplicate rows.
6. Test a single attachment, multiple attachments, an embed, GIF, video, spoiler, and an old message.
7. Test a PNG uploaded with no useful content type.
8. Test one image from each class: anime frame, artwork, photo, meme, and screenshot.
9. Test each hand-off engine.
10. Test no network, airplane mode during upload, and app switching during search.
11. Test a bad key, a missing key, and a provider rate limit reported by normal use. Do not flood any service.
12. Disable the plugin during a search and confirm no later result appears.
13. Confirm no files remain in the cache folder.
14. Confirm the normal Discord sheet still works.
15. Repeat the critical path on a production Valenced build.
16. Upgrade from the previous candidate and confirm settings survive.

A debug build helps during development. A pass only counts for the build type actually tested.

### Quality test set

Keep a private list of 25 test images: 5 each of anime frames, artwork, photos, memes, and screenshots. Record top result quality per provider, so threshold changes are based on evidence.

## 13. Build plan

Do not start a phase until the previous phase passes. A failed gate means changing the plan, not skipping the check.

### P0: Foundation and device probe

Work:

- Bootstrap the repository. **Done.**
- Fix template issues: stale type-check script, mutable dependencies, missing lockfile, and `pull_request_target`. **Done.**
- Add a loadable plugin that does nothing visible. **Done.** The production bundle is an empty plugin.
- In dev builds only, capture sheet keys and the field names of media sources, never values. **Done.** The probe shows a copyable report in plugin settings, because the phone is the main test device.

Acceptance:

- CI passes with read-only permissions and no secrets.
- A clean Gradle build makes a ZIP with no token.
- The plugin installs, starts, stops, and leaves no errors on the phone.
- `docs/compatibility.md` records versions and which entry points exist.
- `manifest.json` has a tested Discord range.

### P1: Entry points and hand-offs

Work:

- Target extraction and signed URL logic. **Done.**
- Long-press row, and viewer button if confirmed. **Done.**
- Search sheet with hand-off rows. **Done.**

Stale links are not refreshed until P2, so a very old message may fail in a browser hand-off.

Acceptance:

- All signed URL tests pass.
- No duplicate rows after repeated opens.
- At least Lens and one other engine return a usable page from a signed Discord image.
- Each engine result is recorded.
- Disabling the plugin removes all UI without a reload, or calls `plugin.requireReload()` if it cannot.

This phase is the first useful release candidate.

**P1 passed on 2026-11-06** with alpha5. All 8 engines work, and the viewer button opens the sheet.

### P2: Byte pipeline and trace.moe

Work:

- URL refresh, bounded download, and sniffing. **Done.** trace.moe takes raw bytes, so no temp file is written.
- Session state machine. **Done.**
- trace.moe provider and basic results sheet. **Done.**

Acceptance:

- An anime frame returns in-app results with no key.
- An expired message image refreshes and succeeds.
- An over-limit file aborts before upload.
- A non-image is rejected with a clear message.
- Cancelling aborts the request and shows no late result.

**P2 passed on 2026-11-06** with alpha2. An anime frame returned an Exact match at 99.2%, and old images, PNG, GIF, and cancel all worked. Over-limit and non-image handling are covered by automated tests only.

### P3: SauceNAO and fusion

Work:

- Key settings, consent, SauceNAO provider, fusion, and quota display. **Done.** The multipart body is built by hand in `core/multipart.ts`, so no temp file is written.

Acceptance:

- Artwork returns ranked in-app results with source links.
- Live remaining counts appear.
- Rate-limit errors show a clear message and do not retry.
- Keys never appear in logs, errors, or bundles.

**P3 passed on 2026-11-06** with alpha2. Fan art returned an Exact SauceNAO match at 91.3% with the artist's name, and its source link opened. Rate limiting, quota display, merging, and key removal passed earlier. Keys stay out of logs and errors because the plugin logs nothing from provider calls, and no key is in the source.

### P4: Cloud Vision

Vision, the copy check, and text reading are built and tested in CI, then parked. See section 8.

Work still live from this phase:

- Short use labels on the hand-off rows.
- TinEye opens sorted by oldest. **Link passed on 2026-11-06.**

Acceptance:

- The TinEye row opens sorted by oldest on the phone.
- Hand-off rows show their labels.
- No Vision setting, row, or request appears.

Parked Vision acceptance, for when it returns:

- Works with a user-supplied key, and setup text explains billing and cost.
- Fully matching pages rank above visually similar images.
- A widely used test image shows the right band, with counts written as "at least".
- A freshly taken test photo shows No copies found, and **What this means** explains the limits.
- An image with a visible watermark shows its text.

### P5: Profile check

Reports signals about an image and an account. Signals sit in their own strip, separate from `fusion.ts`, which only ranks search results.

Work:

- `core/signals.ts`, plus `ui/SignalStrip.tsx` with one labelled, icon-led row per signal. **Built.**
- A **Check Profile** row in the long-press message sheet, using the message author. **Built.** A profile sheet entry can follow once a probe finds it.
- Account age in `core/account-age.ts`: `Math.floor(Number(id) / 4194304) + 1420070400000`. [S] [Discord docs](https://docs.discord.com/developers/reference). Dividing keeps this accurate without BigInt. **Built.**
- Avatar and banner targets in `core/profile.ts` and `adapters/profile.ts`, using `.png?size=1024` on Discord's CDN. Skip default avatars and webhooks. **Built.**
- Those targets open the normal search sheet, so hand-offs and in-app providers all work on them.
- Show the account's creation date, so it can be compared by hand with TinEye's oldest copy. **Built.**
- AI check, in two layers:
  - Local tags in `core/image-tags.ts`: C2PA, IPTC AI labels, and generator settings such as Stable Diffusion `parameters`. It reads the original file from Discord, and nothing goes to an outside service. **Built.** Device run: PNG text survived, and JPEG XMP did not.
  - A SynthID browser row. A hit is strong, and a miss means nothing. [C] Its public checker is [reported at synthid.com](https://bestforandroid.com/radar/synthid-detector-went-public-check-photo-video-ai-watermarks/), with no public image API, so it is a manual upload. **Built.**
- Never read or show GPS or location fields. The tag scan skips EXIF entirely.

Sightengine was scrapped on 2026-11-06, so there is no AI score provider. New AI detection needs Sensei's approval.

The Wayback mismatch signal is parked with Vision, because it needs Vision's page list. The CDX link itself passed on 2026-11-06.

Acceptance:

- A message author's account age shows with no network call.
- Avatar and banner hand-offs work on a real profile.
- A PNG with Stable Diffusion text shows its tag, if the tag survives upload.
- Every signal has a text label and an icon.

**P5 passed on 2026-11-06** with alpha1, apart from the webhook check, which was not run. See `docs/compatibility.md`.

### P6: Local hash list

Work:

- `core/pdq.ts` and `core/pixels.ts`: PDQ 256-bit hash, quality score, mirror hashes, and distance, in pure TypeScript. **Built.** Hashes and quality match `pdqhash` exactly on the fixtures.
- Hash a small PNG from Discord, so one decoder covers every format and the JS thread stays free. **Built**, with no npm packages.
- One-tap **Save to my list**, kept on the device with a private thumbnail for side-by-side comparison. **Built.** The limit is 100 images, and settings can remove them.
- Profile images check the list by themselves when it has entries, because only Discord is contacted. **Built.**
- Start at distance 30 or less and quality 50 or more. **Built.** [A, gate P10] Tune these with real images.

Findings from 2026-11-06, on a small stock image set: 64-bit pHash missed mirrors, and neither hash handled crops. This list catches reused images, while Vision's partial matches cover crops.

Acceptance:

- TypeScript hashes match `pdqhash` reference hashes in tests.
- A recompressed, resized, and mirrored copy of a saved image matches.
- Flat, low-detail images are rejected by the quality score.
- Hashing doesn't visibly freeze the app on the Motorola G40s.

**P6 passed on 2026-11-06** with alpha1. See `docs/compatibility.md`.

### P7: Community list

Work:

- Entries in `blocklist/entries.json`, holding hashes, categories, and report counts, never images. **Built.**
- `publish-blocklist.yml`, publishing a compact list to the `community-list` branch with a real Ed25519 signature. The private key stays in Actions, and the public key ships in the plugin. **Built.** This replaces Pages, so the list needs no Pages setup or release.
- `adapters/community-sync.ts`: fetches `manifest.json`, checks its signature, refuses older versions, then fetches `list.json` and checks its SHA-256. **Built.** It runs from a settings button and from the daily update below.
- A **Report to community list** row that opens a prefilled GitHub issue. `blocklist-intake.yml` turns it into a PR, and Sensei approves it. **Built.**
- Community hits show distance, report count, and category, because there is no image to compare. **Built.**

Sensei skipped the report-to-PR and removal checks on 2026-11-06, because seeing matches matters more to him than reporting. Run them before P10 if reporting stays. A report is public under the reporter's GitHub account, which needs a decision before release.

The list now also updates by itself, at most once a day, after a 20-second delay at start. **Built.**

Setup done by Sensei on 2026-11-06: signing key created, public key added to `ListPublicKey`, and Actions allowed to create pull requests. Replacing the key needs a plugin update.

Acceptance:

- The first signed list publishes, and the phone verifies it.
- A tampered list is rejected.
- A report becomes a PR, and a false-match entry can be removed through the same PR flow.

### P8: Link risk

Work:

- `core/link-risk.ts`: URL extraction, known scam domains, lookalike scoring, and `xn--` detection. **Built.**
- A **Check Links** row on messages with links, opening `ui/LinkSheet.tsx`. **Built.** The check runs on the phone, and links are never sent anywhere.
- `adapters/link-check.ts` downloads [fisphish's Discord list](https://github.com/fisventurous/fisphish) from GitHub and keeps it in memory for 3 hours. **Built.** On 2026-11-06 it held about 32,000 domains, was refreshed the day before, and is MIT-licensed. Its upstream feeds keep their own terms, so this project fetches it rather than republishing it. nikolaischunk's list stopped in March 2024, and Discord-AntiScam was archived with no licence.
- Real Discord, Steam, and Roblox domains are never flagged, even if a list names them.
- RDAP domain age is left out, because the list and lookalike checks cover the same job with less network use.

Acceptance:

- A known scam domain and a lookalike of `discord.com` are both flagged.
- Normal Discord and Steam links are not flagged.

### P9: Crop and mirror search

Parked with Vision, because browser hand-offs can't take crops and the other in-app providers don't search photos. Skip to P10.

### P10: Polish and release

Work:

- Tune thresholds, finish settings, and complete accessibility checks.
- Finish the README, privacy docs, and install guide.
- Complete the device checklist on debug and production builds.

Acceptance:

- All automated and device tests pass.
- Upgrade from the previous candidate works.
- `1.0.0` is published and installs from the public index.

### Ideas for later

- IQDB in-app parsing.
- Upload-then-open for Lens and Yandex, using endpoints seen in PicImageSearch. These are undocumented.
- A paid Lens API with the user's own key.
- An optional relay on Sensei's server.
- A native Kotlin share path.

No face recognition, as section 2 says.

## 14. Release process

Valenced repositories are static. [S] `index.json` lists versions, URLs, SHA-256 values, sizes, dependencies, and channels.

### Workflows

- `validate.yml`: Runs on `push` and `pull_request`, with `contents: read` and no secrets. Runs `bun install --frozen-lockfile`, `bun run verify`, then Gradle packaging for the production and probe ZIPs, then `check-zip.sh`. Uploads both unarchived, so each download is the plugin ZIP itself.
- `release.yml`: `workflow_dispatch` only until `1.0.0`. Keeps the template's scripts and pool logic.
- `publish-index.yml`: Manual, for channel changes.
- Actions are pinned to full commit SHAs.
- Write permission sits on the publishing job only.

### Channels

- [S] `latest` is the highest version with no prerelease label.
- [S] `beta` is the newest version overall, when newer than `latest`.
- [S] A plugin follows `latest` unless the user picks another channel.
- Build candidates use labels like `0.1.0-alpha1` and are sideloaded as ZIPs.
- The first version published to the repository is `0.1.0`, so `latest` exists. Later test builds can use `-beta` labels.
- `repo.config.json` overrides channels, and its target version must exist in the pool.

### Publishing a release

1. Update `version` in `manifest.json`. Never reuse or lower a version.
2. Pass `bun run verify` and package the ZIP.
3. Complete the device checklist for that ZIP.
4. Merge to `main`.
5. Run **Release plugins** manually.
6. Confirm the workflow published `pool/<id>@<version>.zip` and `index.json`.
7. Fetch the public `index.json` and ZIP. Check size and SHA-256.
8. Install from the repository on the phone.

Repository URL: `https://quiet-falcon.github.io/lo-reverse-img-search-plugin/index.json`

Enable Pages for the pool branch. [A, gate P10] Confirm that a push from the workflow actually updates the live site. If it does not, add an explicit Pages deployment job.

### Rollback

Point `latest` back to an earlier version in `repo.config.json`, then run the publish workflow. Never delete or replace a released ZIP. Test what installed clients do, and do not promise an automatic downgrade.

## 15. Open questions and assumptions

| # | Question | Gate | If it fails |
| --- | --- | --- | --- |
| 1 | Which GitHub owner hosts the repo without revealing personal details? | Settled: `quiet-falcon`, 2026-11-06 | Move the repo, then update the install link |
| 2 | Exact Valenced, Discord, and Android versions on the phone | Passed: 1.3.0, 352.6 canary, SDK 34 | Tighten or change the range |
| 3 | Do the Bun pinned Git install and CLI peer dependency resolve cleanly against GitHub? | Passed, 2026-11-06 | Use tags or commit a reviewed vendored copy |
| 4 | Does Gradle package a JS-only plugin with no token? | Passed, 2026-11-06 | Find the trigger, then adjust the build |
| 5 | Does `MediaModalOverlayHeader` exist on the target build? | Passed: plain function export | Use another viewer path, or long-press only |
| 6 | Does `MediaShareActionSheet` still exist? | Passed | Drop it |
| 7 | Exact attachment, embed, and video fields | Attachment and embed passed, video gate P1 | Update `target.ts` |
| 8 | Which hand-off engines accept signed Discord URLs? | Passed: all 8, with trace.moe on the original link | Hide failing engines |
| 9 | Do proxy URLs fix the old `octet-stream` failure? | Passed for 7 engines and a phone PNG in Lens | Use original URLs or in-app providers |
| 10 | Does `format=jpeg` work on the media proxy? | Open: searches work, step not recorded | Use PNG, then the original |
| 11 | Does a video URL return a still frame? | P2 | Disable video search |
| 12 | Do binary XHR and progress events work? | Passed, 2026-11-06 | Use `fetch` with `Content-Length` and declared size checks |
| 13 | Does a raw `Uint8Array` XHR body upload work on the device? | Passed, 2026-11-06 | Use `FileModule` and multipart, then re-evaluate |
| 14 | Do providers accept uploads from the phone's network? | Passed for trace.moe and SauceNAO | Show the provider error and keep hand-offs |
| 15 | SauceNAO limits and keyless behaviour | Partly passed: limited after 5 quick searches, daily count fell 94 to 92. Keyless still untested | Keep the key required |
| 16 | SauceNAO `hide` meaning | P3 | Filter locally using `hidden` |
| 17 | Vision REST shape and billing requirement | Parked with Vision | Keep Vision off, or drop it |
| 18 | Do thresholds match real results? | P10 | Retune them |
| 19 | Does the Pages update run from the release workflow? | P10 | Add a deployment job |
| 20 | Can Termux run the build tools? | Optional | Keep building in CI and WSL2 |
| 21 | Does `maxResults` raise Web Detection's list sizes? | Parked with Vision | Use the default size and keep "at least" wording |
| 22 | Does a TinEye hand-off open with Discord's signed URL? | Passed | Use the media proxy URL or Lens |
| 23 | Does a hand-built multipart upload reach SauceNAO from the phone? | Passed, 2026-11-06 | Write a temp file and use `FormData` with its URI, as PetPet does |
| 24 | Does TinEye's site honour `sort=crawl_date&order=asc`? | Passed, 2026-11-06 | Keep the plain link |
| 25 | Does Wayback's CDX API return the earliest capture? | Passed, 2026-11-06 | Drop the mismatch signal |
| 26 | Which metadata survives Discord's upload? | Partly passed: PNG text survived, JPEG XMP did not, one upload each | Drop local tag checks |
| 27 | Does the Valenced CLI bundle npm packages such as `upng-js`? | Not needed: the plugin has its own PNG decoder | None |
| 28 | Is PDQ fast enough on the phone? | Passed, 2026-11-06 | Use a smaller image, or hash in slices |
| 29 | Does the device have `crypto.subtle`? | Not needed: the plugin has its own Ed25519 and SHA code | None |
| 30 | Does the message sheet's author or `UserStore` give the avatar and banner hashes? | Passed, 2026-11-06 | Use `getAvatarURL`, and leave banners out |
| 31 | Does the media proxy return a PNG with `format=png`? | Passed, 2026-11-06 | Fall back to original PNGs, and say other formats can't be saved |
| 32 | Does BigInt work on the phone, and how long does a signature check take? | Passed, 2026-11-06: 0.2 seconds including the network | Replace BigInt with typed-array maths |

Limitations already known:

- Discord can change its internal modules at any time.
- Providers can change limits or stop service.
- Client mods break Discord's Terms of Service, and users accept that risk.
- Provider coverage varies, and no method finds every image.

## 16. Working rules for Claude

- Read this file first, then re-check the relevant pinned source.
- Work phase by phase, and keep changes small.
- Run the relevant commands before calling work done.
- Report checks as **passed**, **failed**, **not run**, or **not applicable**.
- Never mark a device check as passed without device evidence.
- Update `docs/compatibility.md` when a gate result changes.
- Update this file when a verified fact changes.
- Ask Sensei before anything irreversible, such as publishing, changing the plugin ID, or adding a new provider.
- If a decision is unresolved, ask Sensei or write a copy-paste question for Codex or GPT.

## 17. Useful links

- [Plugin development docs](https://valenced.app/docs/plugin-development)
- [Docs source](https://github.com/Valenced/valenced-website/tree/6c60166df76d545ccf0d05f3b0bec635656d95a4/content/docs/plugin-development)
- [Plugin template](https://github.com/Valenced/valenced-plugin-template)
- [Community plugins](https://github.com/Valenced/valenced-community-plugins)
- [Valenced types](https://github.com/Valenced/valenced-types)
- [Plugin CLI](https://github.com/Valenced/valenced-plugin-cli)
- [trace.moe API docs](https://soruly.github.io/trace.moe-api/)
- [SauceNAO API](https://saucenao.com/user.php?page=search-api)
- [Cloud Vision pricing](https://cloud.google.com/vision/pricing)
- [PicImageSearch](https://github.com/kitUIN/PicImageSearch), useful for provider contract research
