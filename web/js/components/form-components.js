/**
 * Form Components — auto-wiring helpers for pyeza form-group enhancements.
 *
 * Features:
 *   1. form-select-description  — updates a .form-select-description hint span
 *      when a <select> with data-description per <option> changes.
 *   2. form-char-counter        — updates a .form-char-counter span as the user
 *      types in a <textarea> that carries a maxlength attribute.
 *
 * Both features wire on DOMContentLoaded and re-wire on every HTMX content-swap
 * so drawer re-loads work automatically.
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
    // Public init — wire within a subtree (or whole document)
    // -------------------------------------------------------------------------

    function init(root) {
        initSelectDescription(root);
        initCharCounters(root);
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
