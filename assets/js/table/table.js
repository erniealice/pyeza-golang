/**
 * Table - Main entry point that loads all modules and initializes them
 *
 * Load order:
 * 1. table-core.js (shared utilities and state)
 * 2. table-server.js (server-side pagination utilities)
 * 3. table-dropdowns.js (dropdown management)
 * 4. table-search.js (search functionality)
 * 5. table-sort.js (sort functionality)
 * 6. table-columns.js (column visibility)
 * 7. table-filters.js (filter functionality)
 * 8. table-export.js (export functionality)
 * 9. table-density.js (density functionality)
 * 10. table-pagination.js (pagination functionality)
 * 11. table-selection.js (bulk selection functionality)
 * 12. table-actions.js (row actions and navigation - uses global dialog.js)
 * 13. bulk-action.js (unified bulk action handler - uses global dialog.js)
 * 14. table.js (this file - main entry point)
 *
 * Note: Confirmation dialogs are now handled by dialog.js (loaded in app-shell)
 * which serves dialog content via HTMX from /ui/dialog/confirm
 */

(function() {
    'use strict';

    function init() {
        // Initialize all modules in order
        if (lf.TableDropdowns) {
            lf.TableDropdowns.init();
        }

        if (lf.TableSearch) {
            lf.TableSearch.init();
        }

        if (lf.TableSort) {
            lf.TableSort.init();
        }

        if (lf.TableColumns) {
            lf.TableColumns.init();
        }

        if (lf.TableFilters) {
            lf.TableFilters.init();
        }

        if (lf.TableExport) {
            lf.TableExport.init();
        }

        if (lf.TableDensity) {
            lf.TableDensity.init();
        }

        if (lf.TablePagination) {
            lf.TablePagination.init();
        }

        if (lf.TableSelection) {
            lf.TableSelection.init();
        }

        if (lf.TableActions) {
            lf.TableActions.init();
        }

        // Apply default sort after all modules are initialized
        if (lf.TableSort) {
            lf.TableSort.applyDefaultSort();
        }
    }

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    // Re-initialize tables after HTMX settles (preserves pagination state)
    // Using afterSettle instead of afterSwap to ensure DOM is fully updated
    document.body.addEventListener('htmx:afterSettle', function(event) {
        const swappedContent = event.detail.target;
        if (!swappedContent) return;

        // Check for targeted body swap (OOB meta carrier signals this)
        const metaEl = document.querySelector('[data-targeted-swap]');
        if (metaEl) {
            const baseId = metaEl.id.replace('-meta', '');
            const card = document.getElementById(baseId + '-card');
            if (card && lf.TableServer) {
                console.log('[HTMX] Targeted body swap detected for:', baseId);
                // Apply metadata from OOB carrier to table-card data attributes
                lf.TableServer.applyPaginationMeta(card, metaEl);
            }
            // Remove the meta carrier (its job is done)
            metaEl.remove();

            // Re-init pagination (footer was OOB-swapped, needs new event listeners)
            if (lf.TablePagination) {
                lf.TablePagination.init();
            }
            // Clear bulk selections — prevent stale IDs from previous page
            if (lf.TableSelection) {
                lf.TableSelection.initBulkSelection();
            }
            return; // Skip full re-init — toolbar modules are untouched
        }

        // Full card swap detection (existing behavior)
        const hasTable = swappedContent.querySelectorAll('.data-table').length > 0;
        const hasToolbar = swappedContent.querySelectorAll('.table-toolbar').length > 0;

        console.log('[HTMX] afterSettle - target:', swappedContent.id || swappedContent.className, 'hasTable:', hasTable, 'hasToolbar:', hasToolbar);

        // Re-initialize if any table-related content was swapped
        // Note: header OOB swaps don't need table re-init (no table elements in header)
        if (hasTable || hasToolbar) {
            console.log('[HTMX] Re-initializing table modules');
            init();
        }
    });

    // Expose public API via lf.TableToolbar for backwards compatibility
    window.lf = window.lf || {};
    window.lf.TableToolbar = {
        // Core utilities
        closeAllDropdowns: function() {
            if (lf.TableCore) return lf.TableCore.closeAllDropdowns();
        },
        updateTableInfo: function(tableId) {
            if (lf.TableCore) return lf.TableCore.updateTableInfo(tableId);
        },

        // Sort
        sortTable: function(tbody, column, direction) {
            if (lf.TableSort) return lf.TableSort.sortTable(tbody, column, direction);
        },
        updateTableSortIndicators: function(table, column, direction) {
            if (lf.TableSort) return lf.TableSort.updateTableSortIndicators(table, column, direction);
        },
        updateToolbarSortState: function(table, column, direction) {
            if (lf.TableSort) return lf.TableSort.updateToolbarSortState(table, column, direction);
        },

        // Filters
        applyFilters: function(table, conditions) {
            if (lf.TableFilters) return lf.TableFilters.applyFilters(table, conditions);
        },
        clearFilters: function(table) {
            if (lf.TableFilters) return lf.TableFilters.clearFilters(table);
        },
        getTableColumns: function(table) {
            if (lf.TableFilters) return lf.TableFilters.getTableColumns(table);
        },

        // Export
        exportToCSV: function(table, filename) {
            if (lf.TableExport) return lf.TableExport.exportToCSV(table, filename);
        },
        exportToExcel: function(table, filename) {
            if (lf.TableExport) return lf.TableExport.exportToExcel(table, filename);
        },

        // Density
        setDensity: function(density) {
            if (lf.TableDensity) return lf.TableDensity.setDensity(density);
        },

        // Dialog - now uses global dialog.js with HTMX
        showConfirmDialog: function(options) {
            const dialog = document.querySelector('[data-dialog-overlay]');
            if (!dialog) {
                console.warn('[TableToolbar] Dialog element not found');
                return;
            }

            // Build dialog URL with query parameters
            const dialogUrl = '/ui/dialog/confirm?' + new URLSearchParams({
                title: options.title || 'Confirm Action',
                message: options.message || 'Are you sure?',
                confirm: options.confirmLabel || 'Confirm',
                cancel: options.cancelLabel || 'Cancel',
                variant: options.variant || 'default'
            });

            // Store onConfirm callback if provided
            if (options.onConfirm) {
                const handleConfirm = function() {
                    options.onConfirm();
                    dialog.removeEventListener('dialog:confirm', handleConfirm);
                };
                dialog.addEventListener('dialog:confirm', handleConfirm, { once: true });
            }

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
        },

        // Selection
        clearAllSelections: function(table, card, selectedIds, selectedCountEl, selectAllCheckbox) {
            if (lf.TableSelection) return lf.TableSelection.clearAllSelections(table, card, selectedIds, selectedCountEl, selectAllCheckbox);
        },

        // Pagination
        updatePagination: function(tableId) {
            if (lf.TablePagination) return lf.TablePagination.update(tableId);
        },
        applyPagination: function(tableId) {
            if (lf.TablePagination) return lf.TablePagination.apply(tableId);
        },
        setRowFilterState: function(tableId, filterFn) {
            if (lf.TablePagination) return lf.TablePagination.setRowFilterState(tableId, filterFn);
        },
        getPaginationState: function(tableId) {
            if (lf.TableState) return lf.TableState.pagination[tableId];
        }
    };

})();
