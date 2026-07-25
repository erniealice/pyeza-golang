/**
 * Toast Component — centralized notification API.
 *
 * Single source of truth for transient toast notifications across the app.
 * Supersedes the inline `showToast` that previously lived in sheet.js.
 *
 * Public API (window.lf.Toast):
 *   show(message, state)
 *     - string message + optional state: "success" | "error" | "warning" | "info"
 *   show({title, message, state, duration, link, dismissible, id, class, testid})
 *     - structured form: link is {url, label, icon?}, duration in ms ("0" disables)
 *     - state "progress" renders a CSS-animated spinner icon (outer class toast-state-progress,
     *       not toast-progress — that is the timer bar); pair it
 *       with duration "0" + dismissible:false for a persistent indicator that
 *       another owner dismisses via dismiss(toastEl) (e.g. the download indicator).
 *     - testid sets data-testid on the toast element.
 *   dismiss(toastEl)        — start exit animation on a single toast
 *   dismissAll()            — dismiss every visible toast
 *
 * Server-side trigger contract (auto-dispatched by HTMX from HX-Trigger header):
 *   {"showToast": "Saved."}                    — string body → simple toast
 *   {"showToast": {"message": "...", "state": "success"}} — object body → structured
 *   {"pyeza:toast": {message, state, link, ...}}  — always-structured event
 *
 * i18n flow:
 *   Default labels (saved-message text, dismiss aria-label) are read from
 *   <body data-lf-toast-*> attributes set by app-shell.html via {{.T ...}}.
 *   Falls back to nothing/blank when an attribute is missing — no English leaks.
 *
 * Auto-dismiss is driven by data-duration on the toast element. Toasts with
 * duration "0" persist until manually closed.
 */

(function () {
    'use strict';

    // ========================================
    // CONSTANTS — DOM markup
    // ========================================

    var DEFAULT_DURATION = '4000';
    var DEFAULT_DELAY = '0';

    // Inline SVGs match pyeza icon templates (icon-check-circle, icon-x-circle,
    // icon-alert-triangle, icon-info, icon-x). Kept inline so toast.js has no
    // template dependency at runtime.
    var ICONS = {
        success: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>',
        error: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>',
        warning: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
        info: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>',
        // Spinner rotation is driven by the .toast-spinner CSS animation (external
        // stylesheet — CSP-safe) instead of SVG SMIL, so prefers-reduced-motion
        // can freeze it to a static arc (a media query cannot stop SMIL).
        progress: '<svg class="toast-spinner" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="9" stroke-opacity="0.25"/><path d="M21 12a9 9 0 0 0-9-9"/></svg>'
    };

    var CLOSE_ICON = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';

    // ========================================
    // I18N — read defaults from <body data-lf-toast-*>
    // ========================================

    function bodyDataset() {
        return (document.body && document.body.dataset) || {};
    }

    function dismissAriaLabel() {
        // app-shell.html sets data-lf-toast-dismiss from CommonLabels.Toast.Dismiss
        return bodyDataset().lfToastDismiss || '';
    }

    function savedMessage() {
        // Used by sheet.js when a generic form succeeds — pulls lyngua text.
        return bodyDataset().lfToastSaved || '';
    }

    // ========================================
    // CORE — render
    // ========================================

    function getContainer() {
        return document.getElementById('toast-container');
    }

    function isSafeToastURL(url) {
        if (typeof url !== 'string' || url.length === 0) return false;
        // Allow relative URLs (start with "/" or "?" or "#" or no scheme).
        if (/^[\/?#]/.test(url)) return true;
        // Allow only http(s) absolute URLs.
        return /^https?:\/\//i.test(url);
    }

    function escapeHTML(s) {
        if (s == null) return '';
        return String(s)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    /**
     * Build and append a toast to #toast-container.
     * Returns the toast element (or null if container is missing).
     *
     * @param {Object} opts - normalized options
     * @param {string} opts.message
     * @param {string} [opts.state="info"]
     * @param {string} [opts.title]
     * @param {string} [opts.duration="4000"] — ms; "0" disables auto-dismiss
     * @param {Object} [opts.link] — {url, label, icon?}; renders inline link
     * @param {boolean} [opts.dismissible=true]
     * @param {string} [opts.id]
     * @param {string} [opts.class]
     * @param {string} [opts.testid]
     */
    function render(opts) {
        var container = getContainer();
        if (!container) return null;

        var state = opts.state || 'info';
        var duration = opts.duration != null ? String(opts.duration) : DEFAULT_DURATION;
        var delay = opts.delay != null ? String(opts.delay) : DEFAULT_DELAY;
        var dismissible = opts.dismissible !== false;
        var isUrgent = (state === 'error' || state === 'warning');

        var toast = document.createElement('div');
        // The progress state gets a dedicated outer class: 'toast-progress' is the
        // absolutely-positioned 2px timer-bar element, so reusing it for the outer
        // element collapses the toast to an invisible bar.
        var stateClass = state === 'progress' ? 'toast-state-progress' : 'toast-' + state;
        var classes = 'toast ' + stateClass;
        if (opts.class) classes += ' ' + opts.class;
        toast.className = classes;
        if (opts.id) toast.id = opts.id;
        if (opts.testid) toast.setAttribute('data-testid', opts.testid);
        toast.setAttribute('role', isUrgent ? 'alert' : 'status');
        toast.setAttribute('aria-live', isUrgent ? 'assertive' : 'polite');
        toast.setAttribute('data-duration', duration);
        toast.setAttribute('data-delay', delay);

        // Body — title + message + optional link.
        // textContent is used for the message itself (XSS-safe). The link label
        // is escaped via escapeHTML before going into innerHTML.
        var bodyParts = [];
        if (opts.title) {
            bodyParts.push('<div class="toast-title">' + escapeHTML(opts.title) + '</div>');
        }
        bodyParts.push('<div class="toast-message"></div>');
        if (opts.link && opts.link.label && isSafeToastURL(opts.link.url)) {
            bodyParts.push(
                '<a class="toast-link" href="' + escapeHTML(opts.link.url) + '">' +
                    escapeHTML(opts.link.label) +
                '</a>'
            );
        }

        var dismissAttrs = '';
        if (dismissible) {
            var dismissLabel = escapeHTML(opts.dismissAriaLabel || dismissAriaLabel());
            dismissAttrs =
                '<button type="button" class="toast-close" aria-label="' + dismissLabel + '">' +
                    CLOSE_ICON +
                '</button>';
        }

        var progress = '';
        if (duration !== '0') {
            progress = '<div class="toast-progress" style="animation-duration: ' +
                escapeHTML(duration) + 'ms; animation-delay: ' +
                escapeHTML(delay) + 'ms;"></div>';
        }

        toast.innerHTML =
            '<div class="toast-icon">' + (ICONS[state] || ICONS.info) + '</div>' +
            '<div class="toast-body">' + bodyParts.join('') + '</div>' +
            dismissAttrs +
            progress;

        // Set message via textContent so server text is never HTML-parsed.
        var msgEl = toast.querySelector('.toast-message');
        if (msgEl) msgEl.textContent = opts.message || '';

        // Wire close button (avoids inline onclick).
        var closeBtn = toast.querySelector('.toast-close');
        if (closeBtn) {
            closeBtn.addEventListener('click', function () {
                dismiss(toast);
            });
        }

        // Mark wired BEFORE append so the MutationObserver (initExistingToasts)
        // doesn't fire a duplicate attachAutoDismiss + close-listener for the
        // same toast. The observer skips when dataset.lfToastWired is set.
        toast.dataset.lfToastWired = '1';
        container.appendChild(toast);
        attachAutoDismiss(toast);
        return toast;
    }

    function dismiss(toast) {
        if (!toast || !toast.classList) return;
        toast.classList.add('toast-exit');
    }

    function dismissAll() {
        var container = getContainer();
        if (!container) return;
        container.querySelectorAll('.toast').forEach(dismiss);
    }

    // ========================================
    // PUBLIC SHOW — accepts string or options object
    // ========================================

    function show(messageOrOpts, stateOrUndef) {
        if (messageOrOpts == null) return null;
        var opts;
        if (typeof messageOrOpts === 'string') {
            opts = { message: messageOrOpts, state: stateOrUndef || 'success' };
        } else if (typeof messageOrOpts === 'object') {
            opts = messageOrOpts;
        } else {
            return null;
        }
        return render(opts);
    }

    // ========================================
    // AUTO-DISMISS — MutationObserver-free, per-toast timers
    // ========================================

    function attachAutoDismiss(toast) {
        var duration = parseInt(toast.dataset.duration || DEFAULT_DURATION, 10);
        var delay = parseInt(toast.dataset.delay || DEFAULT_DELAY, 10);

        if (delay > 0) {
            toast.classList.add('toast--delayed');
            setTimeout(function () {
                toast.classList.remove('toast--delayed');
            }, delay);
        }

        if (duration > 0) {
            setTimeout(function () {
                dismiss(toast);
            }, duration + delay);
        }

        toast.addEventListener('animationend', function (e) {
            if (e.animationName === 'toastSlideOut') {
                toast.remove();
            }
        });
    }

    // ========================================
    // SERVER-SIDE TRIGGER LISTENERS
    // ========================================

    function fromTriggerDetail(detail) {
        // HTMX passes the HX-Trigger value as event.detail (string or object).
        if (detail == null) return null;
        if (typeof detail === 'string') {
            return { message: detail, state: 'success' };
        }
        if (typeof detail === 'object') {
            // Whitelist fields the server may send, ignore everything else.
            return {
                message: detail.message,
                state: detail.state,
                title: detail.title,
                duration: detail.duration,
                link: detail.link,
                dismissible: detail.dismissible,
                id: detail.id,
                class: detail.class
            };
        }
        return null;
    }

    function initTriggerListeners() {
        // Pattern B (back-compat): HX-Trigger {"showToast": "..."} or {message,state}.
        document.body.addEventListener('showToast', function (e) {
            var opts = fromTriggerDetail(e.detail);
            if (!opts) return;
            if (!opts.message) return;
            show(opts);
        });

        // Pattern D (structured): HX-Trigger {"pyeza:toast": {message, state, link, ...}}.
        // Colon-prefixed body events are dispatched by HTMX as-is.
        document.body.addEventListener('pyeza:toast', function (e) {
            var opts = fromTriggerDetail(e.detail);
            if (!opts || !opts.message) return;
            show(opts);
        });
    }

    function initExistingToasts() {
        // Honor any toasts that the server pre-rendered into #toast-container
        // (toast-oob OOB swap pattern). They need timer wiring just like
        // JS-built toasts, since the inline toast.html's toast-init script is
        // superseded by this module.
        var container = getContainer();
        if (!container) return;
        container.querySelectorAll('.toast').forEach(function (t) {
            // Idempotency: only attach if not already wired
            if (t.dataset.lfToastWired) return;
            t.dataset.lfToastWired = '1';
            // Add close-button listener if no inline handler exists.
            var btn = t.querySelector('.toast-close');
            if (btn && !btn.dataset.lfToastWired) {
                btn.dataset.lfToastWired = '1';
                btn.addEventListener('click', function () { dismiss(t); });
            }
            attachAutoDismiss(t);
        });

        // Watch for OOB-swapped toasts arriving after page load.
        var observer = new MutationObserver(function (mutations) {
            mutations.forEach(function (m) {
                m.addedNodes.forEach(function (node) {
                    if (node.nodeType !== 1) return;
                    if (!node.classList || !node.classList.contains('toast')) return;
                    if (node.dataset.lfToastWired) return;
                    node.dataset.lfToastWired = '1';
                    var btn = node.querySelector('.toast-close');
                    if (btn && !btn.dataset.lfToastWired) {
                        btn.dataset.lfToastWired = '1';
                        btn.addEventListener('click', function () { dismiss(node); });
                    }
                    attachAutoDismiss(node);
                });
            });
        });
        observer.observe(container, { childList: true });
    }

    // ========================================
    // INITIALIZATION
    // ========================================

    function init() {
        initTriggerListeners();
        initExistingToasts();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    // ========================================
    // PUBLIC API
    // ========================================

    window.lf = window.lf || {};
    window.lf.ui = window.lf.ui || {};
    window.lf.ui.Toast = {
        show: show,
        dismiss: dismiss,
        dismissAll: dismissAll,
        // Diagnostic helpers — handy in tests/devtools, not part of the contract.
        _render: render,
        _savedMessage: savedMessage,
        _dismissAriaLabel: dismissAriaLabel
    };
})();
