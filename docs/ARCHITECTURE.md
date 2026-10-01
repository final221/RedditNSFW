# Architecture

RedditNSFW maintains one browser-side userscript. Image Recreation owns both native blur removal and media reconstruction; the unused standalone Auto Unblur script is retained only in Git history.

## Media handling

### Image Recreation
- Entry: `src/userscripts/reddit-image-recreation.user.js`
- Purpose: rebuild a usable media layer when Reddit's own display path is insufficient
- Primary mechanisms: auto-flip Reddit's native blur state first without automated Reddit reveal/login button clicks, treat native galleries, revealed embeds, or actually visible media inside Reddit's blur wrapper as already-resolved, normalize comment permalinks back to their parent post URLs, then fetch post JSON, resolve image, video, or gallery media, rank a capped set of Reddit mp4 guesses while preferring the declared Reddit source ahead of lower guessed variants, prefer resolved preview/media image URLs before fabricating direct `i.redd.it` links, seed fallback layout from blurred or preloaded media dimensions when Reddit collapses the media host, while respecting Reddit''s own max-height caps, preload the selected path, and auto-inject a custom fallback layer only when native handling still looks blocked; a flipped blur property alone does not suppress fallback recreation; fallback videos escalate to controls if autoplay never becomes usable; if Reddit rerenders away a built fallback layer while the surface is still blocked, the script retries on the refreshed host
- Observability: the script keeps a rolling in-memory trace that contributes to the combined report, including scan/process/scheduling decisions, normalized post URLs, candidate video URLs in probe order, the playable source that actually passed preload, fallback layout seeding details and height caps, fallback image render-state snapshots, whether a built fallback later yielded back to Reddit native media, and whether a previously built layer was lost and retried. The report includes session time, retained/discarded/suppressed event counts, version/config, current viewport/media-layer state, synchronous scan timing, and native-player diagnostics. Console output is gated by `debugConsole`.

### Feed image loading
`extractImageMediaFromPost()` retains the original source and advertised preview dimensions/resolutions. `selectDisplayImageSource()` uses the measured host box, Reddit height caps, source aspect ratio, and `devicePixelRatio` to choose the smallest adequate full-frame preview. Signed URLs are used as supplied after HTML decoding; blurred, cropped, distorted, or insufficient candidates are skipped. Animated images and images without usable size metadata retain the original source. `useSizedImagePreviews` can disable this selection.

`preloadFallbackImage()` first loads the selected source and retries the original after a preview failure. Each completion rechecks ownership before retrying or inserting media. Source choice, target/source dimensions, and elapsed preload time are recorded. The existing gallery and native-player paths retain their source-selection rules.

A pending fallback keeps its first 1200ms deadline for the same host/container/post across rescans. A changed target receives a new timer; native ownership or an existing custom layer cancels pending work. Before firing, the timer validates connectivity and host identity and reads the current image. The report records intended/actual timer wait, post-fetch duration, and build-attempt duration.

### Diagnostic controls
`createLogControl()` owns a fixed bottom-right **Copy log** button in a shadow root, separate from unblur and reconstruction decisions. A click formats a fresh report and immediately requests a clipboard write. Success shows Copied!; denied or unavailable clipboard access opens a selected read-only text area with Close/Escape and Download log. The existing integrity rescan calls `ensureLogControl()` to reattach the same host if removed, including across client-side navigation.

The shared reporter's `format()` supplies both clipboard text and the existing `log()` / export-alias downloads of `reddit-nsfw-log.txt`. Copy failures are recorded in the manual report. No log data is persisted or uploaded by the script.

`recordState()` tracks the last process/scheduling/scan decision per live element in a WeakMap. Unchanged results are counted without adding events; state changes remain visible. The shared 800-entry buffer evicts routine state entries first, protecting fetch/recovery/failure events until important history itself fills the cap. Both types of losses are reported.

`findNativeMediaOwner()` preserves the existing native-ownership decision and exposes its reason for diagnostics. Scheduling traces include native type/source/readiness/pause/error fields; changed native video errors also produce protected `native-media-error` events. Export snapshots prioritize viewport posts and cap samples at 12, adding playback time, visibility/rendered size, and fallback-video state. Cross-origin iframe/embed playback is not inspected.

`measureScan()` records aggregate durations for startup, navigation, integrity scans, and outer mutation batches without double-counting nested scans. Work at or above `debugSlowScanMs` produces a protected `scan-slow` event. Ordinary batches update snapshot counters without adding events. This measures the script's synchronous work, excluding asynchronous fetch/preload waits and other page code.

`sanitizeLogText()` removes known Reddit/Cloudflare challenge query parameters before retaining details and when formatting a report, including headers, snapshots, nested URL strings, and error text. Media URL query/hash components needed for diagnosis are preserved; runtime URLs are unchanged.

## Shared assumptions
- Runtime is Tampermonkey in the browser.
- Supported hosts are `www.reddit.com` and `sh.reddit.com`.
- The script depends on Reddit's DOM and can break when Reddit changes markup or data shape.

## Repository support layer
- `src/script-catalog.js` is the metadata source of truth.
- `build/check-userscripts.js` performs local syntax and header validation for maintained userscripts.
- `build/sync-docs.js` regenerates the script reference doc and README script summary from the catalog, preserving LF or CRLF without duplicating carriage returns.

## Recovery safeguards
Native images must be loaded with nonzero natural dimensions, a nonzero rendered box, and visible ancestors, including assigned slots and shadow hosts. Native videos and iframes reserve playback even while hidden or loading, restoring the 1.28 preference over preview reconstruction. Revealed-slot embed elements and async loaders also reserve playback. This deliberately favors native playback over reconstructing a potentially stuck native player; cross-origin playback state is inaccessible. Failed or empty post JSON results are evicted while successful and in-flight requests remain shared. Video variants modify the URL pathname and preserve query/hash components. Image preloads clean up listeners and settle on success, error, or timeout. Unexpected build exceptions restore the retry button.

The fallback video layer covers its host with an opaque black background and clips overflow. This prevents native media underneath from showing through letterboxed areas or edge gaps while the replacement plays. Native handoff still removes the fallback layer normally.

Every JSON and media-preload completion rechecks native ownership and whether the overlay still belongs to the connected host. Obsolete attempts return without inserting a replacement over a newly arrived stream.
