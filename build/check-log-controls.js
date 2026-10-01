const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

// Run the real reporting/UI helpers without starting Reddit media observation.
const source = fs.readFileSync(path.join(__dirname, '../src/userscripts/reddit-image-recreation.user.js'), 'utf8');
const boundary = source.indexOf('    const mo = new MutationObserver');
assert.ok(boundary > 0);
const instrumented = source.slice(0, boundary) + `
globalThis.subject = { sharedLog, createLogControl, ensureLogControl, recordDebug };
})();`;
const timers = new Map();
const downloads = [];
const blobs = new Map();
const revoked = [];
let timerId = 0;
let activeElement;

class Element {
    constructor(tag = 'div') {
        this.tagName = tag.toUpperCase();
        this.listeners = new Map();
        this.children = [];
        this.style = {};
        this.isConnected = false;
        this.hidden = false;
        this.textContent = '';
    }
    addEventListener(event, listener) { this.listeners.set(event, listener); }
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
    createElement(tag) { return new Element(tag); },
    querySelectorAll() { return []; }
};
const context = {
    window: { innerWidth: 1280, innerHeight: 720, scrollY: 1200 },
    navigator: { userAgent: 'Diagnostic test browser' },
    location: { href: 'https://www.reddit.com/r/test/comments/abc/', origin: 'https://www.reddit.com' },
    document, Element, Document: class {}, URL: BrowserURL, Blob, Date: FixedDate,
    console: { log() { throw new Error('Console diagnostics must be gated by default'); } },
    setTimeout(fn) { timers.set(++timerId, fn); return timerId; },
    clearTimeout(id) { timers.delete(id); }
};
vm.createContext(context);
vm.runInContext(instrumented, context);
const { subject } = context;

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
    for (let i = 0; i < reporter.maxEntries + 2; i++) reporter.record('test', 'bounded-event', { i });
    assert.equal(reporter.entries.length, reporter.maxEntries);
    assert.ok(reporter.droppedEntries > 0);
    assert.ok(reporter.format().includes('older events discarded: ' + reporter.droppedEntries));
    console.log('[check-log-controls] Passed shared report/download, clipboard success/failure, manual selection, navigation, control recovery, and bounded trace checks.');
}
run().catch(err => { console.error(err); process.exitCode = 1; });
