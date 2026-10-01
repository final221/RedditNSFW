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
      strategy: "Auto-flip the native blur state first without clicking Reddit reveal/login controls, normalize post URLs, rank capped Reddit video guesses while preferring the declared Reddit source ahead of lower guessed variants, prefer resolved preview/media image URLs before fabricating direct `i.redd.it` links, size single-image previews to the display box and screen pixel density with observed Reddit CDN support, advertised/loaded aspect checks, and original-source recovery, preserve the first fallback deadline across rescans, seed fallback layout from blurred or preloaded media dimensions when Reddit collapses the media host, while respecting native max-height caps, auto-build a replacement layer only when native media still fails, reserve native video/iframe and revealed embed playback even while loading, yield back to visible loaded native images, cancel obsolete fallback attempts after fetch/preload, recover when Reddit rerenders away a built fallback layer, retry failed post JSON requests, preserve video URL query parameters, bound image preload waits, cover underlying native media with an opaque clipped video layer, and keep an exportable field-debug trace for failed live cases.",
      hosts: ["https://www.reddit.com/*", "https://sh.reddit.com/*"],
      debug: [
        "Console prefix: [Reddit External Unblur]",
        "Fixed bottom-right Copy log button copies diagnostics while scrolling; clipboard failures open a selected text area with Download log",
        "Copied and downloaded reports share version/config/page snapshots, session metadata, suppressed/discarded event counts, and the bounded event trace",
        "Unchanged per-element scan/process/scheduling decisions are suppressed; routine state entries cannot evict fetch/recovery/failure history",
        "Diagnostics include synchronous scan timings and slow-batch events, native ownership reasons and player errors, and up to 12 viewport-prioritized media snapshots with playback time and visibility",
        "Known Reddit/Cloudflare challenge parameters are stripped from stored/exported log URLs; media query/hash diagnostics are preserved",
        "debugConsole gates console output (disabled by default); the in-memory trace remains active and resets on reload",
        "Console command log() downloads reddit-nsfw-log.txt with combined data from loaded RedditNSFW scripts",
        "window.redditNSFWExportLog() and window.redditImageRecreationExportLog() are aliases for the same combined download when present",
        "Exported traces include scan/process/scheduling decisions, normalized post URLs, candidate video URLs, the selected playable source, fallback layout seeding details and height caps, fallback image render-state snapshots, native handoff events, and lost-layer recovery events",
        "Image diagnostics include selected/original sources, candidate host/rejection counts, target/source dimensions, actual/intended fallback wait, and fetch/preload/build elapsed times; identical render states are suppressed, detached images are marked, and native handoff height/ownership changes are recorded",
        "Rescans on client-side navigation",
        "Falls back to a retry button only if automatic reconstruction fails"
      ],
      knobs: ["mediaCache", "fallbackDelayMs", "preferNativeReveal", "useClickFallback", "videoRecoveryTimeoutMs", "imagePreloadTimeoutMs", "useSizedImagePreviews", "debugLogMaxEntries", "debugSlowScanMs", "debugConsole", "URL change polling interval"]
    }
  }
};

module.exports = {
  SCRIPT_CATALOG
};







