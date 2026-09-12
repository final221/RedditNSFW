# Architecture

RedditNSFW maintains one browser-side userscript. Image Recreation owns both native blur removal and media reconstruction; the unused standalone Auto Unblur script is retained only in Git history.

## Media handling

### Image Recreation
- Entry: `src/userscripts/reddit-image-recreation.user.js`
- Purpose: rebuild a usable media layer when Reddit's own display path is insufficient
- Primary mechanisms: auto-flip Reddit's native blur state first without automated Reddit reveal/login button clicks, treat native galleries, revealed embeds, or actually visible media inside Reddit's blur wrapper as already-resolved, normalize comment permalinks back to their parent post URLs, then fetch post JSON, resolve image, video, or gallery media, rank a capped set of Reddit mp4 guesses while preferring the declared Reddit source ahead of lower guessed variants, prefer resolved preview/media image URLs before fabricating direct `i.redd.it` links, seed fallback layout from blurred or preloaded media dimensions when Reddit collapses the media host, while respecting Reddit''s own max-height caps, preload the selected path, and auto-inject a custom fallback layer only when native handling still looks blocked; a flipped blur property alone does not suppress fallback recreation; fallback videos escalate to controls if autoplay never becomes usable; if Reddit rerenders away a built fallback layer while the surface is still blocked, the script retries on the refreshed host
- Observability: the script keeps a rolling in-memory trace that contributes to the combined `log()` export as `reddit-nsfw-log.txt`, including scan/process/scheduling decisions, normalized post URLs, candidate video URLs in probe order, the playable source that actually passed preload, fallback layout seeding details and height caps, fallback image render-state snapshots, whether a built fallback later yielded back to Reddit native media, and whether a previously built layer was lost and retried

## Shared assumptions
- Runtime is Tampermonkey in the browser.
- Supported hosts are `www.reddit.com` and `sh.reddit.com`.
- The script depends on Reddit's DOM and can break when Reddit changes markup or data shape.

## Repository support layer
- `src/script-catalog.js` is the metadata source of truth.
- `build/check-userscripts.js` performs local syntax and header validation for maintained userscripts.
- `build/sync-docs.js` regenerates the script reference doc and README script summary from the catalog.







