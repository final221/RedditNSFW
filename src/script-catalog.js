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
      strategy: "Flip the blurred state directly, remove the blur attribute, and fall back to clicking reveal-style controls.",
      hosts: ["https://www.reddit.com/*", "https://sh.reddit.com/*"],
      debug: [
        "Alt+U toggles the script on or off",
        "Alt+Shift+U toggles debug logging",
        "Console prefix: [Reddit Unblur]"
      ],
      knobs: ["includeSpoilers", "useClickFallback", "toastMs"]
    },
    imageRecreation: {
      name: "Reddit Image Recreation",
      file: "src/userscripts/reddit-image-recreation.user.js",
      sourceNote: "Imported from image recreation.txt",
      role: "Native-first script that auto-attempts direct unblur and only reconstructs media when Reddit still fails to reveal it cleanly.",
      strategy: "Auto-flip the native blur state first, optionally click Reddit reveal controls, normalize post URLs, rank better Reddit video sources while preferring the declared Reddit source ahead of lower guessed variants, auto-build a replacement layer only when native media still fails, yield back when Reddit native media resolves later, and keep an exportable field-debug trace for failed live cases.",
      hosts: ["https://www.reddit.com/*", "https://sh.reddit.com/*"],
      debug: [
        "Local DEBUG constant gates console logging",
        "Console prefix: [Reddit External Unblur]",
        "Alt+Shift+R downloads reddit-image-recreation-log.txt",
        "window.redditImageRecreationExportLog() triggers the same download",
        "Exported traces include normalized post URLs, candidate video URLs, the selected playable source, and native handoff events",
        "Rescans on client-side navigation",
        "Falls back to a retry button only if automatic reconstruction fails"
      ],
      knobs: ["DEBUG", "mediaCache", "fallbackDelayMs", "preferNativeReveal", "useClickFallback", "videoRecoveryTimeoutMs", "debugLogMaxEntries", "URL change polling interval"]
    }
  }
};

module.exports = {
  SCRIPT_CATALOG
};


