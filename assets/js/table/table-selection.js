/**
 * Table Selection - Bulk selection functionality
 *
 * FIXED: Event listener accumulation issue
 * - State now stored at module level, keyed by tableId
 * - Old event listeners removed before adding new ones
 * - State explicitly cleared on re-initialization
 */

(function() {
    'use strict';

    // Module-level state storage (not in closure)
    const tableState = new Map();  // tableId -> { selectedIds, eventListeners }

    function init() {
        console.log('[TableSelection] init() called');
        initBulkSelection();
    }

    function initBulkSelection() {
        const tableCards = document.querySelectorAll('.table-card[data-bulk-enabled="true"]');
        console.log('[TableSelection] Found', tableCards.length, 'table card(s) with bulk enabled');

        tableCards.forEach(card => {
            const tableId = card.id.replace('-card', '');
            const table = document.getElementById(tableId);
            const bulkToolbar = card.querySelector('.table-bulk-toolbar');

            if (!table || !bulkToolbar) {
                console.log('[TableSelection] Skipping table:', tableId, '- table or toolbar not found');
                return;
            }

            console.log('[TableSelection] Initializing table:', tableId);

            // CLEANUP: Remove old event listeners from previous initialization
            cleanupTable(tableId);

            // Get UI elements
            const selectAllCheckbox = table.querySelector('.select-all-checkbox');
            const selectedCountEl = bulkToolbar.querySelector('.selected-count');
            const cancelBtn = bulkToolbar.querySelector('[data-action="cancel-selection"]');
            const selectAllBtn = bulkToolbar.querySelector('[data-action="select-all"]');
            const bulkActionBtns = bulkToolbar.querySelectorAll('[data-bulk-action]');

            // Initialize or reset state for this table
            if (!tableState.has(tableId)) {
                tableState.set(tableId, {
                    selectedIds: new Set(),
                    eventListeners: []
                });
            } else {
                // Reset selectedIds on re-initialization
                tableState.get(tableId).selectedIds.clear();
                console.log('[TableSelection] Cleared selectedIds for table:', tableId);
            }

            const state = tableState.get(tableId);
            console.log('[TableSelection] State for table:', tableId, '- selectedIds:', Array.from(state.selectedIds));

            // Track event listeners for cleanup
            const listeners = state.eventListeners;

            // Handle individual row checkbox changes
            const changeHandler = (e) => {
                if (e.target.classList.contains('row-select-checkbox')) {
                    const rowId = e.target.dataset.rowId;
                    console.log('[TableSelection] Checkbox changed - rowId:', rowId, 'checked:', e.target.checked, 'current selectedIds:', Array.from(state.selectedIds));
                    if (e.target.checked) {
                        state.selectedIds.add(rowId);
                        e.target.closest('tr').classList.add('selected');
                    } else {
                        state.selectedIds.delete(rowId);
                        e.target.closest('tr').classList.remove('selected');
                    }
                    updateBulkSelectionUI(card, state.selectedIds, selectedCountEl, selectAllCheckbox, table);
                }
            };
            table.addEventListener('change', changeHandler);
            listeners.push({ element: table, type: 'change', handler: changeHandler });

            // Handle select all in header
            if (selectAllCheckbox) {
                const selectAllHandler = () => {
                    const checkboxes = table.querySelectorAll('.row-select-checkbox');
                    checkboxes.forEach(cb => {
                        cb.checked = selectAllCheckbox.checked;
                        const rowId = cb.dataset.rowId;
                        const row = cb.closest('tr');
                        if (selectAllCheckbox.checked) {
                            state.selectedIds.add(rowId);
                            row.classList.add('selected');
                        } else {
                            state.selectedIds.delete(rowId);
                            row.classList.remove('selected');
                        }
                    });
                    updateBulkSelectionUI(card, state.selectedIds, selectedCountEl, selectAllCheckbox, table);
                };
                selectAllCheckbox.addEventListener('change', selectAllHandler);
                listeners.push({ element: selectAllCheckbox, type: 'change', handler: selectAllHandler });
            }

            // Cancel/clear selection
            if (cancelBtn) {
                const cancelHandler = () => {
                    console.log('[TableSelection] Cancel button clicked for table:', tableId);
                    clearAllSelections(table, card, state.selectedIds, selectedCountEl, selectAllCheckbox);
                };
                cancelBtn.addEventListener('click', cancelHandler);
                listeners.push({ element: cancelBtn, type: 'click', handler: cancelHandler });
            }

            // Select all button in bulk toolbar
            if (selectAllBtn) {
                const selectAllBtnHandler = () => {
                    const checkboxes = table.querySelectorAll('.row-select-checkbox');
                    checkboxes.forEach(cb => {
                        cb.checked = true;
                        const rowId = cb.dataset.rowId;
                        state.selectedIds.add(rowId);
                        cb.closest('tr').classList.add('selected');
                    });
                    if (selectAllCheckbox) selectAllCheckbox.checked = true;
                    updateBulkSelectionUI(card, state.selectedIds, selectedCountEl, selectAllCheckbox, table);
                };
                selectAllBtn.addEventListener('click', selectAllBtnHandler);
                listeners.push({ element: selectAllBtn, type: 'click', handler: selectAllBtnHandler });
            }

            // Handle bulk action buttons
            bulkActionBtns.forEach(btn => {
                const bulkActionHandler = () => {
                    const action = btn.dataset.bulkAction;
                    const selectedArray = Array.from(state.selectedIds);

                    console.log('[TableSelection] Bulk action button clicked - action:', action, 'selectedIds:', selectedArray, 'from table:', tableId);

                    if (selectedArray.length === 0) return;

                    // Trigger custom event for the page to handle
                    const event = new CustomEvent('bulkAction', {
                        detail: {
                            action: action,
                            selectedIds: selectedArray,
                            tableId: tableId
                        },
                        bubbles: true
                    });
                    card.dispatchEvent(event);
                };
                btn.addEventListener('click', bulkActionHandler);
                listeners.push({ element: btn, type: 'click', handler: bulkActionHandler });
            });

            console.log('[TableSelection] Total event listeners for table:', tableId, '=', listeners.length);
        });
    }

    // Clean up old event listeners for a table
    function cleanupTable(tableId) {
        if (!tableState.has(tableId)) {
            return;  // No previous state, nothing to clean
        }

        const state = tableState.get(tableId);
        const listeners = state.eventListeners;

        console.log('[TableSelection] Cleaning up', listeners.length, 'old event listeners for table:', tableId);

        // Remove all tracked event listeners
        listeners.forEach(({ element, type, handler }) => {
            element.removeEventListener(type, handler);
        });

        // Clear the listeners array
        state.eventListeners = [];
    }

    function updateBulkSelectionUI(card, selectedIds, selectedCountEl, selectAllCheckbox, table) {
        const count = selectedIds.size;

        console.log('[TableSelection] updateBulkSelectionUI - count:', count, 'selectedIds:', Array.from(selectedIds));

        // Update count display
        if (selectedCountEl) {
            selectedCountEl.textContent = count;
        }

        // Show/hide bulk toolbar based on selection
        if (count > 0) {
            console.log('[TableSelection] Setting data-bulk-mode="true" for card:', card.id);
            card.setAttribute('data-bulk-mode', 'true');
        } else {
            console.log('[TableSelection] Setting data-bulk-mode="false" for card:', card.id);
            card.setAttribute('data-bulk-mode', 'false');
        }

        // Update select all checkbox state
        if (selectAllCheckbox) {
            const allCheckboxes = table.querySelectorAll('.row-select-checkbox');
            const allChecked = allCheckboxes.length > 0 && Array.from(allCheckboxes).every(cb => cb.checked);
            const someChecked = Array.from(allCheckboxes).some(cb => cb.checked);

            selectAllCheckbox.checked = allChecked;
            selectAllCheckbox.indeterminate = someChecked && !allChecked;
        }

        // Update conditional bulk action button visibility
        updateConditionalButtonVisibility(card, table, selectedIds);
    }

    /**
     * Updates visibility of bulk action buttons that have data-requires-attr.
     * A button with data-requires-attr="deletable" will only be visible if ALL
     * selected rows have data-deletable="true".
     */
    function updateConditionalButtonVisibility(card, table, selectedIds) {
        const bulkToolbar = card.querySelector('.table-bulk-toolbar');
        if (!bulkToolbar) return;

        const conditionalButtons = bulkToolbar.querySelectorAll('[data-requires-attr]');
        if (conditionalButtons.length === 0) return;

        conditionalButtons.forEach(button => {
            const requiredAttr = button.dataset.requiresAttr;

            if (selectedIds.size === 0) {
                // No selection - button visibility controlled by toolbar visibility
                button.style.display = '';
                return;
            }

            // Check if ALL selected rows have the required data attribute = "true"
            let allMatch = true;
            selectedIds.forEach(rowId => {
                const row = table.querySelector(`tr[data-id="${rowId}"]`);
                if (row) {
                    const attrValue = row.dataset[requiredAttr];
                    if (attrValue !== 'true') {
                        allMatch = false;
                    }
                }
            });

            // Show or hide the button based on whether all selected rows match
            button.style.display = allMatch ? '' : 'none';
            console.log('[TableSelection] Conditional button', button.dataset.bulkAction,
                        'requires-attr:', requiredAttr, 'allMatch:', allMatch,
                        'display:', button.style.display || 'visible');
        });
    }

    function clearAllSelections(table, card, selectedIds, selectedCountEl, selectAllCheckbox) {
        console.log('[TableSelection] clearAllSelections called - selectedIds before:', Array.from(selectedIds));
        selectedIds.clear();

        const checkboxes = table.querySelectorAll('.row-select-checkbox');
        checkboxes.forEach(cb => {
            cb.checked = false;
            cb.closest('tr').classList.remove('selected');
        });

        if (selectAllCheckbox) {
            selectAllCheckbox.checked = false;
            selectAllCheckbox.indeterminate = false;
        }

        if (selectedCountEl) {
            selectedCountEl.textContent = '0';
        }

        card.setAttribute('data-bulk-mode', 'false');
        console.log('[TableSelection] clearAllSelections complete - data-bulk-mode set to false');
    }

    // Expose module
    window.TableSelection = {
        init,
        initBulkSelection,
        updateBulkSelectionUI,
        clearAllSelections,
        // Debug: get current state
        getState: function(tableId) {
            return tableState.get(tableId);
        },
        // Debug: get all states
        getAllStates: function() {
            const result = {};
            tableState.forEach((state, tableId) => {
                result[tableId] = {
                    selectedIds: Array.from(state.selectedIds),
                    listenerCount: state.eventListeners.length
                };
            });
            return result;
        }
    };

    // Expose cleanup function globally for debugging
    window.__tableSelectionCleanupAll = function() {
        console.log('[TableSelection] Cleaning up ALL table states');
        tableState.forEach((state, tableId) => {
            cleanupTable(tableId);
        });
        tableState.clear();
    };

    console.log('[TableSelection] Module loaded');
})();
