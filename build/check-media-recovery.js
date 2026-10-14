const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

// Execute the real helpers without starting page observation or adding runtime hooks.
const source = fs.readFileSync(path.join(__dirname, '../src/userscripts/reddit-image-recreation.user.js'), 'utf8');
const boundary = source.indexOf('    const mo = new MutationObserver');
assert.ok(boundary > 0);
const instrumented = source.slice(0, boundary) + `
globalThis.subject = { fetchPostData, buildRankedVideoSources, hasNativeResolvedMedia, preloadImage, canContinueFallback,
    scheduleFallbackBuild, clearPendingFallback, getSharedLogReporter,
    extractImageMediaFromPost, selectDisplayImageSource, preloadFallbackImage, measureFallbackLayout, viewportFallback,
    findPendingNativeImage, handleNativeImageEvent, fallbackTimers, createNativeImagePreloader, CONFIG };
buildOverlay = (...args) => globalThis.buildAttempts.push(args);
})();`;
class Element {
    constructor(tag = 'div') {
        this.tag = tag;
        this.isConnected = true;
        this.className = '';
        this.attrs = {};
        this.style = { display: 'block', visibility: 'visible', opacity: '1' };
        this.children = [];
        this.dataset = {};
    }
    matches(selector) { return selector.split(',').map(s => s.trim()).some(s => s === this.tag ||
        (s === 'shreddit-blurred-container[reason="nsfw"]' && this.tag === 'shreddit-blurred-container' && this.attrs.reason === 'nsfw')); }
    closest(selector) {
        if (selector === '.tm-unblur-media-layer') return this.customLayer || null;
        if (selector === '[slot="revealed"]') return this.revealedSlot || null;
        return null;
    }
    remove() { this.parentElement = null; this.isConnected = false; }
    getAttribute(key) { return this.attrs[key] || null; }
    setAttribute(key, value) { this.attrs[key] = String(value); }
    hasAttribute(key) { return Object.hasOwn(this.attrs, key); }
    removeAttribute(key) { delete this.attrs[key]; }
    getBoundingClientRect() { return this.box || { width: 320, height: 240 }; }
    getRootNode() { return {}; }
    querySelectorAll(selector) { return this.children.filter(node => node.matches(selector)); }
    querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
    contains(node) { return this.children.includes(node); }
}
const timers = new Map();
let timerId = 0;
let clockMs = 0;
let lastImage;
class Image {
    constructor() { this.listeners = new Map(); lastImage = this; }
    addEventListener(event, fn) { this.listeners.set(event, fn); }
    removeEventListener(event) { this.listeners.delete(event); }
    removeAttribute() { this.src = ''; }
}
const context = {
    window: { devicePixelRatio: 1 }, Element, Image, Document: class {}, URL, buildAttempts: [],
    HTMLMediaElement: { HAVE_CURRENT_DATA: 2 },
    location: { href: 'https://www.reddit.com/', origin: 'https://www.reddit.com', pathname: '/' },
    console: { log() {} },
    document: { createElement() { return { set innerHTML(value) { this.value = value.replace(/&amp;/g, '&'); } }; } },
    getComputedStyle: node => node.style,
    performance: { now: () => clockMs },
    setTimeout(fn, delay) { fn.dueAt = clockMs + delay; timers.set(++timerId, fn); return timerId; },
    clearTimeout(id) { timers.delete(id); }
};
vm.createContext(context);
vm.runInContext(instrumented, context);
const { subject } = context;

function advanceTo(time) {
    clockMs = time;
    for (const [id, fn] of [...timers]) {
        if (fn.dueAt <= clockMs) { timers.delete(id); fn(); }
    }
}

function checkNativeImagePreloading() {
    timers.clear(); clockMs = 0; context.window.innerHeight = 900;
    let observer;
    context.IntersectionObserver = class {
        constructor(callback, options) { this.callback = callback; this.targets = new Set(); observer = this;
            assert.equal(options.rootMargin, '1000px 0px'); }
        observe(host) { this.targets.add(host); }
        unobserve(host) { this.targets.delete(host); }
    };
    const host = new Element(), blur = new Element('shreddit-blurred-container'), image = new Element('img');
    blur.attrs.reason = 'nsfw'; blur.parentElement = host; image.parentElement = host;
    image.className = 'media-lightbox-img'; image.complete = false;
    image.attrs = { src: 'https://preview.redd.it/signed.jpg?width=1080&s=signature',
        srcset: 'https://preview.redd.it/signed.jpg?width=640&s=other 640w', loading: 'lazy' };
    image.closest = selector => selector === '[slot="post-media-container"]' ? host :
        selector === '.tm-unblur-media-layer' ? image.customLayer || null : null;
    host.children = [blur, image];
    const setBoxes = top => { host.box = image.box = { left: 100, right: 800, top, bottom: top + 540, width: 700, height: 540 }; };
    const preloader = subject.createNativeImagePreloader();
    setBoxes(5000); preloader.visit(blur, host);
    assert.equal(image.attrs.loading, 'lazy', 'distant pictures retain native lazy loading');
    assert.equal(observer.targets.size, 1);
    setBoxes(1200); observer.callback([{ target: host, isIntersecting: true }]);
    assert.equal(image.attrs.loading, 'eager', 'nearby native pictures are requested before entering the viewport');
    assert.equal(image.attrs.src, 'https://preview.redd.it/signed.jpg?width=1080&s=signature');
    assert.equal(image.attrs.srcset, 'https://preview.redd.it/signed.jpg?width=640&s=other 640w', 'native source selection is preserved');
    preloader.visit(blur, host);
    assert.equal(preloader.snapshot().promotions, 1, 'repeated scans do not repeat a loading-hint change');
    image.attrs.loading = 'lazy'; preloader.visitForNode(image);
    assert.equal(image.attrs.loading, 'eager', 'new/rerendered image content is handled through the native media host');
    for (const kind of ['blurred', 'hidden', 'clipped', 'collapsed', 'fallback', 'background', 'loaded', 'video']) {
        setBoxes(1200); image.style.display = 'block'; image.customLayer = null; image.complete = false;
        image.className = 'media-lightbox-img'; image.attrs.loading = 'lazy'; delete image.attrs.role;
        image.attrs.src = 'https://preview.redd.it/signed.jpg'; host.children = [blur, image];
        if (kind === 'blurred') image.attrs.src += '?blur=40';
        if (kind === 'hidden') image.style.display = 'none';
        if (kind === 'clipped') image.box = { ...image.box, left: 900, right: 1600 };
        if (kind === 'collapsed') image.box = { ...image.box, height: 0 };
        if (kind === 'fallback') image.customLayer = new Element();
        if (kind === 'background') { image.className = ''; image.attrs.role = 'presentation'; }
        if (kind === 'loaded') image.complete = true;
        if (kind === 'video') host.children.push(new Element('video'));
        preloader.visit(blur, host);
        assert.equal(image.attrs.loading, 'lazy', kind + ' media is excluded from native preloading');
    }
    host.children = [blur, image]; image.complete = false; image.attrs.loading = 'lazy';
    subject.CONFIG.preloadNativeImages = false; preloader.visit(blur, host);
    assert.equal(image.attrs.loading, 'lazy', 'native preloading can be disabled');
    subject.CONFIG.preloadNativeImages = true;
    host.isConnected = false; preloader.prune();
    assert.equal(observer.targets.size, 0, 'detached media hosts release observation');
    assert.equal(preloader.snapshot().trackedHosts, 0);
    host.isConnected = true; delete context.IntersectionObserver;
    const withoutObserver = subject.createNativeImagePreloader(); withoutObserver.visit(blur, host);
    assert.equal(image.attrs.loading, 'eager', 'existing scans provide preloading without observer support');
    subject.scheduleFallbackBuild(blur, image, '/comments/pending/');
    const before = context.buildAttempts.length; advanceTo(1200);
    assert.equal(context.buildAttempts.length, before + 1, 'unfinished native images no longer add an eight-second recovery delay');
    delete context.window.innerHeight;
}

function checkFallbackScheduling() {
    const host = new Element();
    const blur = new Element('shreddit-blurred-container');
    blur.attrs.reason = 'nsfw';
    blur.parentElement = host;
    host.children = [blur];
    const schedule = (href = '/comments/deadline/') => subject.scheduleFallbackBuild(blur, null, href);
    schedule();
    const firstTimer = [...timers.keys()][0];
    for (const time of [300, 600, 900, 1199]) {
        advanceTo(time);
        schedule();
        assert.equal([...timers.keys()][0], firstTimer, 'rescans preserve the first fallback deadline');
        assert.equal(context.buildAttempts.length, 0);
    }
    const freshImage = new Element('img');
    blur.children = [freshImage];
    advanceTo(1200);
    assert.equal(context.buildAttempts.length, 1, 'fallback starts at 1200ms despite frequent rescans');
    assert.equal(context.buildAttempts[0][1], freshImage, 'deadline reads the current image');
    const fired = subject.getSharedLogReporter().entries.find(entry => entry.event === 'fallback-timer-fired');
    assert.equal(JSON.parse(fired.details).waitMs, 1200);
    assert.equal(JSON.parse(fired.details).intendedWaitMs, 1200);

    schedule();
    host.children.push(new Element('video'));
    schedule();
    assert.equal(timers.size, 0, 'native arrival cancels a pending timer on rescan');
    host.children = [blur];
    schedule();
    host.children.push(new Element('video'));
    advanceTo(2400);
    assert.equal(context.buildAttempts.length, 1, 'native arrival also blocks a timer without a rescan');
    host.children = [blur];

    schedule();
    host.isConnected = false;
    advanceTo(3600);
    assert.equal(context.buildAttempts.length, 1, 'detached hosts cannot start fallback work');
    host.isConnected = true;
    schedule();
    blur.parentElement = new Element();
    advanceTo(4800);
    assert.equal(context.buildAttempts.length, 1, 'reparented containers invalidate the old timer');
    blur.parentElement = host;

    schedule();
    advanceTo(5100);
    schedule('/comments/reused/');
    advanceTo(6000);
    assert.equal(context.buildAttempts.length, 1, 'host reuse cancels the obsolete post deadline');
    advanceTo(6300);
    assert.equal(context.buildAttempts.length, 2);
    assert.equal(context.buildAttempts[1][2], '/comments/reused/');
    schedule();
    subject.clearPendingFallback(host);
    assert.equal(timers.size, 0);
}

async function run() {
    checkFallbackScheduling();
    checkNativeImagePreloading();
    checkViewportFallback();
    const originalSrc = 'https://i.redd.it/large.jpg';
    const resolution = width => ({
        url: `https://preview.redd.it/large.jpg?width=${width}&format=pjpg&auto=webp&s=signed-${width}#image`,
        width, height: Math.round(width * 8192 / 5464)
    });
    const post = {
        url: originalSrc,
        preview: { images: [{ source: { url: originalSrc, width: 5464, height: 8192 },
            resolutions: [resolution(1080), resolution(320), resolution(960), resolution(640)] }] }
    };
    const media = subject.extractImageMediaFromPost(post);
    const layout = { width: 700, height: 540 };
    const collapsedHost = new Element();
    const cappedBlur = new Element();
    collapsedHost.box = cappedBlur.box = { width: 700, height: 0 };
    cappedBlur.style.maxHeight = '540px';
    const measuredLayout = subject.measureFallbackLayout(collapsedHost, cappedBlur, null,
        { naturalWidth: media.width, naturalHeight: media.height });
    assert.equal(measuredLayout.height, 540);
    assert.equal(subject.selectDisplayImageSource(media, measuredLayout).src, resolution(640).url,
        'source selection honors Reddit height caps on collapsed media hosts');
    assert.equal(subject.selectDisplayImageSource(media, layout).src, resolution(640).url,
        'portrait images use the smallest full-frame preview that fits the actual displayed box');
    const cdnResolution = { ...resolution(640), url: resolution(640).url.replace('preview.redd.it', 'cf.preview.redd.it').replace('&format=', '&crop=smart&format=') };
    const cdnSelected = subject.selectDisplayImageSource({ ...media, resolutions: [cdnResolution] }, layout);
    assert.equal(cdnSelected.src, cdnResolution.url, 'the Reddit CDN host observed in field logs supports sized previews');
    assert.equal(cdnSelected.previewCandidates.hosts['cf.preview.redd.it'], 1);
    assert.equal(cdnSelected.previewCandidates.eligible, 1);
    const impostor = { ...cdnResolution, url: cdnResolution.url.replace('cf.preview.redd.it', 'cf.preview.redd.it.example.test') };
    const rejectedHost = subject.selectDisplayImageSource({ ...media, resolutions: [impostor] }, layout);
    assert.equal(rejectedHost.src, originalSrc);
    assert.equal(rejectedHost.previewCandidates.rejected['unsupported-host'], 1);
    context.window.devicePixelRatio = 2;
    assert.equal(subject.selectDisplayImageSource(media, layout).src, resolution(960).url,
        'high-density screens receive enough image pixels');
    context.window.devicePixelRatio = 4;
    assert.equal(subject.selectDisplayImageSource(media, layout).src, originalSrc,
        'insufficient previews do not replace a sharper original');
    context.window.devicePixelRatio = 1;
    assert.equal(subject.selectDisplayImageSource(media, { width: 0, height: 0 }).src, originalSrc);
    assert.equal(subject.selectDisplayImageSource({ ...media, animated: true }, layout).src, originalSrc,
        'animation is never replaced by a still preview');
    assert.equal(subject.selectDisplayImageSource({ ...media, resolutions: [] }, layout).src, originalSrc);
    subject.CONFIG.useSizedImagePreviews = false;
    assert.equal(subject.selectDisplayImageSource(media, layout).src, originalSrc);
    subject.CONFIG.useSizedImagePreviews = true;
    const unsafe = [
        { ...resolution(640), url: resolution(640).url.replace('#image', '&blur=40') },
        { ...resolution(640), url: resolution(640).url.replace('#image', '&crop=faces') },
        { ...resolution(640), height: 640 },
        { ...resolution(640), width: NaN },
        { ...resolution(640), url: 'not-a-url' }
    ];
    const rejected = subject.selectDisplayImageSource({ ...media, resolutions: unsafe }, layout);
    assert.equal(rejected.src, originalSrc);
    for (const reason of ['blurred', 'cropped', 'aspect-ratio', 'invalid-dimensions', 'unsupported-host']) {
        assert.equal(rejected.previewCandidates.rejected[reason], 1);
    }
    const encoded = { ...resolution(640), url: resolution(640).url.replaceAll('&', '&amp;') };
    assert.equal(subject.selectDisplayImageSource({ ...media, resolutions: [encoded] }, layout).src, resolution(640).url,
        'advertised preview signatures and query/hash fields survive HTML decoding');
    const gif = subject.extractImageMediaFromPost({ ...post, url: 'https://i.redd.it/animation.gif' });
    assert.equal(gif.animated, true);
    assert.equal(subject.selectDisplayImageSource(gif, layout).src, gif.src);
    const metadata = subject.extractImageMediaFromPost({
        gallery_data: { items: [{ media_id: 'one' }] },
        media_metadata: { one: { s: { u: originalSrc, x: 5464, y: 8192 }, p: [
            { u: resolution(640).url, x: 640, y: resolution(640).height }
        ] } }
    });
    assert.equal(subject.selectDisplayImageSource(metadata, layout).src, resolution(640).url);

    Object.assign(context.window, { innerHeight: 720, innerWidth: 1280, scrollY: 0 });
    context.document.visibilityState = 'visible';
    const waitingHost = new Element();
    waitingHost.box = { width: 360, height: 540, top: 500, bottom: 1040, left: 0, right: 360 };
    const previewSuccess = subject.preloadFallbackImage(media, layout, () => true, '/comments/preview/', waitingHost);
    const selectedEvent = subject.getSharedLogReporter().entries.filter(entry => entry.event === 'image-source-selected').at(-1);
    assert.equal(JSON.parse(selectedEvent.details).viewport.intersectsViewport, true);
    assert.equal(lastImage.src, resolution(640).url);
    lastImage.naturalWidth = 640; lastImage.naturalHeight = 960;
    clockMs += 75;
    waitingHost.box.top = -600;
    waitingHost.box.bottom = -60;
    context.window.scrollY = 1100;
    lastImage.listeners.get('load')();
    assert.equal((await previewSuccess).src, resolution(640).url);
    const preloadEvent = subject.getSharedLogReporter().entries.filter(entry => entry.event === 'image-preload').at(-1);
    assert.equal(JSON.parse(preloadEvent.details).elapsedMs, 75);
    assert.equal(JSON.parse(preloadEvent.details).viewport.intersectsViewport, false,
        'completion records that the user has already scrolled past an image which started loading on screen');
    assert.equal(JSON.parse(preloadEvent.details).viewport.scrollY, 1100);
    const retryOriginal = subject.preloadFallbackImage(media, layout, () => true, '/comments/retry/');
    lastImage.listeners.get('error')();
    for (let i = 0; i < 4; i++) await Promise.resolve();
    assert.equal(lastImage.src, originalSrc, 'a failed signed preview retries the original');
    lastImage.listeners.get('load')();
    assert.equal((await retryOriginal).src, originalSrc);
    assert.equal(timers.size, 0);
    const croppedPixels = subject.preloadFallbackImage({ ...media, resolutions: [cdnResolution] }, layout, () => true, '/comments/cropped/');
    lastImage.naturalWidth = 640; lastImage.naturalHeight = 640;
    lastImage.listeners.get('load')();
    for (let i = 0; i < 4; i++) await Promise.resolve();
    assert.equal(lastImage.src, originalSrc, 'a smart-crop preview with mismatched loaded dimensions retries the original');
    lastImage.listeners.get('load')();
    assert.equal((await croppedPixels).src, originalSrc);
    const obsolete = subject.preloadFallbackImage(media, layout, () => false, '/comments/obsolete/');
    const abandonedImage = lastImage;
    lastImage.listeners.get('error')();
    assert.equal(await obsolete, null);
    assert.equal(lastImage, abandonedImage, 'native handoff prevents an obsolete retry of the original');
    const bothFailed = subject.preloadFallbackImage(media, layout, () => true, '/comments/broken/');
    lastImage.listeners.get('error')();
    for (let i = 0; i < 4; i++) await Promise.resolve();
    lastImage.listeners.get('error')();
    assert.equal(await bothFailed, null, 'two failed sources settle without repeated probing');
    assert.equal(timers.size, 0);
    for (const failure of ['http', 'network', 'json', 'empty']) {
        let calls = 0;
        context.fetch = async () => {
            calls++;
            if (calls === 1) {
                if (failure === 'network') throw new Error('offline');
                return { ok: failure !== 'http', status: 503, json: async () => {
                    if (failure === 'json') throw new Error('invalid JSON');
                    return [];
                } };
            }
            return { ok: true, json: async () => [{ data: { children: [{ data: { id: failure } }] } }] };
        };
        const href = '/comments/' + failure + '/';
        assert.equal(await subject.fetchPostData(href), null);
        assert.equal((await subject.fetchPostData(href)).id, failure);
        await subject.fetchPostData(href);
        assert.equal(calls, 2, failure + ' retries once, then caches success');
    }
    let completeFetch;
    context.fetch = async () => ({ ok: false, status: 403, redirected: true,
        url: 'https://www.reddit.com/denied?solution=PRIVATE_SOLUTION',
        headers: { get: name => name === 'content-type' ? 'text/html' : '60' } });
    assert.equal(await subject.fetchPostData('/comments/denied/'), null);
    const denial = JSON.parse(subject.getSharedLogReporter().entries.filter(entry => entry.event === 'fetch-post-data-failed').at(-1).details);
    assert.equal(denial.request.status, 403);
    assert.equal(denial.request.contentType, 'text/html');
    assert.equal(denial.request.retryAfter, '60');
    assert.ok(!denial.request.responseUrl.includes('PRIVATE_'), 'response diagnostics redact challenge parameters');
    let concurrentCalls = 0;
    context.fetch = () => { concurrentCalls++; return new Promise(resolve => { completeFetch = resolve; }); };
    const first = subject.fetchPostData('/comments/shared/');
    const second = subject.fetchPostData('/comments/shared/');
    assert.equal(concurrentCalls, 1);
    completeFetch({ ok: true, json: async () => [] });
    await Promise.all([first, second]);

    const plain = subject.buildRankedVideoSources('https://v.redd.it/id/DASH_480.mp4');
    const queried = subject.buildRankedVideoSources('https://v.redd.it/id/DASH_480.mp4?source=fallback#fragment');
    assert.equal(queried.length, plain.length);
    queried.forEach((url, i) => assert.equal(url, plain[i] + '?source=fallback#fragment'));

    const host = new Element();
    const video = new Element('video');
    host.children = [video];
    video.readyState = 0;
    assert.equal(subject.hasNativeResolvedMedia(host, host), true, 'loading native video retains ownership');
    video.readyState = 2;
    assert.equal(subject.hasNativeResolvedMedia(host, host), true);
    video.parentElement = new Element();
    video.parentElement.style.opacity = '0';
    assert.equal(subject.hasNativeResolvedMedia(host, host), true, 'temporarily hidden native video retains ownership');
    video.parentElement = null;
    video.assignedSlot = new Element();
    video.assignedSlot.style.display = 'none';
    assert.equal(subject.hasNativeResolvedMedia(host, host), true, 'native playback is not replaced during slot reveal');
    video.assignedSlot = null;
    video.customLayer = new Element();
    assert.equal(subject.hasNativeResolvedMedia(host, host), false);
    const img = new Element('img');
    img.attrs.src = 'https://preview.redd.it/id.jpg';
    img.className = 'media-lightbox-img';
    host.children = [img];
    assert.equal(subject.hasNativeResolvedMedia(host, host), false);
    img.complete = true; img.naturalWidth = 320; img.naturalHeight = 240;
    assert.equal(subject.hasNativeResolvedMedia(host, host), true);
    img.attrs.src += '?blur=40';
    assert.equal(subject.hasNativeResolvedMedia(host, host), false);
    host.children = [new Element('shreddit-async-loader')];
    assert.equal(subject.hasNativeResolvedMedia(host, host), false);

    const loader = new Element('shreddit-async-loader');
    loader.revealedSlot = new Element();
    host.children = [loader];
    assert.equal(subject.hasNativeResolvedMedia(host, host), true, 'revealed embed loader retains ownership');
    host.children = [];
    const blur = new Element();
    blur.parentElement = host;
    const overlay = new Element();
    overlay.parentElement = host;
    assert.equal(subject.canContinueFallback(host, blur, overlay), true);
    // Model a native player arriving while JSON or an image preload is pending.
    host.children = [new Element('video')];
    assert.equal(subject.canContinueFallback(host, blur, overlay), false);
    assert.equal(overlay.parentElement, null, 'stale loading overlay is removed');
    host.children = [];
    assert.equal(subject.canContinueFallback(host, blur, overlay), false, 'removed attempt cannot restart');
    overlay.parentElement = host;
    host.isConnected = false;
    assert.equal(subject.canContinueFallback(host, blur, overlay), false, 'navigation invalidates attempt');
    host.isConnected = true;
    blur.parentElement = new Element();
    assert.equal(subject.canContinueFallback(host, blur, overlay), false, 'host replacement invalidates attempt');

    const timeout = subject.preloadImage('https://example.test/stalled.jpg');
    [...timers.values()].forEach(fn => fn());
    assert.equal(await timeout, null);
    assert.equal(lastImage.listeners.size, 0);
    assert.equal(lastImage.src, '');
    const loaded = subject.preloadImage('https://example.test/loaded.jpg');
    lastImage.listeners.get('load')();
    assert.equal(await loaded, lastImage);
    assert.equal(timers.size, 0);
    const error = subject.preloadImage('https://example.test/broken.jpg');
    lastImage.listeners.get('error')();
    assert.equal(await error, null);
    assert.equal(timers.size, 0);
    console.log('[check-media-recovery] Passed nearby native loading hints/exclusions, restored recovery deadlines, viewport deferral/retirement, HTTP response metadata, stable fallback deadlines, display-sized image selection/recovery, request retries/cache, video URLs, native playback ownership, stale attempts, and image preload checks.');
}

function checkViewportFallback() {
    const observed = new Set();
    let onIntersection;
    context.IntersectionObserver = class {
        constructor(callback, options) { onIntersection = callback; assert.equal(options.rootMargin, '1000px 0px'); }
        observe(host) { observed.add(host); }
        unobserve(host) { observed.delete(host); }
    };
    context.window.innerHeight = 720;
    const host = new Element();
    host.box = { width: 700, height: 540, top: 5000, bottom: 5540 };
    const blur = new Element('shreddit-blurred-container');
    blur.attrs.reason = 'nsfw';
    blur.parentElement = host;
    host.children = [blur];
    context.location.href = 'https://www.reddit.com/comments/viewport/';
    context.location.pathname = '/comments/viewport/';
    const count = context.buildAttempts.length;
    subject.scheduleFallbackBuild(blur, null, context.location.href);
    assert.equal(timers.size, 0, 'far-offscreen native loading cannot start the fallback grace period');
    assert.ok(observed.has(host));
    assert.equal(subject.viewportFallback.size(), 1);
    host.box.top = 1200; host.box.bottom = 1740;
    onIntersection([{ target: host, isIntersecting: true }]);
    assert.equal(observed.size, 0, 'entry releases the deferred host');
    const deadline = clockMs + 1200;
    advanceTo(deadline - 1);
    assert.equal(context.buildAttempts.length, count);
    advanceTo(deadline);
    assert.equal(context.buildAttempts.length, count + 1, 'viewport entry gets the full native grace period');
    subject.scheduleFallbackBuild(blur, null, context.location.href);
    host.box.top = -5000; host.box.bottom = -4460;
    advanceTo(clockMs + 1200);
    assert.equal(context.buildAttempts.length, count + 1, 'scrolling away before the deadline defers reconstruction again');
    assert.ok(observed.has(host));
    host.isConnected = false;
    subject.viewportFallback.prune();
    assert.equal(observed.size, 0, 'detached hosts release observer references');
    assert.equal(subject.viewportFallback.size(), 0);
    onIntersection([{ target: host, isIntersecting: true }]);
    assert.equal(timers.size, 0, 'late callbacks cannot revive detached work');
    host.isConnected = true;
    subject.scheduleFallbackBuild(blur, null, context.location.href);
    host.children.push(new Element('video'));
    subject.scheduleFallbackBuild(blur, null, context.location.href);
    assert.equal(observed.size, 0, 'native playback ownership releases deferred work');
    delete context.IntersectionObserver;
    context.location.href = 'https://www.reddit.com/'; context.location.pathname = '/';
}
run().catch(err => { console.error(err); process.exitCode = 1; });
