// ==UserScript==
// @name         Reddit Auto Unblur
// @namespace    https://tampermonkey.net/
// @version      1.4
// @description  Unblurs Reddit Shreddit NSFW media, with toggle/debug/fallback support
// @match        https://www.reddit.com/*
// @match        https://sh.reddit.com/*
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function () {
    "use strict";

    const STORAGE_KEYS = {
        enabled: "reddit-unblur-enabled",
        debug: "reddit-unblur-debug"
    };

    const CONFIG = {
        includeSpoilers: false,
        useClickFallback: true,
        toastMs: 1800,
        debugLogMaxEntries: 400
    };

    const debugEntries = [];

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

    let enabled = loadBool(STORAGE_KEYS.enabled, true);
    let debug = loadBool(STORAGE_KEYS.debug, false);

    function log(...args) {
        if (debug) {
            console.log("[Reddit Unblur]", ...args);
        }
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

    function toDebugString(details) {
        if (details == null) {
            return "";
        }
        if (typeof details === "string") {
            return details;
        }

        try {
            return JSON.stringify(details, (key, value) => {
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
            }, 2);
        } catch (err) {
            return String(err?.message || details);
        }
    }

    function recordDebug(event, details) {
        const timestamp = new Date().toISOString();
        const parts = [`[${timestamp}] ${event}`];
        const detailText = toDebugString(details);
        if (detailText) {
            parts.push(detailText);
        }

        debugEntries.push(parts.join("\n"));
        if (debugEntries.length > CONFIG.debugLogMaxEntries) {
            debugEntries.splice(0, debugEntries.length - CONFIG.debugLogMaxEntries);
        }

        log(event, details);
    }

    function collectPageSnapshot() {
        const containers = Array.from(document.querySelectorAll("shreddit-blurred-container[reason]"));
        return {
            page: location.href,
            enabled,
            debug,
            includeSpoilers: CONFIG.includeSpoilers,
            useClickFallback: CONFIG.useClickFallback,
            matchingContainers: containers.length,
            containers: containers.slice(0, 20).map(describeElement)
        };
    }

    function exportDebugLog() {
        recordDebug("export-debug-log", {
            entries: debugEntries.length,
            snapshot: collectPageSnapshot()
        });

        const lines = [
            "Reddit Auto Unblur Debug Log",
            `Generated: ${new Date().toISOString()}`,
            `Page: ${location.href}`,
            `User agent: ${navigator.userAgent}`,
            "",
            ...debugEntries
        ];
        const blob = new Blob([lines.join("\n\n")], { type: "text/plain;charset=utf-8" });
        const objectUrl = URL.createObjectURL(blob);
        const anchor = document.createElement("a");
        anchor.href = objectUrl;
        anchor.download = "reddit-auto-unblur-log.txt";
        anchor.style.display = "none";
        (document.body || document.documentElement).appendChild(anchor);
        anchor.click();
        anchor.remove();
        setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
        showToast("Reddit Unblur log downloaded");
    }

    window.redditAutoUnblurExportLog = exportDebugLog;

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

    function toggleDebug() {
        debug = !debug;
        saveBool(STORAGE_KEYS.debug, debug);
        showToast("Reddit Unblur debug: " + (debug ? "ON" : "OFF"));
        recordDebug("toggle-debug", { debug });
    }

    document.addEventListener("keydown", (event) => {
        const key = event.key.toLowerCase();

        if (event.altKey && !event.shiftKey && key === "u") {
            event.preventDefault();
            toggleEnabled();
            return;
        }

        if (event.altKey && event.shiftKey && key === "u") {
            event.preventDefault();
            toggleDebug();
            return;
        }

        if (event.altKey && event.shiftKey && key === "l") {
            event.preventDefault();
            exportDebugLog();
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
            debug,
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
