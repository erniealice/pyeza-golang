/**
 * Table Core - Shared utilities and state
 */

(function() {
    'use strict';

    // Shared pagination state for all tables
    window.lf = window.lf || {};
    window.lf.ui = window.lf.ui || {};
    window.lf.ui.table = window.lf.ui.table || {};
    window.lf.ui.table.TableState = {
        pagination: {}
    };

    // Utility: Debounce function
    function debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func.apply(this, args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    // Utility: Close all dropdowns
    function closeAllDropdowns() {
        document.querySelectorAll('.toolbar-dropdown.open').forEach(dropdown => {
            dropdown.classList.remove('open');
            const btn = dropdown.querySelector('.toolbar-btn');
            if (btn) btn.setAttribute('aria-expanded', 'false');
        });
    }

    // Utility: Update table info display
    function updateTableInfo(tableId) {
        if (lf.TableState.pagination[tableId]) {
            if (lf.TablePagination) {
                lf.TablePagination.apply(tableId);
            }
        } else {
            const table = document.getElementById(tableId);
            if (!table) return;

            // Query across ALL tbody elements — grouped tables render one
            // tbody per band, so a first-tbody query sees no rows.
            const allRows = table.querySelectorAll('tbody tr[data-id]');
            const visibleRows = table.querySelectorAll('tbody tr[data-id]:not([style*="display: none"])');

            const startEl = document.getElementById(`${tableId}-start`);
            const endEl = document.getElementById(`${tableId}-end`);
            const totalEl = document.getElementById(`${tableId}-total`);

            if (startEl) startEl.textContent = visibleRows.length > 0 ? '1' : '0';
            if (endEl) endEl.textContent = visibleRows.length;
            if (totalEl) totalEl.textContent = allRows.length;
        }
    }

    // Row-group collapse/expand (table-row-group in table.html). Delegated so
    // it covers tables swapped in after load (HTMX). Bound EXACTLY once per
    // document via a window guard: these table scripts live in page-end.html,
    // which the full-page render re-emits, so a boosted navigation / htmx
    // history-restore re-executes this IIFE and — without the guard — stacked a
    // fresh delegated click listener each time. With an even number of
    // duplicate listeners a single toggle click fired an even number of times
    // and cancelled out, which is the "accordion dead until hard refresh" bug.
    if (!window.__lfTableGroupToggleBound) {
        window.__lfTableGroupToggleBound = true;
        document.addEventListener('click', function(e) {
            const toggle = e.target.closest('.table-group-toggle');
            if (!toggle) return;
            const headerRow = toggle.closest('tr.table-group-header');
            const headerBody = toggle.closest('tbody.table-group');
            if (!headerRow || !headerBody) return;
            const groupId = headerRow.dataset.groupToggle;
            const table = headerBody.closest('table');
            const rowsBody = table && groupId ? table.querySelector(`tbody.table-group-rows#group-${CSS.escape(groupId)}`) : null;
            if (!rowsBody) return;
            const collapsed = headerBody.classList.toggle('collapsed');
            rowsBody.style.display = collapsed ? 'none' : '';
            toggle.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
        });
    }

    // Expose utilities
    window.lf.ui = window.lf.ui || {};
    window.lf.ui.table = window.lf.ui.table || {};
    window.lf.ui.table.TableCore = {
        debounce,
        closeAllDropdowns,
        updateTableInfo
    };

})();
