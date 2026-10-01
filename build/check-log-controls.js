const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

// Run the real reporting/UI helpers without starting Reddit media observation.
const source = fs.readFileSync(path.join(__dirname, '../src/userscripts/reddit-image-recreation.user.js'), 'utf8');
const boundary = source.indexOf('    const mo = new MutationObserver');
assert.ok(boundary > 0);
const instrumented = source.slice(0, boundary) + `
globalThis.subject = { sharedLog, createLogControl, ensureLogControl, recordDebug, measureScan, collectPageSnapshot,
    findNativeMediaOwner, describeNativeOwner, collectMediaDiagnostics, scheduleFallbackBuild, hasNativeResolvedMedia,
    attachImageRenderDebug, yieldToNativeMedia, observeNativeImageHandoff, snapshotHostViewport };
})();`;
const timers = new Map();
const downloads = [];
const blobs = new Map();
const revoked = [];
let timerId = 0;
let activeElement;
let clockMs = 0;

class Element {
    constructor(tag = 'div') {
        this.tagName = tag.toUpperCase();
        this.listeners = new Map();
        this.children = [];
        this.style = { display: 'block', visibility: 'visible', opacity: '1' };
        this.attrs = {};
        this.dataset = {};
        this.isConnected = false;
        this.hidden = false;
        this.textContent = '';
    }
    addEventListener(event, listener) { this.listeners.set(event, listener); }
    getAttribute(key) { return this.attrs[key] || null; }
    hasAttribute(key) { return Object.hasOwn(this.attrs, key); }
    matches(selector) { return selector.split(',').some(part => part.trim() === this.tagName.toLowerCase()); }
    closest(selector) {
        if (selector === '.tm-unblur-media-layer') return this.customLayer || null;
        if (selector === '[slot="revealed"]') return this.revealedSlot || null;
        return null;
    }
    querySelectorAll(selector) { return this.children.filter(node => node.matches(selector)); }
    querySelector(selector) {
        if (selector === '.tm-unblur-media-layer video') return this.children.find(node => node.customLayer && node.matches('video'));
        return this.querySelectorAll(selector)[0] || null;
    }
    getRootNode() { return {}; }
    getBoundingClientRect() { return this.box || { width: 320, height: 240, top: 0, bottom: 240 }; }
    contains(node) { return this.children.includes(node); }
    async emit(event, details = {}) { return this.listeners.get(event)?.(details); }
    appendChild(child) { this.children.push(child); child.isConnected = true; child.parentElement = this; }
    remove() {
        if (this.parentElement) this.parentElement.children = this.parentElement.children.filter(child => child !== this);
        this.isConnected = false;
    }
    attachShadow() { this.shadowRoot = new ShadowRoot(); return this.shadowRoot; }
    focus() { activeElement = this; }
    select() { this.selectionStart = 0; this.selectionEnd = this.value.length; }
    click() {
        if (this.tagName === 'A') downloads.push({ name: this.download, blob: blobs.get(this.href) });
    }
}
class ShadowRoot extends Element {
    set innerHTML(markup) {
        this.markup = markup;
        this.nodes = new Map();
        for (const match of markup.matchAll(/<(section|button|textarea|span)\b([^>]*?)id="([^"]+)"([^>]*)>/g)) {
            const node = new Element(match[1]);
            node.hidden = /\bhidden\b/.test(match[2] + match[4]);
            this.nodes.set(match[3], node);
        }
    }
    getElementById(id) { return this.nodes.get(id); }
}
class HTMLImageElement extends Element {
    constructor() { super('img'); }
}
class BrowserURL extends URL {
    static createObjectURL(blob) { const key = 'blob:test-' + blobs.size; blobs.set(key, blob); return key; }
    static revokeObjectURL(url) { revoked.push(url); }
}
class FixedDate extends Date {
    constructor(...args) { super(...(args.length ? args : ['2026-10-01T10:00:00Z'])); }
}
const document = {
    body: new Element('body'),
    documentElement: new Element('html'),
    readyState: 'complete',
    visibilityState: 'visible',
    createElement(tag) { return new Element(tag); },
    querySelectorAll() { return []; }
};
const context = {
    window: { innerWidth: 1280, innerHeight: 720, scrollY: 1200 },
    navigator: { userAgent: 'Diagnostic test browser' },
    location: { href: 'https://www.reddit.com/r/test/comments/abc/', origin: 'https://www.reddit.com', pathname: '/r/test/comments/abc/' },
    document, Element, HTMLImageElement, Document: class {}, URL: BrowserURL, Blob, Date: FixedDate,
    console: { log() { throw new Error('Console diagnostics must be gated by default'); } },
    performance: { now: () => clockMs },
    getComputedStyle: node => node.style,
    setTimeout(fn) { timers.set(++timerId, fn); return timerId; },
    clearTimeout(id) { timers.delete(id); }
};
vm.createContext(context);
vm.runInContext(instrumented, context);
const { subject } = context;

async function checkDiagnostics(reporter) {
    const image = new HTMLImageElement();
    Object.assign(image, { isConnected: true, src: 'https://i.redd.it/render.jpg', complete: true,
        naturalWidth: 640, naturalHeight: 960, clientWidth: 360, clientHeight: 540 });
    image.box = { width: 360, height: 540 };
    subject.attachImageRenderDebug(image, 'render-check');
    const sampleTimers = [...timers.entries()].slice(-3);
    const suppressedBeforeImage = reporter.suppressedEntries;
    for (const [id, fn] of sampleTimers) { timers.delete(id); fn(); }
    assert.equal(reporter.entries.filter(entry => entry.event === 'render-check').length, 1,
        'identical healthy image snapshots retain one state instead of three phases');
    assert.equal(reporter.suppressedEntries, suppressedBeforeImage + 2);
    image.box = { width: 0, height: 0 };
    image.isConnected = false;
    await image.emit('load');
    const detached = reporter.entries.filter(entry => entry.event === 'render-check').at(-1);
    assert.equal(JSON.parse(detached.details).connected, false);
    assert.equal(JSON.parse(detached.details).rectHeight, 0);
    const beforeErrors = reporter.entries.length;
    await image.emit('error');
    await image.emit('error');
    assert.equal(reporter.entries.length, beforeErrors + 2, 'error notifications remain protected even with identical state');

    const handoffHost = new Element();
    handoffHost.isConnected = true;
    handoffHost.dataset.tmMediaBuilt = '1';
    handoffHost.dataset.tmFallbackMinHeightApplied = '1';
    handoffHost.style.minHeight = '540px';
    const handoffBlur = new Element('shreddit-blurred-container');
    handoffBlur.attrs.reason = 'nsfw';
    const nativeImage = new Element('img');
    Object.assign(nativeImage, { complete: true, naturalWidth: 640, naturalHeight: 960 });
    nativeImage.attrs.src = 'https://cf.preview.redd.it/render.jpg';
    nativeImage.getBoundingClientRect = () => ({ width: 360, height: handoffHost.style.minHeight ? 540 : 0 });
    handoffHost.getBoundingClientRect = nativeImage.getBoundingClientRect;
    handoffHost.appendChild(handoffBlur);
    handoffHost.appendChild(nativeImage);
    assert.equal(subject.yieldToNativeMedia(handoffHost, handoffBlur), true);
    const handoff = reporter.entries.filter(entry => entry.event === 'fallback-yielded-to-native').at(-1);
    assert.equal(JSON.parse(handoff.details).hostHeightBefore, 540);
    assert.equal(JSON.parse(handoff.details).hostHeightAfter, 0);
    assert.equal(JSON.parse(handoff.details).nativeStillResolved, false);
    assert.ok(reporter.entries.some(entry => entry.event === 'native-handoff-layout-lost'),
        'handoff diagnostics detect native layout relying on removed fallback sizing');
    handoffHost.dataset.tmMediaBuilt = '1';
    nativeImage.getBoundingClientRect = () => ({ width: 360, height: 540 });
    handoffHost.getBoundingClientRect = nativeImage.getBoundingClientRect;
    const lostBefore = reporter.entries.filter(entry => entry.event === 'native-handoff-layout-lost').length;
    subject.yieldToNativeMedia(handoffHost, handoffBlur);
    assert.equal(reporter.entries.filter(entry => entry.event === 'native-handoff-layout-lost').length, lostBefore,
        'stable native handoffs do not report layout loss');

    const frames = [];
    context.requestAnimationFrame = fn => frames.push(fn);
    const followupCount = () => reporter.entries.filter(entry => entry.event === 'native-handoff-followup').length;
    const readFollowup = () => JSON.parse(reporter.entries.filter(entry => entry.event === 'native-handoff-followup').at(-1).details);
    const finishFollowup = () => {
        const [id, fn] = [...timers.entries()].at(-1);
        timers.delete(id);
        fn();
    };
    const owner = subject.findNativeMediaOwner(handoffHost, handoffBlur);
    const countBefore = followupCount();
    subject.observeNativeImageHandoff(handoffHost, handoffBlur, owner, context.location.href);
    nativeImage.getBoundingClientRect = () => ({ width: 360, height: 0 });
    handoffHost.getBoundingClientRect = nativeImage.getBoundingClientRect;
    clockMs = 16;
    frames.shift()();
    nativeImage.getBoundingClientRect = () => ({ width: 360, height: 540 });
    handoffHost.getBoundingClientRect = nativeImage.getBoundingClientRect;
    clockMs = 32;
    frames.shift()();
    clockMs = 250;
    finishFollowup();
    assert.equal(followupCount(), countBefore + 1, 'one bounded event records all followup samples');
    let followup = readFollowup();
    assert.deepEqual(followup.checks.map(check => check.phase), ['frame-1', 'frame-2', 'after-250ms']);
    assert.equal(followup.checks[0].sameTarget, true);
    assert.equal(followup.checks[0].nativeStillResolved, false, 'a transient frame collapse is captured even if final layout recovers');
    assert.equal(followup.checks[0].hostHeight, 0);
    assert.equal(followup.checks[2].nativeStillResolved, true);
    assert.equal(followup.checks[2].elapsedMs, 250);

    subject.observeNativeImageHandoff(handoffHost, handoffBlur, owner, context.location.href);
    handoffHost.isConnected = false;
    finishFollowup();
    followup = readFollowup();
    assert.equal(followup.checks[0].sameTarget, false, 'detached or replaced targets are distinguished from layout failures');
    assert.equal(followup.checks[0].hostHeight, null);
    const countAfter = followupCount();
    frames.shift()();
    assert.equal(frames.length, 0, 'late frame callbacks do not schedule further work after final sample');
    assert.equal(followupCount(), countAfter);
    handoffHost.isConnected = true;

    document.visibilityState = 'hidden';
    subject.observeNativeImageHandoff(handoffHost, handoffBlur, owner, context.location.href);
    assert.equal(frames.length, 0, 'hidden tabs skip animation-frame observations');
    finishFollowup();
    assert.equal(readFollowup().checks.length, 1);
    assert.equal(readFollowup().visibility, 'hidden');
    document.visibilityState = 'visible';
    const timersBeforeVideo = timers.size;
    subject.observeNativeImageHandoff(handoffHost, handoffBlur, { node: new Element('video') }, context.location.href);
    assert.equal(timers.size, timersBeforeVideo, 'video handoffs add no image followup work');
    delete context.requestAnimationFrame;

    handoffHost.box = { width: 360, height: 540, top: 500, bottom: 1040, left: 10, right: 370 };
    delete handoffHost.getBoundingClientRect;
    assert.equal(subject.snapshotHostViewport(handoffHost).intersectsViewport, true);
    handoffHost.box.top = 721;
    handoffHost.box.bottom = 1261;
    assert.equal(subject.snapshotHostViewport(handoffHost).intersectsViewport, false, 'offscreen image waits are distinguishable');
    handoffHost.box.top = 500;
    handoffHost.isConnected = false;
    assert.equal(subject.snapshotHostViewport(handoffHost).intersectsViewport, false);
    assert.equal(subject.snapshotHostViewport(null), null);

    const before = reporter.entries.length;
    const suppressedBefore = reporter.suppressedEntries;
    const scopes = Array.from({ length: 49 }, () => new Element());
    for (let pass = 0; pass < 60; pass++) {
        scopes.forEach((scope, i) => {
            subject.recordDebug('process-blurred-container', { post: i, imgFound: true }, scope);
            subject.recordDebug('schedule-fallback', { post: i, blockers: ['native-resolved'] }, scope);
        });
    }
    assert.equal(reporter.entries.length - before, 98, '49 unchanged posts produce one pair of state entries each');
    assert.equal(reporter.suppressedEntries - suppressedBefore, 49 * 2 * 59);
    assert.equal(subject.recordDebug('schedule-fallback', { post: 0, blockers: [] }, scopes[0]), true, 'state changes are retained');
    assert.equal(subject.recordDebug('schedule-fallback', { post: 0, blockers: [] }, scopes[0]), false);
    subject.recordDebug('fallback-build-failed', { post: 0, error: 'keep this failure' });
    subject.recordDebug('fallback-yielded-to-native', { post: 0 });
    for (let i = 0; i < reporter.maxEntries * 2; i++) {
        subject.recordDebug('schedule-fallback', { state: i }, scopes[0]);
    }
    assert.equal(reporter.entries.length, reporter.maxEntries);
    assert.ok(reporter.entries.some(entry => entry.event === 'fallback-build-failed'));
    assert.ok(reporter.entries.some(entry => entry.event === 'fallback-yielded-to-native'));
    assert.equal(reporter.droppedImportantEntries, 0, 'routine floods cannot evict failures or recovery events');

    assert.equal(subject.measureScan('fast', () => { clockMs += 7; return 'result'; }), 'result');
    subject.measureScan('outer', () => subject.measureScan('nested', () => { clockMs += 90; }));
    let snapshot = subject.collectPageSnapshot();
    assert.equal(snapshot.scanTiming.batches, 2, 'nested scans are measured as one batch');
    assert.equal(snapshot.scanTiming.last.reason, 'outer');
    assert.equal(snapshot.scanTiming.maxMs, 90);
    assert.equal(snapshot.scanTiming.averageMs, 48.5);
    assert.equal(snapshot.scanTiming.slowBatches, 1);
    assert.ok(reporter.entries.some(entry => entry.event === 'scan-slow' && entry.details.includes('90')));
    assert.throws(() => subject.measureScan('throws', () => { throw new Error('scan test'); }), /scan test/);
    subject.measureScan('after-throw', () => { clockMs += 1; });
    assert.equal(subject.collectPageSnapshot().scanTiming.batches, 4, 'failed work restores scan measurement');

    const host = new Element();
    const blur = new Element('shreddit-blurred-container');
    blur.attrs.reason = 'nsfw';
    const video = new Element('video');
    Object.assign(video, { readyState: 0, networkState: 2, paused: true, ended: false, currentTime: 9.875 });
    video.attrs.src = 'https://v.redd.it/test/DASH_720.mp4?source=fallback#part';
    host.appendChild(blur);
    host.appendChild(video);
    assert.equal(subject.findNativeMediaOwner(host, blur).reason, 'native-video-present');
    assert.equal(subject.hasNativeResolvedMedia(host, blur), true, 'diagnostics preserve loading native-player ownership');
    const status = subject.describeNativeOwner(subject.findNativeMediaOwner(host, blur));
    assert.equal(status.readyState, 0);
    assert.equal(status.networkState, 2);
    assert.equal(status.currentTime, undefined, 'playback progress does not defeat state deduplication');
    assert.equal(subject.describeNativeOwner(subject.findNativeMediaOwner(host, blur), true).currentTime, 9.88);
    subject.scheduleFallbackBuild(blur, null, '/comments/abc/');
    const afterFirstSchedule = reporter.entries.length;
    const suppressedBeforeProgress = reporter.suppressedEntries;
    video.currentTime = 30;
    subject.scheduleFallbackBuild(blur, null, '/comments/abc/');
    assert.equal(reporter.entries.length, afterFirstSchedule);
    assert.equal(reporter.suppressedEntries, suppressedBeforeProgress + 1, 'currentTime changes do not create repeated status events');
    video.error = { code: 3, message: 'native decode error' };
    subject.scheduleFallbackBuild(blur, null, '/comments/abc/');
    const nativeError = reporter.entries.find(entry => entry.event === 'native-media-error');
    assert.ok(nativeError && !nativeError.routine, 'native player errors receive protected event retention');
    assert.ok(nativeError.details.includes('native decode error'));
    assert.equal(subject.hasNativeResolvedMedia(host, blur), true, 'error diagnostics do not replace native playback');
    video.customLayer = new Element();
    assert.equal(subject.findNativeMediaOwner(host, blur), null, 'fallback video is not reported as the native owner');
    video.customLayer = null;
    host.children = [new Element('iframe')];
    assert.equal(subject.findNativeMediaOwner(host, blur).reason, 'native-iframe-present');
    assert.equal(subject.describeNativeOwner(subject.findNativeMediaOwner(host, blur), true).playbackState, 'not-inspected');

    const samples = Array.from({ length: 20 }, (_, i) => {
        const mediaHost = new Element();
        mediaHost.box = { width: 320, height: 240, top: i === 19 ? 0 : -1000, bottom: i === 19 ? 240 : -760 };
        const mediaBlur = new Element('shreddit-blurred-container');
        mediaBlur.attrs.reason = 'nsfw';
        mediaHost.appendChild(mediaBlur);
        mediaHost.appendChild(new Element('iframe'));
        return mediaBlur;
    });
    const media = subject.collectMediaDiagnostics(samples);
    assert.equal(media.totalContainers, 20);
    assert.equal(media.posts.length, 12, 'copy snapshots cap diagnostic DOM work and report size');
    assert.equal(media.posts[0].inViewport, true, 'visible posts are sampled before old feed entries');
    assert.equal(media.posts[0].nativeOwner.reason, 'native-iframe-present');

    const challengeUrl = 'https://www.reddit.com/r/test/?solution=PRIVATE_SOLUTION&JSC%5Ftoken=PRIVATE_TOKEN&js_challenge=1&jsc_orig_r=PRIVATE_ORIGIN&cf_chl_test=PRIVATE_CF&sort=new#top';
    context.location.href = challengeUrl;
    subject.recordDebug('url-example', { nested: [{ url: challengeUrl }], error: 'Fetch failed at ' + challengeUrl, media: video.attrs.src });
    reporter.registerSource('redaction-test', () => ({ page: challengeUrl }));
    const report = reporter.format();
    assert.ok(!report.includes('PRIVATE_'), 'challenge tokens are stripped from headers, snapshots, events, and error text');
    assert.ok(report.includes('https://www.reddit.com/r/test/?sort=new#top'));
    assert.ok(report.includes(video.attrs.src), 'media source query/hash diagnostics remain intact');
    assert.equal(context.location.href, challengeUrl, 'redaction never changes the actual page URL');
    assert.ok(reporter.entries.at(-1).details.includes('sort=new') && !reporter.entries.at(-1).details.includes('PRIVATE_'));
    context.window.log();
    assert.ok(!(await downloads.at(-1).blob.text()).includes('PRIVATE_'), 'downloads use the sanitized report');
}

async function run() {
    const reporter = subject.sharedLog;
    subject.recordDebug('test-media-failure', { error: 'Post JSON HTTP 503', source: 'https://v.redd.it/test/DASH_720.mp4' });
    const formatted = reporter.format();
    const version = source.match(/@version\s+(\S+)/)[1];
    assert.ok(formatted.includes('"version": "' + version + '"'));
    assert.ok(formatted.includes('"debugConsole": false'));
    assert.ok(formatted.includes('"scrollY": 1200'));
    assert.ok(formatted.includes(context.location.href));
    assert.ok(formatted.includes(context.navigator.userAgent));
    assert.ok(formatted.includes('test-media-failure'));
    assert.ok(formatted.includes('Post JSON HTTP 503'));
    reporter.registerSource('broken-snapshot', () => { throw new Error('snapshot unavailable'); });
    assert.ok(reporter.format().includes('snapshot unavailable'), 'one failed snapshot does not block log export');

    assert.equal(context.window.log(), 'reddit-nsfw-log.txt');
    assert.equal(downloads[0].name, 'reddit-nsfw-log.txt');
    assert.equal(await downloads[0].blob.text(), reporter.format(), 'download uses the shared report formatter');
    assert.equal(context.window.redditNSFWExportLog, context.window.log);
    assert.equal(context.window.redditImageRecreationExportLog(), 'reddit-nsfw-log.txt');
    for (const callback of timers.values()) callback();
    timers.clear();
    assert.equal(revoked.length, 2, 'download object URLs are released');

    subject.ensureLogControl();
    subject.ensureLogControl();
    assert.equal(document.body.children.length, 1, 'rescans retain one log control');
    const host = document.body.children[0];
    const root = host.shadowRoot;
    const button = root.getElementById('copy');
    const panel = root.getElementById('panel');
    const text = root.getElementById('text');
    const status = root.getElementById('status');
    assert.ok(root.markup.includes('position: fixed !important'));
    assert.ok(root.markup.includes('calc(100vw - 32px)'));
    assert.ok(root.markup.includes('aria-label="Diagnostic log" readonly'));
    host.remove();
    subject.ensureLogControl();
    assert.equal(document.body.children[0], host, 'Reddit rerender reattaches the existing control');

    let copied;
    let completeCopy;
    context.navigator.clipboard = { writeText(value) {
        copied = value;
        return new Promise(resolve => { completeCopy = resolve; });
    } };
    const copying = button.emit('click');
    assert.equal(button.disabled, true, 'copy feedback covers a pending clipboard write');
    completeCopy();
    await copying;
    assert.equal(copied, reporter.format(), 'clipboard contains the same diagnostics as a download');
    assert.equal(button.disabled, false);
    assert.equal(button.textContent, 'Copied!');
    assert.equal(panel.hidden, true);
    assert.ok(status.textContent.includes('Log copied'));
    for (const callback of timers.values()) callback();
    timers.clear();
    assert.equal(button.textContent, 'Copy log');

    context.navigator.clipboard.writeText = async () => { throw new Error('Clipboard permission denied'); };
    await button.emit('click');
    assert.equal(panel.hidden, false);
    assert.equal(text.value, reporter.format());
    assert.ok(text.value.includes('Clipboard permission denied'));
    assert.equal(activeElement, text);
    assert.equal(text.selectionStart, 0);
    assert.equal(text.selectionEnd, text.value.length, 'the full log is selected for manual copying');
    assert.equal(button.disabled, false);
    assert.equal(button.textContent, 'Copy log');
    await root.getElementById('download').emit('click');
    assert.equal(downloads.at(-1).name, 'reddit-nsfw-log.txt');
    let prevented = false;
    await root.emit('keydown', { key: 'Escape', preventDefault() { prevented = true; } });
    assert.equal(prevented, true);
    assert.equal(panel.hidden, true);
    assert.equal(activeElement, button, 'closing the panel restores button focus');

    delete context.navigator.clipboard;
    await button.emit('click');
    assert.equal(panel.hidden, false, 'browsers without a clipboard API also get manual copying');
    await root.getElementById('close').emit('click');
    assert.equal(panel.hidden, true);

    context.location.href = 'https://sh.reddit.com/r/another/';
    context.navigator.clipboard = { writeText: async value => { copied = value; } };
    await button.emit('click');
    assert.ok(copied.includes(context.location.href), 'copy takes a fresh snapshot after client-side navigation');
    assert.equal(panel.hidden, true, 'successful retry closes the manual fallback');
    await checkDiagnostics(reporter);
    await button.emit('click');
    assert.ok(!copied.includes('PRIVATE_'), 'clipboard writes use the sanitized report');
    context.navigator.clipboard.writeText = async () => { throw new Error('Clipboard permission denied'); };
    await button.emit('click');
    assert.ok(!text.value.includes('PRIVATE_'), 'manual-copy text also strips challenge tokens');
    for (let i = 0; i < reporter.maxEntries + 2; i++) reporter.record('test', 'bounded-event', { i });
    assert.equal(reporter.entries.length, reporter.maxEntries);
    assert.ok(reporter.droppedEntries > 0);
    assert.ok(reporter.droppedImportantEntries > 0, 'important-only history remains bounded and reports losses');
    assert.ok(reporter.format().includes('events discarded: ' + reporter.droppedEntries));
    console.log('[check-log-controls] Passed copy/download controls, state deduplication, protected retention, scan timing, native-player diagnostics, bounded snapshots, and URL redaction checks.');
}
run().catch(err => { console.error(err); process.exitCode = 1; });
