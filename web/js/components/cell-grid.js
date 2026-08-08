/**
 * cell-grid.js — CellGridConfig spreadsheet grid client.
 *
 * Two layers, both OOB-swap-safe (every binding is document-level lf.on()/
 * lf.hxOn() delegation, never per-element addEventListener, so an HTMX
 * content-swap that replaces the grid subtree keeps working with zero re-init):
 *
 *   LAYER 1 — manual batch (always on). Dirty-tracking + Save-button state for
 *   the whole-grid <form hx-post SaveURL hx-swap="none"> batch submit. The form
 *   also carries data-hx-on="form-result", routed by lf-hx-on.js to
 *   lf.ui.handleFormResult for the aggregate success/error banner.
 *
 *   LAYER 2 — W2 edit mode (only when the form has data-cg-autosave="1").
 *   Excel-like keyboard grid-nav + auto-save-on-focusout as a ~150ms-coalesced,
 *   single-flight micro-batch of ONLY the dirty cells, POSTed via htmx.ajax to
 *   the same SaveURL with a hidden save_mode=cell. Per-cell acks arrive as the
 *   HX-Trigger custom event "omcell-result" (detail {cells:[{key, ok, outcomeId,
 *   nextKey, value, ratingFresh, error?}]}); a successful create renames the
 *   input's name from new.{jt}:{cr} to cells.{outcomeId} IN PLACE so the next
 *   save updates instead of re-creating. If an answered clear sets
 *   nextKey=new.{jt}:{cr}, the same live input renames from cells.{id} back to
 *   new.{jt}:{cr} for the next SAVE. The manual Save button is retained as the
 *   a11y /
 *   retry fallback, but in this mode it is enabled — and therefore, per
 *   cell-grid.css, visible — ONLY while a cell is in the "error" state (see
 *   needsSave). A healthy autosave grid shows no retry control; the control is
 *   never removed from the DOM, so it remains the submit path when JS is
 *   unavailable and the recovery path when a save actually fails.
 *
 * Contract (locked, must match the W2 server half verbatim):
 *   REQUEST  focusout of a CHANGED cell → coalesced single-flight POST of the
 *            signed hidden fields + save_mode=cell + dirty cells only, named
 *            cells.{outcome_id} (existing) / new.{job_task_id}:{criteria_id} (new).
 *   RESPONSE HX-Trigger event "omcell-result", detail.cells[] items
 *            { key, ok, outcomeId, nextKey, value, ratingFresh, error? }.
 *
 * CSP: no on*=/hx-on attributes; htmx is the vendored 1.9.10 build (window.htmx).
 *
 * Auto-copied to apps/{app}/assets/js/pyeza/cell-grid.js at startup via
 * pyeza.CopyStaticAssets — never edit the app copy; edit here.
 */
(function cellGridBoot() {
    'use strict';

    if (!window.lf || typeof window.lf.on !== 'function') {
        // LOAD ORDER: this script is self-included by the grid card (mid-body),
        // but lf-on.js is loaded LATER in app-shell.html — so on a full page load
        // lf.on is not yet defined when this IIFE first runs. Rather than bail
        // permanently (which killed the whole Layer-1 + Layer-2 engine), defer to
        // DOMContentLoaded: all synchronous <script>s (incl. lf-on.js) have
        // executed by then, so re-running cellGridBoot binds successfully. The
        // window.__lfCellGridBound + __cgState guards make the re-run idempotent.
        // If lf truly never loads, the grid still renders + posts via the Save
        // button — it just loses the live dirty/edit affordances.
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', cellGridBoot, { once: true });
        }
        return;
    }

    // The locked per-cell ack event name (mirrors CellGridConfig.ResultEventName
    // and the form's data-result-event attribute).
    var RESULT_EVENT = 'omcell-result';
    var COALESCE_MS = 150;
    var SAVED_LINGER_MS = 1200;
    var ERROR_LINGER_MS = 4000;

    // Per-form edit state lives on window so it survives a re-execution of this
    // IIFE (the card self-includes grid-scripts.html on content swaps). A fresh
    // closure would strand the once-registered delegated listeners on a stale map.
    window.__cgState = window.__cgState || new WeakMap();
    var formState = window.__cgState;

    function stateFor(form) {
        var st = formState.get(form);
        if (!st) {
            st = { pending: new Map(), snapshot: null, inFlight: false, timer: null, stale: false };
            formState.set(form, st);
        }
        return st;
    }

    // --- generic helpers ----------------------------------------------------
    function gridForm(el) { return el && el.closest ? el.closest('.cell-grid-form') : null; }
    function saveButton(form) { return form ? form.querySelector('.cell-grid-save') : null; }
    function isAuto(form) { return !!form && form.getAttribute('data-cg-autosave') === '1'; }
    function cellInputs(form) { return Array.prototype.slice.call(form.querySelectorAll('.cell-grid-input')); }
    function msg(form, key, fallback) {
        var v = form ? form.getAttribute('data-msg-' + key) : '';
        return v || fallback || '';
    }
    function esc(s) {
        return (window.CSS && CSS.escape) ? CSS.escape(s) : String(s).replace(/["\\]/g, '\\$&');
    }
    function inputByName(form, name) {
        return form.querySelector('.cell-grid-input[name="' + esc(name) + '"]');
    }
    function baselineOf(el) { return el.dataset.savedValue == null ? '' : el.dataset.savedValue; }
    function isDirty(el) { return !el.disabled && el.value !== baselineOf(el); }

    function setState(el, s) {
        el.setAttribute('data-cg-state', s);
        if (s !== 'error') el.removeAttribute('aria-invalid');
    }
    function setStatus(el, text) {
        var id = el.getAttribute('aria-describedby');
        if (!id) return;
        var region = document.getElementById(id);
        if (region) region.textContent = text || '';
    }

    // --- manual batch: dirty-tracking + Save-button state (Layer 1) ---------

    // Save/Retry button policy — the ONE predicate both layers agree on.
    //
    //   Layer 1 (no autosave): this button is the ONLY save path, so ANY dirty
    //   cell must enable it. Unchanged behavior.
    //
    //   Layer 2 (autosave): edits persist on focusout, so the button is purely
    //   the recovery / a11y fallback its "retry" label already describes. It is
    //   therefore enabled ONLY while at least one cell FAILED to save. A merely
    //   dirty/queued/saving cell is already on its way to the server and needs
    //   no retry affordance — enabling on those made the button flash on every
    //   keystroke and left it standing permanently on a healthy sheet.
    //   cell-grid.css hides the button (and its strip) while it is disabled in
    //   this mode, so a healthy autosave grid shows no retry control at all —
    //   but the control still EXISTS, and with JS unavailable none of this runs,
    //   leaving the button enabled as the no-JS submit path.
    //   The cgDirty conjunct in the AutoSave branch preserves the pre-existing
    //   "a completed manual batch turns the button off" behavior verbatim:
    //   clearDirty() (afterRequest, successful) still hides it without this
    //   layer having to reach in and repaint per-cell state.
    function needsSave(form) {
        if (isAuto(form)) {
            return form.dataset.cgDirty === '1' &&
                !!form.querySelector('.cell-grid-input[data-cg-state="error"]');
        }
        return form.dataset.cgDirty === '1';
    }
    function syncSaveButton(form) {
        var btn = saveButton(form);
        if (!btn || btn.dataset.cgLocked === '1') return;
        btn.disabled = !needsSave(form);
    }
    function markDirty(form) {
        if (!form) return;
        form.dataset.cgDirty = '1';
        syncSaveButton(form);
    }
    function clearDirty(form) {
        if (!form) return;
        delete form.dataset.cgDirty;
        syncSaveButton(form);
    }
    // Recompute the Save/Retry button enablement from live per-cell state.
    function recomputeDirty(form) {
        if (isAuto(form)) {
            // needsSave() already reads live per-cell state in this mode.
            syncSaveButton(form);
            return;
        }
        var pending = form.querySelector(
            '.cell-grid-input[data-cg-state="dirty"],' +
            '.cell-grid-input[data-cg-state="queued"],' +
            '.cell-grid-input[data-cg-state="saving"],' +
            '.cell-grid-input[data-cg-state="error"]');
        if (pending) markDirty(form); else clearDirty(form);
    }

    // Idempotent init: a freshly-rendered grid is clean → Save disabled, and we
    // record whether the button was permission-locked so nothing re-enables it.
    function initGrids(scope) {
        var root = (scope && scope.querySelectorAll) ? scope : document;

        // Scope the htmx loading indicator away from the app shell. The shell
        // <body> carries an inherited hx-indicator="#main-content-loading", so
        // without an override EVERY auto-save flush lights the full-page
        // overlay for the whole request (multi-second recomputes) — a cell
        // save must never look like a page load. "this" points the indicator
        // at the card itself, which has no .htmx-indicator styling → no
        // visible spinner; per-cell state (saving/saved/error) is the
        // feedback. Applies to the manual batch submit too (the save button's
        // "Saving…" label is that path's feedback).
        var cards = root.querySelectorAll('.cell-grid-card');
        for (var c = 0; c < cards.length; c++) {
            if (!cards[c].hasAttribute('hx-indicator')) {
                cards[c].setAttribute('hx-indicator', 'this');
            }
        }

        var buttons = root.querySelectorAll('.cell-grid-save');
        for (var i = 0; i < buttons.length; i++) {
            var btn = buttons[i];
            if (btn.dataset.cgInit === '1') continue;
            btn.dataset.cgInit = '1';
            if (btn.disabled) {
                btn.dataset.cgLocked = '1';
            } else {
                var form = gridForm(btn);
                if (form) syncSaveButton(form);
            }
        }
    }

    // --- W2 auto-save engine (Layer 2) --------------------------------------
    function queueCell(form, el) {
        if (!isAuto(form) || el.disabled) return;
        var st = stateFor(form);
        var rev = el.dataset.cgRev || '0';
        st.pending.set(el.name, { name: el.name, value: el.value, rev: rev });
        setState(el, 'queued');
        setStatus(el, '');
        markDirty(form);
        scheduleFlush(form);
    }

    function queueIfDirty(form, el) {
        if (isDirty(el)) queueCell(form, el);
    }

    function scheduleFlush(form) {
        var st = stateFor(form);
        if (st.timer) clearTimeout(st.timer);
        st.timer = setTimeout(function () { st.timer = null; flush(form); }, COALESCE_MS);
    }

    function flush(form) {
        var st = stateFor(form);
        if (st.inFlight) return;            // single-flight; re-flushed on completion
        if (st.pending.size === 0) return;
        if (!window.htmx || typeof window.htmx.ajax !== 'function') return; // no transport

        // Immutable snapshot; new edits accumulate into the next batch.
        var snapshot = st.pending;
        st.pending = new Map();
        st.snapshot = snapshot;
        st.inFlight = true;

        var values = {};
        // Signed action/workspace/CSRF fields + job_template_id + scope.
        var hidden = form.querySelectorAll('input[type="hidden"]');
        for (var i = 0; i < hidden.length; i++) {
            if (hidden[i].name) values[hidden[i].name] = hidden[i].value;
        }
        values.save_mode = 'cell';
        snapshot.forEach(function (entry, name) {
            values[name] = entry.value;
            var el = inputByName(form, name);
            if (el) { setState(el, 'saving'); setStatus(el, msg(form, 'saving', 'Saving…')); }
        });

        // Source must be OUTSIDE the <form> so htmx does NOT auto-serialize every
        // cell — the card (the form's ancestor) has no form-field descendants of
        // its own, so getInputValues yields nothing and `values` is the entire
        // body. target=form makes htmx dispatch the "omcell-result" HX-Trigger
        // event on the form, where lf.on() delegation catches it.
        var card = form.closest('.cell-grid-card') || form.parentElement || form;
        var url = form.getAttribute('hx-post') || form.getAttribute('action') || '';

        var settle = function () {
            st.inFlight = false;
            // Any snapshot cell left in "saving" was never acked (network/parse
            // failure or a missing item) → mark it retryable-error.
            snapshot.forEach(function (entry, name) {
                var el = inputByName(form, name);
                if (el && el.getAttribute('data-cg-state') === 'saving') {
                    setState(el, 'error');
                    setStatus(el, msg(form, 'error', 'Not saved.'));
                    el.setAttribute('aria-invalid', 'true');
                }
            });
            st.snapshot = null;
            updateNotice(form);
            recomputeDirty(form);
            if (st.pending.size > 0) scheduleFlush(form);
        };

        var p;
        try {
            p = window.htmx.ajax('POST', url, { source: card, target: form, swap: 'none', values: values });
        } catch (err) {
            settle();
            return;
        }
        if (p && typeof p.then === 'function') {
            p.then(settle, settle);
        } else {
            // No promise returned — guard so inFlight can't wedge forever.
            setTimeout(settle, 8000);
        }
    }

    // Per-cell ack reconciliation. A response acknowledges a SUBMITTED revision,
    // never "the cell" abstractly — a late ack can never clobber a newer edit.
    function handleResult(form, detail) {
        if (!isAuto(form) || !detail || !detail.cells || !detail.cells.length) return;
        var st = stateFor(form);
        var sawStale = false;

        detail.cells.forEach(function (c) {
            if (!c || !c.key) return;
            var key = c.key;
            var el = inputByName(form, key);
            var snapEntry = st.snapshot ? st.snapshot.get(key) : null;
            var nextKey = c.nextKey;
            if (!el) return; // renamed away / gone — nothing to paint

            if (c.ok) {
                // Handshake: a new record just got its id → rename in place so the
                // next save UPDATES instead of re-CREATING a duplicate. MANDATORY.
                // If a clear reply asks for a nextKey, flip cells.{id} back to
                // new.{jt}:{cr} in place so a later edit re-creates cleanly.
                if (key.indexOf('cells.') === 0 && nextKey) {
                    var nextName = nextKey;
                    el.setAttribute('name', nextName);
                    el.name = nextName;
                    if (st.pending.has(key)) {
                        var pe = st.pending.get(key);
                        pe.name = nextName;
                        st.pending.delete(key);
                        st.pending.set(nextName, pe);
                    }
                } else if (c.outcomeId && key.indexOf('new.') === 0) {
                    var canonicalName = 'cells.' + c.outcomeId;
                    el.setAttribute('name', canonicalName);
                    el.name = canonicalName;
                    if (st.pending.has(key)) {
                        var pe = st.pending.get(key);
                        pe.name = canonicalName;
                        st.pending.delete(key);
                        st.pending.set(canonicalName, pe);
                    }
                }
                var canonical = (c.value == null) ? el.value : String(c.value);
                if (nextKey) canonical = '';
                var liveRev = el.dataset.cgRev || '0';
                var submittedRev = snapEntry ? snapEntry.rev : liveRev;
                el.dataset.savedValue = canonical; // new acknowledged baseline

                if (liveRev === submittedRev && !st.pending.has(el.name)) {
                    // No newer edit outran this ack → reflect canonical + mark saved.
                    if (el.value !== canonical && document.activeElement !== el) el.value = canonical;
                    setState(el, 'saved');
                    setStatus(el, msg(form, c.ratingFresh === false ? 'rating-stale' : 'saved', 'Saved.'));
                    lingerSaved(el);
                } else {
                    // The user edited past the submitted revision → stay dirty; the
                    // newer value re-saves on the next flush.
                    setState(el, isDirty(el) ? 'dirty' : 'clean');
                }
                if (c.ratingFresh === false) sawStale = true;
            } else {
                // Explicit server REJECT (value_rejected etc.): spreadsheet
                // semantics — restore the last acknowledged value rather than
                // keeping an unsaveable one in the cell, surface the reason on
                // the cell + notice strip, then let the error paint clear on
                // its own. (Transport failures keep the typed value + retry —
                // that path is settle(), not here.)
                if (document.activeElement !== el) el.value = baselineOf(el);
                setState(el, 'error');
                setStatus(el, (c.error && String(c.error)) || msg(form, 'error', 'Not saved.'));
                el.setAttribute('aria-invalid', 'true');
                lingerError(form, el);
            }
        });

        if (sawStale) st.stale = true;
        updateNotice(form);
        recomputeDirty(form);
    }

    function lingerSaved(el) {
        setTimeout(function () {
            if (el.getAttribute('data-cg-state') === 'saved' && !isDirty(el)) {
                setState(el, 'clean');
                setStatus(el, '');
            }
        }, SAVED_LINGER_MS);
    }

    // After a server reject the cell holds the REVERTED (baseline) value, so it
    // is not dirty and nothing would ever repaint it — clear the error paint
    // once the user has had time to read it (unless they edited again).
    function lingerError(form, el) {
        setTimeout(function () {
            if (el.getAttribute('data-cg-state') === 'error' && !isDirty(el)) {
                setState(el, 'clean');
                setStatus(el, '');
                updateNotice(form);
            }
        }, ERROR_LINGER_MS);
    }

    // Aggregate, screen-reader-friendly grid notice: the soft "rating not yet
    // recomputed" note (sticky until the next clean pass) plus an error count.
    function updateNotice(form) {
        var st = stateFor(form);
        var id = form.getAttribute('data-notice-id');
        if (!id) return;
        var notice = document.getElementById(id);
        if (!notice) return;
        var errors = form.querySelectorAll('.cell-grid-input[data-cg-state="error"]').length;
        if (errors === 0) st.stale = st.stale && !!form.querySelector('.cell-grid-input[data-cg-state="saved"]');
        var parts = [];
        if (st.stale) parts.push(msg(form, 'rating-stale', ''));
        if (errors > 0) parts.push(msg(form, 'error', 'Some cells did not save.'));
        notice.textContent = parts.join(' ').trim();
    }

    function revertCell(form, el) {
        el.value = baselineOf(el);
        var st = stateFor(form);
        st.pending.delete(el.name);
        setState(el, 'clean');
        setStatus(el, '');
        el.removeAttribute('aria-invalid');
        updateNotice(form);
        recomputeDirty(form);
    }

    // --- keyboard grid navigation (Layer 2) ---------------------------------
    function atCaretStart(el) {
        try {
            if (el.selectionStart == null) return true; // <select> / number → treat as boundary
            return el.selectionStart === 0 && el.selectionEnd === 0;
        } catch (e) { return true; }
    }
    function atCaretEnd(el) {
        try {
            if (el.selectionStart == null) return true;
            return el.selectionStart === el.value.length && el.selectionEnd === el.value.length;
        } catch (e) { return true; }
    }
    function focusInput(el) {
        el.focus();
        try { if (el.select) el.select(); } catch (e) { /* number inputs may throw */ }
    }
    function moveVertical(form, el, dir) {
        var col = el.getAttribute('data-col-index');
        if (col == null) return;
        var sameCol = Array.prototype.slice.call(
            form.querySelectorAll('.cell-grid-input[data-col-index="' + esc(col) + '"]'));
        sameCol.sort(function (a, b) {
            return (parseInt(a.getAttribute('data-row-index'), 10) || 0) -
                   (parseInt(b.getAttribute('data-row-index'), 10) || 0);
        });
        var i = sameCol.indexOf(el) + dir;
        while (i >= 0 && i < sameCol.length) {
            if (!sameCol[i].disabled) { focusInput(sameCol[i]); return; }
            i += dir;
        }
    }
    function moveHorizontal(form, el, dir) {
        var all = cellInputs(form); // DOM order = row-major
        var i = all.indexOf(el) + dir;
        while (i >= 0 && i < all.length) {
            if (!all[i].disabled) { focusInput(all[i]); return; }
            i += dir;
        }
    }

    function onKeydown(e) {
        var el = this;
        var form = gridForm(el);
        if (!isAuto(form)) return;              // legacy grid keeps native behavior
        if (e.isComposing) return;              // IME composition — never intercept
        if (e.altKey || e.ctrlKey || e.metaKey) return;

        switch (e.key) {
            case 'Escape':
                revertCell(form, el);
                return;
            case 'Enter':
                e.preventDefault();             // lone input in a form would submit
                queueIfDirty(form, el);
                moveVertical(form, el, e.shiftKey ? -1 : 1);
                return;
            case 'ArrowUp':
                e.preventDefault();             // also suppresses number-input step
                queueIfDirty(form, el);
                moveVertical(form, el, -1);
                return;
            case 'ArrowDown':
                e.preventDefault();
                queueIfDirty(form, el);
                moveVertical(form, el, 1);
                return;
            case 'ArrowLeft':
                if (atCaretStart(el)) {
                    e.preventDefault();
                    queueIfDirty(form, el);
                    moveHorizontal(form, el, -1);
                } // else: normal caret movement
                return;
            case 'ArrowRight':
                if (atCaretEnd(el)) {
                    e.preventDefault();
                    queueIfDirty(form, el);
                    moveHorizontal(form, el, 1);
                }
                return;
            default:
                return;
        }
    }

    // --- one-time delegated registration ------------------------------------
    if (!window.__lfCellGridBound) {
        window.__lfCellGridBound = true;

        // Any edit marks the batch form dirty (Layer 1) and, in auto mode, bumps
        // the cell revision + tracks per-cell dirty state (Layer 2).
        lf.on('input', '.cell-grid-form .cell-grid-input', function () {
            var form = gridForm(this);
            markDirty(form);
            if (isAuto(form)) {
                var rev = (parseInt(this.dataset.cgRev, 10) || 0) + 1;
                this.dataset.cgRev = String(rev);
                setState(this, isDirty(this) ? 'dirty' : 'clean');
            }
        });
        lf.on('change', '.cell-grid-form .cell-grid-input', function () {
            markDirty(gridForm(this));
        });

        // Auto-save on leaving a changed cell (focusout BUBBLES; blur does not).
        lf.on('focusout', '.cell-grid-form .cell-grid-input', function () {
            var form = gridForm(this);
            if (isAuto(form)) queueIfDirty(form, this);
        });

        // Keyboard grid navigation (auto mode only).
        lf.on('keydown', '.cell-grid-form .cell-grid-input', onKeydown);

        // Per-cell ack from the server (HX-Trigger custom event). htmx dispatches
        // response-header triggers on the REQUESTING element — the CARD for
        // auto-save (htmx.ajax source=card), the form for the manual batch
        // submit — so match both and resolve the form either way. Matching the
        // form alone silently drops every auto-save ack: the cells then sit in
        // "saving" until settle() paints them error even though the server
        // answered ok:true (the red-cells-despite-saved failure, 2026-07-26).
        lf.on(RESULT_EVENT, '.cell-grid-card, .cell-grid-form', function (e) {
            var form = (this.matches && this.matches('.cell-grid-form')) ? this : this.querySelector('.cell-grid-form');
            if (form) handleResult(form, e && e.detail);
        });

        // Manual batch (Layer 1) submit UX — fires only for the native form
        // submit (source=form), NOT for auto-save (source=card).
        lf.on('htmx:beforeRequest', '.cell-grid-form', function (e) {
            if (e && e.target !== this) return; // ignore bubbled auto-save requests
            var btn = saveButton(this);
            if (!btn) return;
            btn.disabled = true;
            if (btn.dataset.labelSaving) btn.textContent = btn.dataset.labelSaving;
        });
        lf.on('htmx:afterRequest', '.cell-grid-form', function (e) {
            if (e && e.target !== this) return;
            var btn = saveButton(this);
            if (btn && btn.dataset.labelSave) btn.textContent = btn.dataset.labelSave;
            if (e && e.detail && e.detail.successful) clearDirty(this); else markDirty(this);
        });

        // beforeunload guard: warn if any auto-save cell is still pending/errored.
        window.addEventListener('beforeunload', function (e) {
            var forms = document.querySelectorAll('.cell-grid-form[data-cg-autosave="1"]');
            for (var i = 0; i < forms.length; i++) {
                var unsaved = forms[i].querySelector(
                    '.cell-grid-input[data-cg-state="dirty"],' +
                    '.cell-grid-input[data-cg-state="queued"],' +
                    '.cell-grid-input[data-cg-state="saving"],' +
                    '.cell-grid-input[data-cg-state="error"]');
                if (unsaved) {
                    e.preventDefault();
                    e.returnValue = msg(forms[i], 'unsaved', '');
                    return e.returnValue;
                }
            }
        });

        document.addEventListener('DOMContentLoaded', function () { initGrids(document); });
        document.addEventListener('htmx:afterSwap', function (e) { initGrids(e.target || document); });
    }

    // initGrids runs on every (re-)execution: it is per-button idempotent and
    // covers the case where this script loaded AFTER DOMContentLoaded via a
    // content-partial swap that self-included grid-scripts.html.
    if (document.readyState !== 'loading') initGrids(document);

    // Expose for tests / programmatic use under the design-system namespace.
    window.lf.ui = window.lf.ui || {};
    window.lf.ui.cellGrid = {
        RESULT_EVENT: RESULT_EVENT,
        _handleResult: handleResult,
        _queueCell: queueCell,
        _stateFor: stateFor,
        _flush: flush
    };
})();
