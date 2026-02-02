/**
 * Table Server - Server-side pagination utilities
 *
 * This module provides shared utilities for handling server-side pagination
 * using HTMX. It builds URLs with appropriate query parameters based on the
 * pagination mode (offset or cursor).
 */

(function() {
    'use strict';

    /**
     * Build a server pagination URL with the appropriate query parameters.
     *
     * @param {HTMLElement} tableCard - The table-card element containing data attributes
     * @param {Object} overrides - Object containing parameter overrides (e.g., {page: 2, search: 'query'})
     * @returns {string} - The full URL with query parameters for HTMX requests
     */
    function buildServerPaginationURL(tableCard, overrides = {}, baseURLOverride) {
        // Read data attributes from table-card
        const baseURL = baseURLOverride || tableCard.dataset.paginationUrl || '';
        const paginationMode = tableCard.dataset.paginationMode || 'offset';
        const isServerMode = tableCard.dataset.serverPagination === 'true';

        if (!baseURL || !isServerMode) {
            console.warn('[TableServer] Not a server-side pagination table');
            return baseURL;
        }

        // Build URL object
        let url;
        try {
            url = new URL(baseURL, window.location.origin);
        } catch (e) {
            // If baseURL is not a valid URL, treat it as a path
            url = new URL(baseURL, window.location.origin);
        }

        // Read current state from data attributes
        const currentPage = parseInt(tableCard.dataset.currentPage) || 1;
        const pageSize = parseInt(tableCard.dataset.pageSize) || 25;
        const search = tableCard.dataset.search || '';
        const sortColumn = tableCard.dataset.sortColumn || '';
        const sortDirection = tableCard.dataset.sortDirection || 'asc';

        // Start with base parameters
        const params = new URLSearchParams(url.search);

        // Apply pagination mode specific parameters
        if (paginationMode === 'offset') {
            // Offset mode: page, size, search, sort, dir
            params.set('page', overrides.page !== undefined ? overrides.page : currentPage);
            params.set('size', overrides.size !== undefined ? overrides.size : pageSize);

            if (overrides.search !== undefined) {
                params.set('search', overrides.search);
            } else if (search) {
                params.set('search', search);
            } else {
                params.delete('search');
            }

            if (overrides.sort !== undefined) {
                params.set('sort', overrides.sort);
            } else if (sortColumn) {
                params.set('sort', sortColumn);
            } else {
                params.delete('sort');
            }

            if (overrides.dir !== undefined) {
                params.set('dir', overrides.dir);
            } else if (sortDirection) {
                params.set('dir', sortDirection);
            } else {
                params.delete('dir');
            }

        } else if (paginationMode === 'cursor') {
            // Cursor mode: size, cursor, curdir, search, sort, dir
            params.set('size', overrides.size !== undefined ? overrides.size : pageSize);

            // Handle cursor navigation
            if (overrides.cursor !== undefined) {
                params.set('cursor', overrides.cursor);
            } else if (overrides.cursorDirection === 'next' && tableCard.dataset.nextCursor) {
                params.set('cursor', tableCard.dataset.nextCursor);
                params.set('curdir', 'next');
            } else if (overrides.cursorDirection === 'prev' && tableCard.dataset.prevCursor) {
                params.set('cursor', tableCard.dataset.prevCursor);
                params.set('curdir', 'prev');
            } else {
                params.delete('cursor');
                params.delete('curdir');
            }

            if (overrides.search !== undefined) {
                params.set('search', overrides.search);
            } else if (search) {
                params.set('search', search);
            } else {
                params.delete('search');
            }

            if (overrides.sort !== undefined) {
                params.set('sort', overrides.sort);
            } else if (sortColumn) {
                params.set('sort', sortColumn);
            } else {
                params.delete('sort');
            }

            if (overrides.dir !== undefined) {
                params.set('dir', overrides.dir);
            } else if (sortDirection) {
                params.set('dir', sortDirection);
            } else {
                params.delete('dir');
            }
        }

        // Handle filters (base64 encoded JSON)
        if (overrides.filters !== undefined) {
            if (overrides.filters) {
                params.set('filters', overrides.filters);
            } else {
                params.delete('filters');
            }
        }

        // Rebuild URL with updated params
        url.search = params.toString();

        return url.toString();
    }

    /**
     * Check if a table-card element is using server-side pagination.
     *
     * @param {HTMLElement} tableCard - The table-card element to check
     * @returns {boolean} - True if server-side pagination is enabled
     */
    function isServerPagination(tableCard) {
        return tableCard && tableCard.dataset.serverPagination === 'true';
    }

    /**
     * Get the pagination mode for a table-card.
     *
     * @param {HTMLElement} tableCard - The table-card element
     * @returns {string} - 'offset' or 'cursor'
     */
    function getPaginationMode(tableCard) {
        return tableCard?.dataset.paginationMode || 'offset';
    }

    /**
     * Execute an HTMX request for server-side pagination.
     *
     * @param {HTMLElement} tableCard - The table-card element
     * @param {Object} overrides - Parameter overrides for the URL
     * @param {Object} options - Additional HTMX options (target, swap, etc.)
     */
    function executeServerRequest(tableCard, overrides = {}, options = {}) {
        if (!isServerPagination(tableCard)) {
            console.warn('[TableServer] Cannot execute server request on client-side table');
            return;
        }

        if (typeof htmx === 'undefined') {
            console.error('[TableServer] HTMX is not loaded');
            return;
        }

        // Determine if we should use the body-only endpoint (targeted swap)
        const bodyURL = tableCard.dataset.paginationBodyUrl;
        const useTargetedSwap = !!bodyURL && !options.fullRefresh;

        // Build URL using the appropriate base
        const url = useTargetedSwap
            ? buildServerPaginationURL(tableCard, overrides, bodyURL)
            : buildServerPaginationURL(tableCard, overrides);

        const tableId = tableCard.id || '';
        const baseId = tableId.replace('-card', '');

        if (useTargetedSwap) {
            // Targeted swap via fetch + DOMParser.
            // We cannot use htmx.ajax() here because HTMX parses the response by
            // setting innerHTML on a temporary <div>. The browser's HTML parser sees
            // <tbody> inside a <div> (invalid context) and auto-wraps it in a <table>,
            // which mangles the sibling OOB <div> elements. DOMParser avoids this by
            // creating a full document where each element is properly parsed.
            console.log('[TableServer] Targeted swap via fetch:', { url, baseId });

            fetch(url)
                .then(function(response) {
                    if (!response.ok) throw new Error('HTTP ' + response.status);
                    return response.text();
                })
                .then(function(html) {
                    var doc = new DOMParser().parseFromString(html, 'text/html');

                    // 1. Replace tbody rows
                    // Server wraps <tbody> in a <table id="...-swap-carrier"> carrier
                    // so DOMParser preserves the tbody's id attribute (HTML5 requires
                    // <tbody> to be inside <table> context, otherwise the tag + attrs
                    // are stripped). getElementById now works directly.
                    var newBody = doc.getElementById(baseId + '-body');
                    var oldBody = document.getElementById(baseId + '-body');
                    if (newBody && oldBody) {
                        oldBody.innerHTML = newBody.innerHTML;
                    }

                    // 2. Replace footer (manual OOB swap)
                    var newFooter = doc.getElementById(baseId + '-footer');
                    var oldFooter = document.getElementById(baseId + '-footer');
                    if (newFooter && oldFooter) {
                        newFooter.removeAttribute('hx-swap-oob');
                        oldFooter.replaceWith(newFooter);
                        // Process any hx-* attributes on the new footer content
                        var liveFooter = document.getElementById(baseId + '-footer');
                        if (liveFooter) htmx.process(liveFooter);
                    }

                    // 3. Apply pagination metadata from carrier element
                    var metaEl = doc.getElementById(baseId + '-meta');
                    if (metaEl) {
                        applyPaginationMeta(tableCard, metaEl);
                    }

                    // 4. Re-init pagination (footer was replaced, needs new event listeners)
                    if (window.TablePagination) {
                        window.TablePagination.init();
                    }

                    console.log('[TableServer] Targeted swap complete for:', baseId);
                })
                .catch(function(err) {
                    console.error('[TableServer] Targeted swap failed, falling back to full swap:', err);
                    // Fallback: full card swap via HTMX
                    htmx.ajax('GET', buildServerPaginationURL(tableCard, overrides), {
                        target: '#' + tableId,
                        swap: 'outerHTML',
                        source: tableCard
                    });
                });

            // Sync browser URL so refresh / deep-link preserves pagination state
            updateBrowserURL(tableCard, overrides);
            return;
        }

        // Full card swap (fallback for mutations or missing body URL)
        var defaultOptions = {
            target: '#' + tableId,
            swap: 'outerHTML',
            // Use the table-card as the source element so HTMX resolves
            // hx-push-url="false" from it instead of inheriting hx-push-url="true"
            // from <body>. This prevents HTMX from pushing the action URL
            // (e.g., /action/client/table-paginated?...) into the browser history.
            // The browser URL is managed exclusively by updateBrowserURL() below.
            source: tableCard
        };

        var htmxOptions = Object.assign({}, defaultOptions, options);

        console.log('[TableServer] Executing request:', {
            url: url,
            target: htmxOptions.target,
            swap: htmxOptions.swap,
            targeted: false
        });

        htmx.ajax('GET', url, htmxOptions);

        // Sync browser URL so refresh / deep-link preserves pagination state
        updateBrowserURL(tableCard, overrides);
    }

    /**
     * Update the browser address bar with current pagination state.
     * Uses replaceState so page/sort/search changes don't flood history.
     * Only non-default params are included to keep URLs clean.
     *
     * @param {HTMLElement} tableCard - The table-card element
     * @param {Object} overrides - The overrides that were just applied
     */
    function updateBrowserURL(tableCard, overrides) {
        const browserUrl = new URL(window.location.pathname, window.location.origin);

        // Merge current data-attributes with overrides to get final state
        const page = overrides.page !== undefined ? overrides.page : (parseInt(tableCard.dataset.currentPage) || 1);
        const size = overrides.size !== undefined ? overrides.size : (parseInt(tableCard.dataset.pageSize) || 25);
        const search = overrides.search !== undefined ? overrides.search : (tableCard.dataset.search || '');
        const sort = overrides.sort !== undefined ? overrides.sort : (tableCard.dataset.sortColumn || '');
        const dir = overrides.dir !== undefined ? overrides.dir : (tableCard.dataset.sortDirection || 'asc');

        // Only include non-default values to keep the URL clean
        if (page > 1) browserUrl.searchParams.set('page', page);
        if (size !== 25) browserUrl.searchParams.set('size', size);
        if (search) browserUrl.searchParams.set('search', search);
        if (sort && sort !== 'name') browserUrl.searchParams.set('sort', sort);
        if (dir && dir !== 'asc') browserUrl.searchParams.set('dir', dir);

        // Filters
        const filters = overrides.filters !== undefined ? overrides.filters : (tableCard.dataset.filters || '');
        if (filters) browserUrl.searchParams.set('filters', filters);

        history.replaceState(null, '', browserUrl.toString());
    }

    /**
     * Encode filter conditions to base64 JSON for server transmission.
     *
     * @param {Array} conditions - Array of filter condition objects
     * @returns {string} - Base64 encoded JSON string
     */
    function encodeFilters(conditions) {
        try {
            const json = JSON.stringify(conditions);
            return btoa(json);
        } catch (e) {
            console.error('[TableServer] Error encoding filters:', e);
            return '';
        }
    }

    /**
     * Decode filter conditions from base64 JSON.
     *
     * @param {string} encoded - Base64 encoded JSON string
     * @returns {Array} - Array of filter condition objects
     */
    function decodeFilters(encoded) {
        try {
            const json = atob(encoded);
            return JSON.parse(json);
        } catch (e) {
            console.error('[TableServer] Error decoding filters:', e);
            return [];
        }
    }

    /**
     * Apply pagination metadata from OOB carrier element to table-card.
     * Called after a targeted body swap to update the card's data attributes.
     *
     * @param {HTMLElement} card - The table-card element
     * @param {HTMLElement} meta - The metadata carrier element
     */
    function applyPaginationMeta(card, meta) {
        const attrs = ['currentPage', 'pageSize', 'totalRows', 'search',
                       'sortColumn', 'sortDirection', 'hasNext', 'hasPrev',
                       'nextCursor', 'prevCursor'];
        attrs.forEach(attr => {
            const val = meta.dataset[attr];
            if (val !== undefined) {
                card.dataset[attr] = val;
            }
        });
    }

    // Expose module
    window.TableServer = {
        buildServerPaginationURL,
        isServerPagination,
        getPaginationMode,
        executeServerRequest,
        applyPaginationMeta,
        encodeFilters,
        decodeFilters
    };

})();
