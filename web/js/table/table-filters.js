/**
 * Table Filters — per-type filter widgets (Phase 8)
 *
 * Widget registry keyed by FilterType derived from cell type:
 *   string         — operator <select> + text input
 *   numeric-range  — operator <select> + min input (+ max input shown when between)
 *   date-range     — operator <select> + preset chips + date range inputs
 *   list           — checkbox list against option values (badge / select cells)
 *   list-label     — checkbox list against rendered labels (chips / persons)
 *   boolean        — Any / Yes / No tri-state <select>
 *
 * Each widget exposes build(row, column, labels) and read(row, column) → TypedFilter | null.
 * Chip text is server-emitted via ServerPagination.ActiveFilter.ChipText; JS does not reformat.
 *
 * Wire format: URL `filters=<protojson of FilterRequest>` with each TypedFilter shaped
 * { field, <variant>: { ... } } where variant ∈ stringFilter / numberFilter / rangeFilter /
 * dateFilter / listFilter / booleanFilter. Operator codes match the proto enums.
 */

(function() {
    'use strict';

    // Proto operator enum values (mirrors filter.pb.go)
    var STRING_OP = { equals: 0, not_equals: 1, contains: 2, starts_with: 3, ends_with: 4 };
    var NUMBER_OP = { eq: 0, neq: 1, gt: 2, gte: 3, lt: 4, lte: 5 };
    var DATE_OP   = { eq: 0, before: 1, after: 2, between: 3 };
    var LIST_OP   = { in: 0, not_in: 1 };

    function init() {
        initFilters();
        initChipHandlers();
    }

    function initFilters() {
        var filterPanels = document.querySelectorAll('.filter-panel');
        filterPanels.forEach(function(panel) {
            if (panel.dataset.filterInit) return;
            panel.dataset.filterInit = 'true';
            var dropdown = panel.closest('.toolbar-dropdown');
            var toolbar = dropdown ? dropdown.closest('.table-toolbar') : null;
            var tableId = toolbar ? toolbar.dataset.table : null;
            if (!tableId) return;

            var table = document.getElementById(tableId);
            if (!table) return;
            var tableCard = table.closest('.table-card');
            var isServerMode = tableCard && tableCard.dataset.serverPagination === 'true';

            var conditionsContainer = panel.querySelector('.filter-conditions');
            var addBtn = panel.querySelector('.filter-add-condition');
            var clearAllBtn = panel.querySelector('.filter-clear-all');
            var clearBtn = panel.querySelector('.filter-clear');
            var applyBtn = panel.querySelector('.filter-apply');

            var columns = getTableColumns(tableCard, table);
            var labels = readPanelLabels(panel);

            // Hydrate panel rows from active filters on first open (mirrors Phase 7.5 — three surfaces agree)
            hydrateFromActiveFilters(conditionsContainer, columns, labels, tableCard);

            if (addBtn) {
                addBtn.addEventListener('click', function() {
                    addFilterCondition(conditionsContainer, columns, labels);
                });
            }

            if (clearAllBtn) {
                clearAllBtn.addEventListener('click', function() {
                    conditionsContainer.innerHTML = '';
                    submitFilters(tableCard, isServerMode, table, []);
                });
            }

            if (clearBtn) {
                clearBtn.addEventListener('click', function() {
                    conditionsContainer.innerHTML = '';
                    submitFilters(tableCard, isServerMode, table, []);
                    if (lf.TableCore) lf.TableCore.closeAllDropdowns();
                });
            }

            if (applyBtn) {
                applyBtn.addEventListener('click', function() {
                    var conditions = getFilterConditions(conditionsContainer);
                    submitFilters(tableCard, isServerMode, table, conditions);
                    if (lf.TableCore) lf.TableCore.closeAllDropdowns();
                });
            }
        });
    }

    function submitFilters(tableCard, isServerMode, table, conditions) {
        if (isServerMode) {
            var filtersJSON = conditions.length > 0 ? JSON.stringify({ filters: conditions }) : '';
            var filterInput = tableCard.querySelector('input[name="filters"]');
            if (filterInput) filterInput.value = filtersJSON;
            if (lf.TableServer && typeof htmx !== 'undefined') {
                lf.TableServer.executeServerRequest(tableCard, {
                    filters: filtersJSON,
                    page: 1,
                    tz: Intl.DateTimeFormat().resolvedOptions().timeZone
                });
            }
            return;
        }
        // Client-paginated: legacy clear path. Per-row evaluation removed in Phase 8 —
        // server-paginated tables are authoritative; client tables fall back to "show all".
        clearFilters(table);
        if (lf.TableCore && table && table.id) lf.TableCore.updateTableInfo(table.id);
    }

    function getTableColumns(tableCard, table) {
        if (tableCard) {
            var tableId = table ? table.id : (tableCard.querySelector('.data-table') || {}).id;
            if (tableId) {
                var metaEl = document.getElementById(tableId + '-filter-meta');
                if (metaEl) {
                    try {
                        var cols = JSON.parse(metaEl.textContent);
                        if (cols && cols.length > 0) return cols;
                    } catch (e) { /* fall through */ }
                }
            }
        }
        var headers = table ? table.querySelectorAll('thead th[data-sort]') : [];
        return Array.from(headers).map(function(th) {
            var labelEl = th.querySelector('.column-label');
            var label = labelEl ? labelEl.textContent.trim() : th.textContent.trim();
            return { key: th.dataset.sort, label: label, type: 'string', filterType: 'string', options: [] };
        });
    }

    function readPanelLabels(panel) {
        var script = panel.querySelector('script.filter-panel-labels');
        if (!script) return {};
        try { return JSON.parse(script.textContent) || {}; } catch (e) { return {}; }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // FILTER_WIDGETS registry
    //
    // Each widget exposes:
    //   build(valueContainer, column, labels) — render operator <select> + value input(s)
    //   read(row, column) → TypedFilter | null — return null to skip empty/incomplete rows
    // ─────────────────────────────────────────────────────────────────────────

    var FILTER_WIDGETS = {
        'string': {
            build: function(vc, col, labels) {
                var defaultOp = col.defaultOperator || 'contains';
                vc.innerHTML =
                    '<select class="filter-operator" data-kind="string">' +
                        opt('contains', labels.filterOpContains || 'contains', defaultOp) +
                        opt('equals', labels.filterOpEquals || 'equals', defaultOp) +
                        opt('starts_with', labels.filterOpStartsWith || 'starts with', defaultOp) +
                        opt('ends_with', labels.filterOpEndsWith || 'ends with', defaultOp) +
                        opt('not_equals', labels.filterOpNotEquals || 'does not equal', defaultOp) +
                    '</select>' +
                    '<input type="text" class="filter-value" placeholder="…">';
            },
            read: function(row, col) {
                var val = (row.querySelector('.filter-value') || {}).value || '';
                if (!val) return null;
                var op = (row.querySelector('.filter-operator') || {}).value || 'contains';
                return { field: col.key, stringFilter: { value: val, operator: STRING_OP[op] || 0 } };
            }
        },

        'numeric-range': {
            build: function(vc, col, labels) {
                var defaultOp = col.defaultOperator || 'between';
                vc.innerHTML =
                    '<select class="filter-operator" data-kind="number">' +
                        opt('between', labels.filterOpBetween || 'between', defaultOp) +
                        opt('eq', labels.filterOpEq || '=', defaultOp) +
                        opt('neq', labels.filterOpNeq || '≠', defaultOp) +
                        opt('gt', labels.filterOpGt || '>', defaultOp) +
                        opt('gte', labels.filterOpGte || '≥', defaultOp) +
                        opt('lt', labels.filterOpLt || '<', defaultOp) +
                        opt('lte', labels.filterOpLte || '≤', defaultOp) +
                    '</select>' +
                    '<input type="number" step="any" class="filter-value-min" placeholder="' + esc(labels.filterMinPlaceholder || 'Min') + '">' +
                    '<span class="filter-range-sep">–</span>' +
                    '<input type="number" step="any" class="filter-value-max" placeholder="' + esc(labels.filterMaxPlaceholder || 'Max') + '">';

                var row = vc.closest('.filter-row');
                if (row) row.dataset.op = defaultOp;
                vc.querySelector('.filter-operator').addEventListener('change', function(e) {
                    if (row) row.dataset.op = e.target.value;
                });
            },
            read: function(row, col) {
                var op = (row.querySelector('.filter-operator') || {}).value || 'between';
                var minStr = (row.querySelector('.filter-value-min') || {}).value || '';
                var maxStr = (row.querySelector('.filter-value-max') || {}).value || '';
                if (op === 'between') {
                    if (minStr === '' && maxStr === '') return null;
                    return {
                        field: col.key,
                        rangeFilter: {
                            min: minStr === '' ? 0 : parseFloat(minStr),
                            max: maxStr === '' ? 0 : parseFloat(maxStr),
                            includeMin: minStr !== '',
                            includeMax: maxStr !== ''
                        }
                    };
                }
                if (minStr === '') return null;
                return {
                    field: col.key,
                    numberFilter: { value: parseFloat(minStr), operator: NUMBER_OP[op] || 0 }
                };
            }
        },

        'date-range': {
            build: function(vc, col, labels) {
                var defaultOp = col.defaultOperator || 'between';
                vc.innerHTML =
                    '<select class="filter-operator" data-kind="date">' +
                        opt('between', labels.filterOpBetween || 'between', defaultOp) +
                        opt('eq', labels.filterOpOn || 'on', defaultOp) +
                        opt('before', labels.filterOpBefore || 'before', defaultOp) +
                        opt('after', labels.filterOpAfter || 'after', defaultOp) +
                    '</select>' +
                    '<div class="filter-date-presets">' +
                        presetBtn('today', labels.filterPresetToday || 'Today') +
                        presetBtn('7d', labels.filterPreset7d || 'Last 7 days') +
                        presetBtn('30d', labels.filterPreset30d || 'Last 30 days') +
                        presetBtn('month', labels.filterPresetMonth || 'This month') +
                        presetBtn('custom', labels.filterPresetCustom || 'Custom', true) +
                    '</div>' +
                    '<input type="date" class="filter-date-from">' +
                    '<input type="date" class="filter-date-to">';

                var row = vc.closest('.filter-row');
                if (row) row.dataset.op = defaultOp;
                vc.querySelector('.filter-operator').addEventListener('change', function(e) {
                    if (row) row.dataset.op = e.target.value;
                });
                vc.querySelectorAll('.filter-date-presets button').forEach(function(btn) {
                    btn.addEventListener('click', function() {
                        var preset = btn.dataset.preset;
                        vc.querySelectorAll('.filter-date-presets button').forEach(function(b) { b.classList.remove('active'); });
                        btn.classList.add('active');
                        if (preset === 'custom') return;
                        var range = computeDateRange(preset);
                        if (!range) return;
                        vc.querySelector('.filter-date-from').value = range.from;
                        vc.querySelector('.filter-date-to').value = range.to;
                        var sel = vc.querySelector('.filter-operator');
                        sel.value = 'between';
                        if (row) row.dataset.op = 'between';
                    });
                });
            },
            read: function(row, col) {
                var op = (row.querySelector('.filter-operator') || {}).value || 'between';
                var from = (row.querySelector('.filter-date-from') || {}).value || '';
                var to = (row.querySelector('.filter-date-to') || {}).value || '';
                if (op === 'between') {
                    if (!from || !to) return null;
                    return { field: col.key, dateFilter: { value: from, operator: DATE_OP.between, rangeEnd: to } };
                }
                if (!from) return null;
                return { field: col.key, dateFilter: { value: from, operator: DATE_OP[op] || 0 } };
            }
        },

        'list': {
            build: function(vc, col, labels) {
                buildListWidget(vc, col, labels);
            },
            read: function(row, col) {
                return readListWidget(row, col);
            }
        },

        'list-label': {
            build: function(vc, col, labels) {
                buildListWidget(vc, col, labels);
            },
            read: function(row, col) {
                return readListWidget(row, col);
            }
        },

        'boolean': {
            build: function(vc, col, labels) {
                vc.innerHTML =
                    '<select class="filter-value-bool" data-kind="bool">' +
                        '<option value="">' + esc(labels.filterAny || 'Any') + '</option>' +
                        '<option value="true">' + esc(labels.filterYes || 'Yes') + '</option>' +
                        '<option value="false">' + esc(labels.filterNo || 'No') + '</option>' +
                    '</select>';
            },
            read: function(row, col) {
                var val = (row.querySelector('.filter-value-bool') || {}).value || '';
                if (val === '') return null;
                return { field: col.key, booleanFilter: { value: val === 'true' } };
            }
        }
    };

    // Legacy shims so old `type: 'status'/'numeric'/'money'/'date'/'email'/'phone'` tables
    // continue to render with the new widgets without requiring the consumer sweep first.
    FILTER_WIDGETS['status']  = FILTER_WIDGETS['list'];
    FILTER_WIDGETS['numeric'] = FILTER_WIDGETS['numeric-range'];
    FILTER_WIDGETS['money']   = FILTER_WIDGETS['numeric-range'];
    FILTER_WIDGETS['date']    = FILTER_WIDGETS['date-range'];
    FILTER_WIDGETS['email']   = FILTER_WIDGETS['string'];
    FILTER_WIDGETS['phone']   = FILTER_WIDGETS['string'];

    function buildListWidget(vc, col, labels) {
        var options = col.options || [];
        var showSearch = options.length > 5;
        var search = showSearch
            ? '<div class="filter-list-search"><input type="search" class="filter-list-search-input" placeholder="' + esc(labels.filterSearchPlaceholder || 'Search…') + '"></div>'
            : '';
        var optsHTML = options.map(function(o) {
            return '<label class="filter-list-option"><input type="checkbox" class="filter-value-checkbox" value="' + esc(o.value) + '"> ' + esc(o.label) + '</label>';
        }).join('');
        vc.innerHTML = search + '<div class="filter-list-options">' + optsHTML + '</div>';

        var row = vc.closest('.filter-row');
        if (row) row.dataset.optionsCount = String(options.length);

        if (showSearch) {
            var input = vc.querySelector('.filter-list-search-input');
            input.addEventListener('input', function() {
                var q = input.value.trim().toLowerCase();
                vc.querySelectorAll('.filter-list-option').forEach(function(lbl) {
                    var label = lbl.textContent.trim().toLowerCase();
                    lbl.style.display = (q === '' || label.indexOf(q) !== -1) ? '' : 'none';
                });
            });
        }
    }

    function readListWidget(row, col) {
        var checked = Array.from(row.querySelectorAll('.filter-value-checkbox:checked')).map(function(cb) { return cb.value; });
        if (checked.length === 0) return null;
        return { field: col.key, listFilter: { values: checked, operator: LIST_OP.in } };
    }

    function opt(value, label, defaultValue) {
        var sel = value === defaultValue ? ' selected' : '';
        return '<option value="' + value + '"' + sel + '>' + esc(label) + '</option>';
    }

    function presetBtn(preset, label, isActive) {
        var cls = isActive ? ' active' : '';
        return '<button type="button" class="filter-date-preset' + cls + '" data-preset="' + preset + '">' + esc(label) + '</button>';
    }

    function esc(s) {
        return String(s == null ? '' : s)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }

    function computeDateRange(preset) {
        // Browser-local dates. Server-side timezone middleware compensates.
        function fmt(d) {
            var y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, '0'), day = String(d.getDate()).padStart(2, '0');
            return y + '-' + m + '-' + day;
        }
        var today = new Date();
        var to = new Date(today);
        var from;
        if (preset === 'today') {
            from = new Date(today);
        } else if (preset === '7d') {
            from = new Date(today); from.setDate(from.getDate() - 6);
        } else if (preset === '30d') {
            from = new Date(today); from.setDate(from.getDate() - 29);
        } else if (preset === 'month') {
            from = new Date(today.getFullYear(), today.getMonth(), 1);
        } else {
            return null;
        }
        return { from: fmt(from), to: fmt(to) };
    }

    function addFilterCondition(container, columns, labels) {
        var row = document.createElement('div');
        row.className = 'filter-row';

        var columnSelect = document.createElement('select');
        columnSelect.className = 'filter-column';
        columnSelect.innerHTML = '<option value="">…</option>' + columns.map(function(col) {
            var t = (col.filterType || col.type || 'string');
            return '<option value="' + esc(col.key) + '" data-filter-type="' + esc(t) + '" data-default-operator="' + esc(col.defaultOperator || '') + '">' + esc(col.label) + '</option>';
        }).join('');

        var valueContainer = document.createElement('div');
        valueContainer.className = 'filter-value-container';

        columnSelect.addEventListener('change', function() {
            var sel = columnSelect.selectedOptions[0];
            if (!sel || !sel.value) {
                valueContainer.innerHTML = '';
                row.dataset.filterType = '';
                return;
            }
            var col = columnByKey(columns, sel.value);
            if (!col) return;
            var ft = sel.dataset.filterType || 'string';
            row.dataset.filterType = ft;
            var widget = FILTER_WIDGETS[ft] || FILTER_WIDGETS['string'];
            widget.build(valueContainer, col, labels);
        });

        var removeBtn = document.createElement('button');
        removeBtn.type = 'button';
        removeBtn.className = 'filter-row-remove';
        removeBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';
        removeBtn.addEventListener('click', function() { row.remove(); });

        row.appendChild(columnSelect);
        row.appendChild(valueContainer);
        row.appendChild(removeBtn);
        container.appendChild(row);
        return row;
    }

    function columnByKey(columns, key) {
        for (var i = 0; i < columns.length; i++) {
            if (columns[i].key === key) return columns[i];
        }
        return null;
    }

    function getFilterConditions(container) {
        var conditions = [];
        container.querySelectorAll('.filter-row').forEach(function(row) {
            var sel = row.querySelector('.filter-column');
            if (!sel || !sel.value) return;
            var ft = (sel.selectedOptions[0] || {}).dataset && sel.selectedOptions[0].dataset.filterType
                ? sel.selectedOptions[0].dataset.filterType
                : (row.dataset.filterType || 'string');
            var widget = FILTER_WIDGETS[ft] || FILTER_WIDGETS['string'];
            // Build a thin column shim so widget.read has access to the key
            var col = { key: sel.value };
            var tf = widget.read(row, col);
            if (tf) conditions.push(tf);
        });
        return conditions;
    }

    function hydrateFromActiveFilters(container, columns, labels, tableCard) {
        if (!container || !tableCard) return;
        if (container.children.length > 0) return; // user already opened + edited
        var input = tableCard.querySelector('input[name="filters"]');
        var raw = input ? input.value : '';
        if (!raw) return;
        var req;
        try { req = JSON.parse(raw); } catch (e) { return; }
        if (!req || !Array.isArray(req.filters)) return;
        req.filters.forEach(function(f) {
            var col = columnByKey(columns, f.field);
            if (!col) return;
            var row = addFilterCondition(container, columns, labels);
            var sel = row.querySelector('.filter-column');
            sel.value = f.field;
            sel.dispatchEvent(new Event('change'));
            applyValueFromTypedFilter(row, f);
        });
    }

    function applyValueFromTypedFilter(row, f) {
        if (f.stringFilter) {
            var op = invert(STRING_OP, f.stringFilter.operator);
            setOp(row, op || 'contains');
            setVal(row, '.filter-value', f.stringFilter.value || '');
            return;
        }
        if (f.numberFilter) {
            var op = invert(NUMBER_OP, f.numberFilter.operator);
            setOp(row, op || 'eq');
            row.dataset.op = op || 'eq';
            setVal(row, '.filter-value-min', String(f.numberFilter.value));
            return;
        }
        if (f.rangeFilter) {
            setOp(row, 'between');
            row.dataset.op = 'between';
            if (f.rangeFilter.includeMin) setVal(row, '.filter-value-min', String(f.rangeFilter.min));
            if (f.rangeFilter.includeMax) setVal(row, '.filter-value-max', String(f.rangeFilter.max));
            return;
        }
        if (f.dateFilter) {
            var op = invert(DATE_OP, f.dateFilter.operator);
            setOp(row, op || 'between');
            row.dataset.op = op || 'between';
            setVal(row, '.filter-date-from', f.dateFilter.value || '');
            if (f.dateFilter.rangeEnd) setVal(row, '.filter-date-to', f.dateFilter.rangeEnd);
            return;
        }
        if (f.listFilter) {
            (f.listFilter.values || []).forEach(function(v) {
                var cb = row.querySelector('.filter-value-checkbox[value="' + cssEsc(v) + '"]');
                if (cb) cb.checked = true;
            });
            return;
        }
        if (f.booleanFilter !== undefined && f.booleanFilter !== null) {
            setVal(row, '.filter-value-bool', f.booleanFilter.value ? 'true' : 'false');
            return;
        }
    }

    function setOp(row, op) { var s = row.querySelector('.filter-operator'); if (s) s.value = op; }
    function setVal(row, sel, val) { var el = row.querySelector(sel); if (el) el.value = val; }
    function invert(map, num) {
        for (var k in map) if (map.hasOwnProperty(k) && map[k] === num) return k;
        return null;
    }
    function cssEsc(s) { return String(s).replace(/(["\\])/g, '\\$1'); }

    function clearFilters(table) {
        if (!table) return;
        var tbody = table.querySelector('tbody');
        if (!tbody) return;
        var rows = tbody.querySelectorAll('tr[data-id]');
        rows.forEach(function(row) { row.dataset.filterHidden = 'false'; });
        var tableId = table.id;
        if (tableId && lf.TableState && lf.TableState.pagination[tableId]) {
            lf.TableState.pagination[tableId].currentPage = 1;
            if (lf.TablePagination) lf.TablePagination.apply(tableId);
        } else {
            rows.forEach(function(row) { row.style.display = ''; });
        }
    }

    function initChipHandlers() {
        document.addEventListener('click', function(e) {
            var dismissBtn = e.target.closest('[data-dismiss-filter]');
            if (dismissBtn) {
                var tableCard = dismissBtn.closest('.table-card');
                if (!tableCard || !lf.TableServer) return;
                var keyToRemove = dismissBtn.dataset.dismissFilter;
                var filterInput = tableCard.querySelector('input[name="filters"]');
                var filtersJSON = filterInput ? filterInput.value : '';
                var filterRequest = { filters: [] };
                if (filtersJSON) {
                    try { filterRequest = JSON.parse(filtersJSON); } catch (ex) { /* ignore */ }
                }
                filterRequest.filters = (filterRequest.filters || []).filter(function(f) {
                    return f.field !== keyToRemove;
                });
                var newFiltersJSON = filterRequest.filters.length > 0 ? JSON.stringify(filterRequest) : '';
                if (filterInput) filterInput.value = newFiltersJSON;
                lf.TableServer.executeServerRequest(tableCard, { filters: newFiltersJSON, page: 1 });
                return;
            }
            var clearAllBtn = e.target.closest('[data-clear-all-filters]');
            if (clearAllBtn) {
                var tableCard = clearAllBtn.closest('.table-card');
                if (!tableCard || !lf.TableServer) return;
                var filterInput = tableCard.querySelector('input[name="filters"]');
                if (filterInput) filterInput.value = '';
                lf.TableServer.executeServerRequest(tableCard, { filters: '', page: 1 });
            }
        });
    }

    window.lf = window.lf || {};
    window.lf.ui = window.lf.ui || {};
    window.lf.ui.table = window.lf.ui.table || {};
    window.lf.ui.table.TableFilters = {
        init: init,
        initFilters: initFilters,
        initChipHandlers: initChipHandlers,
        getTableColumns: getTableColumns,
        addFilterCondition: addFilterCondition,
        getFilterConditions: getFilterConditions,
        clearFilters: clearFilters,
        FILTER_WIDGETS: FILTER_WIDGETS
    };

})();
