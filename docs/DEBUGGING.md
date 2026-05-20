# Debugging

## Direct unblur script
- Console output and the rolling in-memory trace are always active.
- Console prefix: `[Reddit Unblur]`
- Runtime toggles:
- `Alt+U` toggles the script on or off
- Exported trace data includes:
- script start and toggle state
- processed `shreddit-blurred-container` details
- skipped reveal-click state when automated clicking is disabled
- current page snapshot of matching Reddit blur containers

## External reconstruction script
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
- `window.redditAutoUnblurExportLog()` and `window.redditImageRecreationExportLog()` still call the combined export when those scripts are loaded.

## First debugging pass
- Confirm which script line is responsible for the current issue.
- Check whether Reddit still renders a `shreddit-blurred-container`.
- Run `log()` before changing logic when the problem is live in the browser.
- For unstable cases where Reddit native media appears intermittently, check whether the trace contains `fallback-build-success` without a later `fallback-yielded-to-native`.
- For disappearing fallback cases, check whether the trace contains `fallback-layer-lost`.
- Check whether the post JSON still exposes the needed media URLs.
- Check browser console output before changing logic.






