/**
 * Unified Bulk Action Handler
 *
 * A single JavaScript module that handles bulk actions for ALL tables.
 * Configuration is read from data attributes on the bulk action buttons:
 *
 * - data-endpoint: POST endpoint URL
 * - data-confirm-title: Confirmation dialog title
 * - data-confirm-message: Confirmation message (use {{count}} placeholder)
 * - data-extra-params: JSON string of extra form parameters
 *
 * Uses the new HTMX-based dialog system instead of window.TableDialog
 */

(function() {
    'use strict';

    // Initialize when DOM is ready
    document.addEventListener('DOMContentLoaded', init);

    function init() {
        console.log('[BulkAction] Unified bulk action handler initialized');
        // Single document-level listener for ALL bulk actions
        document.addEventListener('bulkAction', handleBulkAction);
    }

    /**
     * Handle bulk action events from table-selection.js
     * @param {CustomEvent} e - Event with detail: { action, selectedIds, tableId }
     */
    function handleBulkAction(e) {
        const tableCard = e.target.closest('.table-card[data-bulk-enabled="true"]');
        if (!tableCard) {
            console.log('[BulkAction] No table card found, ignoring');
            return;
        }

        const { action, selectedIds, tableId } = e.detail;
        const count = selectedIds.length;

        if (count === 0) {
            console.log('[BulkAction] No selections, ignoring');
            return;
        }

        // Find the button that triggered this action
        const actionBtn = tableCard.querySelector(`[data-bulk-action="${action}"]`);
        if (!actionBtn) {
            console.log('[BulkAction] Action button not found for:', action);
            return;
        }

        // Permission gate (UI reflection): if the view layer rendered this
        // button disabled (pyeza BulkAction.Disabled), abort. table-selection
        // already short-circuits the click, but this is defence-in-depth in
        // case the custom bulkAction event is dispatched from elsewhere.
        if (actionBtn.disabled || actionBtn.getAttribute('aria-disabled') === 'true') {
            console.log('[BulkAction] Action button disabled, ignoring');
            e.stopImmediatePropagation();
            return;
        }

        // Check if unified config exists (data-endpoint)
        const endpoint = actionBtn.dataset.endpoint;
        if (!endpoint) {
            // No endpoint configured - let existing page-specific JS handle it
            console.log('[BulkAction] No endpoint configured for', action, '- falling back to page handler');
            return;
        }

        // Stop propagation to prevent page-specific handlers from also handling this
        e.stopImmediatePropagation();

        console.log('[BulkAction] Handling action:', action, 'with endpoint:', endpoint, 'count:', count);

        // Read configuration from data attributes. Confirm copy is server-set
        // per call site; a missing value falls back inside the dialog API to
        // the <body data-lf-dialog-*> defaults or renders empty — no English
        // fallback lives in this file.
        const confirmTitle = actionBtn.dataset.confirmTitle || '';
        const confirmMessage = (actionBtn.dataset.confirmMessage || '')
            .replace(/\{\{count\}\}/g, count);
        const extraParamsJSON = actionBtn.dataset.extraParams;

        // Determine variant from button classes
        let variant = 'default';
        if (actionBtn.classList.contains('bulk-action-danger')) {
            variant = 'danger';
        } else if (actionBtn.classList.contains('bulk-action-primary')) {
            variant = 'primary';
        } else if (actionBtn.classList.contains('bulk-action-warning')) {
            variant = 'warning';
        }

        // Get confirm label from button text
        const confirmLabel = actionBtn.querySelector('span')?.textContent?.trim() || action;

        // Show confirmation dialog through the app-shell dialog promise API
        showConfirmDialog({
            title: confirmTitle,
            message: confirmMessage,
            confirmLabel: confirmLabel,
            variant: variant,
            onConfirm: () => {
                console.log('[BulkAction] Confirmed, executing:', action);
                executeBulkAction(endpoint, selectedIds, tableCard, extraParamsJSON);
            }
        });
    }

    /**
     * Ask for confirmation through the app-shell dialog promise API.
     * The dialog renders client-side and issues no request of its own; the
     * API is resolved at call time (dialog.js exposes it only after an
     * overlay-bearing init) and a missing API degrades to the browser's own
     * prompt inside the resolver, so the action stays gated on every page —
     * never auto-fired, never dropped. Label defaults resolve inside the API
     * (<body data-lf-dialog-*> then the overlay data-default-*), never here.
     * @param {Object} options - { title, message, confirmLabel, variant, onConfirm }
     */
    function showConfirmDialog(options) {
        const o = options || {};
        const api = window.lf && window.lf.ui && window.lf.ui.Dialog;
        const ask = (api && typeof api.confirm === 'function')
            ? api.confirm
            : function(opts) {
                let answer;
                try {
                    answer = window.confirm((opts && opts.message) || '');
                } catch (err) {
                    answer = false;
                }
                return Promise.resolve(!!answer);
            };
        ask(o).then(function(confirmed) {
            if (confirmed && typeof o.onConfirm === 'function') {
                o.onConfirm();
            }
        });
    }

    /**
     * Execute the bulk action via fetch POST
     * @param {string} endpoint - POST endpoint URL
     * @param {string[]} selectedIds - Array of selected row IDs
     * @param {HTMLElement} tableCard - The table card element
     * @param {string|undefined} extraParamsJSON - JSON string of extra params
     */
    function executeBulkAction(endpoint, selectedIds, tableCard, extraParamsJSON) {
        console.log('[BulkAction] Executing POST to:', endpoint, 'ids:', selectedIds);

        const formData = new FormData();
        selectedIds.forEach(id => formData.append('id', id));

        // Add extra params if present
        if (extraParamsJSON) {
            try {
                const extraParams = JSON.parse(extraParamsJSON);
                Object.entries(extraParams).forEach(([key, value]) => {
                    formData.append(key, value);
                });
                console.log('[BulkAction] Added extra params:', extraParams);
            } catch (e) {
                console.error('[BulkAction] Failed to parse extra params:', e);
            }
        }

        // Attach the workspace CSRF header + signed action_workspace_guard
        // fields (_workspace_id / _workspace_id_sig) so the bulk POST passes both
        // the WorkspaceCSRF (403) and action_workspace_guard (409) middlewares.
        // Without them a bulk delete/status POST fails closed. Helpers are
        // defined in scripts.html; fall back to the bare request if unavailable.
        var headers = { 'HX-Request': 'true' };
        if (window.lf && window.lf.actionRequestHeaders) {
            Object.assign(headers, window.lf.actionRequestHeaders());
            // The body is FormData (multipart) — the browser sets its own
            // Content-Type with a boundary, so drop the helper's urlencoded
            // Content-Type or the server mis-parses the payload.
            delete headers['Content-Type'];
        }
        if (window.lf && window.lf.actionGuardBody) {
            // actionGuardBody returns urlencoded _workspace_id/_sig for this
            // endpoint's path (the bulk endpoint is signed by rowActionTokens).
            // Parse and append the two fields onto the FormData body.
            var guardParams = new URLSearchParams(window.lf.actionGuardBody(endpoint));
            guardParams.forEach(function(value, key) {
                formData.append(key, value);
            });
        }

        fetch(endpoint, {
            method: 'POST',
            body: formData,
            headers: headers
        })
        .then(response => {
            console.log('[BulkAction] Response status:', response.status);
            if (!response.ok) {
                return response.text().then(text => {
                    throw new Error(text || 'Action failed');
                });
            }
            // Dispatch HX-Trigger body events so server-driven toasts/refreshes fire.
            // Mirrors what HTMX does for regular hx-post requests: each key in the
            // JSON object is dispatched as a CustomEvent on document.body with the
            // value as event.detail.
            const triggerHeader = response.headers.get('HX-Trigger');
            if (triggerHeader) {
                try {
                    const triggers = JSON.parse(triggerHeader);
                    Object.entries(triggers).forEach(([eventName, detail]) => {
                        document.body.dispatchEvent(new CustomEvent(eventName, {
                            detail: detail,
                            bubbles: true,
                        }));
                    });
                } catch (e) {
                    // Ignore parse errors — plain-string HX-Trigger values are
                    // not structured events; skip silently.
                }
            }
            return response.text();
        })
        .then(html => {
            console.log('[BulkAction] Success, refreshing table');
            refreshTable(tableCard);
        })
        .catch(error => {
            console.error('[BulkAction] Failed:', error);
            alert('Action failed: ' + error.message);
        });
    }

    /**
     * Refresh the table after successful action
     * @param {HTMLElement} tableCard - The table card element
     */
    function refreshTable(tableCard) {
        const refreshUrl = tableCard.dataset.refreshUrl;
        if (refreshUrl && typeof htmx !== 'undefined') {
            htmx.ajax('GET', refreshUrl, {
                target: `#${tableCard.id}`,
                swap: 'outerHTML',
                pushUrl: false  // Don't update browser URL
            });
        } else {
            console.log('[BulkAction] No refresh URL or htmx not available, reloading page');
            window.location.reload();
        }
    }

    // Expose module for debugging
    window.lf = window.lf || {};
    window.lf.ui = window.lf.ui || {};
    window.lf.ui.table = window.lf.ui.table || {};
    window.lf.ui.table.BulkAction = {
        handleBulkAction,
        executeBulkAction,
        refreshTable
    };

    console.log('[BulkAction] Module loaded');
})();
