/**
 * Dialog Component - Modal overlay behavior
 *
 * Provides keyboard and mouse interaction for dialog overlays:
 * - Close on ESC key
 * - Close on clicking outside the dialog (overlay)
 * - Focus management for accessibility (trap + restore)
 *
 * Dialog content is loaded via HTMX from /ui/dialog/confirm
 *
 * Usage:
 *   <button hx-get="/ui/dialog/confirm"
 *           hx-vals='{"title":"Confirm","message":"..."}'
 *           hx-target="#dialog">
 *     Show Dialog
 *   </button>
 */

(function() {
    'use strict';

    // P0: remember the element that triggered the dialog so we can restore focus
    let _opener = null;

    // P4: init() re-runs on every htmx:afterSwap whose target carries
    // data-dialog-overlay (see the listener at the bottom of this file). appUrl /
    // checkUrl are shared module state — declared once — so the one-time
    // window/hashchange/popstate listeners and the re-created MutationObserver +
    // interval below always agree on the same URL-tracking state instead of
    // drifting into two independent generations of it.
    let appUrl = window.location.href;

    // Watch for URL changes and revert if it's a dialog or action URL
    // Action URLs (e.g., /action/client/table) are used for HTMX partial refreshes
    // and should not appear in the browser's address bar.
    const checkUrl = function() {
        const currentUrl = window.location.href;
        const isDialogUrl = currentUrl.includes('/ui/dialog/confirm') || currentUrl.includes('/ui/dialog/alert');
        const isActionUrl = currentUrl.includes('/action/') && currentUrl.includes('/table');

        if (isDialogUrl || isActionUrl) {
            // Revert to the last known app URL immediately
            history.replaceState(null, '', appUrl);
        } else if (!currentUrl.includes('/ui/dialog/')) {
            // Update appUrl if we navigated to a non-dialog, non-action URL (normal navigation)
            appUrl = currentUrl;
        }
    };

    // P4: handles for the two MutationObservers + the checkUrl interval, reused
    // across init() re-entries so a re-init disconnects/clears the previous
    // instance instead of stacking another one on top.
    let urlObserver = null;
    let checkUrlIntervalId = null;
    let containerObserver = null;

    // P5: set by the delegated [data-dialog-confirm] handler and read (then
    // cleared) by closeDialog, which dispatches dialog:cancel only when the
    // close was NOT preceded by a confirm. One dialog lifecycle emits exactly
    // one of dialog:confirm / dialog:cancel.
    let _confirmed = false;

    // P5: id of the pending close-animation timer. closeDialog schedules the
    // hide + content clear 200ms out; a dialog opened inside that window would
    // be wiped by the previous dialog's timer, so confirm() clears it first.
    let _closeTimer = null;

    // ========================================
    // ACTION-ERROR SURFACING
    // ========================================

    /**
     * Surface a row-action error (HX-Error-Message on a 4xx) as an error toast.
     * Defensive against the toast module's public-API shape: prefers the
     * canonical window.lf.ui.Toast, falls back to the lf.Toast back-compat alias,
     * and no-ops (console) if neither loaded. Never throws.
     */
    function showDialogActionError(message) {
        if (!message) return;
        var toast = (window.lf && window.lf.ui && window.lf.ui.Toast)
            || (window.lf && window.lf.Toast)
            || null;
        if (toast && typeof toast.show === 'function') {
            toast.show(message, 'error');
            return;
        }
        console.error('Action failed:', message);
    }

    // ========================================
    // INERT HELPERS (P3)
    // ========================================

    function setBackgroundInert(inert) {
        // Only inert the sidebar — the dialog overlay + focus-trap handles the rest.
        // Note: inerting <main> causes <body> to intercept pointer events on dialog buttons.
        var sidebar = document.getElementById('sidebar');
        if (sidebar) {
            if (inert) {
                sidebar.setAttribute('inert', '');
            } else {
                sidebar.removeAttribute('inert');
            }
        }
    }

    /**
     * Close the dialog overlay
     */
    function closeDialog() {
        const dialog = document.querySelector('[data-dialog-overlay]');
        if (!dialog) return;

        // P5: a close that was not preceded by a confirm is a cancel. Read and
        // reset before anything below can re-enter.
        const wasConfirmed = _confirmed;
        _confirmed = false;

        // P0: release focus trap
        if (window.lf && window.lf.FocusTrap) window.lf.FocusTrap.releaseFocus(dialog);

        dialog.classList.remove('visible');

        // P3: restore background interactivity
        setBackgroundInert(false);

        // P0: restore focus to the opener
        if (_opener && typeof _opener.focus === 'function') {
            _opener.focus();
        }
        _opener = null;

        _closeTimer = setTimeout(() => {
            _closeTimer = null;
            dialog.hidden = true;
            // Clear content after animation
            const container = dialog.querySelector('[data-dialog-container]');
            if (container) {
                container.innerHTML = '';
            }
        }, 200);

        // P5: cancel signal for promise-based callers. Dispatched on the same
        // element as dialog:confirm so both live on one listener target.
        if (!wasConfirmed) {
            dialog.dispatchEvent(new CustomEvent('dialog:cancel', {
                detail: { success: false }
            }));
        }
    }

    /**
     * Open the dialog overlay
     */
    function openDialog() {
        const dialog = document.querySelector('[data-dialog-overlay]');
        if (!dialog) return;

        // P0: capture opener before the dialog steals focus
        _opener = document.activeElement;

        // P5: a fresh dialog lifecycle starts unconfirmed.
        _confirmed = false;

        dialog.hidden = false;
        // Trigger reflow for animation
        void dialog.offsetWidth;
        dialog.classList.add('visible');

        // P3: suppress background while dialog is open
        setBackgroundInert(true);

        // P0: label the dialog by its title; install focus trap; move focus inside
        setTimeout(function() {
            var container = dialog.querySelector('[data-dialog-container]');
            if (container) {
                // P0: find .dialog-title, assign id, wire aria-labelledby
                // P5: a title-less dialog must not keep a dangling
                // aria-labelledby — an attribute pointing at an id that does
                // not exist gives assistive tech an empty accessible name,
                // which is worse than no label at all. The shell markup ships
                // the attribute statically, so it is removed here rather than
                // merely left unset — but only when it truly resolves to
                // nothing, so a label living outside this container is kept.
                var titleEl = container.querySelector('.dialog-title');
                if (titleEl) {
                    titleEl.id = 'dialogTitle';
                    container.setAttribute('aria-labelledby', 'dialogTitle');
                } else {
                    var labelledBy = container.getAttribute('aria-labelledby');
                    if (labelledBy && !document.getElementById(labelledBy)) {
                        container.removeAttribute('aria-labelledby');
                    }
                }
            }

            // P0: install focus trap on the full overlay
            if (window.lf && window.lf.FocusTrap) window.lf.FocusTrap.trapFocus(dialog);

            // Move focus to first focusable element inside dialog
            var focusable = dialog.querySelector(
                'button:not([disabled]), [href], input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
            );
            if (focusable) focusable.focus();
        }, 50);
    }

    // ========================================
    // PROMISE CONFIRMATION API (P5)
    // ========================================

    /**
     * Ask the operator to confirm an action. Returns Promise<boolean>.
     *
     * Contract:
     *  - resolves true ONLY when [data-dialog-confirm] is activated
     *  - resolves false on [data-dialog-close] / ESC / overlay click / close()
     *  - NEVER rejects. Every failure path degrades to the browser's own
     *    prompt, which is the behaviour that ships today, so a caller can
     *    always await this without a catch and never silently lose an action.
     *  - the degrade lives inside this function, not in its callers, so every
     *    future caller inherits it.
     *
     * Rendering invariant: every caller-supplied string reaches the DOM through
     * textContent. This function never assigns innerHTML and never builds
     * markup from a template literal. A confirm message can carry record data,
     * and textContent cannot execute markup at all — a stronger guarantee than
     * any escaping discipline, and one a template-context bug cannot defeat.
     *
     * Label invariant: no English literal is substituted here. Copy resolves
     * per-call option -> <body data-lf-dialog-*> -> overlay data-default-*
     * -> empty string. A missing label renders an empty node.
     *
     * options: { message, title, confirmLabel, cancelLabel, variant, testid }
     */
    function confirmDialog(options) {
        var o = options || {};
        var message = typeof o.message === 'string' ? o.message : '';

        function nativePrompt() {
            try {
                return !!window.confirm(message);
            } catch (err) {
                return false;
            }
        }

        var dialog = null;
        try {
            dialog = document.querySelector('[data-dialog-overlay]');
        } catch (err) {
            dialog = null;
        }
        // No overlay on this page (the shell did not render one, or it was
        // swapped away): fall back to the native prompt rather than dropping
        // the confirmation.
        if (!dialog) {
            return Promise.resolve(nativePrompt());
        }

        return new Promise(function(resolve) {
            var settled = false;

            function onConfirmEvent() { settle(true); }
            function onCancelEvent() { settle(false); }

            function settle(value) {
                if (settled) return;
                settled = true;
                try {
                    dialog.removeEventListener('dialog:confirm', onConfirmEvent);
                    dialog.removeEventListener('dialog:cancel', onCancelEvent);
                } catch (err) {
                    // listener target already gone — nothing to detach
                }
                resolve(!!value);
            }

            try {
                var bodyData = (document.body && document.body.dataset) || {};
                var overlayData = dialog.dataset || {};

                var title = o.title || bodyData.lfDialogConfirmTitle || overlayData.defaultTitle || '';
                var confirmLabel = o.confirmLabel || bodyData.lfDialogConfirmLabel || overlayData.defaultConfirm || '';
                var cancelLabel = o.cancelLabel || bodyData.lfDialogCancelLabel || overlayData.defaultCancel || '';
                var variant = o.variant || 'default';
                var testid = o.testid || 'dialog';

                var container = dialog.querySelector('[data-dialog-container]');
                if (!container) {
                    settle(nativePrompt());
                    return;
                }

                // A previous dialog's close animation owns a pending timer that
                // hides the overlay and clears this container; cancel it so the
                // dialog opened below survives it.
                if (_closeTimer !== null) {
                    clearTimeout(_closeTimer);
                    _closeTimer = null;
                }

                while (container.firstChild) {
                    container.removeChild(container.firstChild);
                }

                if (title) {
                    var header = document.createElement('div');
                    header.className = 'dialog-header';
                    var titleEl = document.createElement('h3');
                    titleEl.className = 'dialog-title';
                    titleEl.setAttribute('data-testid', 'dialog-title');
                    titleEl.textContent = title;
                    header.appendChild(titleEl);
                    container.appendChild(header);
                }

                var bodyEl = document.createElement('div');
                bodyEl.className = 'dialog-body';
                var messageEl = document.createElement('p');
                messageEl.className = 'dialog-message';
                messageEl.setAttribute('data-testid', 'dialog-message');
                messageEl.textContent = message;
                bodyEl.appendChild(messageEl);
                container.appendChild(bodyEl);

                var footer = document.createElement('div');
                footer.className = 'dialog-footer';

                // Cancel first: openDialog focuses the first focusable node in
                // the overlay, and the non-destructive control is the correct
                // initial focus target for a confirmation.
                var cancelBtn = document.createElement('button');
                cancelBtn.type = 'button';
                cancelBtn.className = 'dialog-btn dialog-btn-cancel';
                cancelBtn.setAttribute('data-dialog-close', '');
                cancelBtn.setAttribute('data-testid', testid + '-cancel-btn');
                cancelBtn.textContent = cancelLabel;
                footer.appendChild(cancelBtn);

                // Class order matches the server-rendered fragment exactly, so
                // both render paths are styled by the same rules.
                var confirmBtn = document.createElement('button');
                confirmBtn.type = 'button';
                confirmBtn.className = 'dialog-btn dialog-btn-confirm dialog-btn-' + variant;
                confirmBtn.setAttribute('data-dialog-confirm', '');
                confirmBtn.setAttribute('data-testid', testid + '-confirm-btn');
                confirmBtn.textContent = confirmLabel;
                footer.appendChild(confirmBtn);

                container.appendChild(footer);

                // Empty action URL: the delegated confirm handler takes its
                // event-only branch and dispatches dialog:confirm. This path
                // never enters the raw-fetch branch, so it issues no request
                // and re-derives no request guard of its own.
                dialog.dataset.actionUrl = '';

                dialog.addEventListener('dialog:confirm', onConfirmEvent);
                dialog.addEventListener('dialog:cancel', onCancelEvent);

                // Reuses the shared open/close pair verbatim: focus trap,
                // sidebar inert, opener capture and restore all come from
                // there and are not reimplemented here.
                openDialog();
            } catch (err) {
                try {
                    closeDialog();
                } catch (closeErr) {
                    // overlay already gone — nothing to close
                }
                settle(nativePrompt());
            }
        });
    }

    // Initialize when DOM is ready
    function init() {
        const dialog = document.querySelector('[data-dialog-overlay]');
        if (!dialog) return;

        // P4: init() re-runs on every htmx:afterSwap whose target carries
        // data-dialog-overlay (see the listener at the bottom of this file). The
        // block below registers listeners on persistent targets (window, document,
        // document.body) that must be added exactly once — re-adding them on every
        // re-entry would stack a fresh duplicate registration each time. The
        // window.__lfDialogInit flag makes that block a one-time no-op after the
        // first successful init().
        if (!window.__lfDialogInit) {
            window.__lfDialogInit = true;

            // Check URL on hashchange and popstate
            window.addEventListener('hashchange', checkUrl);
            window.addEventListener('popstate', checkUrl);

            // Close on overlay click (click outside dialog)
            dialog.addEventListener('click', function(e) {
                if (e.target === dialog) {
                    closeDialog();
                }
            });

            // Close on ESC key
            document.addEventListener('keydown', function(e) {
                if (e.key === 'Escape' && !dialog.hidden && dialog.classList.contains('visible')) {
                    closeDialog();
                }
            });

            // Close button handler (delegated)
            dialog.addEventListener('click', function(e) {
                if (e.target.hasAttribute('data-dialog-close')) {
                    closeDialog();
                }
            });

            // Confirm button handler (delegated) - handles action URLs
            dialog.addEventListener('click', function(e) {
                if (e.target.hasAttribute('data-dialog-confirm')) {
                    // P5: mark the lifecycle confirmed before any branch below
                    // can close the dialog, so the close that follows is not
                    // reported as a cancel. Set ahead of the HTMX early return
                    // too: that close arrives later, from htmx:afterRequest.
                    _confirmed = true;

                    // If button has hx-post or hx-get, HTMX handles it
                    if (e.target.hasAttribute('hx-post') || e.target.hasAttribute('hx-get')) {
                        return; // Let HTMX handle it
                    }

                    // Check if dialog has an action URL stored
                    const actionUrl = dialog.dataset.actionUrl;
                    if (actionUrl) {
                        // Attach the workspace CSRF header + signed
                        // action_workspace_guard fields (_workspace_id /
                        // _workspace_id_sig). Without them this raw fetch fails
                        // closed (CSRF 403 / guard 409) — the pre-existing app-wide
                        // row-action limitation. Helpers are defined in scripts.html;
                        // fall back to the bare request if (unexpectedly) unavailable.
                        var actHeaders = (window.lf && window.lf.actionRequestHeaders)
                            ? window.lf.actionRequestHeaders()
                            : { 'HX-Request': 'true', 'Content-Type': 'application/x-www-form-urlencoded' };
                        var actBody = (window.lf && window.lf.actionGuardBody)
                            ? window.lf.actionGuardBody(actionUrl)
                            : '';
                        // Perform the action
                        fetch(actionUrl, {
                            method: 'POST',
                            headers: actHeaders,
                            body: actBody
                        }).then(function(response) {
                            // Always close dialog after server response
                            closeDialog();

                            if (response.ok) {
                                // Refresh table if refresh URL is available
                                // HTMX ajax target must be a CSS selector string, not a DOM element.
                                // Passing a DOM element as the target causes HTMX to do a full page
                                // navigation instead of a partial swap.
                                const tableCard = document.querySelector('.table-card[data-refresh-url]');
                                if (tableCard && typeof htmx !== 'undefined') {
                                    htmx.ajax('GET', tableCard.dataset.refreshUrl, {
                                        target: `#${tableCard.id}`,  // Use ID selector string, not element
                                        swap: 'outerHTML',
                                        pushUrl: false  // Don't update browser URL
                                    });
                                }

                                // Trigger custom event for other listeners (like bulk-action.js)
                                dialog.dispatchEvent(new CustomEvent('dialog:confirm', {
                                    detail: { url: actionUrl, success: true }
                                }));
                            } else {
                                // Fail-loud: surface the server's HX-Error-Message
                                // (the 4xx row-action convention — e.g. a referential
                                // delete guard enumerating active dependents) as an
                                // error toast. The dialog has already closed, so the
                                // drawer's inline alert path has nowhere to render;
                                // a toast is the app-wide surface for a closed-dialog
                                // action error. Mirrors sheet.js's HX-Error-Message read.
                                var dlgErr = response.headers.get('HX-Error-Message');
                                if (dlgErr) {
                                    showDialogActionError(dlgErr);
                                } else {
                                    console.error('Action failed:', response.status);
                                }
                                dialog.dispatchEvent(new CustomEvent('dialog:confirm', {
                                    detail: { url: actionUrl, success: false, status: response.status, errorMessage: dlgErr || '' }
                                }));
                            }
                        }).catch(function(err) {
                            console.error('Action error:', err);
                            closeDialog();
                            dialog.dispatchEvent(new CustomEvent('dialog:confirm', {
                                detail: { url: actionUrl, success: false, error: err }
                            }));
                        });
                    } else {
                        // No action URL - just trigger the event for callbacks
                        dialog.dispatchEvent(new CustomEvent('dialog:confirm', {
                            detail: { success: true }
                        }));
                        // Close the dialog
                        closeDialog();
                    }
                }
            });

            // Handle HTMX responses for confirm buttons inside the dialog.
            // When the confirm button has hx-post, the click handler returns early
            // and lets HTMX handle the POST. This listener closes the dialog and
            // refreshes the table after HTMX completes the request.
            document.body.addEventListener('htmx:afterRequest', function(e) {
                var elt = e.detail.elt;
                if (elt && elt.closest('[data-dialog-overlay]')) {
                    if (e.detail.successful) {
                        // Close dialog on success
                        closeDialog();

                        // Refresh table to reflect the change (deleted row, status update, etc.)
                        var tableCard = document.querySelector('.table-card[data-refresh-url]');
                        if (tableCard && typeof htmx !== 'undefined') {
                            htmx.ajax('GET', tableCard.dataset.refreshUrl, {
                                target: '#' + tableCard.id,
                                swap: 'outerHTML',
                                pushUrl: false
                            });
                        } else {
                            // Fallback: reload page if no HTMX refresh target available
                            setTimeout(function() { window.location.reload(); }, 100);
                        }

                        // Trigger custom event for other listeners (like bulk-action.js)
                        dialog.dispatchEvent(new CustomEvent('dialog:confirm', {
                            detail: { success: true }
                        }));
                    } else {
                        // On error: log and keep dialog open so user can retry or cancel
                        var status = e.detail.xhr ? e.detail.xhr.status : 'unknown';
                        console.error('Dialog action failed with status:', status);
                    }
                }
            });

            // P1: before outerHTML swap into dialog container, capture focused element identity.
            // Stored in closure variable — DOM element is destroyed by outerHTML swap.
            var _dialogFocusId = null;
            document.body.addEventListener('htmx:beforeSwap', function(e) {
                var container = dialog.querySelector('[data-dialog-container]');
                if (container && e.detail.target === container) {
                    var el = document.activeElement;
                    _dialogFocusId = el && el.id ? el.id : null;
                }
            });

            // P1: after htmx:afterSettle, restore focus by id lookup
            document.body.addEventListener('htmx:afterSettle', function(e) {
                if (!_dialogFocusId) return;
                var container = dialog.querySelector('[data-dialog-container]');
                if (!container) { _dialogFocusId = null; return; }
                var restored = document.getElementById(_dialogFocusId);
                if (restored && container.contains(restored) && typeof restored.focus === 'function') {
                    restored.focus();
                }
                _dialogFocusId = null;
            });

            // Expose functions globally under lf namespace
            window.lf = window.lf || {};
            window.lf.ui = window.lf.ui || {};
            window.lf.ui.Dialog = { open: openDialog, close: closeDialog, confirm: confirmDialog };
        }

        // P4: the URL-revert MutationObserver + its 100ms interval fallback, and
        // the auto-open MutationObserver, are re-created on every init() call
        // (first run and every re-entry alike) so they always observe the live
        // DOM nodes; the prior instance is disconnected/cleared first so a
        // re-init never stacks a second/third one on top of it.
        if (urlObserver) {
            urlObserver.disconnect();
        }
        urlObserver = new MutationObserver(checkUrl);
        urlObserver.observe(document.documentElement, {
            childList: true,
            subtree: true
        });

        if (checkUrlIntervalId !== null) {
            clearInterval(checkUrlIntervalId);
        }
        checkUrlIntervalId = setInterval(checkUrl, 100);

        // Watch for HTMX content load and auto-open
        if (containerObserver) {
            containerObserver.disconnect();
        }
        containerObserver = new MutationObserver(function(mutations) {
            mutations.forEach(function(mutation) {
                if (mutation.type === 'childList' && mutation.addedNodes.length) {
                    const container = dialog.querySelector('[data-dialog-container]');
                    if (container && container.children.length > 0 && dialog.hidden) {
                        openDialog();
                    }
                }
            });
        });
        containerObserver.observe(dialog, {
            childList: true,
            subtree: true
        });
    }

    // Initialize on DOM ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    // Re-initialize after HTMX swaps (for dialogs that might be replaced)
    document.addEventListener('htmx:afterSwap', function(e) {
        if (e.target.hasAttribute('data-dialog-overlay')) {
            init();
        }
    });
})();
