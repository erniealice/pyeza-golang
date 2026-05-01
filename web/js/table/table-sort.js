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
                if (btn.dataset.sortInit) return;
                btn.dataset.sortInit = 'true';
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
                        if (lf.TableServer && typeof htmx !== 'undefined') {
                            lf.TableServer.executeServerRequest(tableCard, {
                                sort: column,
                                dir: direction,
                                page: 1  // Reset to page 1 when sort changes
                            });
                        }
                    } else {
                        // Client-side sort (existing behavior)
                        sortTable(tbody, column, direction);

                        // Reset pagination to page 1 and re-apply after sort
                        if (lf.TablePagination) {
                            lf.TablePagination.update(tableId);
                        }
                    }

                    // Close dropdown
                    if (lf.TableCore) {
                        lf.TableCore.closeAllDropdowns();
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
                if (th.dataset.headerSortInit) return;
                th.dataset.headerSortInit = 'true';
                th.addEventListener('click', function() {
                    const column = this.dataset.sort;
                    if (!column) return;

                    // Determine new direction
                    let direction = 'asc';
                    const currentDir = this.dataset.sortDirection ||
                        (this.classList.contains('sort-asc') ? 'asc' :
                         this.classList.contains('sort-desc') ? 'desc' : '');
                    if (currentDir === 'asc') {
                        direction = 'desc';
                    } else if (currentDir === 'desc') {
                        direction = 'asc';
                    } else {
                        // Kind-aware default direction for first click on an unsorted column.
                        const kind = this.dataset.sortKind || 'text';
                        direction = (kind === 'number' || kind === 'date') ? 'desc' : 'asc';
                    }

                    // Update indicators
                    updateTableSortIndicators(table, column, direction);

                    // Update toolbar dropdown if exists
                    updateToolbarSortState(table, column, direction);

                    if (isServerMode) {
                        // Server-side sort
                        if (lf.TableServer && typeof htmx !== 'undefined') {
                            lf.TableServer.executeServerRequest(tableCard, {
                                sort: column,
                                dir: direction,
                                page: 1  // Reset to page 1 when sort changes
                            });
                        }
                    } else {
                        // Client-side sort (existing behavior)
                        sortTable(tbody, column, direction);

                        // Reset pagination to page 1 and re-apply after sort
                        if (lf.TablePagination && table.id) {
                            lf.TablePagination.update(table.id);
                        }
                    }
                });
            });
        });
    }

    function updateTableSortIndicators(table, column, direction) {
        // Remove sort classes and aria-sort from all headers
        table.querySelectorAll('thead th.sortable').forEach(th => {
            th.classList.remove('sort-asc', 'sort-desc');
            // P1: reset aria-sort to "none" on all non-active sortable headers
            th.setAttribute('aria-sort', 'none');
        });

        // Add sort class and aria-sort to active column
        const activeHeader = table.querySelector(`thead th[data-sort="${column}"]`);
        if (activeHeader) {
            activeHeader.classList.add(`sort-${direction}`);
            // P1: aria-sort uses "ascending" / "descending" per ARIA spec
            activeHeader.setAttribute('aria-sort', direction === 'asc' ? 'ascending' : 'descending');
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
            // Server-paginated tables: server already applied (and rendered) the
            // authoritative sort. Don't second-guess it on the client — doing so
            // overrides URL params like ?sort=price by re-applying the page's
            // DefaultSortColumn ("name") and corrupts the active-state indicators.
            const card = table.closest('.table-card');
            if (card && card.dataset.serverPagination === 'true') return;

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
            if (lf.TablePagination && table.id) {
                lf.TablePagination.apply(table.id);
            }
        });
    }

    // Expose module
    window.lf = window.lf || {};
    window.lf.TableSort = {
        init,
        initSort,
        initHeaderSort,
        updateTableSortIndicators,
        updateToolbarSortState,
        sortTable,
        applyDefaultSort
    };

})();
