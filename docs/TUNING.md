# Tuning

## Direct unblur script knobs
- `includeSpoilers`: extends handling beyond NSFW blur cases
- `useClickFallback`: enables reveal-button fallback when direct property or attribute changes stop working
- `toastMs`: controls the local toast lifetime

## External reconstruction script knobs
- `DEBUG`: enables console logging for URL-resolution and rescan behavior
- `mediaCache`: memoizes per-post JSON lookups within the page session
- `fallbackDelayMs`: waits briefly before patching so Reddit-native reveal/media handling gets first priority
- `preferNativeReveal`: skips automatic patching when Reddit still exposes its own reveal controls
- `videoRecoveryTimeoutMs`: promotes fallback videos to visible controls when autoplay does not become usable quickly
- URL polling interval: the script currently rescans on a `500ms` interval to catch client-side navigation

## Tuning rule
- Prefer the smallest change that restores behavior on live Reddit pages.
- Treat broader scanning, faster polling, or heavier fetch behavior as higher-cost changes that need runtime justification.

