# Context

## Repo purpose
This repo tracks Reddit/Tampermonkey userscripts for NSFW media access on current Reddit surfaces. The repo is not a generic browser-userscript collection. The maintained Image Recreation script handles native blur removal and media reconstruction. The unused standalone Auto Unblur script was removed and remains in Git history.

## Primary files
- `src/userscripts/reddit-image-recreation.user.js`: maintained native-first unblur plus reconstruction script
- `src/script-catalog.js`: script inventory and doc-sync source of truth
- `Image failure.txt` and `Video Failure.txt`: preserved HTML failure examples

## Editing rule
- Change maintained behavior in `src/userscripts/`. The image recreation script now owns both the native auto-unblur pass and the reconstruction fallback path.
- When a maintained `.user.js` file changes, bump its Tampermonkey `@version` in the same change.
- Keep the root `.txt` files only as preserved raw references unless the user explicitly wants them updated too.

## Verify surface
- `npm run agent:verify` runs doc sync, userscript checks, build/version handling, extra sync checks, and `git status -sb`.
- Doc sync normalizes LF and CRLF input before comparing or writing, including the README generated block.
- This repo expects to be inside a git repo before normal verify/commit use.

## Field debugging
- `src/userscripts/reddit-image-recreation.user.js` now keeps a rolling in-memory trace for live failure diagnosis.
- The fixed **Copy log** button at the bottom right copies the current report. Clipboard failures open a selected, read-only text area with a download option; the control is isolated in a shadow root and reattached by the integrity rescan if Reddit removes it.
- `log()` in the browser console downloads `reddit-nsfw-log.txt` from the current page.
- `getSharedLogReporter().format()` supplies copying, manual selection, and downloading. `recordState()` deduplicates unchanged decisions by live element/host using weak references; nonroutine recovery/failure events receive retention priority. Reports include suppressed/discarded counts, version/config, viewport/media-layer counts, synchronous scan timing, and up to 12 media snapshots prioritized by viewport. Known Reddit/Cloudflare challenge parameters are removed from stored/exported log URLs, including nested fields and error text. `debugConsole` gates console output, while the bounded in-memory trace stays active.
- The exported log is intended for copy-paste back into the repo discussion when a Reddit surface fails in the browser. It combines direct-unblur state with reconstruction events, including unstable cases where the fallback may build first and then yield back to native Reddit media later, no-op cases where fallback is skipped before fetch/build, and image cases where the recreated `<img>` exists in DOM but still does not visibly render or only becomes visible after the fallback seeds layout into a collapsed media host while honoring Reddit''s own height cap.

## Feed image latency
`selectDisplayImageSource()` chooses an advertised, unblurred, aspect-matching preview (including `cf.preview.redd.it` and eligible `crop=smart` URLs) that covers the measured display box at the current pixel density. `image-source-selected.previewCandidates` counts candidate hosts, eligible previews, and rejection reasons. `preloadFallbackImage()` validates loaded preview aspect ratios and records source choice and elapsed load time, and retries the original only while the attempt still owns the connected host. Animation, missing dimensions, unavailable adequate previews, or `useSizedImagePreviews: false` retain original-source selection. Pending fallback timers are tied to a host/container/post and keep their first deadline across repeated scans; native arrival cancels them. `fallback-timer-fired.waitMs` and `.intendedWaitMs`, `resolved-media.fetchElapsedMs`, `image-preload.elapsedMs`, and `fallback-build-success.elapsedMs` separate scheduling and asynchronous costs from synchronous scan work. `fallback-timer-fired`, `image-source-selected`, and `image-preload` include `viewport` snapshots (connection, viewport intersection, top/bottom, scroll position, and tab visibility) for late-loading investigations.

Image render diagnostics suppress identical state across phases, retain errors/changes, and include `connected` so removed layers are distinguishable from broken visible images. Native handoff events include ownership and host height before/after removal; `native-handoff-layout-lost` flags immediate loss of native usability. `observeNativeImageHandoff()` groups the next two frame samples and a 250ms sample into `native-handoff-followup`, recording target identity, native readiness/ownership, dimensions, and elapsed time.

## Recovery regression checks
`build/check-media-recovery.js` runs isolated checks against the real userscript helpers for stable fallback deadlines under repeated scans, host reuse and detached-host cancellation, display-sized image selection at different pixel densities, height caps, preview signatures and original-source recovery, request retries and caching, query-bearing video URLs, native image visibility/readiness, native playback ownership, obsolete fallback cancellation, and image preload cleanup. `build/check-log-controls.js` checks the shared report formatter, legacy downloads, clipboard success/failure, manual selection, navigation snapshots, control reattachment, trace limits/retention priority, 49-post repeat suppression, nested scan timing, native-player ownership/error details, viewport sampling, and URL redaction across clipboard/manual/download paths. `npm test` runs these alongside syntax/header checks; it does not validate live Reddit rendering.
