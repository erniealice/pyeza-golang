/**
 * Table Search - Search functionality
 */

(function() {
    'use strict';

    function init() {
        const searchInputs = document.querySelectorAll('.toolbar-search-input');

        searchInputs.forEach(input => {
            const tableId = input.dataset.table;
            if (!tableId) return;

            const table = document.getElementById(tableId);
            if (!table) return;

            const tableCard = table.closest('.table-card');
            const isServerMode = tableCard && tableCard.dataset.serverPagination === 'true';

            const tbody = table.querySelector('tbody');
            const rows = tbody ? tbody.querySelectorAll('tr[data-id]') : [];

            const debounce = window.TableCore ? window.TableCore.debounce : function(fn, wait) {
                let timeout;
                return function(...args) {
                    clearTimeout(timeout);
                    timeout = setTimeout(() => fn.apply(this, args), wait);
                };
            };

            if (isServerMode) {
                // Server-side search
                input.addEventListener('input', debounce(function() {
                    const searchTerm = this.value.trim();

                    if (window.TableServer && typeof htmx !== 'undefined') {
                        window.TableServer.executeServerRequest(tableCard, {
                            search: searchTerm,
                            page: 1  // Reset to page 1 when search changes
                        });
                    }
                }, 300));  // Slightly longer debounce for server requests
            } else {
                // Client-side search (existing behavior)
                input.addEventListener('input', debounce(function() {
                    const searchTerm = this.value.toLowerCase().trim();

                    rows.forEach(row => {
                        const text = row.textContent.toLowerCase();
                        const matches = searchTerm === '' || text.includes(searchTerm);
                        row.dataset.filterHidden = matches ? 'false' : 'true';
                    });

                    // Use pagination-aware update if available
                    if (window.TableState && window.TableState.pagination[tableId]) {
                        window.TableState.pagination[tableId].currentPage = 1;
                        if (window.TablePagination) {
                            window.TablePagination.apply(tableId);
                        }
                    } else {
                        rows.forEach(row => {
                            row.style.display = row.dataset.filterHidden === 'true' ? 'none' : '';
                        });
                        if (window.TableCore) {
                            window.TableCore.updateTableInfo(tableId);
                        }
                    }
                }, 200));
            }
        });
    }

    // Expose module
    window.TableSearch = { init };

})();
