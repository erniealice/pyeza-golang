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

        // Read configuration from data attributes
        const confirmTitle = actionBtn.dataset.confirmTitle || 'Confirm Action';
        const confirmMessage = (actionBtn.dataset.confirmMessage || `Are you sure you want to ${action} ${count} item(s)?`)
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

        // Show confirmation dialog using new HTMX-based dialog
        showConfirmDialog({
            title: confirmTitle,
            message: confirmMessage,
            confirmLabel: confirmLabel,
            cancelLabel: 'Cancel',
            variant: variant,
            onConfirm: () => {
                console.log('[BulkAction] Confirmed, executing:', action);
                executeBulkAction(endpoint, selectedIds, tableCard, extraParamsJSON);
            }
        });
    }

    /**
     * Show confirmation dialog using HTMX-based dialog system
     * @param {Object} options - Dialog options
     */
    function showConfirmDialog(options) {
        const dialog = document.querySelector('[data-dialog-overlay]');
        if (!dialog) {
            console.error('[BulkAction] Dialog element not found');
            // Fallback to browser confirm
            if (confirm(options.message)) {
                options.onConfirm();
            }
            return;
        }

        // Build dialog URL with query parameters
        const dialogUrl = '/ui/dialog/confirm?' + new URLSearchParams({
            title: options.title || 'Confirm Action',
            message: options.message,
            confirm: options.confirmLabel || 'Confirm',
            cancel: options.cancelLabel || 'Cancel',
            variant: options.variant || 'default'
        });

        // Store the onConfirm callback for later execution
        // We use a custom event to handle this
        const handleConfirm = function() {
            options.onConfirm();
            dialog.removeEventListener('dialog:confirm', handleConfirm);
        };

        dialog.addEventListener('dialog:confirm', handleConfirm, { once: true });

        // Load dialog content via HTMX (don't update URL)
        if (typeof htmx !== 'undefined') {
            // Save current URL to restore it after HTMX updates it
            const currentUrl = window.location.href;

            htmx.ajax('GET', dialogUrl, {
                target: '[data-dialog-container]',
                swap: 'innerHTML',
                pushUrl: false
            });

            // Restore URL immediately in case HTMX still updates it
            setTimeout(() => {
                if (window.location.href !== currentUrl) {
                    history.replaceState(null, '', currentUrl);
                }
            }, 0);
        } else {
            console.error('[BulkAction] HTMX not available');
            if (confirm(options.message)) {
                options.onConfirm();
            }
        }
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

        fetch(endpoint, {
            method: 'POST',
            body: formData,
            headers: {
                'HX-Request': 'true'
            }
        })
        .then(response => {
            console.log('[BulkAction] Response status:', response.status);
            if (!response.ok) {
                return response.text().then(text => {
                    throw new Error(text || 'Action failed');
                });
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
    window.BulkAction = {
        handleBulkAction,
        executeBulkAction,
        refreshTable
    };

    console.log('[BulkAction] Module loaded');
})();
