// test/session-expired.test.mjs — the 20261104 lf.ui.session surface in
// web/js/components/dialog.js: which responses count as "session expired", the
// return_to sign-in URL, the htmx:beforeOnLoad hook that stops htmx from
// following a sign-in redirect on a mutation, and the one-pop-up guarantee.
//
// dialog.js is a browser IIFE, loaded into a minimal fake DOM via node:vm.
// Run: node --test test/session-expired.test.mjs

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import vm from 'node:vm';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SRC = readFileSync(path.join(HERE, '../web/js/components/dialog.js'), 'utf8');

function boot(pathname, search) {
    const listeners = {};
    const events = [];
    const assigned = [];
    const confirms = [];
    const doc = {
        readyState: 'complete',
        querySelector() { return null; }, // no overlay: dialog init() is a no-op
        addEventListener(type, fn) { (listeners[type] = listeners[type] || []).push(fn); },
        dispatchEvent(ev) { events.push(ev.type); (listeners[ev.type] || []).forEach((fn) => fn(ev)); },
    };
    const win = {
        location: { pathname, search, origin: 'https://school.example', assign(u) { assigned.push(u); } },
        addEventListener() {},
    };
    const sandbox = {
        window: win, document: doc, console, URL,
        CustomEvent: class { constructor(type, init) { this.type = type; this.detail = init && init.detail; } },
        MutationObserver: class { observe() {} disconnect() {} },
        setTimeout, clearTimeout, setInterval: () => 0, clearInterval() {}, history: { replaceState() {} },
    };
    sandbox.globalThis = sandbox;
    vm.createContext(sandbox);
    vm.runInContext(SRC, sandbox);
    // Stand-in for the dialog confirm (overlay-less page in this harness).
    win.lf.ui.Dialog = ( { confirm(o) { confirms.push(o); return new Promise(() => {}); } });
    return { win, listeners, events, assigned, confirms };
}

function xhr(headers, responseURL) {
    return {
        responseURL: responseURL || 'https://school.example/action/grade-sheet/T1/record',
        getResponseHeader(n) { return Object.prototype.hasOwnProperty.call(headers, n) ? headers[n] : null; },
    };
}

test('loginURL carries the current /w/ page as return_to, and nothing else', () => {
    let env = boot('/w/mmis/grade-sheet/T1', '?scope=s1&x=1');
    assert.equal(env.win.lf.ui.session.loginURL(),
        '/auth/login?return_to=' + encodeURIComponent('/w/mmis/grade-sheet/T1?scope=s1&x=1'));
    env = boot('/me/inbox', '');
    assert.equal(env.win.lf.ui.session.loginURL(), '/auth/login');
});

test('X-Session-Expired: 1 and a sign-in HX-Redirect are expiries; other failures are not', () => {
    const { win } = boot('/w/mmis/grade-sheet/T1', '');
    assert.equal(win.lf.ui.session.checkXhr(xhr({ 'Content-Type': 'application/json' })), false);
    assert.equal(win.lf.ui.session.checkXhr(xhr({ 'HX-Redirect': '/w/mmis/home' })), false);
    assert.equal(win.lf.ui.session.isExpired(), false);
    assert.equal(win.lf.ui.session.checkXhr(xhr({ 'X-Session-Expired': '1' })), true);
    assert.equal(win.lf.ui.session.isExpired(), true);

    const env2 = boot('/w/mmis/grade-sheet/T1', '');
    assert.equal(env2.win.lf.ui.session.checkXhr(xhr({ 'HX-Redirect': '/auth/login' })), true);
    const env3 = boot('/w/mmis/grade-sheet/T1', '');
    assert.equal(env3.win.lf.ui.session.checkXhr(xhr({ 'HX-Redirect': 'https://evil.example/auth/login' })), false,
        'a cross-origin redirect is not treated as our sign-in page');
    const env4 = boot('/w/mmis/grade-sheet/T1', '');
    const fetchRes = { url: 'https://school.example/auth/login', redirected: true, headers: { get: () => null } };
    assert.equal(env4.win.lf.ui.session.checkResponse(fetchRes), true, 'a fetch bounced to the sign-in page');
});

test('htmx hook: a mutation with the expiry signal is cancelled (no HX-Redirect follow) and pops up once', () => {
    const env = boot('/w/mmis/grade-sheet/T1', '');
    const hook = env.listeners['htmx:beforeOnLoad'][0];
    let prevented = 0;
    const evt = (verb, headers) => ({
        detail: { xhr: xhr(headers), requestConfig: { verb } },
        preventDefault() { prevented++; },
    });
    hook(evt('get', { 'HX-Redirect': '/auth/login' }));
    assert.equal(prevented, 0, 'GET navigations keep htmx redirect behaviour');
    hook(evt('post', { 'X-Session-Expired': '1' }));
    hook(evt('post', { 'X-Session-Expired': '1' }));
    assert.equal(prevented, 2);
    assert.deepEqual(env.events.filter((e) => e === 'lf:session-expired').length, 2,
        'listeners can keep unsaved input on every detection');
    assert.equal(env.confirms.length, 1, 'only one pop-up while it is open');
    assert.equal(env.confirms[0].testid, 'session-expired');
});

test('Sign in on the pop-up goes to the return_to login URL', async () => {
    const env = boot('/w/mmis/grade-sheet/T1', '?scope=s1');
    env.win.lf.ui.Dialog.confirm = (o) => { env.confirms.push(o); return Promise.resolve(true); };
    env.win.lf.ui.session.markExpired();
    await Promise.resolve();
    await Promise.resolve();
    assert.deepEqual(env.assigned, ['/auth/login?return_to=' + encodeURIComponent('/w/mmis/grade-sheet/T1?scope=s1')]);
});
