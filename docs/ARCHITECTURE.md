# Architecture

RedditNSFW keeps two separate browser-side strategies because they solve different failure modes on Reddit.

## Strategy Split

### Direct unblur
- Entry: `src/userscripts/reddit-unblur-extended.user.js`
- Purpose: remove or bypass Reddit's NSFW blur state when the native media container still works
- Primary mechanisms: property flip, attribute removal, reveal-button fallback, mutation reprocessing

### External media reconstruction
- Entry: `src/userscripts/reddit-unblur-external-layer.user.js`
- Purpose: rebuild a usable media layer when Reddit's own display path is insufficient
- Primary mechanisms: fetch post JSON, resolve image or video URLs, preload resolved media, inject custom overlay/media layer

## Shared assumptions
- Runtime is Tampermonkey in the browser.
- Supported hosts are `www.reddit.com` and `sh.reddit.com`.
- Both scripts depend on Reddit's DOM and can break when Reddit changes markup or data shape.

## Repository support layer
- `src/script-catalog.js` is the metadata source of truth.
- `build/check-userscripts.js` performs local syntax and header validation for maintained userscripts.
- `build/sync-docs.js` regenerates the script reference doc and README script summary from the catalog.
