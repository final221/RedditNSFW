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
    attachImageRenderDebug, yieldToNativeMedia, observeNativeImageHandoff, snapshotHostViewport, performanceDiagnostics,
    handleNativeImageEvent, recordNativeImageState, collectNativeImageDiagnostics, compactLogUrls,
    createResourceTimingDiagnostics, resourceTimingDiagnostics, compactSnapshotImageRows, buildOverlay };
})();`;
const timers = new Map();
const downloads = [];
const blobs = new Map();
const revoked = [];
let timerId = 0;
let activeElement;
let clockMs = 0;
const pageListeners = new Map();

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
    matches(selector) { return selector.split(',').some(part => part.trim() === this.tagName.toLowerCase() ||
        (part.trim().startsWith(':scope > .') && this.className === part.trim().slice(':scope > .'.length)) ||
        (part.trim() === 'shreddit-blurred-container[reason="nsfw"]' && this.tagName === 'SHREDDIT-BLURRED-CONTAINER' && this.attrs.reason === 'nsfw')); }
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
    addEventListener(event, listener) { pageListeners.set(event, listener); },
    createElement(tag) { return new Element(tag); },
    querySelectorAll() { return []; }
};
const context = {
    window: { innerWidth: 1280, innerHeight: 720, scrollY: 1200,
        addEventListener(event, listener, options) { pageListeners.set(event, listener); if (event === 'scroll') assert.equal(options.passive, true); } },
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
    const repeatedBeforeImage = reporter.repeatedEntries;
    for (const [id, fn] of sampleTimers) { timers.delete(id); fn(); }
    assert.equal(reporter.entries.filter(entry => entry.event === 'render-check').length, 3,
        'identical image observations retain all three timestamps');
    assert.equal(reporter.repeatedEntries, repeatedBeforeImage + 2);
    image.box = { width: 0, height: 0 };
    image.isConnected = false;
    await image.emit('load');
    const detached = reporter.entries.filter(entry => entry.event === 'render-check').at(-1);
    assert.equal(JSON.parse(detached.details).connected, false);
    assert.equal(JSON.parse(detached.details).rectHeight, 0);
    const beforeErrors = reporter.entries.length;
    await image.emit('error');
    await image.emit('error');
    assert.equal(reporter.entries.length, beforeErrors + 2, 'all error notifications remain even with identical state');

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
    assert.equal(followupCount(), countBefore + 1, 'one event retains all observed followup samples');
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
    const payloadsBefore = reporter.payloads.size;
    const repeatedBefore = reporter.repeatedEntries;
    const scopes = Array.from({ length: 49 }, () => new Element());
    for (let pass = 0; pass < 60; pass++) {
        scopes.forEach((scope, i) => {
            subject.recordDebug('process-blurred-container', { post: i, imgFound: true }, scope);
            subject.recordDebug('schedule-fallback', { post: i, blockers: ['native-resolved'] }, scope);
        });
    }
    assert.equal(reporter.entries.length - before, 49 * 2 * 60, 'all repeated post observations are retained');
    assert.equal(reporter.payloads.size - payloadsBefore, 98, 'repeat payloads share storage without dropping observations');
    assert.equal(reporter.repeatedEntries - repeatedBefore, 49 * 2 * 59);
    assert.equal(subject.recordDebug('schedule-fallback', { post: 0, blockers: [] }, scopes[0]), true, 'state changes are retained');
    assert.equal(subject.recordDebug('schedule-fallback', { post: 0, blockers: [] }, scopes[0]), false);
    subject.recordDebug('fallback-build-failed', { post: 0, error: 'keep this failure' });
    subject.recordDebug('fallback-yielded-to-native', { post: 0 });
    const beforeFlood = reporter.entries.length;
    for (let i = 0; i < 1600; i++) {
        subject.recordDebug('schedule-fallback', { state: i }, scopes[0]);
    }
    assert.equal(reporter.entries.length, beforeFlood + 1600);
    assert.ok(reporter.entries.some(entry => entry.event === 'fallback-build-failed'));
    assert.ok(reporter.entries.some(entry => entry.event === 'fallback-yielded-to-native'));
    assert.ok(!('maxEntries' in reporter), 'the reporter has no retention cap');

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
    const repeatedBeforeProgress = reporter.repeatedEntries;
    video.currentTime = 30;
    subject.scheduleFallbackBuild(blur, null, '/comments/abc/');
    assert.equal(reporter.entries.length, afterFirstSchedule + 2);
    assert.equal(reporter.repeatedEntries, repeatedBeforeProgress + 2, 'repeat observations are counted and retained without playback-time churn');
    video.error = { code: 3, message: 'native decode error' };
    subject.scheduleFallbackBuild(blur, null, '/comments/abc/');
    const nativeError = reporter.entries.find(entry => entry.event === 'native-media-error');
    assert.ok(nativeError, 'native player errors are retained');
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
    assert.equal(media.posts.length, 20, 'exports include every matching post');
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
    const repeated={src:'https://preview.redd.it/repeated.jpg?width=1080&s=SIGNED#fragment',nested:{complete:true,naturalWidth:750},literal:'@detail1'};
    for(let i=0;i<12;i++) subject.recordDebug('repeat-format-test',repeated);
    reporter.entries[0].timestamp = new Date(Date.parse(reporter.startedAt) + 123).toISOString();
    reporter.entries[1].timestamp = new Date(Date.parse(reporter.startedAt) - 10).toISOString();
    reporter.record('@detail_1','reference-like-name',{literal:'preserve this source name'});
    const repeatReport=reporter.format();
    assert.ok(repeatReport.includes('Repeated event details (substitute tokens to recover JSON):'));
    const restoredReport=restoreReferences(repeatReport);
    assert.ok(restoredReport.includes('@detail_1: reference-like-name'),'reference-like source/event names remain literal');
    const restoredLines=restoredReport.split('\n');
    const events=restoredLines.flatMap((line,i)=>line.includes('image-recreation: repeat-format-test')?[i]:[]);
    assert.equal(events.length,12,'payload references retain every event and timestamp');
    for(const [position,index] of events.entries()) {
        assert.deepEqual(JSON.parse(restoredLines[index+1]),repeated,'nested payloads and literal reference-like strings round-trip');
        const offset=Number(restoredLines[index].match(/^\[([+-]?\d+)ms\]/)[1]);
        assert.equal(new Date(Date.parse(reporter.startedAt)+offset).toISOString(), reporter.entries[position].timestamp,
            'compact timestamps restore exact millisecond UTC time, including negative offsets');
    }
    subject.recordDebug('test-media-failure', { error: 'Post JSON HTTP 503', source: 'https://v.redd.it/test/DASH_720.mp4' });
    const formatted = reporter.format();
    const eventLines = formatted.split('\n');
    const failureLine = eventLines.findIndex(line => line.includes('image-recreation: test-media-failure'));
    assert.deepEqual(JSON.parse(eventLines[failureLine + 1]), {
        error: 'Post JSON HTTP 503', source: 'https://v.redd.it/test/DASH_720.mp4'
    }, 'compact event JSON preserves every field');
    assert.ok(!eventLines[failureLine + 1].includes('\n'));
    assert.ok(eventLines[failureLine + 1].includes('"error":"Post JSON HTTP 503"'), 'events use compact JSON');
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
    checkCompactUrls();
    checkSnapshotImageRows();
    checkNativeLoading(reporter);
    await checkRecoveryControls(reporter);
    checkPerformanceDiagnostics(reporter);
    checkResourceTiming(reporter);
    await button.emit('click');
    assert.ok(!copied.includes('PRIVATE_'), 'clipboard writes use the sanitized report');
    context.navigator.clipboard.writeText = async () => { throw new Error('Clipboard permission denied'); };
    await button.emit('click');
    assert.ok(!text.value.includes('PRIVATE_'), 'manual-copy text also strips challenge tokens');
    const beforeUncapped = reporter.entries.length;
    for (let i = 0; i < 5000; i++) reporter.record('test', 'uncapped-event', { i });
    assert.equal(reporter.entries.length, beforeUncapped + 5000, 'history is preserved beyond the old cap');
    assert.deepEqual(Array.from(reporter.entries.slice(beforeUncapped),entry=>JSON.parse(entry.details).i),
        Array.from({length:5000},(_,i)=>i), 'every payload remains in its original order');
    const expanded = restoreReferences(reporter.format());
    assert.equal(expanded.split('test: uncapped-event').length - 1, 5000, 'all exported events retain their timestamps');
    assert.ok(expanded.includes('{"i":0}') && expanded.includes('{"i":4999}'));
    assert.ok(!reporter.format().includes('events discarded'));
    console.log('[check-log-controls] Passed truthful recovery controls/manual retry, copy/download controls, complete-session retention, shared repeat payloads, lossless report references, coalesced native callbacks, complete observed request timing, compact event details, scan timing, foreground timer/frame gaps, native load handoff/sizing, native-player diagnostics, complete snapshots, and URL redaction checks.');
}

function restoreReferences(report) {
    const lines=report.split('\n'), dictionaries=new Map(), kept=[];
    for(let i=0;i<lines.length;i++) {
        if (/^(URL dictionary|Repeated event details) \(substitute tokens/.test(lines[i])) {
            while(++i<lines.length && lines[i]) {
                const split=lines[i].indexOf(' = ');
                dictionaries.set(lines[i].slice(0,split),lines[i].slice(split+3));
            }
        } else kept.push(lines[i]);
    }
    let restored=kept.join('\n');
    for(const kind of ['@detail','@url']) {
        const tokens=[...dictionaries.keys()].filter(token=>token.startsWith(kind)).sort((a,b)=>b.length-a.length);
        if(tokens.length) restored=restored.replace(new RegExp(tokens.join('|'),'g'),token=>dictionaries.get(token));
    }
    return restored;
}

async function checkRecoveryControls(reporter) {
    const host = new Element(); host.isConnected = true;
    const blur = new Element('shreddit-blurred-container'); blur.attrs.reason = 'nsfw';
    const image = new Element('img'); image.attrs.src = 'https://preview.redd.it/pending-native.jpg?s=signed';
    image.complete = false; image.naturalWidth = image.naturalHeight = 0;
    image.closest = selector => selector === '[slot="post-media-container"]' ? host : null;
    host.appendChild(blur); host.appendChild(image);
    let requests = 0;
    context.fetch = async () => { requests++; return { ok: false, status: 403, headers: { get: () => null } }; };
    subject.buildOverlay(blur, image, '/r/test/comments/recovery-ui/');
    await new Promise(resolve => setImmediate(resolve));
    const overlay = host.querySelector(':scope > .tm-nsfw-overlay');
    assert.ok(overlay, 'failed recovery keeps an actionable control');
    const button = overlay.querySelector('button');
    assert.equal(button.textContent, 'Recover image', 'unfinished native loading is not reported as a failed picture');
    assert.equal(button.disabled, false);
    assert.equal(overlay.style.pointerEvents, 'none', 'failure controls do not intercept the whole picture');
    assert.equal(overlay.style.background, 'transparent');
    assert.ok(reporter.entries.some(e => e.event === 'fetch-post-data-failed' && e.details.includes('403')),
        'the recovery failure remains in the complete log');
    image.complete = true;
    subject.handleNativeImageEvent({ type: 'error', target: image });
    assert.equal(button.textContent, 'Try again', 'actual native failure exposes retry immediately');
    await button.emit('click', { preventDefault() {}, stopPropagation() {} });
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(requests, 2, 'manual recovery remains available and retries failed metadata');
    image.naturalWidth = 750; image.naturalHeight = 900;
    subject.handleNativeImageEvent({ type: 'load', target: image });
    assert.equal(host.querySelector(':scope > .tm-nsfw-overlay'), null, 'native completion removes the recovery control immediately');
    delete context.fetch;
}

function checkNativeLoading(reporter) {
    const host = new Element(); host.isConnected = true;
    host.dataset.tmOverlayBuilt = '1';
    const overlay = new Element(); overlay.remove = () => { host.children = host.children.filter(child => child !== overlay); };
    const blur = new Element('shreddit-blurred-container'); blur.attrs.reason = 'nsfw';
    const image = new Element('img');
    image.attrs.src = 'https://preview.redd.it/native.jpg?width=1080&auto=webp&s=signed';
    image.box = { width: 700, height: 900 };
    image.closest = selector => selector === '[slot="post-media-container"]' ? host : null;
    host.appendChild(blur); host.appendChild(image); host.appendChild(overlay);
    const queryAll = host.querySelectorAll.bind(host);
    let nativeImageReads = 0;
    host.querySelectorAll = selector => {
        if (selector === 'img') nativeImageReads++;
        return selector.startsWith(':scope > .tm-nsfw-overlay') ? [overlay] : queryAll(selector);
    };
    subject.recordNativeImageState(host, context.location.href);
    const before = reporter.entries.filter(entry => entry.event === 'native-image-state').length;
    subject.recordNativeImageState(host, context.location.href);
    assert.equal(reporter.entries.filter(entry => entry.event === 'native-image-state').length, before + 1,
        'unchanged native image/layout observations retain timestamps');
    Object.assign(image, { complete: true, naturalWidth: 750, naturalHeight: 1105 });
    subject.handleNativeImageEvent({ type: 'load', target: image });
    assert.equal(host.dataset.tmOverlayBuilt, undefined, 'native load removes the obsolete retry overlay immediately');
    assert.ok(!host.children.includes(overlay));
    const loaded = reporter.entries.filter(entry => entry.event === 'native-image-load').at(-1);
    assert.ok(loaded.details.includes('native.jpg'));
    const timerCount = timers.size;
    const readsBeforeBurst = nativeImageReads;
    for (let i=0;i<20;i++) subject.handleNativeImageEvent({ type: 'load', target: image });
    assert.equal(nativeImageReads, readsBeforeBurst, 'load bursts avoid rescanning all host images');
    assert.equal(timers.size, timerCount, 'duplicate native loads share one follow-up per host');
    assert.ok(subject.collectPageSnapshot().scanTiming.byReason['native-image-event'].batches >= 21,
        'native event work contributes to measured script cost');
    image.box.height = 540;
    for (const [id, callback] of [...timers]) { timers.delete(id); callback(); }
    const state = JSON.parse(reporter.entries.filter(entry => entry.event === 'native-image-state').at(-1).details);
    assert.equal(state.nativeImages.images[0].renderedBox.height, 540, 'post-load sizing changes are retained');
    const signedSrc = image.attrs.src;
    subject.handleNativeImageEvent({ type: 'error', target: image });
    assert.ok(reporter.entries.some(entry => entry.event === 'native-image-error'));
    assert.equal(image.attrs.src, signedSrc, 'diagnostics never rewrite native signed image sources');
    const beforeFallback = reporter.entries.length;
    image.closest = selector => selector === '.tm-unblur-media-layer' ? overlay : host;
    subject.handleNativeImageEvent({ type: 'load', target: image });
    assert.equal(reporter.entries.length, beforeFallback, 'fallback images do not enter native loading diagnostics');
    const inventoryHost = new Element();
    for (let i=0;i<10;i++) inventoryHost.appendChild(new Element('img'));
    assert.equal(subject.collectNativeImageDiagnostics(inventoryHost).images.length, 10);
    assert.equal(subject.collectNativeImageDiagnostics(inventoryHost).total, 10);
    image.closest = selector => selector === '[slot="post-media-container"]' ? host : null;
    let resourceReads = 0;
    context.performance.getEntriesByName = () => {
        resourceReads++;
        return [{ startTime: 200, duration: 150, responseEnd: 350, requestStart: 0, responseStart: 0,
            transferSize: 0, decodedBodySize: 0, initiatorType: 'img' },
            { startTime: 400, duration: 10, responseEnd: 410, initiatorType: 'img' }];
    };
    subject.collectNativeImageDiagnostics(host);
    assert.equal(resourceReads, 0, 'resource timing is queried only on export');
    const timed = subject.collectNativeImageDiagnostics(host, true).images[0];
    const clone = new Element('img'); clone.attrs.src = image.attrs.src; host.appendChild(clone);
    const identity = subject.collectNativeImageDiagnostics(host).images;
    assert.notEqual(identity[0].imageId, identity[1].imageId, 'same-source native clones have distinct identities');
    assert.equal(subject.collectNativeImageDiagnostics(host).images[0].imageId, identity[0].imageId,
        'image identity remains stable across snapshots');
    subject.handleNativeImageEvent({ type: 'load', target: image });
    const identifiedLoad = JSON.parse(reporter.entries.filter(e => e.event === 'native-image-load').at(-1).details);
    assert.equal(identifiedLoad.imageState.imageId, identity[0].imageId, 'native event identity matches its snapshot element');
    assert.equal(identifiedLoad.imageState.firstSeenMs, identity[0].firstSeenMs);
    const originalClock = clockMs; clockMs += 10;
    image.attrs.src = 'https://preview.redd.it/replaced-source.jpg';
    const changedSource = subject.collectNativeImageDiagnostics(host).images[0];
    assert.equal(changedSource.imageId, identity[0].imageId, 'source changes preserve element identity');
    assert.equal(changedSource.firstSeenMs, clockMs, 'new sources reset only their first observation time');
    clockMs = originalClock; image.attrs.src = signedSrc;
    assert.equal(timed.resourceTimings.length, 2, 'every matching browser timing entry is included');
    assert.equal(timed.resourceTimings[1].startTimeMs, 400);
    assert.equal(timed.resourceTimings[0].startTimeMs, 200);
    assert.equal(timed.resourceTimings[0].durationMs, 150);
    assert.equal(timed.resourceTimings[0].requestStartMs, 0, 'restricted/cached zero fields are preserved without inventing latency');
    delete context.performance.getEntriesByName;
}

function checkSnapshotImageRows() {
    const snapshot = { viewport: { width: 700, height: 540 }, nativeImages: { total: 20,
        images: Array.from({ length: 20 }, (_, i) => ({ src: 'https://preview.redd.it/image.jpg?width=1080&s=signed',
            imageId: i + 1, firstSeenMs: 1, complete: false, naturalWidth: 0, naturalHeight: 0,
            literal: '@snapshotImage0 with "quotes" and } brackets',
            renderedBox: { width: 700, height: 540 }, resourceTimings: [{ startTimeMs: 0, durationMs: 123.45 }] })) } };
    const original = JSON.stringify(snapshot, null, 2);
    const compact = subject.compactSnapshotImageRows(original);
    assert.ok(compact.length < original.length * .65, 'complete image rows reduce snapshot whitespace substantially');
    assert.deepEqual(JSON.parse(compact), snapshot, 'all images, fields, timings, strings, and dictionary-like literals survive');
    assert.deepEqual(JSON.parse(subject.compactSnapshotImageRows(original.replaceAll('@snapshotImage', '\\u0040snapshotImage'))), snapshot,
        'escaped literal marker prefixes also round-trip without replacement');
    assert.equal(subject.compactSnapshotImageRows(JSON.stringify(snapshot)), JSON.stringify(snapshot),
        'already compact snapshots never grow');
    assert.ok(compact.includes('"viewport": {\n'), 'outer snapshot structure remains readable');
    assert.equal(subject.compactSnapshotImageRows('snapshot unavailable'), 'snapshot unavailable');
}

function checkResourceTiming(reporter) {
    const src = 'https://preview.redd.it/observed.jpg?width=1080&s=signed';
    const timing = (startTime, name = src) => ({ name, entryType: 'resource', initiatorType: 'img',
        startTime, duration: 150, responseEnd: startTime + 150, requestStart: 0, responseStart: 0,
        transferSize: 0, decodedBodySize: 0 });
    let observer;
    context.PerformanceObserver = class {
        constructor(callback) { this.callback = callback; this.pending = []; observer = this; }
        observe(options) { assert.equal(options.type, 'resource'); assert.equal(options.buffered, true); }
        takeRecords() { return this.pending.splice(0); }
    };
    context.performance.getEntriesByType = () => Array(250).fill({ initiatorType: 'script' });
    const resourceListeners = new Map();
    context.performance.addEventListener = (type, fn) => resourceListeners.set(type, fn);
    context.performance.getEntriesByName = () => []; // Browser buffer filled before these images.
    const diagnostics = subject.resourceTimingDiagnostics;
    diagnostics.start();
    diagnostics.start(); // A repeated start must not replace the live observer.
    const initial = observer;
    observer.callback({ getEntries: () => [timing(200)] });
    assert.equal(diagnostics.read(src)[0].startTimeMs, 200,
        'image timing survives even when the browser timeline has no matching entry');
    observer.pending.push(timing(400));
    const before = reporter.entries.filter(e => e.event === 'image-resource-timing').length;
    const report = restoreReferences(reporter.format());
    assert.equal(observer, initial);
    assert.equal(diagnostics.read(src).length, 2, 'copy drains queued observer entries before taking the snapshot');
    assert.equal(reporter.entries.filter(e => e.event === 'image-resource-timing').length, before + 1);
    assert.ok(report.includes('"startTimeMs":400'), 'requests survive in event history even without a matching live post');
    assert.ok(report.includes(`Events retained: ${reporter.entries.length};`), 'header counts include entries drained during snapshot collection');
    context.performance.getEntriesByName = () => [timing(200), timing(400), timing(600)];
    assert.equal(diagnostics.read(src).length, 3, 'observer and timeline overlap does not duplicate requests');
    observer.callback({ getEntries: () => [timing(800), timing(800)] });
    context.performance.getEntriesByName = () => [timing(800), timing(800)];
    assert.equal(diagnostics.read(src).filter(t => t.startTimeMs === 800).length, 2,
        'distinct identical entries retain their multiplicity when merging data sources');
    const retained = diagnostics.snapshot().imageEntries;
    observer.callback({ getEntries: () => Array.from({ length: 1200 }, (_, i) => timing(1000 + i)) });
    assert.equal(diagnostics.snapshot().imageEntries, retained + 1200, 'resource history has no retention cap');
    assert.ok(subject.collectPageSnapshot().scanTiming.byReason['resource-timing'].batches > 0,
        'resource observer work is included in script timing');
    assert.equal(diagnostics.read(src)[0].requestStartMs, 0, 'restricted timing fields remain explicit zeros');
    observer.callback({ getEntries: () => [{ ...timing(2500), initiatorType: 'script' }] });
    assert.equal(diagnostics.snapshot().imageEntries, retained + 1200, 'unrelated resource types add no image observations');
    resourceListeners.get('resourcetimingbufferfull')();
    assert.equal(diagnostics.snapshot().bufferFullEvents, 1, 'browser buffer exhaustion remains observable');
    assert.equal(diagnostics.snapshot().bufferedResourceEntries, 250);
    delete context.PerformanceObserver;
    delete context.performance.getEntriesByName;
    delete context.performance.getEntriesByType;
    const unavailable = subject.createResourceTimingDiagnostics(); unavailable.start();
    assert.equal(unavailable.snapshot().observing, false);
    assert.equal(unavailable.read(src), null, 'unavailable timing is distinguished from an empty match');
    context.PerformanceObserver = class { observe() { throw new Error('blocked'); } };
    const blocked = subject.createResourceTimingDiagnostics(); blocked.start();
    assert.equal(blocked.snapshot().error, 'blocked', 'observer initialization failure is reported without stopping the userscript');
    context.PerformanceObserver = class {
        static supportedEntryTypes = ['mark'];
        observe() { throw new Error('Unsupported resource type must not be observed'); }
    };
    const unsupportedType = subject.createResourceTimingDiagnostics(); unsupportedType.start();
    assert.equal(unsupportedType.snapshot().observerSupported, false, 'observer availability requires resource support');
    assert.equal(unsupportedType.snapshot().observing, false);
    delete context.PerformanceObserver;
    delete context.performance.addEventListener;
}

function checkCompactUrls() {
    const url='https://preview.redd.it/image.jpg?width=1080&auto=webp&s=SIGNED#image';
    const original='RedditNSFW Combined Debug Log\nPage: '+url+'\n\nSnapshots\n'+JSON.stringify({src:url, literal:'@url1'})+'\n\nEvents\n'+url+'\n';
    const compact=subject.compactLogUrls(original);
    assert.ok(compact.length < original.length, 'URL dictionary includes its overhead and still saves space');
    const marker='URL dictionary (substitute tokens to recover full URLs):\n';
    const start=compact.indexOf(marker), end=compact.indexOf('\n\n',start);
    const dictionary=new Map(compact.slice(start+marker.length,end).split('\n').map(line=>{
        const split=line.indexOf(' = ');return [line.slice(0,split),line.slice(split+3)];
    }));
    let restored=compact.slice(0,start)+compact.slice(end+2);
    const tokens=[...dictionary.keys()].sort((a,b)=>b.length-a.length);
    restored=restored.replace(new RegExp(tokens.join('|'),'g'),token=>dictionary.get(token));
    assert.equal(restored,original,'full URLs, signatures, fragments, literal token text, and all other bytes round-trip');
    assert.equal(subject.compactLogUrls('one '+url),'one '+url,'unique URLs remain literal');
}

function checkPerformanceDiagnostics(reporter) {
    const frames = [];
    context.requestAnimationFrame = fn => frames.push(fn);
    const diagnostics = subject.performanceDiagnostics;
    clockMs = 10000;
    diagnostics.start();
    pageListeners.get('scroll')();
    pageListeners.get('scroll')();
    assert.equal(frames.length, 1, 'scroll bursts share one pending frame callback');
    clockMs += 16;
    frames.shift()();
    clockMs += 160;
    frames.shift()();
    let snapshot = subject.collectPageSnapshot().pagePerformance;
    assert.equal(snapshot.frames.samples, 2);
    assert.equal(snapshot.frames.slowSamples, 1);
    assert.equal(snapshot.frames.maxGapMs, 160);
    assert.ok(reporter.entries.some(entry => entry.event === 'scroll-frame-gap' && JSON.parse(entry.details).gapMs === 160));
    clockMs += 160;
    frames.shift()();
    assert.equal(frames.length, 0, 'frame sampling stops after the scroll burst');
    assert.equal(reporter.entries.filter(entry => entry.event === 'scroll-frame-gap').length, 2, 'every detected slow-frame event is retained');
    clockMs = 11620;
    diagnostics.sampleTimer();
    snapshot = subject.collectPageSnapshot().pagePerformance;
    assert.equal(snapshot.timer.samples, 1);
    assert.equal(snapshot.timer.maxLagMs, 120);
    const lag = reporter.entries.find(entry => entry.event === 'page-timer-lag');
    assert.equal(JSON.parse(lag.details).lagMs, 120);
    assert.equal(JSON.parse(lag.details).scrollY, context.window.scrollY);
    assert.ok(JSON.parse(lag.details).lastScan, 'page stalls retain scan context without attributing the cause');
    const count = reporter.entries.length;
    document.visibilityState = 'hidden';
    pageListeners.get('visibilitychange')();
    clockMs += 60000;
    diagnostics.sampleTimer();
    pageListeners.get('scroll')();
    assert.equal(frames.length, 0, 'hidden pages do no frame sampling');
    document.visibilityState = 'visible';
    pageListeners.get('visibilitychange')();
    clockMs += 1500;
    diagnostics.sampleTimer();
    assert.equal(reporter.entries.length, count, 'background throttling and resume do not report foreground stalls');
    assert.equal(subject.collectPageSnapshot().pagePerformance.timer.samples, 2);
    pageListeners.get('scroll')();
    document.visibilityState = 'hidden';
    pageListeners.get('visibilitychange')();
    clockMs += 60000;
    document.visibilityState = 'visible';
    pageListeners.get('visibilitychange')();
    const beforeResume = subject.collectPageSnapshot().pagePerformance.frames.samples;
    pageListeners.get('scroll')();
    clockMs += 16;
    frames.shift()();
    assert.equal(subject.collectPageSnapshot().pagePerformance.frames.samples, beforeResume + 1,
        'a queued frame resumes sampling from the fresh foreground scroll');
    clockMs += 250;
    frames.shift()();
    assert.equal(frames.length, 0);
    delete context.requestAnimationFrame;
    pageListeners.get('scroll')();
    assert.equal(frames.length, 0, 'missing frame APIs do not schedule callbacks');
    assert.equal(subject.collectPageSnapshot().pagePerformance.frameSupported, false);
}
run().catch(err => { console.error(err); process.exitCode = 1; });
