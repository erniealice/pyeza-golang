// test/cell-grid.test.mjs — DOM-level tests for the W2 edit-mode client in
// web/js/components/cell-grid.js (keyboard traversal, focusout coalescing, the
// new.→cells.{id} and cells.{id}→new.{job}:{criterion} rename handshakes, stale-response
// suppression, and the manual batch-Save fallback staying intact).
//
// The module is a browser IIFE (not an importable ESM), so it is loaded into a
// tiny hand-rolled DOM via node:vm — no jsdom (pyeza ships zero runtime deps).
// The harness implements only the surface cell-grid.js actually touches:
// delegated lf.on() dispatch, a controllable fake timer, a capturing
// htmx.ajax(), and the handful of querySelector shapes the module queries.
//
// Run: pnpm --filter @leapfor/ui test   (node --test 'test/**/*.test.mjs')

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import vm from 'node:vm';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SRC = readFileSync(path.join(HERE, '../web/js/components/cell-grid.js'), 'utf8');

// --- tiny DOM doubles ------------------------------------------------------
function makeInput(o) {
    const attrs = {
        'data-row-index': String(o.row),
        'data-col-index': String(o.col),
        'data-saved-value': o.saved || '',
        'data-cg-state': '',
        'aria-describedby': o.statusId || '',
    };
    const el = {
        tagName: o.tag ? o.tag.toUpperCase() : 'INPUT',
        className: 'cell-grid-input',
        name: o.name,
        value: o.value != null ? o.value : (o.saved || ''),
        disabled: !!o.disabled,
        selectionStart: null,
        selectionEnd: null,
        _form: null,
        _card: null,
        setAttribute(k, v) { if (k === 'name') this.name = String(v); attrs[k] = String(v); },
        getAttribute(k) { return Object.prototype.hasOwnProperty.call(attrs, k) ? attrs[k] : null; },
        removeAttribute(k) { delete attrs[k]; },
        focus() { DOC.activeElement = this; FOCUS_LOG.push(this.name); },
        select() {},
        closest(sel) {
            if (sel.indexOf('cell-grid-card') >= 0) return this._card;
            if (sel.indexOf('cell-grid-input') >= 0) return this;
            if (sel.indexOf('cell-grid-form') >= 0) return this._form;
            return null;
        },
        _attrs: attrs,
    };
    el.dataset = new Proxy(attrs, {
        get(t, p) { return t['data-' + camelToDash(p)]; },
        set(t, p, v) { t['data-' + camelToDash(p)] = String(v); return true; },
        deleteProperty(t, p) { delete t['data-' + camelToDash(p)]; return true; },
    });
    return el;
}
function camelToDash(s) { return String(s).replace(/[A-Z]/g, (m) => '-' + m.toLowerCase()); }

function makeForm(o) {
    const attrs = {
        'data-cg-autosave': o.auto ? '1' : '',
        'data-result-event': 'omcell-result',
        'data-notice-id': 'g-notice',
        'data-msg-saving': 'Saving…',
        'data-msg-saved': 'Saved.',
        'data-msg-error': 'Not saved.',
        'data-msg-rating-stale': 'Rating not yet recomputed.',
        'data-msg-unsaved': 'You have unsaved cells.',
        'hx-post': '/action/outcome-matrix/T1/record',
    };
    const inputs = o.inputs || [];
    const hiddens = o.hiddens || [];
    const saveBtn = {
        className: 'cell-grid-save', tagName: 'BUTTON', disabled: false,
        dataset: {}, textContent: 'Save',
        setAttribute() {}, getAttribute() { return null; },
    };
    saveBtn.dataset.labelSave = 'Save';
    const form = {
        tagName: 'FORM', className: 'cell-grid-form',
        dataset: new Proxy(attrs, {
            get(t, p) { return t['data-' + camelToDash(p)]; },
            set(t, p, v) { t['data-' + camelToDash(p)] = String(v); return true; },
            deleteProperty(t, p) { delete t['data-' + camelToDash(p)]; return true; },
        }),
        getAttribute(k) { return Object.prototype.hasOwnProperty.call(attrs, k) ? attrs[k] : null; },
        setAttribute(k, v) { attrs[k] = String(v); },
        closest(sel) { return sel.indexOf('cell-grid-card') >= 0 ? this._card : (sel.indexOf('cell-grid-form') >= 0 ? this : null); },
        querySelector(sel) { const r = this.querySelectorAll(sel); return r[0] || null; },
        querySelectorAll(sel) { return matchAll(sel, inputs, hiddens, saveBtn); },
        _card: null, _inputs: inputs, _saveBtn: saveBtn,
    };
    const card = {
        className: 'cell-grid-card',
        querySelector(sel) {
            if (sel === '.cell-grid-form') return form;
            return null;
        },
        closest() {
            return null;
        },
    };
    form._card = card;
    inputs.forEach((i) => { i._form = form; i._card = card; });
    saveBtn._form = form;
    return form;
}

function matchAll(sel, inputs, hiddens, saveBtn) {
    if (sel === '.cell-grid-save') return [saveBtn];
    if (sel === 'input[type="hidden"]') return hiddens;
    if (sel === '.cell-grid-input') return inputs.slice();
    let m;
    if ((m = sel.match(/^\.cell-grid-input\[name="(.+)"\]$/))) {
        return inputs.filter((i) => i.name === m[1]);
    }
    if ((m = sel.match(/^\.cell-grid-input\[data-col-index="(.+)"\]$/))) {
        return inputs.filter((i) => i.getAttribute('data-col-index') === m[1]);
    }
    if (sel === '.cell-grid-input[data-cg-state="error"]') {
        return inputs.filter((i) => i.getAttribute('data-cg-state') === 'error');
    }
    if (sel === '.cell-grid-input[data-cg-state="saved"]') {
        return inputs.filter((i) => i.getAttribute('data-cg-state') === 'saved');
    }
    if (sel.indexOf('data-cg-state=') >= 0) {
        // recomputeDirty / beforeunload comma-list of pending states
        const wanted = (sel.match(/data-cg-state="([a-z]+)"/g) || []).map((s) => s.replace(/.*"([a-z]+)".*/, '$1'));
        return inputs.filter((i) => wanted.indexOf(i.getAttribute('data-cg-state')) >= 0);
    }
    return [];
}

// --- fake environment ------------------------------------------------------
let DOC, FOCUS_LOG, REGS, TIMERS, AJAX_CALLS, ELEMENTS, WIN;
function boot() {
    FOCUS_LOG = [];
    REGS = [];
    TIMERS = [];
    AJAX_CALLS = [];
    ELEMENTS = {};
    DOC = {
        activeElement: null,
        readyState: 'complete',
        getElementById(id) { return ELEMENTS[id] || null; },
        querySelectorAll(sel) {
            if (sel === '.cell-grid-form[data-cg-autosave="1"]') {
                return (WIN._forms || []).filter((f) => f.getAttribute('data-cg-autosave') === '1');
            }
            if (sel === '.cell-grid-save') return [];
            return [];
        },
        addEventListener() {},
    };
    WIN = {
        _forms: [],
        CSS: { escape: (s) => String(s) },
        htmx: {
            ajax(verb, url, ctx) {
                const call = { verb, url, ctx, values: ctx.values };
                let resolveFn;
                call.promise = new Promise((res) => { resolveFn = res; });
                call.settle = () => resolveFn();
                AJAX_CALLS.push(call);
                return call.promise;
            },
        },
        addEventListener() {},
    };
    WIN.lf = {
        on(event, selector, handler) { REGS.push({ event, selector, handler }); },
        hxOn() {},
        ui: {},
    };
    const sandbox = {
        window: WIN, document: DOC, console,
        lf: WIN.lf, htmx: WIN.htmx,
        CSS: WIN.CSS,
        setTimeout: (fn) => { const id = TIMERS.length; TIMERS.push({ id, fn, live: true }); return id; },
        clearTimeout: (id) => { if (TIMERS[id]) TIMERS[id].live = false; },
        Promise, Map, WeakMap, Array, Object, String, parseInt, JSON,
    };
    sandbox.globalThis = sandbox;
    vm.createContext(sandbox);
    vm.runInContext(SRC, sandbox);
    return WIN;
}

function runTimers() {
    // Run currently-live timers (coalescing leaves exactly one live).
    const due = TIMERS.filter((t) => t.live);
    due.forEach((t) => { t.live = false; t.fn(); });
}
function fire(event, target, ev) {
    ev = ev || {};
    REGS.forEach((r) => {
        if (r.event !== event) return;
        const m = target.closest ? target.closest(r.selector) : null;
        if (m) r.handler.call(m, Object.assign({ target }, ev));
    });
}

// --- tests -----------------------------------------------------------------
test('traversal: ArrowDown moves focus to same column, next data row, skipping disabled', () => {
    boot();
    // 2 columns x 3 rows.
    const inputs = [];
    for (let r = 0; r < 3; r++) {
        for (let c = 0; c < 2; c++) {
            inputs.push(makeInput({ name: `cells.r${r}c${c}`, row: r, col: c, saved: '' }));
        }
    }
    inputs[2].disabled = true; // (row1,col0) disabled — must be skipped
    makeForm({ auto: true, inputs });
    ELEMENTS['g-notice'] = { textContent: '' };

    const start = inputs[0]; // row0 col0
    fire('keydown', start, { key: 'ArrowDown', preventDefault() {} });
    // row1col0 is disabled → lands on row2col0 = inputs[4]
    assert.equal(DOC.activeElement.name, 'cells.r2c0');
});

test('traversal: Enter is preventDefault-ed (no form submit) and moves down', () => {
    boot();
    const a = makeInput({ name: 'cells.a', row: 0, col: 0 });
    const b = makeInput({ name: 'cells.b', row: 1, col: 0 });
    makeForm({ auto: true, inputs: [a, b] });
    let prevented = false;
    fire('keydown', a, { key: 'Enter', preventDefault() { prevented = true; } });
    assert.equal(prevented, true, 'Enter must preventDefault the lone-input form submit');
    assert.equal(DOC.activeElement.name, 'cells.b');
});

test('focusout coalescing: two changed cells collapse into ONE single-flight batch', () => {
    boot();
    const a = makeInput({ name: 'cells.a', row: 0, col: 0, saved: '1' });
    const b = makeInput({ name: 'cells.b', row: 1, col: 0, saved: '2' });
    const hidden = { name: '_workspace_id', value: 'WS', getAttribute: () => 'hidden' };
    makeForm({ auto: true, inputs: [a, b], hiddens: [hidden] });
    ELEMENTS['g-notice'] = { textContent: '' };

    a.value = '9'; a.dataset.cgRev = '1';
    b.value = '8'; b.dataset.cgRev = '1';
    fire('focusout', a);
    fire('focusout', b);
    assert.equal(AJAX_CALLS.length, 0, 'no request before the coalescing window elapses');
    runTimers();
    assert.equal(AJAX_CALLS.length, 1, 'exactly one coalesced batch');
    const v = AJAX_CALLS[0].values;
    assert.equal(v.save_mode, 'cell');
    assert.equal(v['cells.a'], '9');
    assert.equal(v['cells.b'], '8');
    assert.equal(v['_workspace_id'], 'WS', 'signed hidden field is included');
});

test('new-ID rename handshake: ok+new renames name in place to cells.{outcomeId}', async () => {
    boot();
    const cell = makeInput({ name: 'new.JT1:CR1', row: 0, col: 0, saved: '' });
    makeForm({ auto: true, inputs: [cell] });
    ELEMENTS['g-notice'] = { textContent: '' };

    cell.value = 'P'; cell.dataset.cgRev = '1';
    fire('focusout', cell);
    runTimers();
    assert.equal(AJAX_CALLS.length, 1);
    assert.equal(AJAX_CALLS[0].values['new.JT1:CR1'], 'P');

    fire('omcell-result', AJAX_CALLS[0].ctx.target, {
        detail: { cells: [{ key: 'new.JT1:CR1', ok: true, outcomeId: 'OID9', value: 'P', ratingFresh: true }] },
    });
    assert.equal(cell.name, 'cells.OID9', 'input name renamed in place — no duplicate on next save');
    assert.equal(cell.getAttribute('data-cg-state'), 'saved');
    assert.equal(cell.dataset.savedValue, 'P', 'baseline advanced to server canonical value');
});

test('clear ack: cells.id with nextKey resets to new.{jt}:{cr}, then posts that key next save', async () => {
    boot();
    const cell = makeInput({ name: 'cells.OID9', row: 0, col: 0, saved: 'P' });
    makeForm({ auto: true, inputs: [cell] });
    ELEMENTS['g-notice'] = { textContent: '' };

    // Clear a persisted row.
    cell.value = '';
    cell.dataset.cgRev = '1';
    fire('focusout', cell);
    runTimers();
    assert.equal(AJAX_CALLS.length, 1);
    assert.equal(AJAX_CALLS[0].values['cells.OID9'], '');

    fire('omcell-result', AJAX_CALLS[0].ctx.target, {
        detail: { cells: [{ key: 'cells.OID9', ok: true, nextKey: 'new.JT1:CR1', value: '', ratingFresh: true }] },
    });
    AJAX_CALLS[0].settle();
    await Promise.resolve();
    assert.equal(cell.name, 'new.JT1:CR1', 'cleared input flips back to CREATE key');
    assert.equal(cell.getAttribute('data-cg-state'), 'saved');
    assert.equal(cell.value, '', 'value is canonical empty after clear');
    assert.equal(cell.dataset.savedValue, '', 'baseline is canonical empty after clear');

    // Later edit posts the new key for recreate.
    cell.value = 'Q';
    fire('input', cell);
    fire('focusout', cell);
    runTimers();
    assert.equal(AJAX_CALLS.length, 2);
    assert.equal(AJAX_CALLS[1].values['new.JT1:CR1'], 'Q');
});

test('stale-response suppression: a late ack for an older revision never clobbers a newer edit', () => {
    boot();
    const cell = makeInput({ name: 'cells.x', row: 0, col: 0, saved: '5' });
    makeForm({ auto: true, inputs: [cell] });
    ELEMENTS['g-notice'] = { textContent: '' };

    // Edit → focusout → flight (submitted rev 1, value 7).
    cell.value = '7'; cell.dataset.cgRev = '1';
    fire('focusout', cell);
    runTimers();
    const flight = AJAX_CALLS[0];
    assert.equal(flight.values['cells.x'], '7');

    // User keeps typing WHILE in flight → rev 2, value 9.
    fire('input', cell); // module bumps cgRev to 2 (was 1)
    cell.value = '9';

    // The stale ack for the submitted (older) snapshot arrives.
    fire('omcell-result', flight.ctx.target, {
        detail: { cells: [{ key: 'cells.x', ok: true, value: '7', ratingFresh: true }] },
    });
    assert.equal(cell.value, '9', 'newer live edit must survive the stale ack');
    assert.notEqual(cell.getAttribute('data-cg-state'), 'saved', 'stale ack must not mark the newer edit saved');
});

test('batch fallback: a non-auto (legacy) grid does NOT auto-queue on focusout', () => {
    boot();
    const cell = makeInput({ name: 'cells.a', row: 0, col: 0, saved: '1' });
    makeForm({ auto: false, inputs: [cell] });
    cell.value = '2';
    fire('focusout', cell);
    runTimers();
    assert.equal(AJAX_CALLS.length, 0, 'legacy grid keeps manual batch-only behavior');
    // The exposed edit-mode API is still present for the auto grids.
    assert.equal(WIN.lf.ui.cellGrid.RESULT_EVENT, 'omcell-result');
});
