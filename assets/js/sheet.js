/**
 * Form Drawer Component
 * Handles slide-in drawer for forms with HTMX integration
 */

(function() {
    'use strict';

    // ========================================
    // STATE
    // ========================================

    let isOpen = false;

    // ========================================
    // DOM ELEMENTS
    // ========================================

    function getDrawer() {
        return document.getElementById('sheet');
    }

    function getOverlay() {
        return document.getElementById('sheetOverlay');
    }

    function getTitle() {
        return document.getElementById('sheetTitle');
    }

    function getContent() {
        return document.getElementById('sheetContent');
    }

    function getCloseBtn() {
        return document.getElementById('sheetClose');
    }

    // ========================================
    // CORE FUNCTIONS
    // ========================================

    /**
     * Open the form drawer
     * @param {string} title - The title to display in the drawer header
     */
    function open(title) {
        const drawer = getDrawer();
        const titleEl = getTitle();

        if (!drawer) {
            console.warn('Sheet: Drawer element not found');
            return;
        }

        // Set title if provided
        if (title && titleEl) {
            titleEl.textContent = title;
        }

        // Add active/open classes
        drawer.classList.add('active', 'open');

        // Prevent body scroll
        document.body.style.overflow = 'hidden';

        // Set state
        isOpen = true;

        // Focus management - focus the first focusable element in content
        setTimeout(() => {
            const content = getContent();
            if (content) {
                const firstInput = content.querySelector('input:not([type="hidden"]), select, textarea');
                if (firstInput) {
                    firstInput.focus();
                }
            }
        }, 300); // Wait for animation to complete
    }

    /**
     * Close the form drawer
     */
    function close() {
        const drawer = getDrawer();

        if (!drawer) {
            return;
        }

        // Remove active/open classes
        drawer.classList.remove('active', 'open');

        // Restore body scroll
        document.body.style.overflow = '';

        // Set state
        isOpen = false;

        // Clear content after animation
        setTimeout(() => {
            const content = getContent();
            if (content) {
                content.innerHTML = '';
            }
        }, 300);
    }

    /**
     * Handle HTMX response after form submission
     * @param {Event} event - The HTMX after-request event
     */
    function handleResponse(event) {
        // Mark the event as handled so the global listener doesn't re-invoke us
        // when the same event is also handled by an hx-on:: attribute (HTMX 2.x).
        if (event.detail._sheetHandled) return;
        event.detail._sheetHandled = true;

        var xhr = event.detail.xhr;
        var successful = event.detail.successful;

        if (successful) {
            // Default behavior: close drawer on success
            close();

            // Dispatch success event
            document.dispatchEvent(new CustomEvent('formSuccess', {
                detail: {
                    xhr: xhr,
                    response: xhr.responseText
                }
            }));

            // Reload the page after a brief delay to reflect the new data.
            // The delay allows HTMX to finish processing the HX-Trigger
            // header before the navigation starts, avoiding a race between
            // the HTMX DOM swap and the browser reload.
            setTimeout(function() { window.location.reload(); }, 100);
        } else {
            // Handle error
            const errorMessage = xhr.getResponseHeader('HX-Error-Message') || 'An error occurred. Please try again.';

            // Dispatch error event
            document.dispatchEvent(new CustomEvent('formError', {
                detail: {
                    xhr: xhr,
                    message: errorMessage
                }
            }));

            // Show error in drawer
            showError(errorMessage);
        }
    }

    /**
     * Show error message in the drawer
     * @param {string} message - The error message to display
     */
    function showError(message) {
        const content = getContent();
        if (!content) return;

        // Look for existing error element or create one
        let errorEl = content.querySelector('.form-drawer-error');

        if (!errorEl) {
            errorEl = document.createElement('div');
            errorEl.className = 'form-drawer-error';
            content.insertBefore(errorEl, content.firstChild);
        }

        errorEl.textContent = message;
        errorEl.classList.add('visible');

        // Auto-hide after 5 seconds
        setTimeout(() => {
            errorEl.classList.remove('visible');
        }, 5000);
    }

    /**
     * Hide error message
     */
    function hideError() {
        const content = getContent();
        if (!content) return;

        const errorEl = content.querySelector('.form-drawer-error');
        if (errorEl) {
            errorEl.classList.remove('visible');
        }
    }

    /**
     * Trigger table refresh via HTMX
     */
    function refreshTable() {
        // Dispatch custom event for table refresh
        document.dispatchEvent(new CustomEvent('refreshTable'));

        // Find table card with a refresh URL
        const tableCard = document.querySelector('.table-card[data-refresh-url]');
        if (tableCard && typeof htmx !== 'undefined') {
            const refreshUrl = tableCard.dataset.refreshUrl;
            if (refreshUrl) {
                // HTMX ajax target must be a CSS selector string, not a DOM element.
                // Passing a DOM element as the target causes HTMX to do a full page
                // navigation instead of a partial swap.
                console.log('Refreshing table via HTMX:', refreshUrl);
                htmx.ajax('GET', refreshUrl, {
                    target: `#${tableCard.id}`,  // Use ID selector string, not element
                    swap: 'outerHTML',
                    pushUrl: false  // Don't update browser URL
                });
                return;
            }
        }

        // Find any element with hx-get that should refresh
        const tableBody = document.querySelector('[data-refresh-target]');
        if (tableBody && typeof htmx !== 'undefined') {
            htmx.trigger(tableBody, 'refresh');
            return;
        }

        // Fallback: reload the page if no refresh mechanism is available
        console.log('No refresh URL found, reloading page');
        window.location.reload();
    }

    /**
     * Check if drawer is currently open
     * @returns {boolean}
     */
    function isDrawerOpen() {
        return isOpen;
    }

    // ========================================
    // EVENT LISTENERS
    // ========================================

    function initEventListeners() {
        // Close on overlay click
        document.addEventListener('click', function(e) {
            if (e.target.id === 'sheetOverlay') {
                close();
            }
        });

        // Close button
        document.addEventListener('click', function(e) {
            if (e.target.closest('#sheetClose')) {
                close();
            }
        });

        // Escape key to close
        document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape' && isOpen) {
                close();
            }
        });

        // Listen for HTMX events
        document.addEventListener('formSuccess', function(e) {
            // Additional handling can be added here
            console.log('Form submitted successfully');
        });

        document.addEventListener('formError', function(e) {
            // Additional error handling can be added here
            // HTMX passes the trigger value directly as e.detail (not e.detail.message)
            const message = typeof e.detail === 'string' ? e.detail : (e.detail?.message || 'Unknown error');
            console.error('Form submission error:', message);
        });

        document.addEventListener('refreshTable', function(e) {
            // Additional refresh handling can be added here
            console.log('Table refresh triggered');
        });

        // HTMX-specific events
        if (typeof htmx !== 'undefined') {
            // After content is loaded into drawer
            document.body.addEventListener('htmx:afterSwap', function(e) {
                if (e.detail.target.id === 'sheetContent') {
                    hideError();
                    // Focus first input after content loads
                    setTimeout(() => {
                        const firstInput = e.detail.target.querySelector('input:not([type="hidden"]), select, textarea');
                        if (firstInput) {
                            firstInput.focus();
                        }
                    }, 100);
                }
            });

            // Handle form submission loading state
            document.body.addEventListener('htmx:beforeRequest', function(e) {
                var form = e.detail.elt;
                if (form && (form.closest('#sheetContent') || form.closest('.form-drawer-content'))) {
                    var submitBtn = form.querySelector('button[type="submit"]');
                    if (submitBtn) {
                        submitBtn.disabled = true;
                        submitBtn.classList.add('btn-loading');
                    }
                }
            });

            // Global afterRequest handler for forms inside the sheet.
            // The form templates use hx-on::after-request (HTMX 2.x syntax)
            // but the app loads HTMX 1.9.x which ignores that attribute.
            // This global listener ensures Sheet.handleResponse fires on
            // both success and error for any form POST inside #sheetContent.
            // A flag on the event prevents double-calling if HTMX is later
            // upgraded to 2.x where the attribute handler would also fire.
            document.body.addEventListener('htmx:afterRequest', function(e) {
                var form = e.detail.elt;
                if (form && (form.closest('#sheetContent') || form.closest('.form-drawer-content'))) {
                    var submitBtn = form.querySelector('button[type="submit"]');
                    if (submitBtn) {
                        submitBtn.disabled = false;
                        submitBtn.classList.remove('btn-loading');
                    }
                    // Guard against double invocation (attribute + global listener)
                    if (!e.detail._sheetHandled) {
                        e.detail._sheetHandled = true;
                        handleResponse(e);
                    }
                }
            });
        }
    }

    // ========================================
    // INITIALIZATION
    // ========================================

    function init() {
        initEventListeners();

        // URL Protection - Prevent action URLs from changing browser address bar
        // Similar to dialog.js protection
        let appUrl = window.location.href;

        const checkUrl = function() {
            const currentUrl = window.location.href;
            // Action URLs (e.g., /action/user/user-division/add) are used for HTMX requests
            // and should not appear in the browser's address bar.
            const isActionUrl = currentUrl.includes('/action/');

            if (isActionUrl) {
                // Revert to the last known app URL immediately
                history.replaceState(null, '', appUrl);
            } else if (!currentUrl.includes('/ui/dialog/')) {
                // Update appUrl if we navigated to a non-action URL (normal navigation)
                appUrl = currentUrl;
            }
        };

        // Check URL on hashchange and popstate
        window.addEventListener('hashchange', checkUrl);
        window.addEventListener('popstate', checkUrl);

        // Also use a MutationObserver to catch URL changes
        const urlObserver = new MutationObserver(checkUrl);
        urlObserver.observe(document.documentElement, {
            childList: true,
            subtree: true
        });

        // Check URL periodically as fallback (less frequent than dialog.js)
        setInterval(checkUrl, 100);
    }

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    // ========================================
    // PUBLIC API
    // ========================================

    window.Sheet = {
        open: open,
        close: close,
        handleResponse: handleResponse,
        showError: showError,
        hideError: hideError,
        refreshTable: refreshTable,
        isOpen: isDrawerOpen
    };

})();
