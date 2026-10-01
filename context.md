**AGENTS DO NOT TOUCH THIS PART** 

How to use:
review it after every run, but edit it only when durable knowledge changed. keep info retained compact but lossless. Extract general knowledge from your context and give it to the file
what it should contain:
- distilled general knowledge gathered about the repo
- distilled user preferences on how to work
- principles that apply across multiple repository areas
- durable cross-cutting context
- Enter and edit sections as needed

what it should not contain
- recent crash reports
- recent crash fixes
- anything specific about earlier runs, any summaries
- current status about loggings, telemetry
- recent fixes
- reproduce what is already encoded in other documentation
- current project status
- everything that is not durable cross-cutting context
- claim summaries
- audit defects
- repository mechanics: placement, ownership, verification, archival, lifecycle, or partition rules
- named constructions, claims, current candidates, counterexamples, audit findings, or rejected mechanisms
- representation surveys or map-specific technical details


****


## User working preferences

- For this repository, the user authorizes commits and pushes of changes to `origin` without per-commit confirmation. Use the configured GitHub SSH remote, which is authenticated without requiring the user to supply credentials. This is user authorization; it does not bypass the app's sandbox or automated-review gates. Follow those system gates without asking the user to repeat the standing authorization.
- A request to discuss, assess, or suggest optional work is not approval to implement it. Explain tradeoffs and work only on the selected step; do not add speculative changes just to finish a plan.
- For multi-step code reviews, the user prefers a clear ordered plan with progress reported as each step is completed.
- The user shares browser diagnostics by pasting them into this chat. Prefer directly copyable reports and controls that remain accessible while scrolling; downloading a file is a supplementary option.
- The user judges feed responsiveness by whether images are ready during continuous scrolling; eventual successful loading alone does not meet the browsing goal.
- Performance and reliability investigations should proactively add or refine bounded, low-cost logging or counters to verify changes and distinguish plausible causes when existing evidence leaves important questions unanswered. Do this during the current investigation; do not stop at stating uncertainty or wait for a separate request. The user explicitly authorizes these diagnostic improvements. Keep normal browsing quiet and cheap. When reporting an unresolved cause, explain which diagnostic gap was addressed and what the next capture can establish.
- The user authorizes the assistant to maintain the editable durable-context sections of this file when lasting repository knowledge or preferences change, following the protected instructions above. Routine maintenance of those sections does not require another permission request.

## Cross-cutting repository knowledge

- A diagnostic capture establishes what was observed during its coverage. Missing errors or successful intermediate operations do not establish that unobserved intermittent problems are absent or that the user's media experience is healthy. Separate observations, plausible explanations, and unmeasured behavior when interpreting evidence.
- Media cost depends on source dimensions as well as displayed size. A small on-screen image can still require a large transfer and decoded allocation; consider both when investigating responsiveness or evaluating media-source choices.
