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
      strategy: "Auto-flip the native blur state first, optionally click Reddit reveal controls, then fetch post JSON, resolve media URLs, and auto-build a replacement layer only when native media still fails.",
      hosts: ["https://www.reddit.com/*", "https://sh.reddit.com/*"],
      debug: [
        "Local DEBUG constant gates logging",
        "Console prefix: [Reddit External Unblur]",
        "Rescans on client-side navigation",
        "Falls back to a retry button only if automatic reconstruction fails"
      ],
      knobs: ["DEBUG", "mediaCache", "fallbackDelayMs", "preferNativeReveal", "useClickFallback", "videoRecoveryTimeoutMs", "URL change polling interval"]
    }
  }
};

module.exports = {
  SCRIPT_CATALOG
};

