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

        setTimeout(() => {
            dialog.hidden = true;
            // Clear content after animation
            const container = dialog.querySelector('[data-dialog-container]');
            if (container) {
                container.innerHTML = '';
            }
        }, 200);
    }

    /**
     * Open the dialog overlay
     */
    function openDialog() {
        const dialog = document.querySelector('[data-dialog-overlay]');
        if (!dialog) return;

        // P0: capture opener before the dialog steals focus
        _opener = document.activeElement;

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
                var titleEl = container.querySelector('.dialog-title');
                if (titleEl) {
                    titleEl.id = 'dialogTitle';
                    container.setAttribute('aria-labelledby', 'dialogTitle');
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

    // Initialize when DOM is ready
    function init() {
        const dialog = document.querySelector('[data-dialog-overlay]');
        if (!dialog) return;

        // Store the initial URL to prevent dialog URLs from changing it
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

        // Check URL on hashchange and popstate
        window.addEventListener('hashchange', checkUrl);
        window.addEventListener('popstate', checkUrl);

        // Also use a MutationObserver to catch URL changes
        const urlObserver = new MutationObserver(checkUrl);
        urlObserver.observe(document.documentElement, {
            childList: true,
            subtree: true
        });

        // Check URL periodically as fallback
        setInterval(checkUrl, 100);

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

        // Watch for HTMX content load and auto-open
        const observer = new MutationObserver(function(mutations) {
            mutations.forEach(function(mutation) {
                if (mutation.type === 'childList' && mutation.addedNodes.length) {
                    const container = dialog.querySelector('[data-dialog-container]');
                    if (container && container.children.length > 0 && dialog.hidden) {
                        openDialog();
                    }
                }
            });
        });

        observer.observe(dialog, {
            childList: true,
            subtree: true
        });

        // Expose functions globally under lf namespace
        window.lf = window.lf || {};
        window.lf.ui = window.lf.ui || {};
        window.lf.ui.Dialog = { open: openDialog, close: closeDialog };
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
