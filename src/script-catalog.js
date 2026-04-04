const SCRIPT_CATALOG = {
  project: {
    name: "RedNSFW",
    repo: "final221/RedNSFW",
    runtime: "Tampermonkey on reddit.com and sh.reddit.com",
    maintainedEntries: "src/userscripts/",
    intakeReferences: ["Unblur.txt", "image recreation.txt"]
  },
  scripts: {
    unblur: {
      name: "Reddit Unblur Extended",
      file: "src/userscripts/reddit-unblur-extended.user.js",
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
      name: "Reddit Unblur External Layer",
      file: "src/userscripts/reddit-unblur-external-layer.user.js",
      sourceNote: "Imported from image recreation.txt",
      role: "Fallback script for Reddit media display failures where direct unblur is not enough.",
      strategy: "Fetch post JSON, resolve media URLs, preload the asset, and inject a replacement display layer.",
      hosts: ["https://www.reddit.com/*", "https://sh.reddit.com/*"],
      debug: [
        "Local DEBUG constant gates logging",
        "Console prefix: [Reddit External Unblur]",
        "Rescans on client-side navigation"
      ],
      knobs: ["DEBUG", "mediaCache", "URL change polling interval"]
    }
  }
};

module.exports = {
  SCRIPT_CATALOG
};
