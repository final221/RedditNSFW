# Tuning

The standalone Auto Unblur script has been removed. These settings apply to the maintained Image Recreation script.

## Image Recreation script knobs
- `mediaCache`: shares in-flight and successful per-post JSON lookups; failures and empty results are evicted for retry
- `fallbackDelayMs`: waits briefly before patching so Reddit-native reveal/media handling gets first priority
- `preferNativeReveal`: disabled by default so login-gated Reddit reveal controls do not suppress reconstruction
- `useClickFallback`: disabled by default so Reddit login/register prompts are not opened repeatedly
- `imagePreloadTimeoutMs`: 8000ms deadline for each image preload; timed-out requests release their source and allow retry
- `videoRecoveryTimeoutMs`: promotes fallback videos to visible controls when autoplay does not become usable quickly
- `debugLogMaxEntries`: caps the rolling exportable trace buffer so field diagnostics do not grow without bound
- Video source ranking: probes a capped higher-quality ladder (`1080`, `720`), then the declared Reddit source, then lower fallbacks, and also checks the sibling `CMAF`/`DASH` family before giving up
- Integrity rescan interval: the script reprocesses live NSFW blur containers every `1500ms` so lost fallback layers can be recovered after Reddit rerenders
- URL polling interval: the script currently rescans on a `500ms` interval to catch client-side navigation

## Tuning rule
- Prefer the smallest change that restores behavior on live Reddit pages.
- Treat broader scanning, faster polling, or heavier fetch behavior as higher-cost changes that need runtime justification.

Native video/iframe presence and revealed embed loaders take priority over the fallback timer, even before playback starts. Reducing `fallbackDelayMs` does not override this guard.
