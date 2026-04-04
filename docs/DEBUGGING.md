# Debugging

## Direct unblur script
- Debug output is gated by local storage key `reddit-unblur-debug`.
- Console prefix: `[Reddit Unblur]`
- Runtime toggles:
- `Alt+U` toggles the script on or off
- `Alt+Shift+U` toggles debug logging

## External reconstruction script
- Debug output is gated by the local `DEBUG` constant for console logging.
- A separate rolling in-memory trace is always available for live export.
- Console prefix: `[Reddit External Unblur]`
- Export hooks:
- `Alt+Shift+R` downloads `reddit-image-recreation-log.txt`
- `window.redditImageRecreationExportLog()` triggers the same download manually
- Exported trace data includes:
- scan/process/scheduling decisions
- normalized post URLs
- candidate video URLs in probe order
- which video URL actually passed preload
- whether a built fallback later yielded back to Reddit native media
- media-type resolution and preload outcomes, including why fallback was skipped before fetch/build
- Main failure points:
- post JSON fetch failure
- media URL extraction failure or low-quality source ranking, especially when a lower guessed video variant wins before the declared Reddit source
- incorrect rewriting of `external-preview.redd.it` URLs into invalid `i.redd.it` URLs
- preload failure
- direct native unblur flipping the blur state/property without Reddit actually revealing usable media
- video or gif-like posts resolving to the wrong media type or URL, comment permalinks failing to normalize back to a post URL, gallery posts collapsing to a single item, or fallback videos becoming a dead autoplay-only layer
- Reddit DOM changes that prevent overlay attachment
- native Reddit controls, galleries, revealed embeds, or visible media inside the blur wrapper being present when the fallback heuristic expected a broken state

## First debugging pass
- Confirm which script line is responsible for the current issue.
- Check whether Reddit still renders a `shreddit-blurred-container`.
- Export the reconstruction trace before changing logic when the problem is live in the browser.
- For unstable cases where Reddit native media appears intermittently, check whether the trace contains `fallback-build-success` without a later `fallback-yielded-to-native`.
- Check whether the post JSON still exposes the needed media URLs.
- Check browser console output before changing logic.

