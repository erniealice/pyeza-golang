/**
 * Table Actions - Row actions and navigation
 */

(function() {
    'use strict';

    let rowActionsInitialized = false;
    let rowNavigationInitialized = false;

    function init() {
        initRowActions();
        initRowNavigation();
    }

    function initRowActions() {
        // Only initialize once - uses event delegation on document
        if (rowActionsInitialized) return;
        rowActionsInitialized = true;

        document.addEventListener('click', function(e) {
            // Handle Edit button
            const editBtn = e.target.closest('.action-btn[data-action="edit"]');
            if (editBtn) {
                e.preventDefault();
                const id = editBtn.dataset.id;
                const editUrl = editBtn.dataset.editUrl;
                const drawerTitle = editBtn.dataset.drawerTitle || 'Edit';

                if (!editUrl || !id) {
                    console.warn('Edit button missing data-edit-url or data-id');
                    return;
                }

                const url = editUrl + (editUrl.includes('?') ? '&' : '?') + 'id=' + id;

                if (typeof htmx !== 'undefined') {
                    htmx.ajax('GET', url, {
                        target: '#sheetContent',
                        swap: 'innerHTML'
                    });
                }

                if (window.Sheet) {
                    Sheet.open(drawerTitle);
                }
            }

            // Handle Delete button
            const deleteBtn = e.target.closest('.action-btn[data-action="delete"]');
            if (deleteBtn) {
                e.preventDefault();
                const id = deleteBtn.dataset.id;
                const deleteUrl = deleteBtn.dataset.deleteUrl;
                const itemName = deleteBtn.dataset.itemName || 'this item';
                const confirmTitle = deleteBtn.dataset.confirmTitle || 'Confirm Delete';
                const confirmMessage = deleteBtn.dataset.confirmMessage || `Are you sure you want to delete ${itemName}?`;

                if (!deleteUrl || !id) {
                    console.warn('Delete button missing data-delete-url or data-id');
                    return;
                }

                const url = deleteUrl + (deleteUrl.includes('?') ? '&' : '?') + 'id=' + id;

                // Use new HTMX-based dialog
                showRowActionDialog(confirmTitle, confirmMessage, 'Delete', 'danger', url);
            }

            // Handle Deactivate button
            const deactivateBtn = e.target.closest('.action-btn[data-action="deactivate"]');
            if (deactivateBtn) {
                e.preventDefault();
                const id = deactivateBtn.dataset.id;
                const deactivateUrl = deactivateBtn.dataset.deactivateUrl;
                const itemName = deactivateBtn.dataset.itemName || 'this item';
                const confirmTitle = deactivateBtn.dataset.confirmTitle || 'Confirm Deactivation';
                const confirmMessage = deactivateBtn.dataset.confirmMessage || `Are you sure you want to deactivate ${itemName}?`;

                if (!deactivateUrl || !id) {
                    console.warn('Deactivate button missing data-deactivate-url or data-id');
                    return;
                }

                const url = deactivateUrl + (deactivateUrl.includes('?') ? '&' : '?') + 'id=' + id;

                // Use new HTMX-based dialog
                showRowActionDialog(confirmTitle, confirmMessage, 'Deactivate', 'warning', url);
            }

            // Handle Activate button
            const activateBtn = e.target.closest('.action-btn[data-action="activate"]');
            if (activateBtn) {
                e.preventDefault();
                const id = activateBtn.dataset.id;
                const activateUrl = activateBtn.dataset.activateUrl;
                const itemName = activateBtn.dataset.itemName || 'this item';
                const confirmTitle = activateBtn.dataset.confirmTitle || 'Confirm Activation';
                const confirmMessage = activateBtn.dataset.confirmMessage || `Are you sure you want to activate ${itemName}?`;

                if (!activateUrl || !id) {
                    console.warn('Activate button missing data-activate-url or data-id');
                    return;
                }

                const url = activateUrl + (activateUrl.includes('?') ? '&' : '?') + 'id=' + id;

                // Use new HTMX-based dialog
                showRowActionDialog(confirmTitle, confirmMessage, 'Activate', 'primary', url);
            }

        });
    }

    /**
     * Show confirmation dialog for row actions
     */
    function showRowActionDialog(title, message, confirmLabel, variant, actionUrl) {
        const dialog = document.querySelector('[data-dialog-overlay]');
        if (!dialog) {
            console.warn('[TableActions] Dialog element not found, using fallback');
            if (confirm(message)) {
                executeRowAction(actionUrl);
            }
            return;
        }

        // Build dialog URL with query parameters
        const dialogUrl = '/ui/dialog/confirm?' + new URLSearchParams({
            title: title,
            message: message,
            confirm: confirmLabel,
            cancel: 'Cancel',
            variant: variant
        });

        // Store action URL on dialog element
        dialog.dataset.actionUrl = actionUrl;

        // Load dialog content via HTMX (don't update URL)
        if (typeof htmx !== 'undefined') {
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
        }
    }

    /**
     * Execute the row action (POST to actionUrl)
     *
     * HTMX ajax target must be a CSS selector string, not a DOM element.
     * Passing a DOM element as the target causes HTMX to do a full page
     * navigation instead of a partial swap, which is why we use `#${tableCard.id}`.
     */
    function executeRowAction(actionUrl) {
        fetch(actionUrl, {
            method: 'POST',
            headers: {
                'HX-Request': 'true',
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        }).then(function(response) {
            if (response.ok) {
                // Refresh table after successful action
                const tableCard = document.querySelector('.table-card[data-refresh-url]');
                if (tableCard && typeof htmx !== 'undefined') {
                    htmx.ajax('GET', tableCard.dataset.refreshUrl, {
                        target: `#${tableCard.id}`,  // Use ID selector string, not element
                        swap: 'outerHTML',
                        pushUrl: false  // Don't update browser URL
                    });
                }
            } else {
                console.error('Action failed:', response.status);
            }
        }).catch(function(err) {
            console.error('Action error:', err);
        });
    }

    function initRowNavigation() {
        // Only initialize once - uses event delegation on document
        if (rowNavigationInitialized) return;
        rowNavigationInitialized = true;

        // Handle clicks on rows with data-href attribute
        document.addEventListener('click', (e) => {
            // Find the clicked row
            const row = e.target.closest('tr.clickable-row[data-href]');
            if (!row) return;

            // Don't navigate if clicking on interactive elements
            const interactiveElements = [
                'input',
                'button',
                'a',
                '.action-btn',
                '.action-buttons',
                '.action-dropdown',
                '.row-checkbox'
            ];

            for (const selector of interactiveElements) {
                if (e.target.closest(selector)) {
                    return; // Don't navigate when clicking checkboxes, buttons, links, or actions
                }
            }

            // Navigate to the row's href
            const href = row.dataset.href;
            if (href) {
                window.location.href = href;
            }
        });
    }

    // Expose module
    window.TableActions = {
        init,
        initRowActions,
        initRowNavigation
    };

})();
