/**
 * Table Core - Shared utilities and state
 */

(function() {
    'use strict';

    // Shared pagination state for all tables
    window.TableState = {
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
        if (window.TableState.pagination[tableId]) {
            if (window.TablePagination) {
                window.TablePagination.apply(tableId);
            }
        } else {
            const table = document.getElementById(tableId);
            if (!table) return;

            const tbody = table.querySelector('tbody');
            const allRows = tbody.querySelectorAll('tr[data-id]');
            const visibleRows = tbody.querySelectorAll('tr[data-id]:not([style*="display: none"])');

            const startEl = document.getElementById(`${tableId}-start`);
            const endEl = document.getElementById(`${tableId}-end`);
            const totalEl = document.getElementById(`${tableId}-total`);

            if (startEl) startEl.textContent = visibleRows.length > 0 ? '1' : '0';
            if (endEl) endEl.textContent = visibleRows.length;
            if (totalEl) totalEl.textContent = allRows.length;
        }
    }

    // Expose utilities
    window.TableCore = {
        debounce,
        closeAllDropdowns,
        updateTableInfo
    };

})();
