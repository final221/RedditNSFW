# Tuning

## Direct unblur script knobs
- `includeSpoilers`: extends handling beyond NSFW blur cases
- `useClickFallback`: enables reveal-button fallback when direct property or attribute changes stop working
- `toastMs`: controls the local toast lifetime
- `debugLogMaxEntries`: caps the rolling exportable trace buffer so field diagnostics do not grow without bound

## External reconstruction script knobs
- `mediaCache`: memoizes per-post JSON lookups within the page session
- `fallbackDelayMs`: waits briefly before patching so Reddit-native reveal/media handling gets first priority
- `preferNativeReveal`: skips automatic patching when Reddit still exposes its own reveal controls
- `useClickFallback`: clicks Reddit reveal-style controls when direct blur-state flips do not take effect
- `videoRecoveryTimeoutMs`: promotes fallback videos to visible controls when autoplay does not become usable quickly
- `debugLogMaxEntries`: caps the rolling exportable trace buffer so field diagnostics do not grow without bound
- Video source ranking: probes a capped higher-quality ladder (`1080`, `720`), then the declared Reddit source, then lower fallbacks, and also checks the sibling `CMAF`/`DASH` family before giving up
- Integrity rescan interval: the script reprocesses live NSFW blur containers every `1500ms` so lost fallback layers can be recovered after Reddit rerenders
- URL polling interval: the script currently rescans on a `500ms` interval to catch client-side navigation

## Tuning rule
- Prefer the smallest change that restores behavior on live Reddit pages.
- Treat broader scanning, faster polling, or heavier fetch behavior as higher-cost changes that need runtime justification.
