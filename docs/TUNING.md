# Tuning

The standalone Auto Unblur script has been removed. These settings apply to the maintained Image Recreation script.

## Image Recreation script knobs
- `mediaCache`: shares in-flight and successful per-post JSON lookups; failures and empty results are evicted for retry
- `fallbackDelayMs`: 1200ms grace period from the first unblocked fallback decision for a host/container/post; rescans preserve the pending deadline, and native arrival cancels it
- `preferNativeReveal`: disabled by default so login-gated Reddit reveal controls do not suppress reconstruction
- `useClickFallback`: disabled by default so Reddit login/register prompts are not opened repeatedly
- `useSizedImagePreviews`: true by default; reconstructed single images use the smallest advertised full-frame preview covering the measured box at screen pixel density. Animation, missing sizing data, or insufficient previews retain the original. A failed preview retries the original while ownership remains valid. Set false to always use the original selected image source.
- `imagePreloadTimeoutMs`: 8000ms deadline for each image preload; timed-out requests release their source and allow retry
- `videoRecoveryTimeoutMs`: promotes fallback videos to visible controls when autoplay does not become usable quickly
- `debugLogMaxEntries`: 400 by default; the shared reporter retains twice this value (800 events) and reports discarded events (including important-history losses) and suppressed repeats. Unchanged per-element decisions are suppressed; overflow discards routine state before fetch/recovery/failure events. Both Copy log and downloads read this bounded in-memory buffer.
- `debugSlowScanMs`: 50ms by default; synchronous scan/mutation batches at or above this threshold emit `scan-slow`. Normal batches update aggregate timing snapshots only.
- `debugConsole`: false by default; enables `[Reddit External Unblur]` console output when true. Copy log and downloads remain available either way.
- Video source ranking: probes a capped higher-quality ladder (`1080`, `720`), then the declared Reddit source, then lower fallbacks, and also checks the sibling `CMAF`/`DASH` family before giving up
- Integrity rescan interval: the script reprocesses live NSFW blur containers every `1500ms` so lost fallback layers can be recovered after Reddit rerenders
- URL polling interval: the script currently rescans on a `500ms` interval to catch client-side navigation

The Copy log control uses viewport-fixed positioning and is reattached by the existing 1500ms integrity rescan. It adds no extra polling interval and does not change media recovery timing. Player progress, visibility/rendered boxes, and up to 12 viewport-prioritized media samples are collected only on export; regular status comparisons omit playback time. Clipboard access is requested only on a button click; failed access opens a manual-copy panel.

## Tuning rule
- Prefer the smallest change that restores behavior on live Reddit pages.
- Treat broader scanning, faster polling, or heavier fetch behavior as higher-cost changes that need runtime justification.

Native video/iframe presence and revealed embed loaders take priority over the fallback timer, even before playback starts. Reducing `fallbackDelayMs` does not override this guard.
