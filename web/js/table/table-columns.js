/**
 * Table Columns - Column visibility functionality
 */

(function() {
    'use strict';

    function init() {
        initColumnVisibility();
    }

    function initColumnVisibility() {
        const columnsMenus = document.querySelectorAll('.columns-menu');

        columnsMenus.forEach(menu => {
            const checkboxes = menu.querySelectorAll('input[type="checkbox"]');
            const dropdown = menu.closest('.toolbar-dropdown');
            const toolbar = dropdown.closest('.table-toolbar');
            const tableId = toolbar ? toolbar.dataset.table : null;

            if (!tableId) return;

            const table = document.getElementById(tableId);
            if (!table) return;

            checkboxes.forEach(checkbox => {
                if (checkbox.dataset.columnInit) return;
                checkbox.dataset.columnInit = 'true';
                checkbox.addEventListener('change', function() {
                    if (this.disabled) return;  // sort-locked column — ignore
                    const columnIndex = parseInt(this.dataset.index);
                    const columnKey = this.dataset.column;
                    const isVisible = this.checked;

                    // Toggle column visibility
                    toggleColumn(table, columnIndex, isVisible);

                    // Save preference
                    saveColumnPreference(tableId, columnKey, isVisible);
                });
            });

            // Restore saved preferences
            restoreColumnPreferences(tableId, table, checkboxes);
        });
    }

    function toggleColumn(table, columnIndex, isVisible) {
        // Account for checkbox column (index + 1 if checkbox exists)
        const hasCheckbox = table.querySelector('.row-checkbox');
        const actualIndex = hasCheckbox ? columnIndex + 1 : columnIndex;

        // Toggle header
        const th = table.querySelector(`thead th:nth-child(${actualIndex + 1})`);
        if (th) th.style.display = isVisible ? '' : 'none';

        // Toggle all cells in that column
        const cells = table.querySelectorAll(`tbody td:nth-child(${actualIndex + 1})`);
        cells.forEach(cell => {
            cell.style.display = isVisible ? '' : 'none';
        });
    }

    function saveColumnPreference(tableId, columnKey, isVisible) {
        try {
            const key = `lf-table-columns-${tableId}`;
            const prefs = JSON.parse(localStorage.getItem(key) || '{}');
            prefs[columnKey] = isVisible;
            localStorage.setItem(key, JSON.stringify(prefs));
        } catch (e) {
            console.warn('Could not save column preference', e);
        }
    }

    function restoreColumnPreferences(tableId, table, checkboxes) {
        try {
            const key = `lf-table-columns-${tableId}`;
            const prefs = JSON.parse(localStorage.getItem(key) || '{}');

            checkboxes.forEach(checkbox => {
                const columnKey = checkbox.dataset.column;
                if (columnKey in prefs) {
                    checkbox.checked = prefs[columnKey];
                    const columnIndex = parseInt(checkbox.dataset.index);
                    toggleColumn(table, columnIndex, prefs[columnKey]);
                }
            });
        } catch (e) {
            console.warn('Could not restore column preferences', e);
        }
    }

    /**
     * Re-evaluate sort-lock state after a targeted server swap.
     * Called from table-server.js after applyPaginationMeta() updates
     * tableCard.dataset.sortColumn. Reads the new active sort column and
     * updates disabled / aria-disabled / locked-class on every column toggle.
     *
     * Note: the <small class="column-toggle-hint"> is server-rendered and is
     * NOT injected or removed here — the hint will appear/disappear correctly
     * only after the next full page reload or a full card swap. On a targeted
     * (body-only) swap the hint may be stale for columns whose lock state
     * changes client-side. This is a known limitation; a follow-up can add
     * hint injection if needed.
     */
    function refreshColumnSortLock(card) {
        var menu = card.querySelector('.columns-menu');
        if (!menu) return;

        // card.dataset.sortColumn is already updated by applyPaginationMeta
        var activeCol = card.dataset.sortColumn || '';

        // Also keep the data attribute on the menu in sync for future reads
        menu.dataset.sortActiveColumn = activeCol;

        var labels = menu.querySelectorAll('.column-toggle');
        labels.forEach(function(label) {
            var input = label.querySelector('input[data-column]');
            if (!input) return;
            var isActive = activeCol !== '' && input.dataset.column === activeCol;
            input.disabled = isActive;
            if (isActive) {
                input.setAttribute('aria-disabled', 'true');
            } else {
                input.removeAttribute('aria-disabled');
            }
            label.classList.toggle('column-toggle-locked', isActive);
        });
    }

    // Expose module
    window.lf = window.lf || {};
    window.lf.ui = window.lf.ui || {};
    window.lf.ui.table = window.lf.ui.table || {};
    window.lf.ui.table.TableColumns = {
        init,
        initColumnVisibility,
        toggleColumn,
        saveColumnPreference,
        restoreColumnPreferences,
        refreshColumnSortLock
    };

})();
