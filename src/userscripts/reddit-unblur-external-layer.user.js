// ==UserScript==
// @name         Reddit Unblur External Layer
// @namespace    https://tampermonkey.net/
// @version      1.5
// @match        https://www.reddit.com/*
// @match        https://sh.reddit.com/*
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function () {
    'use strict';

    const DEBUG = false;
    let lastUrl = location.href;
    const mediaCache = new Map();

    function log(...args) {
        if (DEBUG) console.log('[Reddit External Unblur]', ...args);
    }

    function decodeHtml(str) {
        if (!str) return str;
        const txt = document.createElement('textarea');
        txt.innerHTML = str;
        return txt.value;
    }

    function isDirectImageUrl(url) {
        if (!url || typeof url !== 'string') return false;

        try {
            const u = new URL(decodeHtml(url), location.origin);
            const path = u.pathname.toLowerCase();

            return (
                u.hostname === 'i.redd.it' ||
                (
                    u.hostname !== 'preview.redd.it' &&
                    u.hostname !== 'external-preview.redd.it' &&
                    (
                        path.endsWith('.jpg') ||
                        path.endsWith('.jpeg') ||
                        path.endsWith('.png') ||
                        path.endsWith('.webp') ||
                        path.endsWith('.gif')
                    )
                )
            );
        } catch {
            return false;
        }
    }

    function previewToDirect(url) {
        if (!url || typeof url !== 'string') return null;

        try {
            const u = new URL(decodeHtml(url), location.origin);

            if (u.hostname !== 'preview.redd.it' && u.hostname !== 'external-preview.redd.it') {
                return null;
            }

            return `https://i.redd.it${u.pathname}`;
        } catch {
            return null;
        }
    }

    async function fetchPostData(postHref) {
        try {
            const postUrl = new URL(postHref, location.origin);
            const postPath = postUrl.pathname.replace(/\/+$/, '');

            if (mediaCache.has(postPath)) {
                return mediaCache.get(postPath);
            }

            const promise = (async () => {
                const jsonUrl = `${postPath}/.json?raw_json=1`;
                const res = await fetch(jsonUrl, { credentials: 'same-origin' });
                if (!res.ok) return null;

                const json = await res.json();
                return json?.[0]?.data?.children?.[0]?.data || null;
            })();

            mediaCache.set(postPath, promise);
            return promise;
        } catch (err) {
            log('fetchPostData failed', err);
            return null;
        }
    }

    function extractImageUrlFromPost(post) {
        if (!post) return null;

        const candidates = [];

        if (typeof post.url_overridden_by_dest === 'string') {
            candidates.push(post.url_overridden_by_dest);
        }

        if (typeof post.url === 'string') {
            candidates.push(post.url);
        }

        const firstGalleryItem = post?.gallery_data?.items?.[0];
        const mediaId = firstGalleryItem?.media_id;
        const mediaMeta = mediaId ? post?.media_metadata?.[mediaId] : null;

        if (mediaMeta?.s?.u) {
            candidates.push(mediaMeta.s.u);
        }

        if (Array.isArray(mediaMeta?.p)) {
            candidates.push(...mediaMeta.p.map(x => x?.u).filter(Boolean));
        }

        const preview = post?.preview?.images?.[0]?.source?.url;
        if (preview) {
            candidates.push(preview);
        }

        for (const raw of candidates) {
            const decoded = decodeHtml(raw);
            if (isDirectImageUrl(decoded)) {
                return decoded;
            }
        }

        for (const raw of candidates) {
            const direct = previewToDirect(raw);
            if (direct) {
                return direct;
            }
        }

        if (preview) {
            return decodeHtml(preview);
        }

        return null;
    }

    function extractVideoUrlFromPost(post) {
        if (!post) return null;

        const videoUrl =
            post?.secure_media?.reddit_video?.fallback_url ||
            post?.media?.reddit_video?.fallback_url;

        return videoUrl ? decodeHtml(videoUrl) : null;
    }

    function getOverlayHost(blurContainer) {
        if (!(blurContainer instanceof Element)) return null;

        return (
            blurContainer.closest('[slot="post-media-container"]') ||
            blurContainer.parentElement
        );
    }

    function forceRelative(host) {
        if (!(host instanceof Element)) return;
        if (getComputedStyle(host).position === 'static') {
            host.style.position = 'relative';
        }
    }

    function removeCustomLayer(host) {
        if (!(host instanceof Element)) return;
        host.querySelectorAll(':scope > .tm-unblur-media-layer').forEach(el => el.remove());
        host.querySelectorAll(':scope > .tm-nsfw-overlay').forEach(el => el.remove());
        delete host.dataset.tmOverlayBuilt;
        delete host.dataset.tmMediaBuilt;
    }

    async function preloadImage(url) {
        return await new Promise((resolve) => {
            const img = new Image();

            img.addEventListener('load', () => resolve(img), { once: true });
            img.addEventListener('error', () => resolve(null), { once: true });

            img.src = url;
        });
    }

    function createSharpLayer(host, imageUrl, clickHref, altText) {
        if (!(host instanceof Element) || !imageUrl) return false;

        host.querySelectorAll(':scope > .tm-unblur-media-layer').forEach(el => el.remove());

        const layer = document.createElement('div');
        layer.className = 'tm-unblur-media-layer';
        layer.style.cssText = `
            position:absolute;
            inset:0;
            z-index:9998;
            display:flex;
            align-items:center;
            justify-content:center;
            pointer-events:auto;
            background:transparent;
        `;

        const anchor = document.createElement('a');
        anchor.href = clickHref || imageUrl;
        anchor.style.cssText = `
            display:flex;
            align-items:center;
            justify-content:center;
            width:100%;
            height:100%;
            text-decoration:none;
        `;

        const img = document.createElement('img');
        img.src = imageUrl;
        img.alt = altText || '';
        img.loading = 'eager';
        img.decoding = 'sync';
        img.style.cssText = `
            display:block;
            max-width:100%;
            max-height:100%;
            width:auto;
            height:auto;
            object-fit:contain;
            filter:none !important;
            -webkit-filter:none !important;
            opacity:1 !important;
            visibility:visible !important;
        `;

        anchor.appendChild(img);
        layer.appendChild(anchor);
        host.appendChild(layer);

        host.dataset.tmMediaBuilt = '1';
        return true;
    }

    function buildOverlay(blurContainer, img, postHref) {
        const host = getOverlayHost(blurContainer);
        if (!host) return;

        if (host.dataset.tmOverlayBuilt === '1' || host.dataset.tmMediaBuilt === '1') return;
        host.dataset.tmOverlayBuilt = '1';

        forceRelative(host);

        const overlay = document.createElement('div');
        overlay.className = 'tm-nsfw-overlay';
        overlay.style.cssText = `
            position:absolute;
            inset:0;
            z-index:9999;
            display:flex;
            align-items:center;
            justify-content:center;
            pointer-events:auto;
            background:rgba(0,0,0,0.18);
        `;

        const button = document.createElement('button');
        button.type = 'button';
        button.textContent = 'View NSFW content';
        button.style.cssText = `
            appearance:none;
            border:none;
            border-radius:999px;
            padding:10px 16px;
            font:600 14px/1.2 sans-serif;
            color:#fff;
            background:rgba(0,0,0,0.82);
            cursor:pointer;
            box-shadow:0 4px 14px rgba(0,0,0,0.35);
            pointer-events:auto;
        `;

        button.addEventListener('click', async (event) => {
            event.preventDefault();
            event.stopPropagation();

            button.disabled = true;
            button.textContent = 'Loading...';

            let built = false;

            if (postHref) {
                const post = await fetchPostData(postHref);
                const realImageUrl = extractImageUrlFromPost(post);

                log('Resolved image URL:', realImageUrl);

                if (realImageUrl) {
                    const preloaded = await preloadImage(realImageUrl);
                    if (preloaded) {
                        built = createSharpLayer(
                            host,
                            realImageUrl,
                            new URL(postHref, location.origin).toString(),
                            img?.alt || ''
                        );
                    }
                } else {
                    const realVideoUrl = extractVideoUrlFromPost(post);
                    if (realVideoUrl) {
                        window.open(new URL(postHref, location.origin).toString(), '_blank', 'noopener');
                        built = true;
                    }
                }
            }

            if (built) {
                overlay.remove();
                delete host.dataset.tmOverlayBuilt;
            } else {
                button.disabled = false;
                button.textContent = 'Try again';
            }
        });

        overlay.appendChild(button);
        host.appendChild(overlay);
    }

    function processBlurredContainer(el) {
        if (!(el instanceof Element)) return;
        if ((el.getAttribute('reason') || '').toLowerCase() !== 'nsfw') return;

        const img = el.querySelector('img');
        if (!img) return;

        const postLink = el.querySelector('a[href*="/comments/"]');
        const postHref = postLink ? postLink.getAttribute('href') : null;

        buildOverlay(el, img, postHref);
    }

    function scan(root = document) {
        if (!(root instanceof Element || root instanceof Document)) return;
        root.querySelectorAll('shreddit-blurred-container[reason="nsfw"]').forEach(processBlurredContainer);
    }

    const mo = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
            for (const node of mutation.addedNodes) {
                if (node instanceof Element) {
                    if (node.matches?.('shreddit-blurred-container[reason="nsfw"]')) {
                        processBlurredContainer(node);
                    }
                    scan(node);
                }
            }
        }
    });

    function start() {
        scan(document);

        if (document.body) {
            mo.observe(document.body, { childList: true, subtree: true });
        }

        setInterval(() => {
            if (location.href !== lastUrl) {
                lastUrl = location.href;
                log('URL changed, rescanning');
                scan(document);
            }
        }, 500);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', start, { once: true });
    } else {
        start();
    }
})();