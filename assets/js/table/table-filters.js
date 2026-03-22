/**
 * Table Filters - Filter functionality
 */

(function() {
    'use strict';

    function init() {
        initFilters();
        initChipHandlers();
    }

    function initFilters() {
        const filterPanels = document.querySelectorAll('.filter-panel');

        filterPanels.forEach(panel => {
            if (panel.dataset.filterInit) return;
            panel.dataset.filterInit = 'true';
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

            // Get columns from JSON metadata block (with fallback to header scan)
            const columns = getTableColumns(tableCard, table);

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
                        var filterInput = tableCard.querySelector('input[name="filters"]');
                        if (filterInput) filterInput.value = '';
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
                        var filterInput = tableCard.querySelector('input[name="filters"]');
                        if (filterInput) filterInput.value = '';
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
                applyBtn.addEventListener('click', function() {
                    var conditions = getFilterConditions(conditionsContainer);

                    if (isServerMode) {
                        // Build FilterRequest JSON (AND-only, no OR logic)
                        var filterRequest = { filters: conditions };
                        var filtersJSON = JSON.stringify(filterRequest);

                        // Update the hidden filter input
                        var filterInput = tableCard.querySelector('input[name="filters"]');
                        if (filterInput) {
                            filterInput.value = filtersJSON;
                        }

                        // POST via HTMX
                        if (window.TableServer && typeof htmx !== 'undefined') {
                            window.TableServer.executeServerRequest(tableCard, {
                                filters: filtersJSON,
                                page: 1,
                                tz: Intl.DateTimeFormat().resolvedOptions().timeZone
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

    function getTableColumns(tableCard, table) {
        // Read filterable columns from the JSON metadata block
        if (tableCard) {
            const tableId = table ? table.id : (tableCard.querySelector('.data-table') || {}).id;
            if (tableId) {
                const metaEl = document.getElementById(tableId + '-filter-meta');
                if (metaEl) {
                    try {
                        const cols = JSON.parse(metaEl.textContent);
                        if (cols && cols.length > 0) return cols;
                    } catch (e) { /* fall through to header scan */ }
                }
            }
        }
        // Fallback: read from sortable column headers (legacy / non-filterable tables)
        const headers = table ? table.querySelectorAll('thead th[data-sort]') : [];
        return Array.from(headers).map(th => {
            const labelEl = th.querySelector('.column-label');
            const label = labelEl ? labelEl.textContent.trim() : th.textContent.trim();
            return { key: th.dataset.sort, label: label, type: 'string', options: [] };
        });
    }

    function addFilterCondition(container, columns) {
        const row = document.createElement('div');
        row.className = 'filter-row';

        // Column select
        const columnSelect = document.createElement('select');
        columnSelect.className = 'filter-column';
        columnSelect.innerHTML = '<option value="">Select column...</option>' +
            columns.map(col => '<option value="' + col.key + '" data-type="' + (col.type || 'string') + '" data-options=\'' + JSON.stringify(col.options || []) + '\'>' + col.label + '</option>').join('');

        // Value container — rebuilt when column changes
        const valueContainer = document.createElement('div');
        valueContainer.className = 'filter-value-container';

        function buildValueInput(type, options) {
            valueContainer.innerHTML = '';
            if (type === 'status') {
                (options || []).forEach(function(opt) {
                    var label = document.createElement('label');
                    label.className = 'filter-option-checkbox';
                    label.innerHTML = '<input type="checkbox" class="filter-value-checkbox" value="' + opt.value + '"> ' + opt.label;
                    valueContainer.appendChild(label);
                });
            } else if (type === 'date') {
                valueContainer.innerHTML = '<input type="date" class="filter-value filter-date-from" placeholder="From">' +
                    '<input type="date" class="filter-value filter-date-to" placeholder="To">';
            } else if (type === 'numeric' || type === 'money') {
                valueContainer.innerHTML = '<input type="number" step="any" class="filter-value" placeholder="Value...">';
            } else {
                valueContainer.innerHTML = '<input type="text" class="filter-value" placeholder="Value...">';
            }
        }

        buildValueInput('string', []);

        columnSelect.addEventListener('change', function() {
            var opt = columnSelect.selectedOptions[0];
            var type = opt ? opt.dataset.type || 'string' : 'string';
            var options = [];
            try { options = opt && opt.dataset.options ? JSON.parse(opt.dataset.options) : []; } catch(e) {}
            buildValueInput(type, options);
        });

        // Remove button
        var removeBtn = document.createElement('button');
        removeBtn.type = 'button';
        removeBtn.className = 'filter-row-remove';
        removeBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';
        removeBtn.addEventListener('click', function() {
            row.remove();
        });

        row.appendChild(columnSelect);
        row.appendChild(valueContainer);
        row.appendChild(removeBtn);
        container.appendChild(row);
    }

    function getFilterConditions(container) {
        var conditions = [];
        var rows = container.querySelectorAll('.filter-row');

        rows.forEach(function(row) {
            var columnEl = row.querySelector('.filter-column');
            var column = columnEl ? columnEl.value : '';
            if (!column) return;

            var opt = columnEl.selectedOptions[0];
            var type = opt ? (opt.dataset.type || 'string') : 'string';
            var filterType = null;

            if (type === 'status') {
                var checked = Array.from(row.querySelectorAll('.filter-value-checkbox:checked')).map(function(cb) { return cb.value; });
                if (checked.length > 0) {
                    filterType = { statusFilter: { values: checked } };
                }
            } else if (type === 'date') {
                var from = (row.querySelector('.filter-date-from') || {}).value || '';
                var to = (row.querySelector('.filter-date-to') || {}).value || '';
                if (from || to) {
                    var df = { operator: from && to ? 3 : (from ? 2 : 1), value: from || to };
                    if (from && to) df.rangeEnd = to;
                    filterType = { dateFilter: df };
                }
            } else if (type === 'numeric') {
                var val = (row.querySelector('.filter-value') || {}).value || '';
                if (val !== '') filterType = { numberFilter: { value: parseFloat(val), operator: 0 } };
            } else if (type === 'money') {
                var val = (row.querySelector('.filter-value') || {}).value || '';
                if (val !== '') filterType = { moneyFilter: { amount: parseFloat(val), operator: 0 } };
            } else {
                var val = (row.querySelector('.filter-value') || {}).value || '';
                if (val) filterType = { stringFilter: { value: val, operator: 2 } };
            }

            if (filterType) {
                conditions.push(Object.assign({ field: column }, filterType));
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
                    // Support both legacy shape {column, value, operator} and new shape {field, stringFilter...}
                    const col = condition.column || condition.field || '';
                    let filterValue = '';
                    if (condition.value !== undefined) {
                        filterValue = condition.value;
                    } else if (condition.stringFilter) {
                        filterValue = condition.stringFilter.value || '';
                    } else if (condition.statusFilter) {
                        filterValue = (condition.statusFilter.values || []).join(',');
                    }
                    const cellValue = (row.dataset[col] || '').toLowerCase();
                    filterValue = (filterValue || '').toLowerCase();

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

    function initChipHandlers() {
        // Event delegation — handles chips rendered server-side on page load
        // and after each swap (chips are inside the table-card which is swapped)
        document.addEventListener('click', function(e) {
            // Dismiss single filter chip
            var dismissBtn = e.target.closest('[data-dismiss-filter]');
            if (dismissBtn) {
                var tableCard = dismissBtn.closest('.table-card');
                if (!tableCard || !window.TableServer) return;

                var keyToRemove = dismissBtn.dataset.dismissFilter;
                var filterInput = tableCard.querySelector('input[name="filters"]');
                var filtersJSON = filterInput ? filterInput.value : '';
                var filterRequest = { filters: [] };

                if (filtersJSON) {
                    try {
                        filterRequest = JSON.parse(filtersJSON);
                    } catch (ex) { /* ignore malformed */ }
                }

                filterRequest.filters = (filterRequest.filters || []).filter(function(f) {
                    return f.field !== keyToRemove;
                });

                var newFiltersJSON = filterRequest.filters.length > 0
                    ? JSON.stringify(filterRequest)
                    : '';

                if (filterInput) filterInput.value = newFiltersJSON;

                window.TableServer.executeServerRequest(tableCard, {
                    filters: newFiltersJSON,
                    page: 1
                });
                return;
            }

            // Clear all filters button
            var clearAllBtn = e.target.closest('[data-clear-all-filters]');
            if (clearAllBtn) {
                var tableCard = clearAllBtn.closest('.table-card');
                if (!tableCard || !window.TableServer) return;

                var filterInput = tableCard.querySelector('input[name="filters"]');
                if (filterInput) filterInput.value = '';

                window.TableServer.executeServerRequest(tableCard, {
                    filters: '',
                    page: 1
                });
            }
        });
    }

    // Expose module
    window.TableFilters = {
        init,
        initFilters,
        initChipHandlers,
        getTableColumns,
        addFilterCondition,
        getFilterConditions,
        applyFilters,
        clearFilters
    };

})();
