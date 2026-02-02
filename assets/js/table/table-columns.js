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
                checkbox.addEventListener('change', function() {
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
            const key = `table_columns_${tableId}`;
            const prefs = JSON.parse(localStorage.getItem(key) || '{}');
            prefs[columnKey] = isVisible;
            localStorage.setItem(key, JSON.stringify(prefs));
        } catch (e) {
            console.warn('Could not save column preference', e);
        }
    }

    function restoreColumnPreferences(tableId, table, checkboxes) {
        try {
            const key = `table_columns_${tableId}`;
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

    // Expose module
    window.TableColumns = {
        init,
        initColumnVisibility,
        toggleColumn,
        saveColumnPreference,
        restoreColumnPreferences
    };

})();
