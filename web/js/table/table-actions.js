/**
 * Table Actions - Row actions and navigation
 */

(function() {
    'use strict';

    let rowActionsInitialized = false;
    let rowNavigationInitialized = false;

    function isDisabled(btn) {
        return btn && (btn.disabled || btn.getAttribute('aria-disabled') === 'true');
    }

    function init() {
        initRowActions();
        initRowNavigation();
        initMobileActionDropdowns();
        initActionOverflows();
    }

    function initRowActions() {
        // Only initialize once - uses event delegation on document
        if (rowActionsInitialized) return;
        rowActionsInitialized = true;

        document.addEventListener('click', function(e) {
            // Handle Edit button
            const editBtn = e.target.closest('.action-btn[data-action="edit"], .action-overflow-item[data-action="edit"]');
            if (editBtn) {
                if (isDisabled(editBtn)) { e.preventDefault(); return; }
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
                        swap: 'innerHTML',
                        // pushUrl:false — drawer URLs must NOT enter browser
                        // history. Without this, hx-boost on <body> pushes the
                        // /action/ URL, htmx:beforeHistorySave snapshots the
                        // <body> with #sheet.open + empty #sheetContent, and
                        // back-nav restores that stale state because #sheet
                        // lives outside #main-content (HTMX's swap target).
                        pushUrl: false
                    });
                }

                if (lf.Sheet) {
                    lf.Sheet.open(drawerTitle);
                }
            }

            // Handle Clone / Duplicate button
            // Reuses the Edit URL but appends ?clone=1 so the server returns a
            // drawer form pre-populated from the source record, with FormAction
            // pointing at AddURL and the name field suffixed " (Copy)".
            const cloneBtn = e.target.closest('.action-btn[data-action="clone"], .action-dropdown-item[data-action="clone"], .action-overflow-item[data-action="clone"]');
            if (cloneBtn) {
                if (isDisabled(cloneBtn)) { e.preventDefault(); return; }
                e.preventDefault();
                const id = cloneBtn.dataset.id;
                const cloneUrl = cloneBtn.dataset.cloneUrl;
                const drawerTitle = cloneBtn.dataset.drawerTitle || 'Duplicate';

                if (!cloneUrl || !id) {
                    console.warn('Clone button missing data-clone-url or data-id');
                    return;
                }

                const url = cloneUrl + (cloneUrl.includes('?') ? '&' : '?') + 'clone=1';

                if (typeof htmx !== 'undefined') {
                    htmx.ajax('GET', url, {
                        target: '#sheetContent',
                        swap: 'innerHTML',
                        // pushUrl:false — drawer URLs must NOT enter browser
                        // history. Without this, hx-boost on <body> pushes the
                        // /action/ URL, htmx:beforeHistorySave snapshots the
                        // <body> with #sheet.open + empty #sheetContent, and
                        // back-nav restores that stale state because #sheet
                        // lives outside #main-content (HTMX's swap target).
                        pushUrl: false
                    });
                }

                if (lf.Sheet) {
                    lf.Sheet.open(drawerTitle);
                }
            }

            // Handle Delete button
            const deleteBtn = e.target.closest('.action-btn[data-action="delete"], .action-overflow-item[data-action="delete"]');
            if (deleteBtn) {
                if (isDisabled(deleteBtn)) { e.preventDefault(); return; }
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
            const deactivateBtn = e.target.closest('.action-btn[data-action="deactivate"], .action-overflow-item[data-action="deactivate"]');
            if (deactivateBtn) {
                if (isDisabled(deactivateBtn)) { e.preventDefault(); return; }
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
            const activateBtn = e.target.closest('.action-btn[data-action="activate"], .action-overflow-item[data-action="activate"]');
            if (activateBtn) {
                if (isDisabled(activateBtn)) { e.preventDefault(); return; }
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

            // Handle Undo button
            const undoBtn = e.target.closest('.action-btn[data-action="undo"], .action-overflow-item[data-action="undo"]');
            if (undoBtn) {
                if (isDisabled(undoBtn)) { e.preventDefault(); return; }
                e.preventDefault();
                const id = undoBtn.dataset.id;
                const undoUrl = undoBtn.dataset.activateUrl;
                const itemName = undoBtn.dataset.itemName || 'this item';
                const confirmTitle = undoBtn.dataset.confirmTitle || 'Revert to Draft';
                const confirmMessage = undoBtn.dataset.confirmMessage || `Are you sure you want to revert ${itemName} to draft?`;

                if (!undoUrl || !id) {
                    console.warn('Undo button missing data-activate-url or data-id');
                    return;
                }

                const url = undoUrl + (undoUrl.includes('?') ? '&' : '?') + 'id=' + id;
                showRowActionDialog(confirmTitle, confirmMessage, 'Revert', 'warning', url);
            }

            // Handle Complete button
            const completeBtn = e.target.closest('.action-btn[data-action="complete"]');
            if (completeBtn) {
                if (isDisabled(completeBtn)) { e.preventDefault(); return; }
                e.preventDefault();
                const id = completeBtn.dataset.id;
                const completeUrl = completeBtn.dataset.deactivateUrl;
                const itemName = completeBtn.dataset.itemName || 'this item';
                const confirmTitle = completeBtn.dataset.confirmTitle || 'Mark as Complete';
                const confirmMessage = completeBtn.dataset.confirmMessage || `Are you sure you want to complete ${itemName}?`;

                if (!completeUrl || !id) {
                    console.warn('Complete button missing data-deactivate-url or data-id');
                    return;
                }

                const url = completeUrl + (completeUrl.includes('?') ? '&' : '?') + 'id=' + id;
                showRowActionDialog(confirmTitle, confirmMessage, 'Complete', 'warning', url);
            }

            // Handle Cancel button
            const cancelBtn = e.target.closest('.action-btn[data-action="cancel"]');
            if (cancelBtn) {
                if (isDisabled(cancelBtn)) { e.preventDefault(); return; }
                e.preventDefault();
                const id = cancelBtn.dataset.id;
                const cancelUrl = cancelBtn.dataset.deactivateUrl;
                const itemName = cancelBtn.dataset.itemName || 'this item';
                const confirmTitle = cancelBtn.dataset.confirmTitle || 'Cancel';
                const confirmMessage = cancelBtn.dataset.confirmMessage || `Are you sure you want to cancel ${itemName}?`;

                if (!cancelUrl || !id) {
                    console.warn('Cancel button missing data-deactivate-url or data-id');
                    return;
                }

                const url = cancelUrl + (cancelUrl.includes('?') ? '&' : '?') + 'id=' + id;
                showRowActionDialog(confirmTitle, confirmMessage, 'Cancel', 'danger', url);
            }

            // Handle Reclassify button
            const reclassifyBtn = e.target.closest('.action-btn[data-action="reclassify"]');
            if (reclassifyBtn) {
                if (isDisabled(reclassifyBtn)) { e.preventDefault(); return; }
                e.preventDefault();
                const id = reclassifyBtn.dataset.id;
                const reclassifyUrl = reclassifyBtn.dataset.activateUrl;
                const itemName = reclassifyBtn.dataset.itemName || 'this item';
                const confirmTitle = reclassifyBtn.dataset.confirmTitle || 'Reclassify to Draft';
                const confirmMessage = reclassifyBtn.dataset.confirmMessage || `Are you sure you want to reclassify ${itemName}?`;

                if (!reclassifyUrl || !id) {
                    console.warn('Reclassify button missing data-activate-url or data-id');
                    return;
                }

                const url = reclassifyUrl + (reclassifyUrl.includes('?') ? '&' : '?') + 'id=' + id;
                showRowActionDialog(confirmTitle, confirmMessage, 'Reclassify', 'primary', url);
            }

            // Handle Download button (direct GET — opens in new tab or triggers download)
            const downloadBtn = e.target.closest('.action-btn[data-action="download"], .action-overflow-item[data-action="download"]');
            if (downloadBtn) {
                if (isDisabled(downloadBtn)) { e.preventDefault(); return; }
                e.preventDefault();
                const id = downloadBtn.dataset.id;
                const downloadUrl = downloadBtn.dataset.downloadUrl;
                const confirmTitle = downloadBtn.dataset.confirmTitle;
                const confirmMessage = downloadBtn.dataset.confirmMessage;

                if (!downloadUrl || !id) {
                    console.warn('Download button missing data-download-url or data-id');
                    return;
                }

                const url = downloadUrl + (downloadUrl.includes('?') ? '&' : '?') + 'id=' + id;

                if (confirmTitle) {
                    // Show confirmation dialog, then trigger download
                    showRowActionDialogWithCallback(confirmTitle, confirmMessage || 'Proceed with download?', 'Download', 'primary', function() {
                        window.open(url, '_blank');
                    });
                } else {
                    // Direct download without confirmation
                    window.open(url, '_blank');
                }
            }

            // Handle Send Email button (POST with dialog confirmation)
            const sendEmailBtn = e.target.closest('.action-btn[data-action="send-email"], .action-overflow-item[data-action="send-email"]');
            if (sendEmailBtn) {
                if (isDisabled(sendEmailBtn)) { e.preventDefault(); return; }
                e.preventDefault();
                const id = sendEmailBtn.dataset.id;
                const sendEmailUrl = sendEmailBtn.dataset.sendEmailUrl;
                const itemName = sendEmailBtn.dataset.itemName || 'this item';
                const confirmTitle = sendEmailBtn.dataset.confirmTitle || 'Send Email';
                const confirmMessage = sendEmailBtn.dataset.confirmMessage || 'Send invoice for ' + itemName + ' via email?';

                if (!sendEmailUrl || !id) {
                    console.warn('Send-email button missing data-send-email-url or data-id');
                    return;
                }

                const url = sendEmailUrl + (sendEmailUrl.includes('?') ? '&' : '?') + 'id=' + id;

                // Use HTMX-based dialog (same as delete/deactivate)
                showRowActionDialog(confirmTitle, confirmMessage, 'Send Email', 'primary', url);
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
     * Show confirmation dialog with a callback instead of actionUrl
     */
    function showRowActionDialogWithCallback(title, message, confirmLabel, variant, callback) {
        if (lf.TableDialog) {
            lf.TableDialog.showConfirmDialog({
                title: title,
                message: message,
                confirmLabel: confirmLabel,
                variant: variant,
                onConfirm: callback
            });
        } else if (confirm(message)) {
            callback();
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

    /**
     * P1: Mobile action dropdown — open/close/escape/arrow-key pattern.
     * Targets .action-dropdown-btn buttons and their sibling .action-dropdown-menu menus.
     * Uses event delegation so it works after HTMX swaps.
     */
    let mobileDropdownsInitialized = false;

    function initMobileActionDropdowns() {
        if (mobileDropdownsInitialized) return;
        mobileDropdownsInitialized = true;

        // Toggle on trigger click
        document.addEventListener('click', function(e) {
            var trigger = e.target.closest('.action-dropdown-btn');
            if (!trigger) return;

            e.stopPropagation();
            var wrapper = trigger.closest('.action-dropdown') || trigger.parentElement;
            var menu = wrapper ? wrapper.querySelector('.action-dropdown-menu, [role="menu"]') : null;
            if (!menu) return;

            var isOpen = wrapper.classList.contains('open');

            // Close all other open action dropdowns first
            document.querySelectorAll('.action-dropdown.open').forEach(function(el) {
                el.classList.remove('open');
                var t = el.querySelector('.action-dropdown-btn');
                if (t) t.setAttribute('aria-expanded', 'false');
            });

            if (!isOpen) {
                wrapper.classList.add('open');
                trigger.setAttribute('aria-expanded', 'true');
                // Move focus to first menu item
                var firstItem = menu.querySelector('a, button:not([disabled])');
                if (firstItem) firstItem.focus();
            }
        });

        // Close all action dropdowns on outside click
        document.addEventListener('click', function(e) {
            if (!e.target.closest('.action-dropdown')) {
                document.querySelectorAll('.action-dropdown.open').forEach(function(el) {
                    el.classList.remove('open');
                    var t = el.querySelector('.action-dropdown-btn');
                    if (t) t.setAttribute('aria-expanded', 'false');
                });
            }
        });

        // Keyboard: Escape closes; ArrowDown/ArrowUp navigates items
        document.addEventListener('keydown', function(e) {
            var activeWrapper = document.querySelector('.action-dropdown.open');
            if (!activeWrapper) return;

            var trigger = activeWrapper.querySelector('.action-dropdown-btn');
            var menu = activeWrapper.querySelector('.action-dropdown-menu, [role="menu"]');
            var items = menu ? Array.from(menu.querySelectorAll('a, button:not([disabled])')) : [];

            if (e.key === 'Escape') {
                e.preventDefault();
                activeWrapper.classList.remove('open');
                if (trigger) {
                    trigger.setAttribute('aria-expanded', 'false');
                    trigger.focus();
                }
            } else if (e.key === 'ArrowDown') {
                e.preventDefault();
                var idx = items.indexOf(document.activeElement);
                var next = idx < items.length - 1 ? items[idx + 1] : items[0];
                if (next) next.focus();
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                var idx2 = items.indexOf(document.activeElement);
                var prev = idx2 > 0 ? items[idx2 - 1] : items[items.length - 1];
                if (prev) prev.focus();
            } else if (e.key === 'Home') {
                e.preventDefault();
                if (items[0]) items[0].focus();
            } else if (e.key === 'End') {
                e.preventDefault();
                if (items.length) items[items.length - 1].focus();
            }
        });
    }

    /**
     * Action Overflow (⋮) — desktop row-level "more" menu.
     * Targets .action-overflow-btn triggers and their sibling .action-overflow-menu.
     * Same open/close/escape/arrow-key pattern as the mobile .action-dropdown but
     * stays visible on desktop and lives inline inside .action-buttons.
     * Uses event delegation so it survives HTMX swaps.
     */
    let overflowMenusInitialized = false;

    function initActionOverflows() {
        if (overflowMenusInitialized) return;
        overflowMenusInitialized = true;

        // Toggle on trigger click
        document.addEventListener('click', function(e) {
            var trigger = e.target.closest('.action-overflow-btn');
            if (!trigger) return;

            e.stopPropagation();
            e.preventDefault();
            var wrapper = trigger.closest('.action-overflow');
            if (!wrapper) return;
            var menu = wrapper.querySelector('.action-overflow-menu, [role="menu"]');

            var isOpen = wrapper.classList.contains('open');

            // Close any other open overflow menus first
            document.querySelectorAll('.action-overflow.open').forEach(function(el) {
                if (el === wrapper) return;
                el.classList.remove('open');
                var t = el.querySelector('.action-overflow-btn');
                if (t) t.setAttribute('aria-expanded', 'false');
            });

            if (!isOpen) {
                wrapper.classList.add('open');
                trigger.setAttribute('aria-expanded', 'true');
                if (menu) {
                    var firstItem = menu.querySelector('button:not([disabled]):not([aria-disabled="true"]), a');
                    if (firstItem) firstItem.focus();
                }
            } else {
                wrapper.classList.remove('open');
                trigger.setAttribute('aria-expanded', 'false');
            }
        });

        // Close on outside click
        document.addEventListener('click', function(e) {
            if (!e.target.closest('.action-overflow')) {
                document.querySelectorAll('.action-overflow.open').forEach(function(el) {
                    el.classList.remove('open');
                    var t = el.querySelector('.action-overflow-btn');
                    if (t) t.setAttribute('aria-expanded', 'false');
                });
            }
        });

        // Keyboard: Escape closes; ArrowDown/ArrowUp navigates items
        document.addEventListener('keydown', function(e) {
            var activeWrapper = document.querySelector('.action-overflow.open');
            if (!activeWrapper) return;

            var trigger = activeWrapper.querySelector('.action-overflow-btn');
            var menu = activeWrapper.querySelector('.action-overflow-menu, [role="menu"]');
            var items = menu
                ? Array.from(menu.querySelectorAll('button:not([disabled]):not([aria-disabled="true"]), a'))
                : [];

            if (e.key === 'Escape') {
                e.preventDefault();
                activeWrapper.classList.remove('open');
                if (trigger) {
                    trigger.setAttribute('aria-expanded', 'false');
                    trigger.focus();
                }
            } else if (e.key === 'ArrowDown') {
                e.preventDefault();
                var idx = items.indexOf(document.activeElement);
                var next = idx < items.length - 1 ? items[idx + 1] : items[0];
                if (next) next.focus();
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                var idx2 = items.indexOf(document.activeElement);
                var prev = idx2 > 0 ? items[idx2 - 1] : items[items.length - 1];
                if (prev) prev.focus();
            } else if (e.key === 'Home') {
                e.preventDefault();
                if (items[0]) items[0].focus();
            } else if (e.key === 'End') {
                e.preventDefault();
                if (items.length) items[items.length - 1].focus();
            }
        });
    }

    // Expose module
    window.lf = window.lf || {};
    window.lf.ui = window.lf.ui || {};
    window.lf.ui.table = window.lf.ui.table || {};
    window.lf.ui.table.TableActions = {
        init,
        initRowActions,
        initRowNavigation,
        initMobileActionDropdowns,
        initActionOverflows
    };

})();
