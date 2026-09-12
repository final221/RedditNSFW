# Context

## Repo purpose
This repo tracks Reddit/Tampermonkey userscripts for NSFW media access on current Reddit surfaces. The repo is not a generic browser-userscript collection. The maintained Image Recreation script handles native blur removal and media reconstruction. The unused standalone Auto Unblur script was removed and remains in Git history.

## Primary files
- `src/userscripts/reddit-image-recreation.user.js`: maintained native-first unblur plus reconstruction script
- `src/script-catalog.js`: script inventory and doc-sync source of truth
- `Image failure.txt` and `Video Failure.txt`: preserved HTML failure examples

## Editing rule
- Change maintained behavior in `src/userscripts/`. The image recreation script now owns both the native auto-unblur pass and the reconstruction fallback path.
- When a maintained `.user.js` file changes, bump its Tampermonkey `@version` in the same change.
- Keep the root `.txt` files only as preserved raw references unless the user explicitly wants them updated too.

## Verify surface
- `npm run agent:verify` runs doc sync, userscript checks, build/version handling, extra sync checks, and `git status -sb`.
- This repo expects to be inside a git repo before normal verify/commit use.

## Field debugging
- `src/userscripts/reddit-image-recreation.user.js` now keeps a rolling in-memory trace for live failure diagnosis.
- `log()` in the browser console downloads `reddit-nsfw-log.txt` from the current page.
- The exported log is intended for copy-paste back into the repo discussion when a Reddit surface fails in the browser. It combines direct-unblur state with reconstruction events, including unstable cases where the fallback may build first and then yield back to native Reddit media later, no-op cases where fallback is skipped before fetch/build, and image cases where the recreated `<img>` exists in DOM but still does not visibly render or only becomes visible after the fallback seeds layout into a collapsed media host while honoring Reddit''s own height cap.




