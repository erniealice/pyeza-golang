/**
 * Table Pagination - Pagination functionality
 */

(function() {
    'use strict';

    // Track which footer elements have been processed to avoid duplicates
    const processedFooters = new WeakSet();

    function init() {
        initPagination();
    }

    function initPagination() {
        const tableFooters = document.querySelectorAll('.table-footer');

        tableFooters.forEach(footer => {
            const entriesSelector = footer.querySelector('.entries-selector');
            if (!entriesSelector) return;

            const tableId = entriesSelector.dataset.table;
            const table = tableId ? document.getElementById(tableId) : findAssociatedTable(footer);

            if (!table) return;

            const actualTableId = table.id || generateTableId(table);
            const tableCard = table.closest('.table-card');

            // Skip if this specific footer element was already processed
            if (processedFooters.has(footer)) {
                return;
            }

            // Mark this footer as processed
            processedFooters.add(footer);

            // Check if this is server-side pagination
            const isServerMode = tableCard && tableCard.dataset.serverPagination === 'true';

            if (isServerMode) {
                // Server-side pagination initialization
                initServerPagination(tableCard, footer, entriesSelector, actualTableId);
            } else {
                // Client-side pagination initialization (existing behavior)
                initClientPagination(tableCard, footer, entriesSelector, actualTableId, table);
            }
        });
    }

    /**
     * Initialize server-side pagination
     */
    function initServerPagination(tableCard, footer, entriesSelector, tableId) {
        const paginationMode = tableCard.dataset.paginationMode || 'offset';

        // Entries selector change - trigger server request
        entriesSelector.addEventListener('change', function() {
            const newSize = parseInt(this.value);
            if (window.TableServer && typeof htmx !== 'undefined') {
                window.TableServer.executeServerRequest(tableCard, { size: newSize, page: 1 });
            }
        });

        // Prev button
        const prevBtn = footer.querySelector('.pagination-prev');
        if (prevBtn) {
            prevBtn.addEventListener('click', function() {
                if (this.disabled) return;

                if (paginationMode === 'offset') {
                    const currentPage = parseInt(tableCard.dataset.currentPage) || 1;
                    if (currentPage > 1) {
                        if (window.TableServer && typeof htmx !== 'undefined') {
                            window.TableServer.executeServerRequest(tableCard, { page: currentPage - 1 });
                        }
                    }
                } else {
                    // Cursor mode
                    const hasPrev = tableCard.dataset.hasPrev === 'true';
                    if (hasPrev && window.TableServer && typeof htmx !== 'undefined') {
                        window.TableServer.executeServerRequest(tableCard, { cursorDirection: 'prev' });
                    }
                }
            });
        }

        // Next button
        const nextBtn = footer.querySelector('.pagination-next');
        if (nextBtn) {
            nextBtn.addEventListener('click', function() {
                if (this.disabled) return;

                if (paginationMode === 'offset') {
                    const currentPage = parseInt(tableCard.dataset.currentPage) || 1;
                    const totalPages = Math.ceil(
                        parseInt(tableCard.dataset.totalRows || 0) /
                        parseInt(tableCard.dataset.pageSize || 25)
                    );
                    if (currentPage < totalPages) {
                        if (window.TableServer && typeof htmx !== 'undefined') {
                            window.TableServer.executeServerRequest(tableCard, { page: currentPage + 1 });
                        }
                    }
                } else {
                    // Cursor mode
                    const hasNext = tableCard.dataset.hasNext === 'true';
                    if (hasNext && window.TableServer && typeof htmx !== 'undefined') {
                        window.TableServer.executeServerRequest(tableCard, { cursorDirection: 'next' });
                    }
                }
            });
        }

        // Page number buttons (delegated) - offset mode only
        if (paginationMode === 'offset') {
            const paginationContainer = footer.querySelector('.footer-pagination');
            if (paginationContainer) {
                paginationContainer.addEventListener('click', function(e) {
                    const pageBtn = e.target.closest('.pagination-page');
                    if (pageBtn && !pageBtn.classList.contains('ellipsis')) {
                        const page = parseInt(pageBtn.dataset.page);
                        if (!isNaN(page) && window.TableServer && typeof htmx !== 'undefined') {
                            window.TableServer.executeServerRequest(tableCard, { page });
                        }
                    }
                });
            }
        }

        // Update pagination UI based on current server state
        updateServerPaginationUI(tableCard, footer);
    }

    /**
     * Update pagination UI for server-side mode
     */
    function updateServerPaginationUI(tableCard, footer) {
        const paginationMode = tableCard.dataset.paginationMode || 'offset';
        const currentPage = parseInt(tableCard.dataset.currentPage) || 1;
        const pageSize = parseInt(tableCard.dataset.pageSize) || 25;
        const totalRows = parseInt(tableCard.dataset.totalRows) || 0;

        // Update info text
        const startEl = footer.querySelector('#showingStart') ||
                        footer.querySelector(`#${tableCard.id.replace('-card', '')}ShowingStart`) ||
                        footer.querySelector(`#${tableCard.id.replace('-card', '')}-start`);
        const endEl = footer.querySelector('#showingEnd') ||
                      footer.querySelector(`#${tableCard.id.replace('-card', '')}ShowingEnd`) ||
                      footer.querySelector(`#${tableCard.id.replace('-card', '')}-end`);
        const totalEl = footer.querySelector('#totalEntries') ||
                        footer.querySelector(`#${tableCard.id.replace('-card', '')}TotalEntries`) ||
                        footer.querySelector(`#${tableCard.id.replace('-card', '')}-total`);

        if (paginationMode === 'offset') {
            const displayStart = totalRows > 0 ? (currentPage - 1) * pageSize + 1 : 0;
            const displayEnd = Math.min(currentPage * pageSize, totalRows);

            if (startEl) startEl.textContent = displayStart;
            if (endEl) endEl.textContent = displayEnd;
            if (totalEl) totalEl.textContent = totalRows;

            // Update prev/next buttons
            const prevBtn = footer.querySelector('.pagination-prev');
            const nextBtn = footer.querySelector('.pagination-next');
            const totalPages = Math.ceil(totalRows / pageSize) || 1;

            if (prevBtn) prevBtn.disabled = currentPage <= 1;
            if (nextBtn) nextBtn.disabled = currentPage >= totalPages;

            // Update page numbers
            const tableId = tableCard.id.replace('-card', '');
            renderPageNumbers(footer, currentPage, totalPages, tableId);
        } else {
            // Cursor mode - use server-provided info
            const displayStart = totalRows > 0 ? 1 : 0;
            const displayEnd = totalRows;

            if (startEl) startEl.textContent = displayStart;
            if (endEl) endEl.textContent = displayEnd;
            if (totalEl) totalEl.textContent = totalRows;

            // Update prev/next buttons based on cursor availability
            const prevBtn = footer.querySelector('.pagination-prev');
            const nextBtn = footer.querySelector('.pagination-next');
            const hasNext = tableCard.dataset.hasNext === 'true';
            const hasPrev = tableCard.dataset.hasPrev === 'true';

            if (prevBtn) prevBtn.disabled = !hasPrev;
            if (nextBtn) nextBtn.disabled = !hasNext;
        }
    }

    /**
     * Initialize client-side pagination (existing behavior)
     */
    function initClientPagination(tableCard, footer, entriesSelector, actualTableId, table) {
        // Initialize or update state for this table
        // Preserve existing pagination state if table was refreshed (e.g., after HTMX swap)
        const existingState = window.TableState.pagination[actualTableId];
        const entriesPerPage = parseInt(entriesSelector.value) || 25;

        window.TableState.pagination[actualTableId] = {
            currentPage: existingState?.currentPage || 1,
            entriesPerPage: existingState?.entriesPerPage || entriesPerPage,
            tableId: actualTableId,
            footer: footer
        };

        // Sync entries selector with preserved state
        if (existingState?.entriesPerPage && entriesSelector.value != existingState.entriesPerPage) {
            entriesSelector.value = existingState.entriesPerPage;
        }

        // Entries selector change
        entriesSelector.addEventListener('change', function() {
            const state = window.TableState.pagination[actualTableId];
            state.entriesPerPage = parseInt(this.value);
            state.currentPage = 1; // Reset to first page
            applyPagination(actualTableId);
        });

        // Prev button
        const prevBtn = footer.querySelector('.pagination-prev');
        if (prevBtn) {
            prevBtn.addEventListener('click', function() {
                const state = window.TableState.pagination[actualTableId];
                if (state.currentPage > 1) {
                    state.currentPage--;
                    applyPagination(actualTableId);
                }
            });
        }

        // Next button
        const nextBtn = footer.querySelector('.pagination-next');
        if (nextBtn) {
            nextBtn.addEventListener('click', function() {
                const state = window.TableState.pagination[actualTableId];
                const totalPages = getTotalPages(actualTableId);
                if (state.currentPage < totalPages) {
                    state.currentPage++;
                    applyPagination(actualTableId);
                }
            });
        }

        // Page number buttons (delegated)
        const paginationContainer = footer.querySelector('.footer-pagination');
        if (paginationContainer) {
            paginationContainer.addEventListener('click', function(e) {
                const pageBtn = e.target.closest('.pagination-page');
                if (pageBtn && !pageBtn.classList.contains('ellipsis')) {
                    const page = parseInt(pageBtn.dataset.page);
                    if (!isNaN(page)) {
                        window.TableState.pagination[actualTableId].currentPage = page;
                        applyPagination(actualTableId);
                    }
                }
            });
        }

        // Initial pagination
        applyPagination(actualTableId);
    }

    function findAssociatedTable(footer) {
        // Try to find table in the same card/container
        const card = footer.closest('.table-card');
        if (card) {
            return card.querySelector('.data-table');
        }
        // Fallback: find previous sibling table
        let sibling = footer.previousElementSibling;
        while (sibling) {
            if (sibling.classList.contains('data-table') || sibling.tagName === 'TABLE') {
                return sibling;
            }
            const table = sibling.querySelector('.data-table, table');
            if (table) return table;
            sibling = sibling.previousElementSibling;
        }
        return null;
    }

    function generateTableId(table) {
        if (!table.id) {
            table.id = 'table-' + Math.random().toString(36).substr(2, 9);
        }
        return table.id;
    }

    function getVisibleRows(tableId) {
        const table = document.getElementById(tableId);
        if (!table) return [];

        const tbody = table.querySelector('tbody');
        if (!tbody) return [];

        // Get all data rows that are not hidden by filters/search
        const allRows = Array.from(tbody.querySelectorAll('tr[data-id]'));
        return allRows.filter(row => {
            // Check if row is hidden by search/filter (not pagination)
            const style = row.style.display;
            const isFilterHidden = row.dataset.filterHidden === 'true';
            return !isFilterHidden && style !== 'none';
        });
    }

    function getAllDataRows(tableId) {
        const table = document.getElementById(tableId);
        if (!table) return [];

        const tbody = table.querySelector('tbody');
        if (!tbody) return [];

        return Array.from(tbody.querySelectorAll('tr[data-id]'));
    }

    function getTotalPages(tableId) {
        const state = window.TableState.pagination[tableId];
        if (!state) return 1;

        const allRows = getAllDataRows(tableId);
        // Count rows not hidden by filters
        const filteredRows = allRows.filter(row => row.dataset.filterHidden !== 'true');
        return Math.ceil(filteredRows.length / state.entriesPerPage) || 1;
    }

    function applyPagination(tableId) {
        const state = window.TableState.pagination[tableId];
        if (!state) return;

        const table = document.getElementById(tableId);
        if (!table) return;

        const tbody = table.querySelector('tbody');
        if (!tbody) return;

        const allRows = Array.from(tbody.querySelectorAll('tr[data-id]'));
        const { currentPage, entriesPerPage } = state;

        // Filter out rows hidden by search/filter
        const filteredRows = allRows.filter(row => row.dataset.filterHidden !== 'true');
        const totalFiltered = filteredRows.length;
        const totalPages = Math.ceil(totalFiltered / entriesPerPage) || 1;

        // Ensure current page is valid
        if (currentPage > totalPages) {
            state.currentPage = totalPages;
        }

        const startIndex = (state.currentPage - 1) * entriesPerPage;
        const endIndex = startIndex + entriesPerPage;

        // Show/hide rows based on pagination
        let visibleIndex = 0;
        allRows.forEach(row => {
            if (row.dataset.filterHidden === 'true') {
                row.style.display = 'none';
            } else {
                if (visibleIndex >= startIndex && visibleIndex < endIndex) {
                    row.style.display = '';
                } else {
                    row.style.display = 'none';
                }
                visibleIndex++;
            }
        });

        // Update pagination UI
        updatePaginationUI(tableId, state.currentPage, totalPages, startIndex, endIndex, totalFiltered);
    }

    function updatePaginationUI(tableId, currentPage, totalPages, startIndex, endIndex, totalFiltered) {
        const state = window.TableState.pagination[tableId];
        if (!state || !state.footer) return;

        const footer = state.footer;

        // Update info text - try multiple ID patterns
        const startEl = footer.querySelector(`#${tableId}ShowingStart`) ||
                        footer.querySelector('#showingStart') ||
                        footer.querySelector(`#${tableId}-start`);
        const endEl = footer.querySelector(`#${tableId}ShowingEnd`) ||
                      footer.querySelector('#showingEnd') ||
                      footer.querySelector(`#${tableId}-end`);
        const totalEl = footer.querySelector(`#${tableId}TotalEntries`) ||
                        footer.querySelector('#totalEntries') ||
                        footer.querySelector(`#${tableId}-total`);

        const displayStart = totalFiltered > 0 ? startIndex + 1 : 0;
        const displayEnd = Math.min(endIndex, totalFiltered);

        if (startEl) startEl.textContent = displayStart;
        if (endEl) endEl.textContent = displayEnd;
        if (totalEl) totalEl.textContent = totalFiltered;

        // Update prev/next buttons
        const prevBtn = footer.querySelector('.pagination-prev');
        const nextBtn = footer.querySelector('.pagination-next');

        if (prevBtn) prevBtn.disabled = currentPage <= 1;
        if (nextBtn) nextBtn.disabled = currentPage >= totalPages;

        // Update page numbers
        renderPageNumbers(footer, currentPage, totalPages, tableId);
    }

    function renderPageNumbers(footer, currentPage, totalPages, tableId) {
        const container = footer.querySelector('.footer-pagination');
        if (!container) return;

        const prevBtn = container.querySelector('.pagination-prev');
        const nextBtn = container.querySelector('.pagination-next');

        // Remove existing page buttons
        container.querySelectorAll('.pagination-page').forEach(btn => btn.remove());

        // Generate page buttons
        const pages = generatePageNumbers(currentPage, totalPages);

        pages.forEach(page => {
            const btn = document.createElement('button');
            btn.className = 'pagination-page';
            btn.dataset.table = tableId;

            if (page === '...') {
                btn.classList.add('ellipsis');
                btn.textContent = '...';
                btn.disabled = true;
            } else {
                btn.dataset.page = page;
                btn.textContent = page;
                if (page === currentPage) {
                    btn.classList.add('active');
                }
            }

            // Insert before next button
            container.insertBefore(btn, nextBtn);
        });
    }

    function generatePageNumbers(currentPage, totalPages) {
        const pages = [];

        if (totalPages <= 7) {
            // Show all pages
            for (let i = 1; i <= totalPages; i++) {
                pages.push(i);
            }
        } else {
            // Always show first page
            pages.push(1);

            if (currentPage > 3) {
                pages.push('...');
            }

            // Show pages around current
            const start = Math.max(2, currentPage - 1);
            const end = Math.min(totalPages - 1, currentPage + 1);

            for (let i = start; i <= end; i++) {
                pages.push(i);
            }

            if (currentPage < totalPages - 2) {
                pages.push('...');
            }

            // Always show last page
            if (totalPages > 1) {
                pages.push(totalPages);
            }
        }

        return pages;
    }

    // Public function to update pagination after filter/search
    function updatePagination(tableId) {
        const state = window.TableState.pagination[tableId];
        if (state) {
            state.currentPage = 1; // Reset to first page after filter
            applyPagination(tableId);
        }
    }

    // Mark rows as filter-hidden (for search/filter integration)
    function setRowFilterState(tableId, filterFn) {
        const allRows = getAllDataRows(tableId);
        allRows.forEach(row => {
            const isHidden = !filterFn(row);
            row.dataset.filterHidden = isHidden ? 'true' : 'false';
        });
        updatePagination(tableId);
    }

    // Expose module
    window.TablePagination = {
        init,
        initPagination,
        initServerPagination,
        initClientPagination,
        updateServerPaginationUI,
        findAssociatedTable,
        generateTableId,
        getVisibleRows,
        getAllDataRows,
        getTotalPages,
        apply: applyPagination,
        applyPagination,
        updatePaginationUI,
        renderPageNumbers,
        generatePageNumbers,
        update: updatePagination,
        updatePagination,
        setRowFilterState
    };

})();
