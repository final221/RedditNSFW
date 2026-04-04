// ==UserScript==
// @name         Reddit Image Recreation
// @namespace    https://tampermonkey.net/
// @version      1.21
// @match        https://www.reddit.com/*
// @match        https://sh.reddit.com/*
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function () {
    'use strict';

    const DEBUG = false;
    const CONFIG = {
        fallbackDelayMs: 1200,
        preferNativeReveal: true,
        useClickFallback: true,
        videoRecoveryTimeoutMs: 1800,
        debugLogMaxEntries: 400
    };
    let lastUrl = location.href;
    const mediaCache = new Map();
    const fallbackTimers = new WeakMap();
    const debugEntries = [];

    function toDebugString(details) {
        if (details == null) return '';
        if (typeof details === 'string') return details;

        try {
            return JSON.stringify(details, null, 2);
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

        debugEntries.push(parts.join('\n'));
        if (debugEntries.length > CONFIG.debugLogMaxEntries) {
            debugEntries.splice(0, debugEntries.length - CONFIG.debugLogMaxEntries);
        }

        log(event, details);
    }

    function exportDebugLog() {
        recordDebug('export-debug-log', {
            page: location.href,
            entries: debugEntries.length
        });

        const lines = [
            'Reddit Image Recreation Debug Log',
            `Generated: ${new Date().toISOString()}`,
            `Page: ${location.href}`,
            `User agent: ${navigator.userAgent}`,
            '',
            ...debugEntries
        ];
        const blob = new Blob([lines.join('\n\n')], { type: 'text/plain;charset=utf-8' });
        const objectUrl = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = objectUrl;
        anchor.download = 'reddit-image-recreation-log.txt';
        anchor.style.display = 'none';
        (document.body || document.documentElement).appendChild(anchor);
        anchor.click();
        anchor.remove();
        setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
    }

    window.redditImageRecreationExportLog = exportDebugLog;


    function log(...args) {
        if (DEBUG) console.log('[Reddit External Unblur]', ...args);
    }

    function getReason(el) {
        return String(el?.getAttribute('reason') || '').trim().toLowerCase();
    }

    function shouldHandleReason(reason) {
        return reason === 'nsfw';
    }

    function tryClickReveal(...scopes) {
        if (!CONFIG.useClickFallback) return false;

        for (const scope of scopes) {
            if (!(scope instanceof Element || scope instanceof Document)) continue;

            const candidates = scope.querySelectorAll('button, [role="button"]');
            for (const node of candidates) {
                if (!(node instanceof Element)) continue;
                if (node.closest('.tm-nsfw-overlay') || node.closest('.tm-unblur-media-layer')) continue;

                const text = (node.textContent || '').trim().toLowerCase();
                if (
                    text.includes('view') ||
                    text.includes('reveal') ||
                    text.includes('show') ||
                    text.includes('continue') ||
                    text.includes('yes') ||
                    text.includes('nsfw')
                ) {
                    log('Fallback click:', text || node);
                    node.click();
                    return true;
                }
            }
        }

        return false;
    }

    function unblurElement(blurContainer, host) {
        if (!(blurContainer instanceof Element)) return false;

        const reason = getReason(blurContainer);
        if (!shouldHandleReason(reason)) {
            return false;
        }

        let changed = false;

        try {
            if (blurContainer.blurred !== false) {
                blurContainer.blurred = false;
                changed = true;
            }
        } catch (err) {
            log('Setting property failed:', err);
        }

        if (blurContainer.hasAttribute('blurred')) {
            blurContainer.removeAttribute('blurred');
            changed = true;
        }

        if (!changed) {
            changed = tryClickReveal(host, blurContainer, document) || changed;
        }

        log('Processed blurred container:', { reason, changed, blurContainer });
        return changed;
    }

    function decodeHtml(str) {
        if (!str) return str;
        const txt = document.createElement('textarea');
        txt.innerHTML = str;
        return txt.value;
    }

    function decodeUrl(raw) {
        if (!raw || typeof raw !== 'string') return null;
        return decodeHtml(raw);
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

            if (u.hostname !== 'preview.redd.it') {
                return null;
            }

            return `https://i.redd.it${u.pathname}`;
        } catch {
            return null;
        }
    }

    function isExternalPreviewUrl(url) {
        if (!url || typeof url !== 'string') return false;

        try {
            const u = new URL(decodeHtml(url), location.origin);
            return u.hostname === 'external-preview.redd.it';
        } catch {
            return false;
        }
    }

    function normalizePostHref(postHref) {
        if (!postHref || typeof postHref !== 'string') return null;

        try {
            const postUrl = new URL(postHref, location.origin);
            const parts = postUrl.pathname.split('/').filter(Boolean);
            const commentsIndex = parts.indexOf('comments');
            if (commentsIndex >= 0 && parts.length >= commentsIndex + 2) {
                postUrl.pathname = `/${parts.slice(0, commentsIndex + 2).join('/')}/`;
            }
            postUrl.search = '';
            postUrl.hash = '';
            return postUrl.toString();
        } catch (err) {
            recordDebug('normalize-post-href-failed', { postHref, error: err?.message || String(err) });
            return null;
        }
    }

    async function fetchPostData(postHref) {
        try {
            const normalizedHref = normalizePostHref(postHref) || postHref;
            const postUrl = new URL(normalizedHref, location.origin);
            const postPath = postUrl.pathname.replace(/\/+$/, '');
            recordDebug('fetch-post-data', { inputHref: postHref, normalizedHref, postPath });

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

    function getPosterUrl(post) {
        return decodeUrl(post?.preview?.images?.[0]?.source?.url) || null;
    }

    function collectImageCandidates(mediaMeta) {
        const candidates = [];

        if (mediaMeta?.s?.u) {
            candidates.push(mediaMeta.s.u);
        }

        if (mediaMeta?.s?.gif) {
            candidates.push(mediaMeta.s.gif);
        }

        if (Array.isArray(mediaMeta?.p)) {
            candidates.push(...mediaMeta.p.map((entry) => entry?.u).filter(Boolean));
        }

        return candidates;
    }

    function resolveImageSource(candidates, preview) {
        for (const raw of candidates) {
            const decoded = decodeUrl(raw);
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

        for (const raw of candidates) {
            const decoded = decodeUrl(raw);
            if (isExternalPreviewUrl(decoded)) {
                return decoded;
            }
        }

        if (preview) {
            return decodeHtml(preview);
        }

        return null;
    }

    function extractGalleryMediaFromPost(post) {
        if (!post) return null;

        const galleryItems = Array.isArray(post?.gallery_data?.items) ? post.gallery_data.items : [];
        if (galleryItems.length < 2) {
            return null;
        }

        const items = [];
        for (const galleryItem of galleryItems) {
            const mediaId = galleryItem?.media_id;
            const mediaMeta = mediaId ? post?.media_metadata?.[mediaId] : null;
            const src = resolveImageSource(collectImageCandidates(mediaMeta), null);
            if (!src) continue;
            items.push({
                src,
                alt: post?.title || ''
            });
        }

        if (items.length < 2) {
            return null;
        }

        return {
            type: 'gallery',
            items
        };
    }

    function extractImageMediaFromPost(post) {
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
        candidates.push(...collectImageCandidates(mediaMeta));

        const previewGif = post?.preview?.images?.[0]?.variants?.gif?.source?.url;
        if (previewGif) {
            candidates.push(previewGif);
        }

        const preview = post?.preview?.images?.[0]?.source?.url;
        if (preview) {
            candidates.push(preview);
        }

        const src = resolveImageSource(candidates, preview);
        if (!src) {
            return null;
        }

        return {
            type: 'image',
            src
        };
    }

    function buildRankedVideoSources(...rawSources) {
        const seen = new Set();
        const ranked = [];
        const add = (value) => {
            const decoded = decodeUrl(value);
            if (!decoded || seen.has(decoded)) return;
            seen.add(decoded);
            ranked.push(decoded);
        };

        for (const raw of rawSources) {
            const decoded = decodeUrl(raw);
            if (!decoded) continue;

            let addedStructuredOrder = false;

            try {
                const url = new URL(decoded, location.origin);
                const match = url.pathname.match(/\/(CMAF|DASH)_(\d+)\.mp4$/i);
                if (match) {
                    const family = match[1].toUpperCase();
                    const alternateFamily = family === 'CMAF' ? 'DASH' : 'CMAF';
                    const current = Number(match[2]);
                    const highProbeHeights = [1080, 720].filter((value) => value > current);
                    const lowerHeights = [360, 240].filter((value) => value < current);
                    const swapVariant = (nextFamily, nextHeight) => decoded.replace(/\/(CMAF|DASH)_\d+\.mp4$/i, `/${nextFamily}_${nextHeight}.mp4`);

                    for (const height of highProbeHeights) {
                        add(swapVariant(family, height));
                    }

                    for (const height of highProbeHeights) {
                        add(swapVariant(alternateFamily, height));
                    }

                    add(decoded);
                    add(swapVariant(alternateFamily, current));

                    for (const height of lowerHeights) {
                        add(swapVariant(family, height));
                    }

                    for (const height of lowerHeights) {
                        add(swapVariant(alternateFamily, height));
                    }

                    addedStructuredOrder = true;
                }
            } catch {
                // Keep the raw candidate even if URL parsing fails.
            }

            if (!addedStructuredOrder) {
                add(decoded);
            }
        }

        return ranked;
    }

    function extractVideoMediaFromPost(post) {
        if (!post) return null;

        const poster = getPosterUrl(post);
        const redditVideo = post?.secure_media?.reddit_video || post?.media?.reddit_video;
        if (redditVideo?.fallback_url) {
            return {
                type: 'video',
                src: decodeHtml(redditVideo.fallback_url),
                sources: buildRankedVideoSources(redditVideo.fallback_url),
                poster,
                loop: Boolean(redditVideo.is_gif),
                controls: !redditVideo.is_gif
            };
        }

        const previewVideo = post?.preview?.reddit_video_preview;
        const previewMp4 =
            previewVideo?.fallback_url ||
            post?.preview?.images?.[0]?.variants?.mp4?.source?.url;
        if (previewMp4) {
            const gifLike = Boolean(previewVideo) || post?.post_hint === 'image';
            return {
                type: 'video',
                src: decodeHtml(previewMp4),
                sources: buildRankedVideoSources(previewMp4),
                poster,
                loop: gifLike,
                controls: !gifLike
            };
        }

        return null;
    }

    function resolveMediaFromPost(post) {
        return extractGalleryMediaFromPost(post) || extractVideoMediaFromPost(post) || extractImageMediaFromPost(post);
    }

    function getOverlayHost(blurContainer) {
        if (!(blurContainer instanceof Element)) return null;

        return (
            blurContainer.closest('[slot="post-media-container"]') ||
            blurContainer.parentElement
        );
    }

    function extractPostIdToken(value) {
        if (!value) return null;

        const text = String(value);
        const fullnameMatch = text.match(/\bt3_([a-z0-9]+)\b/i);
        if (fullnameMatch) {
            return fullnameMatch[1].toLowerCase();
        }

        const commentsMatch = text.match(/\/comments\/([a-z0-9]+)(?:\/|$)/i);
        if (commentsMatch) {
            return commentsMatch[1].toLowerCase();
        }

        return null;
    }

    function collectPostIdToken(blurContainer, host) {
        const candidates = [];

        if (blurContainer instanceof Element) {
            candidates.push(
                blurContainer.id,
                blurContainer.getAttribute('id'),
                blurContainer.getAttribute('for'),
                blurContainer.getAttribute('aria-controls')
            );
        }

        if (host instanceof Element) {
            candidates.push(
                host.id,
                host.getAttribute('id'),
                host.getAttribute('for'),
                host.getAttribute('aria-controls')
            );

            const scopedIdNode = host.querySelector('[id^="t3_"]');
            if (scopedIdNode instanceof Element) {
                candidates.push(scopedIdNode.id, scopedIdNode.getAttribute('id'));
            }
        }

        let cursor = host instanceof Element ? host : blurContainer;
        while (cursor instanceof Element) {
            candidates.push(
                cursor.id,
                cursor.getAttribute('id'),
                cursor.getAttribute('for'),
                cursor.getAttribute('aria-controls')
            );
            cursor = cursor.parentElement;
        }

        for (const value of candidates) {
            const token = extractPostIdToken(value);
            if (token) {
                return token;
            }
        }

        return null;
    }

    function resolvePostHref(blurContainer, host) {
        const postIdToken = collectPostIdToken(blurContainer, host);
        const scopeCandidates = [
            blurContainer,
            host,
            host?.parentElement,
            host?.closest('article'),
            host?.closest('shreddit-post'),
            host?.closest('faceplate-tracker'),
            host?.closest('[id^="t3_"]'),
            document
        ].filter(Boolean);

        for (const scope of scopeCandidates) {
            const anchors = scope.querySelectorAll?.('a[href*="/comments/"]');
            if (!anchors?.length) continue;

            if (postIdToken) {
                for (const anchor of anchors) {
                    const href = anchor.getAttribute('href');
                    if (extractPostIdToken(href) === postIdToken) {
                        return normalizePostHref(href) || href;
                    }
                }
            }

            if (anchors.length === 1) {
                const href = anchors[0].getAttribute('href');
                return normalizePostHref(href) || href;
            }
        }

        if (location.pathname.includes('/comments/')) {
            if (!postIdToken || extractPostIdToken(location.pathname) === postIdToken) {
                return normalizePostHref(location.href) || location.href;
            }
        }

        return null;
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

    function hasNativeRevealControl(host) {
        if (!(host instanceof Element) || !CONFIG.preferNativeReveal) return false;

        const candidates = host.querySelectorAll('button, [role="button"]');
        for (const node of candidates) {
            if (!(node instanceof Element)) continue;
            if (node.closest('.tm-nsfw-overlay') || node.closest('.tm-unblur-media-layer')) continue;

            const text = (node.textContent || '').trim().toLowerCase();
            if (
                text.includes('view') ||
                text.includes('reveal') ||
                text.includes('show') ||
                text.includes('continue') ||
                text.includes('yes') ||
                text.includes('nsfw')
            ) {
                return true;
            }
        }

        return false;
    }

    function nodeHasUsableNativeMedia(node, blurContainer) {
        if (!(node instanceof Element)) return false;
        if (node.closest('.tm-unblur-media-layer')) return false;

        if (node.matches('video, iframe')) {
            return true;
        }

        if (!node.matches('img')) {
            return false;
        }

        const src = node.getAttribute('src') || node.getAttribute('data-lazy-src') || node.currentSrc || '';
        const loweredSrc = src.toLowerCase();
        const className = node.className || '';
        const alt = (node.getAttribute('alt') || '').trim();
        const role = (node.getAttribute('role') || '').toLowerCase();

        if (className.includes('media-lightbox-img')) {
            return !loweredSrc.includes('blur=');
        }

        if (node.closest('gallery-carousel, shreddit-gallery-carousel, faceplate-carousel, figure')) {
            if (!loweredSrc.includes('blur=')) {
                return true;
            }
        }

        if (role === 'presentation' || className.includes('post-background-image-filter')) {
            return false;
        }

        if (alt && !loweredSrc.includes('blur=')) {
            return true;
        }

        if (!(blurContainer instanceof Element) || !blurContainer.contains(node)) {
            return true;
        }

        return false;
    }

    function hasNativeRevealedEmbed(blurContainer) {
        if (!(blurContainer instanceof Element)) return false;

        const revealed = blurContainer.querySelector(':scope > [slot="revealed"], [slot="revealed"]');
        if (!(revealed instanceof Element)) {
            return false;
        }

        if (revealed.querySelector('iframe, video, img, embed, object, shreddit-embed')) {
            return true;
        }

        const asyncLoader = revealed.querySelector('shreddit-async-loader');
        if (asyncLoader instanceof Element) {
            return true;
        }

        const embedHtml = revealed.querySelector('shreddit-embed')?.getAttribute('html') || '';
        if (typeof embedHtml === 'string' && embedHtml.trim()) {
            return true;
        }

        return false;
    }

    function hasNativeResolvedMedia(host, blurContainer) {
        if (!(host instanceof Element)) return false;

        if (hasNativeRevealedEmbed(blurContainer)) {
            return true;
        }

        const nativeVideo = host.querySelector('video:not(.tm-unblur-media-layer video)');
        if (nativeVideo && !nativeVideo.closest('.tm-unblur-media-layer')) {
            return true;
        }

        const mediaNodes = host.querySelectorAll('img, video, iframe');
        for (const node of mediaNodes) {
            if (nodeHasUsableNativeMedia(node, blurContainer)) {
                return true;
            }
        }

        return false;
    }

    function yieldToNativeMedia(host, blurContainer) {
        if (!(host instanceof Element) || !(blurContainer instanceof Element)) return false;

        const hasCustomLayer = host.dataset.tmOverlayBuilt === '1' || host.dataset.tmMediaBuilt === '1' || Boolean(host.querySelector(':scope > .tm-unblur-media-layer, :scope > .tm-nsfw-overlay'));
        if (!hasCustomLayer) return false;
        if (!hasNativeResolvedMedia(host, blurContainer)) return false;

        recordDebug('fallback-yielded-to-native', {
            normalizedPostUrl: resolvePostHref(blurContainer, host),
            hadOverlay: host.dataset.tmOverlayBuilt === '1',
            hadMediaLayer: host.dataset.tmMediaBuilt === '1'
        });

        removeCustomLayer(host);
        return true;
    }

    function collectFallbackBlockers(host, blurContainer) {
        const blockers = [];
        if (!(host instanceof Element)) blockers.push('missing-host');
        if (!(blurContainer instanceof Element)) blockers.push('missing-blur-container');
        if (blockers.length) return blockers;
        if ((blurContainer.getAttribute('reason') || '').toLowerCase() !== 'nsfw') blockers.push('non-nsfw');
        if (host.dataset.tmOverlayBuilt === '1') blockers.push('overlay-built');
        if (host.dataset.tmMediaBuilt === '1') blockers.push('media-built');
        if (hasNativeResolvedMedia(host, blurContainer)) blockers.push('native-resolved');
        if (hasNativeRevealControl(host)) blockers.push('native-reveal-control');
        return blockers;
    }

    function shouldBuildFallback(host, blurContainer) {
        return collectFallbackBlockers(host, blurContainer).length === 0;
    }

    function clearPendingFallback(host) {
        if (!(host instanceof Element)) return;
        const timer = fallbackTimers.get(host);
        if (timer) {
            clearTimeout(timer);
            fallbackTimers.delete(host);
        }
    }

    async function preloadImage(url) {
        return await new Promise((resolve) => {
            const img = new Image();

            img.addEventListener('load', () => resolve(img), { once: true });
            img.addEventListener('error', () => resolve(null), { once: true });

            img.src = url;
        });
    }

    async function preloadVideo(url) {
        return await new Promise((resolve) => {
            const video = document.createElement('video');
            let settled = false;

            const finish = (value) => {
                if (settled) return;
                settled = true;
                clearTimeout(timer);
                resolve(value);
            };

            const timer = setTimeout(() => finish(null), 8000);

            video.preload = 'auto';
            video.muted = true;
            video.playsInline = true;
            video.addEventListener('loadeddata', () => finish(video), { once: true });
            video.addEventListener('canplay', () => finish(video), { once: true });
            video.addEventListener('error', () => finish(null), { once: true });
            video.src = url;
            video.load();
        });
    }

    async function resolvePlayableVideoSource(media) {
        const candidates = Array.isArray(media?.sources) && media.sources.length ? media.sources : [media?.src];
        recordDebug('video-candidates', {
            normalizedPostUrl: media?.debugPostUrl || null,
            candidates
        });

        for (const candidate of candidates) {
            if (!candidate) continue;
            const preloaded = await preloadVideo(candidate);
            if (preloaded) {
                recordDebug('video-candidate-selected', {
                    normalizedPostUrl: media?.debugPostUrl || null,
                    selected: candidate
                });
                return candidate;
            }

            recordDebug('video-candidate-failed', {
                normalizedPostUrl: media?.debugPostUrl || null,
                candidate
            });
        }

        recordDebug('video-candidate-none-playable', {
            normalizedPostUrl: media?.debugPostUrl || null,
            candidates
        });
        return null;
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

    function createGalleryLayer(host, media, clickHref, altText) {
        if (!(host instanceof Element) || !Array.isArray(media?.items) || media.items.length === 0) return false;

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

        const frame = document.createElement('div');
        frame.style.cssText = `
            position:relative;
            width:100%;
            height:100%;
            display:flex;
            align-items:center;
            justify-content:center;
            overflow:hidden;
        `;

        const image = document.createElement('img');
        image.loading = 'eager';
        image.decoding = 'sync';
        image.style.cssText = `
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
            cursor:${clickHref ? 'pointer' : 'default'};
        `;

        const counter = document.createElement('div');
        counter.style.cssText = `
            position:absolute;
            left:50%;
            bottom:12px;
            transform:translateX(-50%);
            padding:6px 10px;
            border-radius:999px;
            background:rgba(0,0,0,0.72);
            color:#fff;
            font:600 12px/1 sans-serif;
            pointer-events:none;
        `;

        const makeNavButton = (label, direction) => {
            const button = document.createElement('button');
            button.type = 'button';
            button.textContent = label;
            button.style.cssText = `
                position:absolute;
                top:50%;
                ${direction}:12px;
                transform:translateY(-50%);
                appearance:none;
                border:none;
                border-radius:999px;
                width:40px;
                height:40px;
                background:rgba(0,0,0,0.72);
                color:#fff;
                font:700 18px/1 sans-serif;
                cursor:pointer;
                box-shadow:0 4px 14px rgba(0,0,0,0.35);
            `;
            return button;
        };

        const prevButton = makeNavButton('<', 'left');
        const nextButton = makeNavButton('>', 'right');
        let currentIndex = 0;

        const renderIndex = (index) => {
            currentIndex = (index + media.items.length) % media.items.length;
            const item = media.items[currentIndex];
            image.src = item.src;
            image.alt = item.alt || altText || '';
            counter.textContent = `${currentIndex + 1} / ${media.items.length}`;
        };

        prevButton.addEventListener('click', (event) => {
            event.preventDefault();
            event.stopPropagation();
            renderIndex(currentIndex - 1);
        });

        nextButton.addEventListener('click', (event) => {
            event.preventDefault();
            event.stopPropagation();
            renderIndex(currentIndex + 1);
        });

        if (clickHref) {
            image.addEventListener('dblclick', (event) => {
                event.preventDefault();
                window.open(clickHref, '_blank', 'noopener');
            });
        }

        renderIndex(0);
        frame.appendChild(image);
        if (media.items.length > 1) {
            frame.appendChild(prevButton);
            frame.appendChild(nextButton);
            frame.appendChild(counter);
        }
        layer.appendChild(frame);
        host.appendChild(layer);

        host.dataset.tmMediaBuilt = '1';
        return true;
    }

    function createVideoLayer(host, media, clickHref) {
        if (!(host instanceof Element) || !media?.src) return false;

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

        const video = document.createElement('video');
        video.src = media.src;
        video.poster = media.poster || '';
        video.preload = 'auto';
        video.autoplay = true;
        video.loop = Boolean(media.loop);
        video.muted = true;
        video.defaultMuted = true;
        video.playsInline = true;
        video.controls = Boolean(media.controls);
        video.setAttribute('playsinline', '');
        video.style.cssText = `
            display:block;
            max-width:100%;
            max-height:100%;
            width:auto;
            height:auto;
            object-fit:contain;
            background:#000;
            opacity:1 !important;
            visibility:visible !important;
        `;

        const promoteVideoRecovery = () => {
            video.controls = true;
            video.setAttribute('controls', '');
            video.dataset.tmVideoRecovery = '1';
        };

        if (clickHref) {
            video.dataset.tmClickHref = clickHref;
            video.addEventListener('dblclick', (event) => {
                event.preventDefault();
                window.open(clickHref, '_blank', 'noopener');
            });
        }

        video.addEventListener('click', () => {
            if (!video.paused) return;
            const clickPlayAttempt = video.play();
            if (clickPlayAttempt && typeof clickPlayAttempt.catch === 'function') {
                clickPlayAttempt.catch(() => promoteVideoRecovery());
            }
        });

        let playbackRecovered = false;
        let recoveryTimer = 0;
        const clearRecovery = () => {
            playbackRecovered = true;
            clearTimeout(recoveryTimer);
        };

        video.addEventListener('playing', clearRecovery, { once: true });
        video.addEventListener('error', promoteVideoRecovery, { once: true });

        layer.appendChild(video);
        host.appendChild(layer);

        recoveryTimer = setTimeout(() => {
            if (playbackRecovered) return;
            if (video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA || video.paused) {
                promoteVideoRecovery();
            }
        }, CONFIG.videoRecoveryTimeoutMs);

        const playAttempt = video.play();
        if (playAttempt && typeof playAttempt.catch === 'function') {
            playAttempt.catch(() => promoteVideoRecovery());
        }

        host.dataset.tmMediaBuilt = '1';
        return true;
    }

    function buildOverlay(blurContainer, img, postHref) {
        const host = getOverlayHost(blurContainer);
        if (!host) return;

        if (!shouldBuildFallback(host, blurContainer)) {
            clearPendingFallback(host);
            return;
        }

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
            pointer-events:none;
            background:rgba(0,0,0,0.12);
        `;

        const button = document.createElement('button');
        button.type = 'button';
        button.textContent = 'Loading...';
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

        const attemptBuild = async () => {
            button.disabled = true;
            button.textContent = 'Loading...';

            if (hasNativeResolvedMedia(host, blurContainer) || hasNativeRevealControl(host)) {
                recordDebug('fallback-suppressed', {
                    normalizedPostUrl: normalizePostHref(postHref) || postHref || null,
                    nativeResolved: hasNativeResolvedMedia(host, blurContainer),
                    nativeRevealControl: hasNativeRevealControl(host)
                });
                overlay.remove();
                delete host.dataset.tmOverlayBuilt;
                return;
            }

            let built = false;
            let builtMediaType = null;

            if (postHref) {
                const normalizedPostUrl = normalizePostHref(postHref) || new URL(postHref, location.origin).toString();
                const post = await fetchPostData(postHref);
                const media = resolveMediaFromPost(post);
                const clickHref = normalizedPostUrl;
                builtMediaType = media?.type || null;

                recordDebug('resolved-media', {
                    normalizedPostUrl,
                    mediaType: media?.type || null
                });

                if (media?.type === 'gallery') {
                    const firstItem = media.items?.[0];
                    const preloaded = firstItem ? await preloadImage(firstItem.src) : null;
                    recordDebug('gallery-preload', {
                        normalizedPostUrl,
                        firstItem: firstItem?.src || null,
                        ok: Boolean(preloaded)
                    });
                    if (preloaded) {
                        built = createGalleryLayer(host, media, clickHref, img?.alt || '');
                    }
                } else if (media?.type === 'image') {
                    const preloaded = await preloadImage(media.src);
                    recordDebug('image-preload', {
                        normalizedPostUrl,
                        src: media.src,
                        ok: Boolean(preloaded)
                    });
                    if (preloaded) {
                        built = createSharpLayer(
                            host,
                            media.src,
                            clickHref,
                            img?.alt || ''
                        );
                    }
                } else if (media?.type === 'video') {
                    const playableSrc = await resolvePlayableVideoSource({ ...media, debugPostUrl: normalizedPostUrl });
                    if (playableSrc) {
                        built = createVideoLayer(host, { ...media, src: playableSrc }, clickHref);
                    }
                }
            } else {
                recordDebug('missing-post-href', {
                    currentUrl: location.href
                });
            }

            if (built) {
                recordDebug('fallback-build-success', {
                    normalizedPostUrl: normalizePostHref(postHref) || postHref || null,
                    mediaType: builtMediaType
                });
                overlay.remove();
                delete host.dataset.tmOverlayBuilt;
            } else {
                recordDebug('fallback-build-failed', {
                    normalizedPostUrl: normalizePostHref(postHref) || postHref || null,
                    buttonText: 'Try again'
                });
                button.disabled = false;
                button.textContent = 'Try again';
                overlay.style.pointerEvents = 'auto';
            }
        };

        button.addEventListener('click', (event) => {
            event.preventDefault();
            event.stopPropagation();
            attemptBuild();
        });

        overlay.appendChild(button);
        host.appendChild(overlay);
        attemptBuild();
    }

    function scheduleFallbackBuild(el, img, postHref) {
        const host = getOverlayHost(el);
        if (!host) {
            recordDebug('missing-overlay-host', {
                currentUrl: location.href,
                reason: getReason(el)
            });
            return;
        }

        clearPendingFallback(host);

        const initialBlockers = collectFallbackBlockers(host, el);
        recordDebug('schedule-fallback', {
            normalizedPostUrl: normalizePostHref(postHref) || postHref || null,
            blockers: initialBlockers,
            imgFound: Boolean(img)
        });

        if (initialBlockers.length) {
            yieldToNativeMedia(host, el);
            return;
        }

        const timer = setTimeout(() => {
            fallbackTimers.delete(host);
            const timerBlockers = collectFallbackBlockers(host, el);
            recordDebug('fallback-timer-fired', {
                normalizedPostUrl: normalizePostHref(postHref) || postHref || null,
                blockers: timerBlockers,
                imgFound: Boolean(img)
            });
            if (timerBlockers.length) {
                yieldToNativeMedia(host, el);
                return;
            }
            buildOverlay(el, img, postHref);
        }, CONFIG.fallbackDelayMs);

        fallbackTimers.set(host, timer);
    }

    function processBlurredContainer(el) {
        if (!(el instanceof Element)) return;
        const reason = getReason(el);
        if (!shouldHandleReason(reason)) return;

        const host = getOverlayHost(el);
        unblurElement(el, host);

        const img = el.querySelector('img');
        const postHref = resolvePostHref(el, host);

        recordDebug('process-blurred-container', {
            reason,
            hostFound: Boolean(host),
            imgFound: Boolean(img),
            normalizedPostUrl: normalizePostHref(postHref) || postHref || null
        });

        scheduleFallbackBuild(el, img, postHref);
    }

    function scan(root = document) {
        if (!(root instanceof Element || root instanceof Document)) return;
        const blurred = root.querySelectorAll('shreddit-blurred-container[reason="nsfw"]');
        if (blurred.length) {
            recordDebug('scan-found-blurs', {
                count: blurred.length,
                currentUrl: location.href
            });
        }
        blurred.forEach(processBlurredContainer);
    }


    const mo = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
            if (mutation.type === 'attributes') {
                const target = mutation.target;
                if (target instanceof Element && target.matches('shreddit-blurred-container[reason]')) {
                    processBlurredContainer(target);
                }
                continue;
            }

            for (const node of mutation.addedNodes) {
                if (node instanceof Element) {
                    if (node.matches?.('shreddit-blurred-container[reason]')) {
                        processBlurredContainer(node);
                    }
                    scan(node);
                }
            }
        }
    });

    function start() {
        recordDebug('script-start', {
            version: '1.21',
            shortcut: 'Alt+Shift+R',
            exportFunction: 'window.redditImageRecreationExportLog()'
        });
        scan(document);

        if (document.body) {
            mo.observe(document.body, {
                childList: true,
                subtree: true,
                attributes: true,
                attributeFilter: ['blurred', 'reason']
            });
        }

        setInterval(() => {
            if (location.href !== lastUrl) {
                lastUrl = location.href;
                log('URL changed, rescanning');
                scan(document);
            }
        }, 500);
    }

    document.addEventListener('keydown', (event) => {
        const key = event.key.toLowerCase();
        if (event.altKey && event.shiftKey && key === 'r') {
            event.preventDefault();
            exportDebugLog();
        }
    });

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', start, { once: true });
    } else {
        start();
    }
})();

