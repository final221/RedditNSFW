# RedditNSFW

Current: **1.2.1**

RedditNSFW maintains one Reddit/Tampermonkey userscript: Reddit Image Recreation. It attempts native blur removal and reconstructs media when Reddit's own display layer fails.

The maintained source lives under `src/userscripts/`. The unused standalone Auto Unblur script was removed; it remains recoverable from Git history.

## Current Scripts
<!-- SCRIPT_SUMMARY_START -->
- `Reddit Image Recreation` -> `src/userscripts/reddit-image-recreation.user.js`: Native-first script that auto-attempts direct unblur and only reconstructs media when Reddit still fails to reveal it cleanly.
<!-- SCRIPT_SUMMARY_END -->

## Repo Layout
- `src/userscripts/` contains the maintained userscript entry files.
- `src/script-catalog.js` is the single metadata source for script inventory and doc generation.
- `build/` contains the repo-local verify, build, commit, and doc-sync entrypoints.
- `docs/` holds the project docs, including generated script reference output.
- Root `.txt` files contain preserved failure examples for debugging.

## Field Logs
- Click the fixed **Copy log** button at the bottom right of Reddit. It stays visible while scrolling and copies diagnostics ready to paste into chat.
- If clipboard access is blocked, a panel opens with the entire log selected. Press Ctrl+C (or ⌘C), then paste it here. The panel also offers **Download log**.
- Run `log()` in the browser console on Reddit to download `reddit-nsfw-log.txt`.
- Both paths combine version/settings/page snapshots, state changes, media recovery failures, scan timing, and native-player diagnostics. Unchanged scan decisions are suppressed, and routine entries cannot evict recovery/failure history. Logs stay in memory until a page reload; nothing is uploaded automatically.
- Shared logs strip known Reddit/Cloudflare challenge parameters from URLs while retaining useful media query parameters. The media snapshot samples up to 12 posts, prioritizing those in the viewport.

## Workflow
- Run `BUMP=patch|minor|major|none npm run agent:verify`.
- Run `COMMIT_MSG="..." npm run agent:commit` after verify succeeds.
- Use `BUMP=none` for local-only verification when you do not want a version or changelog bump.
- Keep docs in sync with code changes in the same change set.

## Hosting
- GitHub account: `final221`
- Default repo target: `git@github.com:final221/RedditNSFW.git`
- Default branch: `main`

## Recovery behavior
Image Recreation 1.35 adds quieter diagnostic traces, protected recovery/failure history, scan timing, native-player state, and challenge-URL redaction to the fixed Copy log control and manual clipboard fallback. It retains native video and embed playback priority, cancels obsolete fallback attempts after fetch/preload, checks native image visibility and readiness, retries failed post JSON requests, preserves query parameters when probing video variants, and times out stalled image preloads.
