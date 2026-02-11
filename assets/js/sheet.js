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

            // Show success toast
            showToast('Changes saved successfully.', 'success');

            // Refresh the table after a brief delay to reflect the new data.
            // The delay allows HTMX to finish processing the HX-Trigger
            // header before the refresh starts.  Using refreshTable() instead
            // of window.location.reload() avoids a race where the full-page
            // reload interrupts the close() CSS transition and the sheet
            // appears to stay open.
            setTimeout(function() { refreshTable(); }, 100);
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
     * Show a toast notification.
     * Requires #toast-container in the DOM (from toast-container template).
     * The toast-init MutationObserver auto-handles dismiss timers.
     * @param {string} message - Text to display
     * @param {string} [state] - success | error | warning | info (default: success)
     */
    function showToast(message, state) {
        state = state || 'success';
        var container = document.getElementById('toast-container');
        if (!container) return;

        var toast = document.createElement('div');
        toast.className = 'toast toast-' + state;
        toast.setAttribute('role', 'alert');
        toast.setAttribute('aria-live', 'assertive');
        toast.setAttribute('data-duration', '3000');
        toast.setAttribute('data-delay', '0');

        // Icon SVGs — lightweight inline versions matching pyeza icon templates
        var icons = {
            success: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>',
            error: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>',
            warning: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
            info: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>'
        };

        toast.innerHTML =
            '<div class="toast-icon">' + (icons[state] || icons.info) + '</div>' +
            '<div class="toast-body"><div class="toast-message">' + message + '</div></div>' +
            '<button class="toast-close" aria-label="Dismiss notification" onclick="this.closest(\'.toast\').classList.add(\'toast-exit\')">' +
                '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>' +
            '</button>' +
            '<div class="toast-progress" style="animation-duration: 3000ms; animation-delay: 0ms;"></div>';

        container.appendChild(toast);
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
                    // Guard against double invocation (attribute + global listener).
                    // Do NOT set _sheetHandled here — let handleResponse() set it,
                    // otherwise handleResponse() sees the flag and returns early.
                    if (!e.detail._sheetHandled) {
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
        showToast: showToast,
        refreshTable: refreshTable,
        isOpen: isDrawerOpen
    };

})();
