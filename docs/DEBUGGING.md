# Debugging

## Image Recreation script
- Console output and the rolling in-memory trace are always active.
- Console prefix: `[Reddit External Unblur]`
- Exported trace data includes:
- scan/process/scheduling decisions
- normalized post URLs
- candidate video URLs in probe order
- which video URL actually passed preload
- whether a built fallback later yielded back to Reddit native media
- whether a previously built fallback layer was lost and retried
- fallback layout seeding details, including whether the host needed an injected min-height and which height cap was applied
- fallback image render-state snapshots, including load/error, natural dimensions, rendered box size, and computed visibility
- media-type resolution and preload outcomes, including why fallback was skipped before fetch/build
- Main failure points:
- Reddit login/register prompts appearing means automated reveal clicking should remain disabled
- post JSON fetch failure
- media URL extraction failure or low-quality source ranking, especially when a lower guessed video variant wins before the declared Reddit source
- fallback gallery or image layers building successfully while the recreated `<img>` loads but the host/frame collapses to zero height, expands past Reddit''s intended media cap, or the image becomes visually hidden after insertion
- preload failure
- direct native unblur flipping the blur state/property without Reddit actually revealing usable media
- video or gif-like posts resolving to the wrong media type or URL, comment permalinks failing to normalize back to a post URL, gallery posts collapsing to a single item, or fallback videos becoming a dead autoplay-only layer
- Reddit DOM changes that prevent overlay attachment or rerender a previously built fallback layer away
- native Reddit controls, galleries, revealed embeds, or visible media inside the blur wrapper being present when the fallback heuristic expected a broken state

## Combined export
- Run `log()` in the browser console on Reddit to download `reddit-nsfw-log.txt`.
- The file includes page metadata, snapshots from every loaded RedditNSFW script, and the combined event trace.
- `window.redditNSFWExportLog()` is the explicit alias.
- `window.redditImageRecreationExportLog()` also calls the export. The removed standalone Auto Unblur script is no longer part of the maintained debug surface.

## First debugging pass
- Confirm Image Recreation is enabled and disable any old standalone Auto Unblur installation to avoid overlapping behavior.
- Check whether Reddit still renders a `shreddit-blurred-container`.
- Run `log()` before changing logic when the problem is live in the browser.
- For unstable cases where Reddit native media appears intermittently, check whether the trace contains `fallback-build-success` without a later `fallback-yielded-to-native`.
- For disappearing fallback cases, check whether the trace contains `fallback-layer-lost`.
- Check whether the post JSON still exposes the needed media URLs.
- Check browser console output before changing logic.

## Recovery failures
`fetch-post-data-failed` records HTTP, network, or JSON errors; these failures are evicted so Try again can fetch afresh. `image-preload-timeout` records an image that exceeded its preload deadline. `fallback-build-error` records unexpected build exceptions and restores Try again. Startup reports userscript version 1.33 (restored 1.31 behavior). Loading native players and revealed embed loaders reserve playback again; cross-origin iframe playback still cannot be verified.

For a second animation showing along a fallback video edge, confirm userscript 1.30 or newer is installed. Its video layer uses an opaque black background and clips overflow to hide underlying Reddit media around the fitted video. This addresses layer bleed-through; it does not diagnose artifacts encoded in the video itself.

If a preview image covers an actual stream, use 1.31 or newer: 1.29 relaxed native-player ownership and allowed fallback reconstruction too early. Version 1.30 only masked edge bleed-through. Version 1.31 restores native playback priority and invalidates obsolete work after fetch/preload. A stuck native player may consequently remain native, as in 1.28; capture log() and the affected media DOM before changing this priority again.
