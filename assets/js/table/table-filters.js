/**
 * Table Filters - Filter functionality
 */

(function() {
    'use strict';

    function init() {
        initFilters();
    }

    function initFilters() {
        const filterPanels = document.querySelectorAll('.filter-panel');

        filterPanels.forEach(panel => {
            const dropdown = panel.closest('.toolbar-dropdown');
            const toolbar = dropdown.closest('.table-toolbar');
            const tableId = toolbar ? toolbar.dataset.table : null;

            if (!tableId) return;

            const table = document.getElementById(tableId);
            if (!table) return;

            const tableCard = table.closest('.table-card');
            const isServerMode = tableCard && tableCard.dataset.serverPagination === 'true';

            const conditionsContainer = panel.querySelector('.filter-conditions');
            const addBtn = panel.querySelector('.filter-add-condition');
            const clearAllBtn = panel.querySelector('.filter-clear-all');
            const clearBtn = panel.querySelector('.filter-clear');
            const applyBtn = panel.querySelector('.filter-apply');

            // Get columns from table headers
            const columns = getTableColumns(table);

            // Add condition button
            if (addBtn) {
                addBtn.addEventListener('click', () => {
                    addFilterCondition(conditionsContainer, columns);
                });
            }

            // Clear all button
            if (clearAllBtn) {
                clearAllBtn.addEventListener('click', () => {
                    conditionsContainer.innerHTML = '';
                    if (isServerMode) {
                        // Server-side clear filters
                        if (window.TableServer && typeof htmx !== 'undefined') {
                            window.TableServer.executeServerRequest(tableCard, {
                                filters: '',  // Empty string removes filters param
                                page: 1
                            });
                        }
                    } else {
                        // Client-side clear filters (existing behavior)
                        clearFilters(table);
                    }
                });
            }

            // Clear button
            if (clearBtn) {
                clearBtn.addEventListener('click', () => {
                    conditionsContainer.innerHTML = '';
                    if (isServerMode) {
                        // Server-side clear filters
                        if (window.TableServer && typeof htmx !== 'undefined') {
                            window.TableServer.executeServerRequest(tableCard, {
                                filters: '',  // Empty string removes filters param
                                page: 1
                            });
                        }
                    } else {
                        // Client-side clear filters (existing behavior)
                        clearFilters(table);
                    }
                    if (window.TableCore) {
                        window.TableCore.closeAllDropdowns();
                    }
                });
            }

            // Apply filters button
            if (applyBtn) {
                applyBtn.addEventListener('click', () => {
                    const conditions = getFilterConditions(conditionsContainer);

                    if (isServerMode) {
                        // Server-side apply filters
                        const encodedFilters = window.TableServer ?
                            window.TableServer.encodeFilters(conditions) : '';

                        if (window.TableServer && typeof htmx !== 'undefined') {
                            window.TableServer.executeServerRequest(tableCard, {
                                filters: encodedFilters,
                                page: 1  // Reset to page 1 when filters change
                            });
                        }
                    } else {
                        // Client-side apply filters (existing behavior)
                        applyFilters(table, conditions);
                        if (window.TableCore) {
                            window.TableCore.updateTableInfo(tableId);
                        }
                    }

                    if (window.TableCore) {
                        window.TableCore.closeAllDropdowns();
                    }
                });
            }
        });
    }

    function getTableColumns(table) {
        const headers = table.querySelectorAll('thead th[data-sort]');
        return Array.from(headers).map(th => {
            // Get only the label text, not the sort icons
            const labelEl = th.querySelector('.column-label');
            const label = labelEl ? labelEl.textContent.trim() : th.textContent.trim();
            return {
                key: th.dataset.sort,
                label: label
            };
        });
    }

    function addFilterCondition(container, columns, logic = 'and') {
        const row = document.createElement('div');
        row.className = 'filter-row';

        // Logic connector (only if not first row)
        if (container.children.length > 0) {
            const logicDiv = document.createElement('div');
            logicDiv.className = 'filter-logic';
            logicDiv.innerHTML = `
                <button type="button" class="filter-logic-connector ${logic === 'and' ? 'active' : ''}" data-logic="and">AND</button>
                <button type="button" class="filter-logic-connector ${logic === 'or' ? 'active' : ''}" data-logic="or">OR</button>
            `;
            container.appendChild(logicDiv);

            // Logic toggle
            logicDiv.querySelectorAll('.filter-logic-connector').forEach(btn => {
                btn.addEventListener('click', function() {
                    logicDiv.querySelectorAll('.filter-logic-connector').forEach(b => b.classList.remove('active'));
                    this.classList.add('active');
                });
            });
        }

        // Column select
        const columnSelect = document.createElement('select');
        columnSelect.className = 'filter-column';
        columnSelect.innerHTML = '<option value="">Select column...</option>' +
            columns.map(col => `<option value="${col.key}">${col.label}</option>`).join('');

        // Operator select
        const operatorSelect = document.createElement('select');
        operatorSelect.className = 'filter-operator';
        operatorSelect.innerHTML = `
            <option value="contains">contains</option>
            <option value="equals">equals</option>
            <option value="starts_with">starts with</option>
            <option value="ends_with">ends with</option>
            <option value="not_equals">not equals</option>
            <option value="is_empty">is empty</option>
            <option value="is_not_empty">is not empty</option>
        `;

        // Value input
        const valueInput = document.createElement('input');
        valueInput.type = 'text';
        valueInput.className = 'filter-value';
        valueInput.placeholder = 'Value...';

        // Remove button
        const removeBtn = document.createElement('button');
        removeBtn.type = 'button';
        removeBtn.className = 'filter-row-remove';
        removeBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';
        removeBtn.addEventListener('click', () => {
            // Remove logic connector if exists
            const prevElement = row.previousElementSibling;
            if (prevElement && prevElement.classList.contains('filter-logic')) {
                prevElement.remove();
            }
            row.remove();
        });

        row.appendChild(columnSelect);
        row.appendChild(operatorSelect);
        row.appendChild(valueInput);
        row.appendChild(removeBtn);

        container.appendChild(row);
    }

    function getFilterConditions(container) {
        const conditions = [];
        const rows = container.querySelectorAll('.filter-row');

        rows.forEach((row, index) => {
            const column = row.querySelector('.filter-column')?.value;
            const operator = row.querySelector('.filter-operator')?.value;
            const value = row.querySelector('.filter-value')?.value;

            if (column) {
                let logic = 'and';
                const logicEl = row.previousElementSibling;
                if (logicEl && logicEl.classList.contains('filter-logic')) {
                    const activeLogic = logicEl.querySelector('.filter-logic-connector.active');
                    logic = activeLogic ? activeLogic.dataset.logic : 'and';
                }

                conditions.push({ column, operator, value, logic });
            }
        });

        return conditions;
    }

    function applyFilters(table, conditions) {
        const tableId = table.id;
        const tbody = table.querySelector('tbody');
        const rows = tbody.querySelectorAll('tr[data-id]');

        if (conditions.length === 0) {
            rows.forEach(row => {
                row.dataset.filterHidden = 'false';
            });
        } else {
            rows.forEach(row => {
                let matches = null;

                conditions.forEach((condition, index) => {
                    const cellValue = (row.dataset[condition.column] || '').toLowerCase();
                    const filterValue = condition.value.toLowerCase();

                    let conditionMatches = false;

                    switch (condition.operator) {
                        case 'contains':
                            conditionMatches = cellValue.includes(filterValue);
                            break;
                        case 'equals':
                            conditionMatches = cellValue === filterValue;
                            break;
                        case 'starts_with':
                            conditionMatches = cellValue.startsWith(filterValue);
                            break;
                        case 'ends_with':
                            conditionMatches = cellValue.endsWith(filterValue);
                            break;
                        case 'not_equals':
                            conditionMatches = cellValue !== filterValue;
                            break;
                        case 'is_empty':
                            conditionMatches = cellValue === '';
                            break;
                        case 'is_not_empty':
                            conditionMatches = cellValue !== '';
                            break;
                    }

                    if (index === 0) {
                        matches = conditionMatches;
                    } else if (condition.logic === 'or') {
                        matches = matches || conditionMatches;
                    } else {
                        matches = matches && conditionMatches;
                    }
                });

                row.dataset.filterHidden = matches ? 'false' : 'true';
            });
        }

        // Update pagination if available, otherwise just show/hide rows
        if (tableId && window.TableState && window.TableState.pagination[tableId]) {
            window.TableState.pagination[tableId].currentPage = 1;
            if (window.TablePagination) {
                window.TablePagination.apply(tableId);
            }
        } else {
            rows.forEach(row => {
                row.style.display = row.dataset.filterHidden === 'true' ? 'none' : '';
            });
        }
    }

    function clearFilters(table) {
        const tableId = table.id;
        const tbody = table.querySelector('tbody');
        const rows = tbody.querySelectorAll('tr[data-id]');
        rows.forEach(row => {
            row.dataset.filterHidden = 'false';
        });

        // Update pagination if available
        if (tableId && window.TableState && window.TableState.pagination[tableId]) {
            window.TableState.pagination[tableId].currentPage = 1;
            if (window.TablePagination) {
                window.TablePagination.apply(tableId);
            }
        } else {
            rows.forEach(row => row.style.display = '');
        }
    }

    // Expose module
    window.TableFilters = {
        init,
        initFilters,
        getTableColumns,
        addFilterCondition,
        getFilterConditions,
        applyFilters,
        clearFilters
    };

})();
