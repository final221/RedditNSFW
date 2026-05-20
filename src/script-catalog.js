const SCRIPT_CATALOG = {
  project: {
    name: "RedditNSFW",
    repo: "final221/RedditNSFW",
    runtime: "Tampermonkey on reddit.com and sh.reddit.com",
    maintainedEntries: "src/userscripts/",
    intakeReferences: ["Unblur.txt", "image recreation.txt"]
  },
  scripts: {
    unblur: {
      name: "Reddit Auto Unblur",
      file: "src/userscripts/reddit-auto-unblur.user.js",
      sourceNote: "Imported from Unblur.txt",
      role: "Primary script for direct blur removal when Reddit still renders the native media container correctly.",
      strategy: "Flip the blurred state directly, remove the blur attribute, avoid automated Reddit button clicks so login/register prompts are not spammed, and keep an exportable field-debug trace for failed live cases.",
      hosts: ["https://www.reddit.com/*", "https://sh.reddit.com/*"],
      debug: [
        "Alt+U toggles the script on or off",
        "Console prefix: [Reddit Unblur]",
        "Console command log() downloads reddit-nsfw-log.txt with combined data from loaded RedditNSFW scripts",
        "window.redditNSFWExportLog(), window.redditAutoUnblurExportLog(), and window.redditImageRecreationExportLog() are aliases for the same combined download when present",
        "Exported traces include start/toggle state, processed blur containers, skipped reveal-click state, and a current page snapshot of matching Reddit blur containers"
      ],
      knobs: ["includeSpoilers", "useClickFallback", "toastMs", "debugLogMaxEntries"]
    },
    imageRecreation: {
      name: "Reddit Image Recreation",
      file: "src/userscripts/reddit-image-recreation.user.js",
      sourceNote: "Imported from image recreation.txt",
      role: "Native-first script that auto-attempts direct unblur and only reconstructs media when Reddit still fails to reveal it cleanly.",
      strategy: "Auto-flip the native blur state first without clicking Reddit reveal/login controls, normalize post URLs, rank capped Reddit video guesses while preferring the declared Reddit source ahead of lower guessed variants, prefer resolved preview/media image URLs before fabricating direct `i.redd.it` links, seed fallback layout from blurred or preloaded media dimensions when Reddit collapses the media host, while respecting native max-height caps, auto-build a replacement layer only when native media still fails, yield back when Reddit native media resolves later, recover when Reddit rerenders away a built fallback layer, and keep an exportable field-debug trace for failed live cases.",
      hosts: ["https://www.reddit.com/*", "https://sh.reddit.com/*"],
      debug: [
        "Console prefix: [Reddit External Unblur]",
        "Console command log() downloads reddit-nsfw-log.txt with combined data from loaded RedditNSFW scripts",
        "window.redditNSFWExportLog(), window.redditAutoUnblurExportLog(), and window.redditImageRecreationExportLog() are aliases for the same combined download when present",
        "Exported traces include scan/process/scheduling decisions, normalized post URLs, candidate video URLs, the selected playable source, fallback layout seeding details and height caps, fallback image render-state snapshots, native handoff events, and lost-layer recovery events",
        "Rescans on client-side navigation",
        "Falls back to a retry button only if automatic reconstruction fails"
      ],
      knobs: ["mediaCache", "fallbackDelayMs", "preferNativeReveal", "useClickFallback", "videoRecoveryTimeoutMs", "debugLogMaxEntries", "URL change polling interval"]
    }
  }
};

module.exports = {
  SCRIPT_CATALOG
};







