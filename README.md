# RedditNSFW

Current: **1.1.2**

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
- Run `log()` in the browser console on Reddit to download `reddit-nsfw-log.txt`.
- The file combines data from every loaded RedditNSFW script on the page.

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
Image Recreation 1.33 reserves native video and embed playback, including players still loading, and cancels obsolete fallback attempts after fetch/preload. It checks native image visibility and readiness, retries failed post JSON requests, preserves query parameters when probing video variants, and times out stalled image preloads.
