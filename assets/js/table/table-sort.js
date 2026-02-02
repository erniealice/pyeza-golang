/**
 * Table Sort - Sort functionality
 */

(function() {
    'use strict';

    function init() {
        initSort();
        initHeaderSort();
    }

    function initSort() {
        const sortMenus = document.querySelectorAll('.sort-menu');

        sortMenus.forEach(menu => {
            const dropdown = menu.closest('.toolbar-dropdown');
            const toolbar = dropdown.closest('.table-toolbar');
            const tableId = toolbar ? toolbar.dataset.table : null;

            if (!tableId) return;

            const table = document.getElementById(tableId);
            if (!table) return;

            const tableCard = table.closest('.table-card');
            const isServerMode = tableCard && tableCard.dataset.serverPagination === 'true';

            const tbody = table.querySelector('tbody');
            const sortBtns = menu.querySelectorAll('.sort-dir-btn');

            sortBtns.forEach(btn => {
                btn.addEventListener('click', function(e) {
                    e.stopPropagation();

                    const option = this.closest('.sort-option');
                    const column = option.dataset.sort;
                    const direction = this.dataset.direction;

                    // Update active states in dropdown
                    menu.querySelectorAll('.sort-option').forEach(o => o.classList.remove('active'));
                    menu.querySelectorAll('.sort-dir-btn').forEach(b => b.classList.remove('active'));
                    option.classList.add('active');
                    this.classList.add('active');

                    // Update table header sort indicators
                    updateTableSortIndicators(table, column, direction);

                    if (isServerMode) {
                        // Server-side sort
                        if (window.TableServer && typeof htmx !== 'undefined') {
                            window.TableServer.executeServerRequest(tableCard, {
                                sort: column,
                                dir: direction,
                                page: 1  // Reset to page 1 when sort changes
                            });
                        }
                    } else {
                        // Client-side sort (existing behavior)
                        sortTable(tbody, column, direction);

                        // Reset pagination to page 1 and re-apply after sort
                        if (window.TablePagination) {
                            window.TablePagination.update(tableId);
                        }
                    }

                    // Close dropdown
                    if (window.TableCore) {
                        window.TableCore.closeAllDropdowns();
                    }
                });
            });
        });
    }

    function initHeaderSort() {
        const tables = document.querySelectorAll('.data-table');

        tables.forEach(table => {
            const tableCard = table.closest('.table-card');
            const isServerMode = tableCard && tableCard.dataset.serverPagination === 'true';

            const headers = table.querySelectorAll('thead th.sortable');
            const tbody = table.querySelector('tbody');

            headers.forEach(th => {
                th.addEventListener('click', function() {
                    const column = this.dataset.sort;
                    if (!column) return;

                    // Determine new direction
                    let direction = 'asc';
                    if (this.classList.contains('sort-asc')) {
                        direction = 'desc';
                    } else if (this.classList.contains('sort-desc')) {
                        direction = 'asc';
                    }

                    // Update indicators
                    updateTableSortIndicators(table, column, direction);

                    // Update toolbar dropdown if exists
                    updateToolbarSortState(table, column, direction);

                    if (isServerMode) {
                        // Server-side sort
                        if (window.TableServer && typeof htmx !== 'undefined') {
                            window.TableServer.executeServerRequest(tableCard, {
                                sort: column,
                                dir: direction,
                                page: 1  // Reset to page 1 when sort changes
                            });
                        }
                    } else {
                        // Client-side sort (existing behavior)
                        sortTable(tbody, column, direction);

                        // Reset pagination to page 1 and re-apply after sort
                        if (window.TablePagination && table.id) {
                            window.TablePagination.update(table.id);
                        }
                    }
                });
            });
        });
    }

    function updateTableSortIndicators(table, column, direction) {
        // Remove sort classes from all headers
        table.querySelectorAll('thead th.sortable').forEach(th => {
            th.classList.remove('sort-asc', 'sort-desc');
        });

        // Add sort class to active column
        const activeHeader = table.querySelector(`thead th[data-sort="${column}"]`);
        if (activeHeader) {
            activeHeader.classList.add(`sort-${direction}`);
        }
    }

    function updateToolbarSortState(table, column, direction) {
        const tableId = table.id;
        const toolbar = document.querySelector(`.table-toolbar[data-table="${tableId}"]`);
        if (!toolbar) return;

        const sortMenu = toolbar.querySelector('.sort-menu');
        if (!sortMenu) return;

        // Update dropdown states
        sortMenu.querySelectorAll('.sort-option').forEach(o => o.classList.remove('active'));
        sortMenu.querySelectorAll('.sort-dir-btn').forEach(b => b.classList.remove('active'));

        const option = sortMenu.querySelector(`.sort-option[data-sort="${column}"]`);
        if (option) {
            option.classList.add('active');
            const btn = option.querySelector(`.sort-dir-btn[data-direction="${direction}"]`);
            if (btn) btn.classList.add('active');
        }
    }

    function sortTable(tbody, column, direction) {
        const rows = Array.from(tbody.querySelectorAll('tr[data-id]'));

        rows.sort((a, b) => {
            const aVal = (a.dataset[column] || a.querySelector(`[data-${column}]`)?.textContent || '').toLowerCase();
            const bVal = (b.dataset[column] || b.querySelector(`[data-${column}]`)?.textContent || '').toLowerCase();

            // Try numeric comparison first
            const aNum = parseFloat(aVal);
            const bNum = parseFloat(bVal);

            if (!isNaN(aNum) && !isNaN(bNum)) {
                return direction === 'asc' ? aNum - bNum : bNum - aNum;
            }

            // Fall back to string comparison
            const comparison = aVal.localeCompare(bVal);
            return direction === 'asc' ? comparison : -comparison;
        });

        // Re-append sorted rows
        rows.forEach(row => tbody.appendChild(row));
    }

    function applyDefaultSort() {
        const tables = document.querySelectorAll('.data-table[data-default-sort]');

        tables.forEach(table => {
            const column = table.dataset.defaultSort;
            const direction = table.dataset.defaultDirection || 'asc';

            if (!column) return;

            const tbody = table.querySelector('tbody');
            if (!tbody) return;

            // Update table header indicators
            updateTableSortIndicators(table, column, direction);

            // Update toolbar dropdown state
            updateToolbarSortState(table, column, direction);

            // Perform the sort
            sortTable(tbody, column, direction);

            // Re-apply pagination after default sort (don't reset page for initial load)
            if (window.TablePagination && table.id) {
                window.TablePagination.apply(table.id);
            }
        });
    }

    // Expose module
    window.TableSort = {
        init,
        initSort,
        initHeaderSort,
        updateTableSortIndicators,
        updateToolbarSortState,
        sortTable,
        applyDefaultSort
    };

})();
