# Tuning

The standalone Auto Unblur script has been removed. These settings apply to the maintained Image Recreation script.

## Image Recreation script knobs
- `mediaCache`: shares in-flight and successful per-post JSON lookups; failures and empty results are evicted for retry
- `fallbackDelayMs`: 1200ms grace period from the first unblocked fallback decision within the preload range for a host/container/post; rescans preserve the pending deadline, native arrival cancels it, and leaving range defers work until a fresh entry
- `fallbackViewportMarginPx`: 1000px above/below the viewport; distant hosts defer automatic reconstruction while native unblur continues. A shared IntersectionObserver resumes processing on entry; integrity rescans provide fallback when the API is unavailable and prune detached/reparented hosts. The timer rechecks eligibility before starting reconstruction. Native image load events also cancel obsolete work and yield custom layers immediately.
- `preferNativeReveal`: disabled by default so login-gated Reddit reveal controls do not suppress reconstruction
- `useClickFallback`: disabled by default so Reddit login/register prompts are not opened repeatedly
- `useSizedImagePreviews`: true by default; reconstructed single images use the smallest advertised aspect-matching preview covering the measured box at screen pixel density. Animation, missing sizing data, or insufficient previews retain the original. The preview classifier accepts the observed `cf.preview.redd.it` CDN host. Smart-crop candidates retain signed URLs and must match the original aspect ratio in metadata and after loading; other crop modes are excluded. A failed or mismatched preview retries the original while ownership remains valid. Set false to always use the original selected image source.
- `imagePreloadTimeoutMs`: 8000ms deadline for each image preload; timed-out requests release their source and allow retry
- `videoRecoveryTimeoutMs`: promotes fallback videos to visible controls when autoplay does not become usable quickly
- `debugLogMaxEntries`: 400 by default; the shared reporter retains twice this value (800 events) and reports discarded events (including important-history losses) and suppressed repeats. Unchanged per-element decisions are suppressed; overflow discards routine state before fetch/recovery/failure events. Identical image render states across phases are also suppressed; errors and state changes remain. Both Copy log and downloads read this bounded in-memory buffer.
- `debugSlowScanMs`: 50ms by default; synchronous scan/mutation batches at or above this threshold emit `scan-slow`. Normal batches update aggregate timing snapshots only.
- `debugFrameGapMs`: 100ms by default; foreground frame-callback gaps during scroll bursts increment `pagePerformance.frames` counters. `scroll-frame-gap` events are limited to one per 1500ms; every slow sample still contributes to the counters.
- `debugTimerLagMs`: 100ms by default; lateness of the existing 1500ms integrity interval increments `pagePerformance.timer` counters and emits `page-timer-lag` at this threshold. Hidden-tab timing is excluded and visibility changes reset timing baselines.
- `debugConsole`: false by default; enables `[Reddit External Unblur]` console output when true. Copy log and downloads remain available either way.
- Video source ranking: probes a capped higher-quality ladder (`1080`, `720`), then the declared Reddit source, then lower fallbacks, and also checks the sibling `CMAF`/`DASH` family before giving up
- Integrity rescan interval: the script reprocesses live NSFW blur containers every `1500ms` so lost fallback layers can be recovered after Reddit rerenders
- URL polling interval: the script currently rescans on a `500ms` interval to catch client-side navigation

The Copy log control uses viewport-fixed positioning and is reattached by the existing 1500ms integrity rescan. It adds no extra polling interval and does not change media recovery timing. Image handoffs add at most two animation-frame checks and one 250ms timeout, grouped into one retained event; hidden tabs skip frame checks and late callbacks stop at the final sample. Media-wait viewport snapshots are sampled at fallback timer firing, source selection, and load completion; native image events and observer entries also record viewport position. These samples add no polling. The separate passive timing listener samples frame gaps during scroll bursts, ends its frame chain 250ms after the last scroll event, and performs no DOM queries or geometry reads. Foreground timer-lag sampling reuses the integrity interval. Player progress and up to 12 viewport-prioritized post snapshots are collected on export; regular status comparisons omit playback time. Nearby native image boxes are additionally sampled during existing processing and native image load/error handling. Clipboard access is requested only on a button click; failed access opens a manual-copy panel.

## Tuning rule
- Native image state samples inspect at most three images per nearby host during existing processing, at captured load/error events, and once 250ms after a load. Export adds the same capped image details to at most 12 post snapshots. These samples record changes rather than scroll positions and add no polling interval.
- Prefer the smallest change that restores behavior on live Reddit pages.
- Treat broader scanning, faster polling, or heavier fetch behavior as higher-cost changes that need runtime justification.

Native video/iframe presence and revealed embed loaders take priority over the fallback timer, even before playback starts. Reducing `fallbackDelayMs` does not override this guard.
