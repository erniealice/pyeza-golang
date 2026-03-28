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
                    allResultsSelected: false,
                    eventListeners: []
                });
            } else {
                // Reset state on re-initialization
                tableState.get(tableId).selectedIds.clear();
                tableState.get(tableId).allResultsSelected = false;
                card.setAttribute('data-bulk-mode', 'false');
                console.log('[TableSelection] Cleared state for table:', tableId);
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
                        // Deselecting any row exits cross-page "all results" mode
                        if (state.allResultsSelected) {
                            state.allResultsSelected = false;
                            // Drop cross-page IDs — rebuild from visible checked rows
                            state.selectedIds.clear();
                            table.querySelectorAll('.row-select-checkbox:checked').forEach(function(cb) {
                                state.selectedIds.add(cb.dataset.rowId);
                            });
                            console.log('[TableSelection] Exited allResultsSelected mode, rebuilt page selection:', state.selectedIds.size);
                        }
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
                    // Unchecking header checkbox exits cross-page mode
                    if (!selectAllCheckbox.checked && state.allResultsSelected) {
                        state.allResultsSelected = false;
                        state.selectedIds.clear(); // Drop cross-page IDs
                        console.log('[TableSelection] Exited allResultsSelected mode via header checkbox');
                    }
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

            // Store original "Select all" label for dynamic text updates
            if (selectAllBtn && !selectAllBtn.dataset.originalLabel) {
                selectAllBtn.dataset.originalLabel = selectAllBtn.textContent.trim();
            }

            // Select all button in bulk toolbar
            if (selectAllBtn) {
                const selectAllBtnHandler = () => {
                    const checkboxes = table.querySelectorAll('.row-select-checkbox');
                    // Check all visible rows
                    checkboxes.forEach(cb => {
                        cb.checked = true;
                        const rowId = cb.dataset.rowId;
                        state.selectedIds.add(rowId);
                        cb.closest('tr').classList.add('selected');
                    });
                    if (selectAllCheckbox) selectAllCheckbox.checked = true;

                    // In server-pagination mode, fetch ALL result IDs across pages
                    const isServerPaginated = card.dataset.serverPagination === 'true';
                    const totalRows = parseInt(card.dataset.totalRows) || 0;
                    if (isServerPaginated && totalRows > checkboxes.length) {
                        state.allResultsSelected = true;
                        console.log('[TableSelection] Entering allResultsSelected mode, total:', totalRows);
                        // Optimistically show total count while fetching
                        if (selectedCountEl) selectedCountEl.textContent = totalRows;
                        // Fetch all IDs from the server
                        fetchAllResultIds(card, state).then(function() {
                            updateBulkSelectionUI(card, state.selectedIds, selectedCountEl, selectAllCheckbox, table);
                        });
                    }

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
                            tableId: tableId,
                            allResultsSelected: state.allResultsSelected || false
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

    /**
     * Fetch all result IDs from server for cross-page "select all".
     * Uses the table's pagination endpoint with size=totalRows, then
     * extracts IDs from the HTML response via DOMParser.
     */
    function fetchAllResultIds(card, state) {
        var bodyURL = card.dataset.paginationBodyUrl || card.dataset.paginationUrl;
        if (!bodyURL || !window.TableServer) return Promise.resolve();

        var totalRows = parseInt(card.dataset.totalRows) || 0;
        var overrides = { page: 1, size: totalRows };

        // Preserve active filters
        var filters = card.dataset.filters;
        if (filters) overrides.filters = filters;

        var url = window.TableServer.buildServerPaginationURL(card, overrides, bodyURL);
        console.log('[TableSelection] Fetching all result IDs from:', url);

        return fetch(url)
            .then(function(response) {
                if (!response.ok) throw new Error('HTTP ' + response.status);
                return response.text();
            })
            .then(function(html) {
                var doc = new DOMParser().parseFromString(html, 'text/html');
                var allRows = doc.querySelectorAll('tr[data-id]');
                allRows.forEach(function(row) {
                    state.selectedIds.add(row.dataset.id);
                });
                console.log('[TableSelection] Fetched all result IDs, count:', state.selectedIds.size);
            })
            .catch(function(err) {
                console.error('[TableSelection] Failed to fetch all result IDs:', err);
                state.allResultsSelected = false;
            });
    }

    function updateBulkSelectionUI(card, selectedIds, selectedCountEl, selectAllCheckbox, table) {
        const count = selectedIds.size;
        const tableId = card.id.replace('-card', '');
        const state = tableState.get(tableId);
        const isServerPaginated = card.dataset.serverPagination === 'true';
        const totalRows = parseInt(card.dataset.totalRows) || 0;

        // When all results selected cross-page, show total; otherwise page count
        const displayCount = (state && state.allResultsSelected) ? Math.max(totalRows, count) : count;

        console.log('[TableSelection] updateBulkSelectionUI - count:', count, 'displayCount:', displayCount, 'allResultsSelected:', state?.allResultsSelected);

        // Update count display
        if (selectedCountEl) {
            selectedCountEl.textContent = displayCount;
        }

        // Show/hide bulk toolbar based on selection
        if (displayCount > 0) {
            card.setAttribute('data-bulk-mode', 'true');
        } else {
            card.setAttribute('data-bulk-mode', 'false');
        }

        // Update select all checkbox state and "Select all" button
        if (selectAllCheckbox) {
            const allCheckboxes = table.querySelectorAll('.row-select-checkbox');
            const allChecked = allCheckboxes.length > 0 && Array.from(allCheckboxes).every(cb => cb.checked);
            const someChecked = Array.from(allCheckboxes).some(cb => cb.checked);

            selectAllCheckbox.checked = allChecked;
            selectAllCheckbox.indeterminate = someChecked && !allChecked;

            const selectAllBtn = card.querySelector('[data-action="select-all"]');
            if (selectAllBtn) {
                if (state && state.allResultsSelected) {
                    // All results selected cross-page — hide button
                    selectAllBtn.style.display = 'none';
                } else if (isServerPaginated && allChecked && totalRows > allCheckboxes.length) {
                    // All page rows checked but more exist — show "Select all {total}"
                    const label = selectAllBtn.dataset.originalLabel || 'Select all';
                    selectAllBtn.textContent = label + ' ' + totalRows;
                    selectAllBtn.style.display = '';
                } else if (allChecked) {
                    // Client-side table or total equals page — hide
                    selectAllBtn.style.display = 'none';
                } else {
                    // Partial selection — restore original label
                    if (selectAllBtn.dataset.originalLabel) {
                        selectAllBtn.textContent = selectAllBtn.dataset.originalLabel;
                    }
                    selectAllBtn.style.display = '';
                }
            }
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

        const tableId = card.id.replace('-card', '');
        const state = tableState.get(tableId);

        conditionalButtons.forEach(button => {
            const requiredAttr = button.dataset.requiresAttr;

            if (selectedIds.size === 0) {
                // No selection - button visibility controlled by toolbar visibility
                button.style.display = '';
                return;
            }

            // When all results selected cross-page, show all action buttons
            // (server validates per-item; we can't check off-page row attributes)
            if (state && state.allResultsSelected) {
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

        // Reset cross-page selection state
        const tableId = card.id.replace('-card', '');
        const state = tableState.get(tableId);
        if (state) state.allResultsSelected = false;

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
                    allResultsSelected: state.allResultsSelected,
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
