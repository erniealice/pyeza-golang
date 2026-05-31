// test/authz.negative.test.mjs — W4 negative test: an SDK render path with an
// UNAUTHORIZED host authz parameter renders INERT and fires NO dispatch.
//
// This is plan.md W4's "renders inert under an unauthorized host authz
// parameter" acceptance, and the JS twin of the bulk-action.js:54-58 abort.
//
// Runs under plain `node --test` (no browser) using a tiny fake element that
// implements just the surface applyAuthzAttributes / isElementInert touch.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
    normalizeAuthz,
    isAuthorized,
    applyAuthzAttributes,
    isElementInert,
    guardDispatch,
    renderInert,
} from '../src/authz.js';

// --- Minimal DOM-element double --------------------------------------------
function makeEl(tag = 'button') {
    const attrs = {};
    return {
        tagName: tag.toUpperCase(),
        disabled: false,
        setAttribute(k, v) { attrs[k] = String(v); },
        getAttribute(k) { return Object.prototype.hasOwnProperty.call(attrs, k) ? attrs[k] : null; },
        removeAttribute(k) { delete attrs[k]; },
        _attrs: attrs,
    };
}

// Simulates the unauthorized host authz parameter:
// host fmt.Sprintf(MissingPermission, "plan:create") -> "Missing permission: plan:create".
const UNAUTHORIZED = { disabled: true, disabledTooltip: 'Missing permission: plan:create' };
const AUTHORIZED = { disabled: false, disabledTooltip: '' };

test('normalizeAuthz coerces an unauthorized host param', () => {
    const n = normalizeAuthz(UNAUTHORIZED);
    assert.equal(n.disabled, true);
    assert.equal(n.disabledTooltip, 'Missing permission: plan:create');
});

test('isAuthorized is false for an unauthorized host param, true for authorized/absent', () => {
    assert.equal(isAuthorized(UNAUTHORIZED), false);
    assert.equal(isAuthorized(AUTHORIZED), true);
    assert.equal(isAuthorized(undefined), true); // absent param => enabled (host opt-in)
});

test('(1) RENDER: unauthorized param renders disabled + aria-disabled + title tooltip', () => {
    const el = makeEl('button');
    applyAuthzAttributes(el, UNAUTHORIZED);

    assert.equal(el.disabled, true, 'control must be disabled');
    assert.equal(el.getAttribute('aria-disabled'), 'true', 'must set aria-disabled="true"');
    assert.equal(
        el.getAttribute('title'),
        'Missing permission: plan:create',
        'title must reflect the host tooltip',
    );
});

test('RENDER: authorized param clears the inert attributes', () => {
    const el = makeEl('button');
    applyAuthzAttributes(el, UNAUTHORIZED);
    applyAuthzAttributes(el, AUTHORIZED);
    assert.equal(el.disabled, false);
    assert.equal(el.getAttribute('aria-disabled'), null);
});

test('renderInert (pure, no DOM) describes the inert state for an unauthorized param', () => {
    const inert = renderInert(UNAUTHORIZED);
    assert.equal(inert.disabled, true);
    assert.equal(inert.ariaDisabled, 'true');
    assert.equal(inert.title, 'Missing permission: plan:create');
    assert.deepEqual(inert.attrs, {
        'disabled': '',
        'aria-disabled': 'true',
        'title': 'Missing permission: plan:create',
    });

    const ok = renderInert(AUTHORIZED);
    assert.equal(ok.disabled, false);
    assert.equal(ok.ariaDisabled, null);
    assert.deepEqual(ok.attrs, {});
});

test('isElementInert mirrors the bulk-action.js abort predicate', () => {
    const disabledEl = makeEl();
    applyAuthzAttributes(disabledEl, UNAUTHORIZED);
    assert.equal(isElementInert(disabledEl), true, '.disabled OR aria-disabled => inert');

    const ariaOnly = makeEl();
    ariaOnly.setAttribute('aria-disabled', 'true'); // never set .disabled
    assert.equal(isElementInert(ariaOnly), true, 'aria-disabled alone => inert');

    const enabledEl = makeEl();
    applyAuthzAttributes(enabledEl, AUTHORIZED);
    assert.equal(isElementInert(enabledEl), false);
});

test('(2) DISPATCH: unauthorized param fires NO network request / use-case call', () => {
    let networkCalls = 0;
    const fakeDispatch = () => { networkCalls++; }; // stands in for htmx.ajax / fetch POST

    // Unauthorized: guardDispatch must abort -> action NEVER runs.
    const ranUnauthorized = guardDispatch(UNAUTHORIZED, fakeDispatch);
    assert.equal(ranUnauthorized, false, 'guardDispatch must return false when host disabled');
    assert.equal(networkCalls, 0, 'NO network/use-case call may fire for an unauthorized control');

    // Authorized: the same seam DOES dispatch (proves it is a reflection, not a
    // blanket block).
    const ranAuthorized = guardDispatch(AUTHORIZED, fakeDispatch);
    assert.equal(ranAuthorized, true);
    assert.equal(networkCalls, 1, 'an authorized control dispatches exactly once');
});

test('END-TO-END inert path: render inert AND abort dispatch from the same host param', () => {
    const el = makeEl('button');
    let posted = 0;

    // SDK entrypoint shape: reflect the host decision onto the control, then
    // guard the side effect through the SAME param.
    applyAuthzAttributes(el, UNAUTHORIZED);
    const dispatched = guardDispatch(UNAUTHORIZED, () => { posted++; });

    // (1) rendered inert
    assert.equal(el.disabled, true);
    assert.equal(el.getAttribute('aria-disabled'), 'true');
    assert.equal(el.getAttribute('title'), 'Missing permission: plan:create');
    // (2) dispatched nothing
    assert.equal(dispatched, false);
    assert.equal(posted, 0);
    // (3) the control is inert by the bulk-action predicate too
    assert.equal(isElementInert(el), true);
});
