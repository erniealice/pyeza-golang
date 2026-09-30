/**
 * Form Components — auto-wiring helpers for pyeza form-group enhancements.
 *
 * Features:
 *   1. form-select-description  — updates a .form-select-description hint span
 *      when a <select> with data-description per <option> changes.
 *   2. form-char-counter        — updates a .form-char-counter span as the user
 *      types in a <textarea> that carries a maxlength attribute.
 *   3. conditional section      — an element with data-lf-show-when="<control id>" and
 *      data-lf-show-values="A,B" is shown only while that control's value is one of
 *      the listed values; while hidden, its inner form controls are disabled so they
 *      are not submitted. CSP-safe replacement for per-drawer inline scripts.
 *
 * Features 1 and 2 bind per-element listeners (guarded against double binding); feature 3
 * uses ONE delegated document 'change' listener, so an HTMX swap only needs its initial state
 * re-applied and never accumulates listeners on a control that outlives the swapped section.
 * All features wire on DOMContentLoaded and re-wire on every HTMX content-swap.
 * Without JS a hidden section's controls still post; the use-case guards are authoritative.
 */

window.lf = window.lf || {};
window.lf.ui = window.lf.ui || {};

window.lf.ui.FormComponents = (function () {
    'use strict';

    // -------------------------------------------------------------------------
    // Feature 1: select description hint
    // -------------------------------------------------------------------------

    function initSelectDescription(root) {
        var selects = (root || document).querySelectorAll('.form-select[id]');
        selects.forEach(function (sel) {
            var descEl = document.getElementById(sel.id + '-description');
            if (!descEl) return;
            // avoid double-binding
            if (sel.dataset.descInit) return;
            sel.dataset.descInit = '1';

            function update() {
                var opt = sel.options[sel.selectedIndex];
                descEl.textContent = (opt && opt.dataset.description) ? opt.dataset.description : '';
            }

            sel.addEventListener('change', update);
            // initialise immediately (in case an option is pre-selected)
            update();
        });
    }

    // -------------------------------------------------------------------------
    // Feature 2: textarea character counter
    // -------------------------------------------------------------------------

    function initCharCounters(root) {
        var textareas = (root || document).querySelectorAll('textarea[maxlength][id]');
        textareas.forEach(function (ta) {
            var counterEl = document.getElementById(ta.id + '-counter');
            if (!counterEl) return;
            if (ta.dataset.counterInit) return;
            ta.dataset.counterInit = '1';

            var max = parseInt(ta.getAttribute('maxlength'), 10);
            if (!max || max <= 0) return;

            function update() {
                var used = ta.value.length;
                var remaining = max - used;
                counterEl.textContent = used + ' / ' + max;

                counterEl.classList.remove(
                    'form-char-counter--ok',
                    'form-char-counter--warning',
                    'form-char-counter--error'
                );

                if (remaining === 0) {
                    counterEl.classList.add('form-char-counter--error');
                } else if (remaining < Math.ceil(max * 0.1)) {
                    counterEl.classList.add('form-char-counter--warning');
                } else {
                    counterEl.classList.add('form-char-counter--ok');
                }
            }

            ta.addEventListener('input', update);
            // initialise with current value (pre-filled edit forms)
            update();
        });
    }

    // -------------------------------------------------------------------------
    // Feature 3: conditional section (show while a control holds a listed value)
    // -------------------------------------------------------------------------

    // Applies one section's state from its controlling element. Idempotent: safe to call on
    // every init and on every change. Controls the script disabled are tagged so only those
    // are re-enabled (a control disabled by markup stays disabled).
    function applyConditionalSection(section) {
        var control = document.getElementById(section.dataset.lfShowWhen);
        if (!control) return;
        var values = (section.dataset.lfShowValues || '').split(',').map(function (v) { return v.trim(); });
        var on = values.indexOf(control.value) !== -1;
        section.hidden = !on;
        section.querySelectorAll('input, select, textarea').forEach(function (el) {
            if (on) {
                if (el.dataset.lfShowWhenDisabled) { el.disabled = false; delete el.dataset.lfShowWhenDisabled; }
            } else if (!el.disabled) {
                el.disabled = true;
                el.dataset.lfShowWhenDisabled = '1';
            }
        });
    }

    // Initial state for sections in a subtree. No listeners are added here: the single
    // delegated 'change' listener below serves every section, present or swapped in later.
    function initConditionalSections(root) {
        (root || document).querySelectorAll('[data-lf-show-when]').forEach(applyConditionalSection);
    }

    var conditionalListenerBound = false;
    function bindConditionalListener() {
        if (conditionalListenerBound) return;
        conditionalListenerBound = true;
        document.addEventListener('change', function (e) {
            var id = e.target && e.target.id;
            if (!id) return;
            document.querySelectorAll('[data-lf-show-when]').forEach(function (section) {
                if (section.dataset.lfShowWhen === id) applyConditionalSection(section);
            });
        });
    }

    // -------------------------------------------------------------------------
    // Public init — wire within a subtree (or whole document)
    // -------------------------------------------------------------------------

    function init(root) {
        bindConditionalListener();
        initSelectDescription(root);
        initCharCounters(root);
        initConditionalSections(root);
    }

    // -------------------------------------------------------------------------
    // Auto-wire on initial load
    // -------------------------------------------------------------------------

    document.addEventListener('DOMContentLoaded', function () { init(); });

    // Re-wire whenever HTMX swaps content (covers drawer loads)
    document.addEventListener('htmx:afterSwap', function (e) {
        init(e.detail.target);
    });

    return { init: init };
})();
