/**
 * Focus Trap Utility
 * Shared by sheet.js and dialog.js.
 * Traps Tab / Shift+Tab within a container while it is open.
 */

(function() {
    'use strict';

    var FOCUSABLE = [
        'a[href]',
        'area[href]',
        'button:not([disabled])',
        'input:not([disabled]):not([type="hidden"])',
        'select:not([disabled])',
        'textarea:not([disabled])',
        '[tabindex]:not([tabindex="-1"])',
        'details > summary'
    ].join(', ');

    /**
     * Trap Tab / Shift+Tab within container.
     * Stores the handler on the container so releaseFocus can remove it.
     *
     * @param {HTMLElement} container
     */
    function trapFocus(container) {
        var handler = function(e) {
            if (e.key !== 'Tab') return;

            var focusable = Array.from(container.querySelectorAll(FOCUSABLE))
                .filter(function(el) { return !el.closest('[hidden]') && el.offsetParent !== null; });

            if (!focusable.length) { e.preventDefault(); return; }

            var first = focusable[0];
            var last  = focusable[focusable.length - 1];

            if (e.shiftKey) {
                if (document.activeElement === first) {
                    e.preventDefault();
                    last.focus();
                }
            } else {
                if (document.activeElement === last) {
                    e.preventDefault();
                    first.focus();
                }
            }
        };

        // Store so we can remove later
        container._focusTrapHandler = handler;
        container.addEventListener('keydown', handler);
    }

    /**
     * Remove the trap installed by trapFocus.
     *
     * @param {HTMLElement} container
     */
    function releaseFocus(container) {
        if (container && container._focusTrapHandler) {
            container.removeEventListener('keydown', container._focusTrapHandler);
            delete container._focusTrapHandler;
        }
    }

    window.lf = window.lf || {};
    window.lf.FocusTrap = { trapFocus: trapFocus, releaseFocus: releaseFocus };
})();
