// ==UserScript==
// @name         Reddit Auto Unblur
// @namespace    https://tampermonkey.net/
// @version      1.5
// @description  Unblurs Reddit Shreddit NSFW media, with toggle/fallback/report support
// @match        https://www.reddit.com/*
// @match        https://sh.reddit.com/*
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function () {
    "use strict";

    const STORAGE_KEYS = {
        enabled: "reddit-unblur-enabled"
    };

    const CONFIG = {
        includeSpoilers: false,
        useClickFallback: true,
        toastMs: 1800,
        debugLogMaxEntries: 400
    };

    const REPORTER_KEY = "__redditNSFWLogReporter";

    function loadBool(key, fallback) {
        try {
            const raw = localStorage.getItem(key);
            return raw === null ? fallback : raw === "true";
        } catch {
            return fallback;
        }
    }

    function saveBool(key, value) {
        try {
            localStorage.setItem(key, String(value));
        } catch { }
    }

    function describeElement(el) {
        if (!(el instanceof Element)) {
            return String(el);
        }

        const buttonTexts = Array.from(el.querySelectorAll("button, [role=\"button\"]"))
            .slice(0, 8)
            .map((button) => (button.textContent || "").trim())
            .filter(Boolean);

        return {
            tag: el.tagName.toLowerCase(),
            id: el.id || null,
            className: el.className || null,
            reason: el.getAttribute("reason"),
            hasBlurredAttribute: el.hasAttribute("blurred"),
            blurredProperty: typeof el.blurred === "undefined" ? null : el.blurred,
            ariaLabel: el.getAttribute("aria-label"),
            text: (el.textContent || "").trim().slice(0, 160),
            revealButtons: buttonTexts
        };
    }

    function describeLogValue(value) {
        if (value instanceof Element) {
            return describeElement(value);
        }
        if (value instanceof Document) {
            return "[document]";
        }
        if (value instanceof Error) {
            return {
                name: value.name,
                message: value.message,
                stack: value.stack
            };
        }
        return value;
    }

    function getSharedLogReporter() {
        if (window[REPORTER_KEY]) {
            return window[REPORTER_KEY];
        }

        const reporter = {
            entries: [],
            maxEntries: CONFIG.debugLogMaxEntries * 2,
            snapshots: {},
            stringify(details) {
                if (details == null) {
                    return "";
                }
                if (typeof details === "string") {
                    return details;
                }

                try {
                    return JSON.stringify(details, (key, value) => describeLogValue(value), 2);
                } catch (err) {
                    return String(err?.message || details);
                }
            },
            registerSource(source, snapshotFn) {
                this.snapshots[source] = snapshotFn;
            },
            record(source, event, details) {
                const timestamp = new Date().toISOString();
                this.entries.push({
                    timestamp,
                    source,
                    event,
                    details: this.stringify(details)
                });
                if (this.entries.length > this.maxEntries) {
                    this.entries.splice(0, this.entries.length - this.maxEntries);
                }
            },
            export() {
                this.record("reporter", "export-log", {
                    page: location.href,
                    entries: this.entries.length
                });

                const lines = [
                    "RedditNSFW Combined Debug Log",
                    `Generated: ${new Date().toISOString()}`,
                    `Page: ${location.href}`,
                    `User agent: ${navigator.userAgent}`,
                    "",
                    "Snapshots"
                ];

                for (const [source, snapshotFn] of Object.entries(this.snapshots)) {
                    let snapshot;
                    try {
                        snapshot = snapshotFn();
                    } catch (err) {
                        snapshot = { error: err?.message || String(err) };
                    }
                    lines.push(`## ${source}`, this.stringify(snapshot));
                }

                lines.push("", "Events");
                for (const entry of this.entries) {
                    lines.push(`[${entry.timestamp}] ${entry.source}: ${entry.event}`);
                    if (entry.details) {
                        lines.push(entry.details);
                    }
                    lines.push("");
                }

                const blob = new Blob([lines.join("\n")], { type: "text/plain;charset=utf-8" });
                const objectUrl = URL.createObjectURL(blob);
                const anchor = document.createElement("a");
                anchor.href = objectUrl;
                anchor.download = "reddit-nsfw-log.txt";
                anchor.style.display = "none";
                (document.body || document.documentElement).appendChild(anchor);
                anchor.click();
                anchor.remove();
                setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
                return "reddit-nsfw-log.txt";
            }
        };

        window[REPORTER_KEY] = reporter;
        window.redditNSFWExportLog = () => reporter.export();
        window.log = window.redditNSFWExportLog;
        return reporter;
    }

    const sharedLog = getSharedLogReporter();
    let enabled = loadBool(STORAGE_KEYS.enabled, true);

    function log(...args) {
        console.log("[Reddit Unblur]", ...args);
    }

    function recordDebug(event, details) {
        sharedLog.record("direct-unblur", event, details);
        log(event, details);
    }

    function collectPageSnapshot() {
        const containers = Array.from(document.querySelectorAll("shreddit-blurred-container[reason]"));
        return {
            page: location.href,
            enabled,
            includeSpoilers: CONFIG.includeSpoilers,
            useClickFallback: CONFIG.useClickFallback,
            matchingContainers: containers.length,
            containers: containers.slice(0, 20).map(describeElement)
        };
    }

    function exportCombinedLog() {
        const fileName = sharedLog.export();
        showToast("RedditNSFW log downloaded");
        return fileName;
    }

    sharedLog.registerSource("direct-unblur", collectPageSnapshot);
    window.redditAutoUnblurExportLog = exportCombinedLog;

    function showToast(message) {
        const old = document.getElementById("tm-reddit-unblur-toast");
        if (old) {
            old.remove();
        }

        const toast = document.createElement("div");
        toast.id = "tm-reddit-unblur-toast";
        toast.textContent = message;
        toast.style.cssText = [
            "position:fixed",
            "right:16px",
            "bottom:16px",
            "z-index:2147483647",
            "background:rgba(0,0,0,0.85)",
            "color:#fff",
            "padding:10px 14px",
            "border-radius:10px",
            "font:13px/1.3 sans-serif",
            "box-shadow:0 4px 14px rgba(0,0,0,0.35)",
            "pointer-events:none"
        ].join(";");

        document.documentElement.appendChild(toast);
        setTimeout(() => toast.remove(), CONFIG.toastMs);
    }

    function getReason(el) {
        return String(el.getAttribute("reason") || "").trim().toLowerCase();
    }

    function shouldHandleReason(reason) {
        if (reason === "nsfw") {
            return true;
        }
        if (CONFIG.includeSpoilers && reason === "spoiler") {
            return true;
        }
        return false;
    }

    function tryClickReveal(el) {
        if (!CONFIG.useClickFallback) {
            return false;
        }

        const candidates = el.querySelectorAll("button, [role=\"button\"]");
        for (const node of candidates) {
            const text = (node.textContent || "").trim().toLowerCase();
            if (
                text.includes("view") ||
                text.includes("reveal") ||
                text.includes("show") ||
                text.includes("continue") ||
                text.includes("yes")
            ) {
                recordDebug("fallback-click", {
                    text,
                    button: node,
                    container: el
                });
                node.click();
                return true;
            }
        }
        recordDebug("fallback-click-miss", { container: el });
        return false;
    }

    function unblurElement(el) {
        if (!enabled || !el) {
            return false;
        }

        const reason = getReason(el);
        if (!shouldHandleReason(reason)) {
            return false;
        }

        let changed = false;

        try {
            if (el.blurred !== false) {
                el.blurred = false;
                changed = true;
            }
        } catch (err) {
            recordDebug("setting-property-failed", {
                error: err,
                container: el
            });
        }

        if (el.hasAttribute("blurred")) {
            el.removeAttribute("blurred");
            changed = true;
        }

        if (!changed) {
            tryClickReveal(el);
        }

        recordDebug("processed-blurred-container", { reason, changed, container: el });
        return changed;
    }

    function processRoot(root) {
        if (!root || !(root instanceof Element || root instanceof Document)) {
            return;
        }

        if (root instanceof Element && root.matches("shreddit-blurred-container[reason]")) {
            unblurElement(root);
        }

        const nodes = root.querySelectorAll?.("shreddit-blurred-container[reason]");
        if (!nodes) {
            return;
        }

        for (const el of nodes) {
            unblurElement(el);
        }
    }

    let scanScheduled = false;
    function scheduleScan(root = document) {
        if (scanScheduled) {
            return;
        }
        scanScheduled = true;

        requestAnimationFrame(() => {
            scanScheduled = false;
            processRoot(root);
        });
    }

    function handleMutations(mutations) {
        if (!enabled) {
            return;
        }

        for (const mutation of mutations) {
            if (mutation.type === "attributes") {
                const target = mutation.target;
                if (
                    target instanceof Element &&
                    target.matches("shreddit-blurred-container[reason]")
                ) {
                    unblurElement(target);
                }
                continue;
            }

            for (const node of mutation.addedNodes) {
                if (node instanceof Element) {
                    processRoot(node);
                }
            }
        }
    }

    function toggleEnabled() {
        enabled = !enabled;
        saveBool(STORAGE_KEYS.enabled, enabled);
        showToast("Reddit Unblur: " + (enabled ? "ON" : "OFF"));
        recordDebug("toggle-enabled", { enabled });

        if (enabled) {
            scheduleScan();
        }
    }

    document.addEventListener("keydown", (event) => {
        const key = event.key.toLowerCase();

        if (event.altKey && !event.shiftKey && key === "u") {
            event.preventDefault();
            toggleEnabled();
            return;
        }
    });

    const observer = new MutationObserver(handleMutations);

    function start() {
        processRoot(document);

        if (document.body) {
            observer.observe(document.body, {
                childList: true,
                subtree: true,
                attributes: true,
                attributeFilter: ["blurred", "reason"]
            });
        }

        recordDebug("script-started", {
            enabled,
            includeSpoilers: CONFIG.includeSpoilers,
            useClickFallback: CONFIG.useClickFallback
        });
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", start, { once: true });
    } else {
        start();
    }
})();
