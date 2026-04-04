# RedditNSFW Agent Workflow

## Single entrypoint
- This file is the authoritative agent workflow for this repo.
- Keep process rules here. Keep other docs focused on architecture, context, debugging, and tuning.

## Efficiency-first stance
- Prioritize the thinnest path that preserves userscript correctness and repo clarity.
- Keep the two script lines separate unless there is a concrete runtime reason to merge them.
- Do not add process docs or extra tooling unless they reduce real maintenance cost.

## Honesty over agreeableness
- Say when a request would blur the separation between direct unblur logic and media reconstruction logic.
- Push back on changes that make the scripts harder to debug on live Reddit surfaces.

## Discussion-first
- When the user is asking for strategy, comparisons, or scope decisions, do not edit files or run builds.
- When the user asks to implement, carry through to a working repo state.

## Start
- `package.json`
- `build/agent-verify.js`
- `build/agent-commit.js`
- `build/build.js`
- `build/sync-docs.js`
- `docs/CONTEXT.md`
- `docs/ARCHITECTURE.md`
- `docs/SCRIPTS.md`

## Agent quick map
- Entry point: `src/userscripts/`
- Main logic map: `src/script-catalog.js`
- Core subsystem A: `src/userscripts/reddit-auto-unblur.user.js`
- Core subsystem B: `src/userscripts/reddit-image-recreation.user.js`
- Core subsystem C: `build/` repo workflow scripts
- Logging / observability: browser console logs inside the userscripts and `docs/DEBUGGING.md`

## Workflow (always)
1. Make changes and update tests or checks when behavior changes.
2. Choose bump policy, set `BUMP=patch|minor|major|none`, then run `npm run agent:verify`.
3. Set `COMMIT_MSG="..."` and run `npm run agent:commit` if verify succeeds.

- Preferred workflow entrypoints are `agent:verify` and `agent:commit`.
- `BUMP=none` is the local-only verify path. Use it for exploratory setup or docs-only validation when no release metadata change is wanted.
- Doc-only changes still run `BUMP=none npm run agent:verify`. Do not skip verification in this repo.
- Any change to a maintained `.user.js` file must also bump that script's Tampermonkey `@version` in the same change, even when `BUMP=none`.
- When reporting verification, include any warnings or skipped checks.
- Documentation sync is mandatory whenever script behavior, config flags, debug hooks, file layout, or workflow changes.

## Structural contracts
- Every maintained userscript file must keep a valid Tampermonkey header block.
- Every maintained userscript change must update that file's `@version` header so Tampermonkey can detect updates.
- Root `.txt` files are preserved intake references. Maintained changes belong in `src/userscripts/` unless the user explicitly asks to update the raw baselines too.
- `src/script-catalog.js` is the source of truth for generated script docs and README script inventory.
- Generated files must be updated in the same change: `docs/SCRIPTS.md`, `docs/CHANGELOG.md`, and `build/version.txt` when applicable.
- Warning target: keep repo-local verification warnings at `0`.

## Bump / release policy
- Patch: repo plumbing, docs, refactors, tests, metadata, or behavior-preserving script maintenance
- Minor: new user-visible script behavior, new recovery paths, or new supported Reddit cases
- Major: breaking changes to script usage, installation path, runtime expectations, or repo interface
- None: local-only verification without version or changelog movement

## Constraints
- Generated files: `docs/SCRIPTS.md`, `docs/CHANGELOG.md`, `build/version.txt`
- Packaging / build constraints: keep `package.json` scripts aligned with the repo-local `build/` entrypoints
- Runtime constraints: target Tampermonkey in the browser on `https://www.reddit.com/*` and `https://sh.reddit.com/*`
- Logging / observability contract: debug output must be intentionally gated and documented
- File size / refactor threshold: if a maintained userscript becomes difficult to reason about, split helpers before adding more behavior
- Public hooks / entrypoint changes must update: `README.md`, `docs/CONTEXT.md`, `docs/ARCHITECTURE.md`, `docs/DEBUGGING.md`, `docs/TUNING.md`
- Keep docs explicitly in sync with the changed surface:
- Architecture / flow / subsystem interaction docs -> `docs/ARCHITECTURE.md`
- Navigation / hot paths / debug hooks / AI orientation docs -> `docs/CONTEXT.md`
- Debugging / operations docs -> `docs/DEBUGGING.md`
- Tuning / thresholds / knobs docs -> `docs/TUNING.md`
- Generated script reference docs -> `docs/SCRIPTS.md`

## Quick refs
- `docs/CONTEXT.md`
- `docs/ARCHITECTURE.md`
- `docs/DEBUGGING.md`
- `docs/TUNING.md`
- `docs/SCRIPTS.md`
