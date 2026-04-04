# Architecture

RedditNSFW keeps two separate browser-side strategies because they solve different failure modes on Reddit.

## Strategy Split

### Direct unblur
- Entry: `src/userscripts/reddit-auto-unblur.user.js`
- Purpose: remove or bypass Reddit's NSFW blur state when the native media container still works
- Primary mechanisms: property flip, attribute removal, reveal-button fallback, mutation reprocessing

### External media reconstruction
- Entry: `src/userscripts/reddit-image-recreation.user.js`
- Purpose: rebuild a usable media layer when Reddit's own display path is insufficient
- Primary mechanisms: auto-flip Reddit's native blur state first, optionally click Reddit reveal controls, treat native galleries, revealed embeds, or actually visible media inside Reddit's blur wrapper as already-resolved, normalize comment permalinks back to their parent post URLs, then fetch post JSON, resolve image, video, or gallery media, rank better Reddit mp4 variants, preload the selected path, and auto-inject a custom fallback layer only when native handling still looks blocked; a flipped blur property alone does not suppress fallback recreation; fallback videos escalate to controls if autoplay never becomes usable
- Observability: the script keeps a rolling in-memory debug trace and can export it as `reddit-image-recreation-log.txt`, including normalized post URLs, candidate video URLs in probe order, the playable source that actually passed preload, and whether a built fallback later yielded back to Reddit native media

## Shared assumptions
- Runtime is Tampermonkey in the browser.
- Supported hosts are `www.reddit.com` and `sh.reddit.com`.
- Both scripts depend on Reddit's DOM and can break when Reddit changes markup or data shape.

## Repository support layer
- `src/script-catalog.js` is the metadata source of truth.
- `build/check-userscripts.js` performs local syntax and header validation for maintained userscripts.
- `build/sync-docs.js` regenerates the script reference doc and README script summary from the catalog.

