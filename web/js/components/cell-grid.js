/**
 * cell-grid.js — dirty-tracking + Save-button state for the CellGridConfig
 * batch-edit grid (web/templates/components/grid/cell-grid-*.html).
 *
 * OOB-swap-safe: every interactive binding goes through lf.on() document-level
 * delegation (web/js/components/lf-on.js), never per-element addEventListener,
 * so an HTMX content-swap that replaces the grid subtree keeps working with zero
 * re-init. The batch <form> also carries data-hx-on="form-result", which
 * lf-hx-on.js already routes to lf.ui.handleFormResult for the success/error
 * banner — this module owns only: (1) marking the form dirty on any cell edit,
 * (2) enabling/disabling the Save button, (3) the "Saving…" label swap.
 *
 * Loaded via the self-included partials/grid-scripts.html (cell-grid-card ends
 * with {{template "grid-scripts" .}}), so it is present on both full-page and
 * content-partial renders.
 *
 * Auto-copied to apps/{app}/assets/js/pyeza/cell-grid.js at startup via
 * pyeza.CopyStaticAssets — never edit the app copy.
 */
(function () {
    'use strict';

    if (!window.lf || typeof window.lf.on !== 'function') {
        // lf-on.js is in the 16-script core bundle; if it is somehow absent the
        // grid still renders and posts — it just loses live dirty affordances.
        return;
    }

    function gridForm(el) {
        return el.closest ? el.closest('.cell-grid-form') : null;
    }

    function saveButton(form) {
        return form ? form.querySelector('.cell-grid-save') : null;
    }

    function markDirty(form) {
        if (!form) return;
        form.dataset.cgDirty = '1';
        var btn = saveButton(form);
        // Never re-enable a permission-disabled Save button.
        if (btn && btn.dataset.cgLocked !== '1') btn.disabled = false;
    }

    function clearDirty(form) {
        if (!form) return;
        delete form.dataset.cgDirty;
        var btn = saveButton(form);
        if (btn && btn.dataset.cgLocked !== '1') btn.disabled = true;
    }

    // --- Initial state: a freshly-rendered grid is clean → Save disabled. ---
    // Idempotent, and it records whether the button was permission-locked so the
    // dirty handlers never override that. Runs on load and after every HTMX swap
    // (the delegated edit handlers below are what keep it live thereafter).
    function initGrids(scope) {
        var root = (scope && scope.querySelectorAll) ? scope : document;
        var buttons = root.querySelectorAll('.cell-grid-save');
        for (var i = 0; i < buttons.length; i++) {
            var btn = buttons[i];
            if (btn.dataset.cgInit === '1') continue;
            btn.dataset.cgInit = '1';
            if (btn.disabled) {
                // Rendered disabled → permission lock; keep it that way.
                btn.dataset.cgLocked = '1';
            } else {
                var form = gridForm(btn);
                if (form && form.dataset.cgDirty !== '1') btn.disabled = true;
            }
        }
    }

    // --- Live wiring (delegated; survives OOB swaps) ------------------------
    lf.on('input', '.cell-grid-form .cell-grid-input', function () {
        markDirty(gridForm(this));
    });
    lf.on('change', '.cell-grid-form .cell-grid-input', function () {
        markDirty(gridForm(this));
    });

    // Submit → show "Saving…" + block double-submit.
    lf.on('htmx:beforeRequest', '.cell-grid-form', function () {
        var btn = saveButton(this);
        if (!btn) return;
        btn.disabled = true;
        if (btn.dataset.labelSaving) btn.textContent = btn.dataset.labelSaving;
    });

    // Settle → restore label; success ⇒ clean, failure ⇒ stay dirty for retry.
    lf.on('htmx:afterRequest', '.cell-grid-form', function (e) {
        var btn = saveButton(this);
        if (btn && btn.dataset.labelSave) btn.textContent = btn.dataset.labelSave;
        if (e && e.detail && e.detail.successful) {
            clearDirty(this);
        } else {
            markDirty(this);
        }
    });

    document.addEventListener('DOMContentLoaded', function () { initGrids(document); });
    document.addEventListener('htmx:afterSwap', function (e) { initGrids(e.target || document); });

    // Cover the case where this script loads AFTER DOMContentLoaded (grid arrived
    // via a content-partial swap that self-included grid-scripts.html).
    if (document.readyState !== 'loading') initGrids(document);
})();
