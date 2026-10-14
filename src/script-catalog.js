const SCRIPT_CATALOG = {
  project: {
    name: "RedditNSFW",
    repo: "final221/RedditNSFW",
    runtime: "Tampermonkey on reddit.com and sh.reddit.com",
    maintainedEntries: "src/userscripts/",
    intakeReferences: ["Image failure.txt", "Video Failure.txt"]
  },
  scripts: {
    imageRecreation: {
      name: "Reddit Image Recreation",
      file: "src/userscripts/reddit-image-recreation.user.js",
      sourceNote: "Originally imported from image recreation.txt; the original intake is no longer in the working tree",
      role: "Native-first script that auto-attempts direct unblur and only reconstructs media when Reddit still fails to reveal it cleanly.",
      strategy: "Auto-flip the native blur state first without clicking Reddit reveal/login controls, normalize post URLs, rank capped Reddit video guesses while preferring the declared Reddit source ahead of lower guessed variants, prefer resolved preview/media image URLs before fabricating direct `i.redd.it` links, size single-image previews to the display box and screen pixel density with observed Reddit CDN support, advertised/loaded aspect checks, and original-source recovery, defer automatic reconstruction outside the viewport preload range, preserve the first eligible fallback deadline across rescans, promote nearby renderable sharp native pictures from lazy to eager without changing source selection, yield obsolete overlays immediately on usable native image loads, seed fallback layout from blurred or preloaded media dimensions when Reddit collapses the media host, while respecting native max-height caps, auto-build a replacement layer only when native media still fails, reserve native video/iframe and revealed embed playback even while loading, yield back to visible loaded native images, cancel obsolete fallback attempts after fetch/preload, recover when Reddit rerenders away a built fallback layer, retry failed post JSON requests, preserve video URL query parameters, bound image preload waits, cover underlying native media with an opaque clipped video layer, and keep an exportable field-debug trace for failed live cases.",
      hosts: ["https://www.reddit.com/*", "https://sh.reddit.com/*"],
      debug: [
        "Console prefix: [Reddit External Unblur]",
        "Fixed bottom-right Copy log button copies diagnostics while scrolling; clipboard failures open a selected text area with Download log",
        "Copied and downloaded reports share version/config/page snapshots, session metadata, retained/repeated observation counts, and complete session history",
        "Every recorded decision, repeat, error, and timestamp is retained; identical serialized payloads share storage without event eviction",
        "Diagnostics include synchronous scan timings and slow-batch events, native ownership reasons and player errors, and all matching media snapshots, prioritized by viewport with playback time and visibility",
        "Foreground timer lateness and scroll frame gaps complement per-reason script timing, including native callbacks; lossless report dictionaries compact repeated event details and URLs, and outer snapshots remain indented with complete images on compact JSON rows",
        "Known Reddit/Cloudflare challenge parameters are stripped from stored/exported log URLs; media query/hash diagnostics are preserved",
        "debugConsole gates console output (disabled by default); the in-memory trace remains active and resets on reload",
        "Console command log() downloads reddit-nsfw-log.txt with combined data from loaded RedditNSFW scripts",
        "window.redditNSFWExportLog() and window.redditImageRecreationExportLog() are aliases for the same combined download when present",
        "Exported traces include scan/process/scheduling decisions, normalized post URLs, candidate video URLs, the selected playable source, fallback layout seeding details and height caps, fallback image render-state snapshots, native handoff events, and lost-layer recovery events",
        "Image diagnostics include selected/original sources, candidate host/rejection counts, target/source dimensions, actual/intended fallback wait, and fetch/preload/build elapsed times; identical render observations retain their phases and timestamps, detached images are marked, native handoff height/ownership changes are recorded immediately and over two frames plus 250ms, and timer/source/load viewport snapshots relate waits to scrolling",
        "Viewport eligibility traces, native image state/events with stable element IDs and source observation times, complete observed image-request timings with explicit coverage and matching entries on export, and JSON failure response metadata diagnose late pictures; nearby load bursts share one follow-up per host",
        "Rescans on client-side navigation",
        "Nearby native loading-hint promotions retain source/element identity and viewport position; recovery keeps the 1200ms grace and distinguishes unfinished native loading from failed recovery in small actionable corner controls",
        "Falls back to a retry button only if automatic reconstruction fails"
      ],
      knobs: ["mediaCache", "fallbackDelayMs", "preloadNativeImages", "nativeImagePreloadMarginPx", "fallbackViewportMarginPx", "preferNativeReveal", "useClickFallback", "videoRecoveryTimeoutMs", "imagePreloadTimeoutMs", "useSizedImagePreviews", "debugSlowScanMs", "debugFrameGapMs", "debugTimerLagMs", "debugConsole", "URL change polling interval"]
    }
  }
};

module.exports = {
  SCRIPT_CATALOG
};







