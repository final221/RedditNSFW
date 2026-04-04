# RedditNSFW

Current: **0.6.0**

RedditNSFW is a Reddit/Tampermonkey userscript repo focused on two related but separate problems on modern Reddit surfaces:
- direct NSFW blur removal when Reddit still renders the media container correctly
- external media reconstruction when Reddit's own display layer fails or degrades

The current working sources still exist in the repo root as intake baselines:
- `Unblur.txt`
- `image recreation.txt`

The maintained script entries live under `src/userscripts/`.

## Current Scripts
<!-- SCRIPT_SUMMARY_START -->
- `Reddit Auto Unblur` -> `src/userscripts/reddit-auto-unblur.user.js`: Primary script for direct blur removal when Reddit still renders the native media container correctly.
- `Reddit Image Recreation` -> `src/userscripts/reddit-image-recreation.user.js`: Native-first script that auto-attempts direct unblur and only reconstructs media when Reddit still fails to reveal it cleanly.
<!-- SCRIPT_SUMMARY_END -->

## Repo Layout
- `src/userscripts/` contains the maintained userscript entry files.
- `src/script-catalog.js` is the single metadata source for script inventory and doc generation.
- `build/` contains the repo-local verify, build, commit, and doc-sync entrypoints.
- `docs/` holds the project docs, including generated script reference output.
- Root `.txt` files are preserved as raw intake/reference material, not the primary maintained entries.

## Workflow
- Run `BUMP=patch|minor|major|none npm run agent:verify`.
- Run `COMMIT_MSG="..." npm run agent:commit` after verify succeeds.
- Use `BUMP=none` for local-only verification when you do not want a version or changelog bump.
- Keep docs in sync with code changes in the same change set.

## Hosting
- GitHub account: `final221`
- Default repo target: `git@github.com:final221/RedditNSFW.git`
- Default branch: `main`
