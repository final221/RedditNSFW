const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

// Execute the real helpers without starting page observation or adding runtime hooks.
const source = fs.readFileSync(path.join(__dirname, '../src/userscripts/reddit-image-recreation.user.js'), 'utf8');
const boundary = source.indexOf('    const mo = new MutationObserver');
assert.ok(boundary > 0);
const instrumented = source.slice(0, boundary) + `
globalThis.subject = { fetchPostData, buildRankedVideoSources, hasNativeResolvedMedia, preloadImage, canContinueFallback };
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
    matches(selector) { return selector.split(',').map(s => s.trim()).includes(this.tag); }
    closest(selector) {
        if (selector === '.tm-unblur-media-layer') return this.customLayer || null;
        if (selector === '[slot="revealed"]') return this.revealedSlot || null;
        return null;
    }
    remove() { this.parentElement = null; this.isConnected = false; }
    getAttribute(key) { return this.attrs[key] || null; }
    getBoundingClientRect() { return { width: 320, height: 240 }; }
    getRootNode() { return {}; }
    querySelectorAll(selector) { return this.children.filter(node => node.matches(selector)); }
    contains(node) { return this.children.includes(node); }
}
const timers = new Map();
let timerId = 0;
let lastImage;
class Image {
    constructor() { this.listeners = new Map(); lastImage = this; }
    addEventListener(event, fn) { this.listeners.set(event, fn); }
    removeEventListener(event) { this.listeners.delete(event); }
    removeAttribute() { this.src = ''; }
}
const context = {
    window: {}, Element, Image, Document: class {}, URL,
    HTMLMediaElement: { HAVE_CURRENT_DATA: 2 },
    location: { href: 'https://www.reddit.com/', origin: 'https://www.reddit.com' },
    console: { log() {} },
    document: { createElement() { return { set innerHTML(value) { this.value = value; } }; } },
    getComputedStyle: node => node.style,
    setTimeout(fn) { timers.set(++timerId, fn); return timerId; },
    clearTimeout(id) { timers.delete(id); }
};
vm.createContext(context);
vm.runInContext(instrumented, context);
const { subject } = context;

async function run() {
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
    console.log('[check-media-recovery] Passed request retries/cache, video URLs, native playback ownership, stale attempts, and image preload checks.');
}
run().catch(err => { console.error(err); process.exitCode = 1; });
