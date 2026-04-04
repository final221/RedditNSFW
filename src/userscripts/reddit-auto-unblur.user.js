// ==UserScript==
// @name         Reddit Auto Unblur
// @namespace    https://tampermonkey.net/
// @version      1.3
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
        toastMs: 1800
    };

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
                log("Fallback click:", text || node);
                node.click();
                return true;
            }
        }
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
            log("Setting property failed:", err);
        }

        if (el.hasAttribute("blurred")) {
            el.removeAttribute("blurred");
            changed = true;
        }

        if (!changed) {
            tryClickReveal(el);
        }

        log("Processed blurred container:", { reason, changed, el });
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
        log("Enabled set to", enabled);

        if (enabled) {
            scheduleScan();
        }
    }

    function toggleDebug() {
        debug = !debug;
        saveBool(STORAGE_KEYS.debug, debug);
        showToast("Reddit Unblur debug: " + (debug ? "ON" : "OFF"));
        log("Debug set to", debug);
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

        log("Script started", {
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
