/**
 * form-password — toggle password visibility via the eye-icon button.
 *
 * Wires every [data-form-password] block on the page. Idempotent: re-running
 * on the same node is a no-op (we mark wired nodes with
 * data-form-password-wired="true").
 *
 * Activates on initial DOMContentLoaded and again on htmx:afterSwap so
 * drawer-loaded forms (e.g. change-password used inside the app shell)
 * wire up automatically.
 *
 * No dependencies. Matches the IIFE pattern used by form-color-field.js.
 */
(function () {
    'use strict';

    function wire(root) {
        if (!root || root.dataset.formPasswordWired === 'true') return;

        var input = root.querySelector('input.form-password-input');
        var btn = root.querySelector('[data-form-password-toggle]');
        if (!input || !btn) return;

        var eyeIcon = btn.querySelector('[data-icon-show]');
        var eyeOffIcon = btn.querySelector('[data-icon-hide]');

        var labelShow = btn.dataset.labelShow || btn.getAttribute('aria-label') || 'Show password';
        var labelHide = btn.dataset.labelHide || 'Hide password';

        function setShown(shown) {
            input.type = shown ? 'text' : 'password';
            btn.setAttribute('aria-pressed', shown ? 'true' : 'false');
            btn.setAttribute('aria-label', shown ? labelHide : labelShow);
            if (eyeIcon) eyeIcon.hidden = shown;
            if (eyeOffIcon) eyeOffIcon.hidden = !shown;
        }

        btn.addEventListener('click', function (e) {
            e.preventDefault();
            setShown(input.type === 'password');
        });

        // Mirror the disabled state onto the wrapper so the toggle can be
        // visually muted in browsers without :has() support.
        function syncDisabled() {
            if (input.disabled) {
                root.classList.add('is-disabled');
            } else {
                root.classList.remove('is-disabled');
            }
        }
        syncDisabled();

        root.dataset.formPasswordWired = 'true';
    }

    function wireAll(scope) {
        var nodes = (scope || document).querySelectorAll('[data-form-password]');
        for (var i = 0; i < nodes.length; i++) wire(nodes[i]);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function () { wireAll(); });
    } else {
        wireAll();
    }

    document.addEventListener('htmx:afterSwap', function (evt) {
        var scope = evt && evt.target ? evt.target : document;
        wireAll(scope);
    });

    // Expose for tests / programmatic re-wiring.
    if (typeof window !== 'undefined') {
        window.lf = window.lf || {};
        window.lf.FormPassword = { wire: wire, wireAll: wireAll };
    }
}());
