/**
 * htmx:confirm -> pyeza dialog bridge.
 *
 * htmx fires a cancelable htmx:confirm before it falls through to the browser's
 * own window.confirm(). This listener cancels that fallback and asks the
 * question through the app-shell dialog instead, then re-enters htmx's own
 * pipeline with issueRequest(true).
 *
 * Never-drop invariant: this file issues no request, builds no header and
 * reconstructs no request guard. issueRequest(true) re-enters htmx from the
 * ORIGINAL element, so the request htmx builds is the request it would have
 * built without this bridge — every signed form value, every inherited
 * attribute and every configRequest hook applies unchanged. Any design where
 * the confirmation layer sends the action itself would have to re-derive those,
 * and is the one thing this bridge must never do.
 *
 * Fail-to-today invariant: every degrade path (no dialog API, no overlay, an
 * htmx whose detail no longer carries issueRequest) ends at the native prompt.
 * No path drops a confirmed action and no path fires an unconfirmed one.
 *
 * This is deliberately its own file rather than an addition to dialog.js:
 * dialog.js does its work inside an init() that returns early when the page
 * rendered no overlay, and this listener must register unconditionally —
 * degrading gracefully is precisely its contract.
 */

(function() {
    'use strict';

    // The four shells hand-list their <script src> tags and some navigation
    // paths re-execute them. A second registration would ask the same question
    // twice for one click, so registration is one-time. Playwright also asserts
    // this flag per shell: a shell that silently missed the script tag is the
    // documented failure mode for a hand-listed script set.
    if (window.__lfConfirmBridge) return;
    window.__lfConfirmBridge = true;

    // Present on the trigger element for exactly as long as its dialog is open.
    var PENDING_ATTR = 'data-lf-confirm-pending';

    // One confirmation at a time. A second htmx:confirm arriving while a dialog
    // is open is dropped AFTER preventDefault, so the dropped click sends
    // nothing — a double-click cannot produce two dialogs or two requests.
    var _pending = false;

    /**
     * Read an attribute off the nearest ancestor that carries it, so a value
     * set on a row or a form applies to the control inside it.
     */
    function inherited(elt, name) {
        if (!elt || typeof elt.closest !== 'function') return '';
        var host;
        try {
            host = elt.closest('[' + name + ']');
        } catch (err) {
            return '';
        }
        if (!host) return '';
        var value = host.getAttribute(name);
        return typeof value === 'string' ? value : '';
    }

    /**
     * Resolve the dialog function at EVENT time, never at load time. dialog.js
     * exposes lf.ui.Dialog inside its own one-time init, which returns early on
     * a page whose shell rendered no overlay, and the shells list the two files
     * independently. A missing API is not a reason to stop asking the question.
     */
    function resolveConfirm() {
        var api = window.lf && window.lf.ui && window.lf.ui.Dialog;
        if (api && typeof api.confirm === 'function') return api.confirm;
        return function(options) {
            var message = (options && options.message) || '';
            var answer;
            try {
                answer = window.confirm(message);
            } catch (err) {
                answer = false;
            }
            return Promise.resolve(!!answer);
        };
    }

    document.addEventListener('htmx:confirm', function(evt) {
        var detail = evt && evt.detail;

        // htmx fires this for every request it makes, not only confirmed ones.
        // Without a question there is nothing to ask, so leave it alone.
        if (!detail || !detail.question) return;

        // An htmx whose detail no longer carries issueRequest leaves no way to
        // re-enter the pipeline. Return WITHOUT cancelling so htmx runs its own
        // native prompt: the action stays gated, which is the property that
        // must not regress. This is the one deliberate fail-open, and it is
        // safe precisely because the native path still asks the operator.
        if (typeof detail.issueRequest !== 'function') return;

        var elt = detail.elt;

        // Mandatory. htmx aborts only when the event is cancelled — its
        // dispatcher returns dispatchEvent()'s own result, so returning false
        // from a listener does nothing. Nothing has been sent at this point:
        // the xhr does not exist until issueRequest(true) re-enters.
        evt.preventDefault();

        if (_pending) return;
        _pending = true;
        if (elt && typeof elt.setAttribute === 'function') {
            try {
                elt.setAttribute(PENDING_ATTR, '');
            } catch (err) {
                // attribute is a test/diagnostic hook only — never gate on it
            }
        }

        function release() {
            _pending = false;
            if (elt && typeof elt.removeAttribute === 'function') {
                try {
                    elt.removeAttribute(PENDING_ATTR);
                } catch (err) {
                    // same: the attribute is diagnostic, its absence is benign
                }
            }
        }

        // The message always comes from detail.question, which htmx resolved
        // through its inherited-attribute lookup — reading hx-confirm off the
        // element directly would miss a value set on an ancestor.
        var options = {
            message: detail.question,
            title: inherited(elt, 'data-confirm-title'),
            confirmLabel: inherited(elt, 'data-confirm-label'),
            cancelLabel: inherited(elt, 'data-cancel-label'),
            variant: inherited(elt, 'data-confirm-variant'),
            testid: inherited(elt, 'data-confirm-testid')
        };

        var asked;
        try {
            asked = resolveConfirm()(options);
        } catch (err) {
            asked = null;
        }

        // A confirm function that returned no promise cannot answer, and the
        // request is already cancelled. Release the single-flight token so the
        // operator's next click is not swallowed too.
        if (!asked || typeof asked.then !== 'function') {
            release();
            return;
        }

        asked.then(function(confirmed) {
            release();
            if (!confirmed) return;
            // A swap can detach the trigger while the dialog is open. Issuing
            // from a detached element yields an htmx target error rather than
            // the request, so treat it as not issuable.
            if (elt && elt.isConnected === false) return;
            detail.issueRequest(true);
        }, function() {
            // The dialog API's contract is that it never rejects. If a future
            // one does, the action stays unsent: an unanswered question must
            // never be treated as a yes.
            release();
        });
    });
})();
