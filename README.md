# RedditNSFW

Current: **1.6.0**

RedditNSFW maintains one Reddit/Tampermonkey userscript: Reddit Image Recreation. It attempts native blur removal and reconstructs media when Reddit's own display layer fails.

The maintained source lives under `src/userscripts/`. The unused standalone Auto Unblur script was removed; it remains recoverable from Git history.

## Current Scripts
<!-- SCRIPT_SUMMARY_START -->
- `Reddit Image Recreation` -> `src/userscripts/reddit-image-recreation.user.js`: Native-first script that auto-attempts direct unblur and only reconstructs media when Reddit still fails to reveal it cleanly.
<!-- SCRIPT_SUMMARY_END -->

## Repo Layout

- `src/userscripts/` contains the maintained userscript entry files.
- `src/script-catalog.js` is the single metadata source for script inventory and doc generation.
- `build/` contains the repo-local verify, build, commit, and doc-sync entrypoints.
- `docs/` holds the project docs, including generated script reference output.
- `Image failure.txt` and `Video Failure.txt` contain preserved HTML failure examples for debugging.
- [context.md](context.md) holds compact durable repository knowledge and user preferences.
- [AGENTS.md](AGENTS.md) owns agent workflow and editing rules.

See [Architecture](docs/ARCHITECTURE.md) for implementation flow, [Debugging](docs/DEBUGGING.md) for diagnostics and check coverage, [Tuning](docs/TUNING.md) for settings, and [Scripts](docs/SCRIPTS.md) for the generated script reference.

## Field Logs
- Reports retain every recorded event and timestamp for the page session, with no history or snapshot-count caps. Complete post/image snapshots are taken on export. Repeated payloads and URLs share complete dictionary entries; event times use exact millisecond offsets from the session's UTC start time.
- Click the fixed **Copy log** button at the bottom right of Reddit. It stays visible while scrolling and copies diagnostics ready to paste into chat.
- If clipboard access is blocked, a panel opens with the entire log selected. Press Ctrl+C (or ⌘C), then paste it here. The panel also offers **Download log**.
- Run `log()` in the browser console on Reddit to download `reddit-nsfw-log.txt`.
- Both paths combine version/settings/page snapshots, state changes, media recovery failures, scan timing, and native-player diagnostics. All recorded observations and timestamps remain for the full page session, including repeated decisions; identical payloads share storage. Logs stay in memory until a page reload; nothing is uploaded automatically.
- Shared logs strip known Reddit/Cloudflare challenge parameters from URLs while retaining useful media query parameters. The media snapshot includes every matching post and native image, prioritizing viewport posts.
- Event details and URLs use lossless references to complete report-local dictionaries; every retained field and timestamp remains, and outer snapshots stay indented, with one complete JSON row per image. Foreground timer lateness and scroll frame gaps help distinguish page stalls from synchronous userscript work. See [Debugging](docs/DEBUGGING.md) for measurement limits.
- Stable session image IDs link native load/error events with complete image snapshots, distinguishing same-source clones and source changes.
- Image request timings are retained by a passive Resource Timing observer, including requests whose posts later leave the DOM. Timing coverage and browser-buffer counts appear in the snapshot; unavailable or restricted timing remains explicit.

## Workflow

- Run `BUMP=patch|minor|major|none npm run agent:verify`.
- Run `COMMIT_MSG="..." npm run agent:commit` after verify succeeds.
- Use `BUMP=none` for local-only verification when you do not want a version or changelog bump.
- Keep docs in sync with code changes in the same change set.

Run these commands from the repository's Git checkout. `agent:verify` runs doc sync, userscript checks, build/version handling, extra sync checks, and `git status -sb`. See [AGENTS.md](AGENTS.md) for the full workflow and release policy.

## Hosting
- GitHub account: `final221`
- Default repo target: `git@github.com:final221/RedditNSFW.git`
- Default branch: `main`

## Recovery behavior
Automatic reconstruction is deferred until posts are within 1000px of the viewport, then receives the full native grace period. If a renderable sharp native image is still unfinished at 1.2 seconds, recovery waits until eight seconds from the first eligible decision; native load cancels it and native failure releases it early. Native image loads remove obsolete overlays immediately. Reports include native callback cost, browser request timing, loading/sizing transitions, and JSON rejection metadata to investigate late pictures, transient retry buttons, and resizing.

Image Recreation 1.45 supports advertised previews on Reddit's `cf.preview.redd.it` CDN and accepts `crop=smart` when advertised and loaded aspect ratios match. Reports include viewport positions at fallback timer firing, source selection, and load completion, plus native image handoff checks over two frames and after 250ms. They explain rejected preview candidates and native handoff layout changes, and identical image observations retain their timestamps. It preserves pending fallback deadlines across rescans and uses sharp, display-sized previews for reconstructed single images, accounting for screen pixel density and Reddit height caps. Failed previews retry the original image. The Copy log report includes the selected source, target dimensions, grace-period wait, fetch time, preload time, and build time. It retains native video and embed playback priority, cancels obsolete fallback attempts after fetch/preload, checks native image visibility and readiness, retries failed post JSON requests, preserves query parameters when probing video variants, and times out stalled image preloads.
