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
    let _opener = null; // element that triggered the open — restored on close

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
    // INERT HELPERS (P3)
    // ========================================

    function setBackgroundInert(inert) {
        // Only inert the sidebar — the sheet overlay + focus-trap handles the rest.
        // Note: inerting <main> causes <body> to intercept pointer events on sheet buttons.
        var sidebar = document.getElementById('sidebar');
        if (sidebar) {
            if (inert) {
                sidebar.setAttribute('inert', '');
            } else {
                sidebar.removeAttribute('inert');
            }
        }
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

        // P0: store the opener so we can restore focus on close
        _opener = document.activeElement;

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

        // P3: suppress background
        setBackgroundInert(true);

        // P0: install focus trap on the sheet panel; move focus inside after animation
        const panel = drawer.querySelector('.sheet-panel') || drawer;
        setTimeout(() => {
            if (window.lf && window.lf.FocusTrap) window.lf.FocusTrap.trapFocus(panel);

            const content = getContent();
            if (content) {
                const firstInput = content.querySelector('input:not([type="hidden"]), select, textarea, button:not([disabled])');
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

        // P0: release focus trap
        const panel = drawer.querySelector('.sheet-panel') || drawer;
        if (window.lf && window.lf.FocusTrap) window.lf.FocusTrap.releaseFocus(panel);

        // Remove active/open classes
        drawer.classList.remove('active', 'open');

        // Restore body scroll
        document.body.style.overflow = '';

        // Set state
        isOpen = false;

        // P3: restore background interactivity
        setBackgroundInert(false);

        // P0: restore focus to the opener
        if (_opener && typeof _opener.focus === 'function') {
            _opener.focus();
        }
        _opener = null;

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
        // Dedupe: an inline hx-on::after-request attribute on the form AND the
        // global body afterRequest listener both invoke handleResponse for the
        // same submit. event.detail is shared between them, but in some HTMX
        // versions a second event fires with a fresh detail object — guard on
        // the xhr instance itself so a single XHR is processed exactly once.
        var xhr = event.detail.xhr;
        if (!xhr) return;
        if (xhr._sheetHandled) return;
        xhr._sheetHandled = true;
        event.detail._sheetHandled = true;

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

            // Show success toast — text comes from CommonLabels.Toast.Saved
            // via <body data-lf-toast-saved>. Toast module handles render.
            showToast(savedToastMessage(), 'success');

            // Extract the target table ID from the HX-Trigger response header.
            // HTMXSuccess sends: {"formSuccess":true,"refreshTable":"clients-table"}
            var targetTableID = null;
            try {
                var triggerHeader = xhr.getResponseHeader('HX-Trigger');
                if (triggerHeader) {
                    var parsed = JSON.parse(triggerHeader);
                    targetTableID = parsed.refreshTable || null;
                }
            } catch (e) { /* ignore parse errors */ }

            // Refresh the table after a brief delay to let the close animation start.
            setTimeout(function() { refreshTable(targetTableID); }, 400);
        } else {
            // Soft block path: when the server signals a re-render via
            // HX-Reswap + HX-Retarget (e.g. recognize-revenue idempotency
            // banner returning 422), honor those headers and swap the
            // response body in. The form's hx-swap="none" would otherwise
            // discard the body and the user would see no feedback.
            const reswap = xhr.getResponseHeader('HX-Reswap');
            const retarget = xhr.getResponseHeader('HX-Retarget');
            if (reswap && retarget && xhr.responseText) {
                const targetEl = document.querySelector(retarget);
                if (targetEl) {
                    if (reswap === 'outerHTML') {
                        targetEl.outerHTML = xhr.responseText;
                    } else if (reswap === 'innerHTML') {
                        targetEl.innerHTML = xhr.responseText;
                    }
                    // Re-process HTMX attributes on the swapped DOM.
                    if (window.htmx && typeof window.htmx.process === 'function') {
                        window.htmx.process(document.querySelector(retarget) || document.body);
                    }
                    return;
                }
            }

            // Default error path
            const errorMessage = xhr.getResponseHeader('HX-Error-Message') || errorFallbackMessage();
            document.dispatchEvent(new CustomEvent('formError', {
                detail: { xhr: xhr, message: errorMessage }
            }));
            if (errorMessage) showError(errorMessage);
        }
    }

    /**
     * Show error message in the drawer.
     *
     * Renders the same markup as the Go-side `alert` component so existing
     * alert.css styles apply uniformly. Sticky — does NOT auto-dismiss.
     * htmx:afterSwap calls hideError() when fresh form content loads, which
     * is the right time to clear: a successful retry replaces the form.
     *
     * @param {string} message - The error message to display
     */
    function showError(message) {
        const content = getContent();
        if (!content) return;

        // Replace any existing alert so re-renders show the latest message.
        const existing = content.querySelector('.sheet-error-alert');
        if (existing) existing.remove();

        const alertEl = document.createElement('div');
        alertEl.className = 'alert alert-error alert-subtle sheet-error-alert';
        alertEl.setAttribute('role', 'alert');

        // Match the Go alert template's DOM: .alert-icon + .alert-body{.alert-title,.alert-message} + .alert-dismiss.
        alertEl.innerHTML = [
            '<div class="alert-icon">',
            '  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">',
            '    <circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>',
            '  </svg>',
            '</div>',
            '<div class="alert-body">',
            '  <div class="alert-message"></div>',
            '</div>',
            '<button type="button" class="alert-dismiss" aria-label="' + dismissAlertAriaLabel() + '">',
            '  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">',
            '    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>',
            '  </svg>',
            '</button>'
        ].join('');

        // textContent (not innerHTML) — server-supplied error strings shouldn't get parsed as HTML.
        alertEl.querySelector('.alert-message').textContent = message;
        alertEl.querySelector('.alert-dismiss').addEventListener('click', () => alertEl.remove());

        content.insertBefore(alertEl, content.firstChild);
    }

    /**
     * Hide error message
     */
    function hideError() {
        const content = getContent();
        if (!content) return;

        const alertEl = content.querySelector('.sheet-error-alert');
        if (alertEl) alertEl.remove();
    }

    /**
     * Resolve the lyngua-translated "saved" toast message from <body data-lf-toast-saved>.
     * Returns empty string if not set — callers should suppress the toast in that case.
     */
    function savedToastMessage() {
        return (document.body && document.body.dataset && document.body.dataset.lfToastSaved) || '';
    }

    /**
     * Resolve the lyngua-translated error fallback message from
     * <body data-lf-sheet-error-fallback>. Returns empty string if not set —
     * callers should suppress the inline alert in that case.
     */
    function errorFallbackMessage() {
        return (document.body && document.body.dataset && document.body.dataset.lfSheetErrorFallback) || '';
    }

    /**
     * Resolve the lyngua-translated aria-label for the inline error alert's
     * dismiss button from <body data-lf-sheet-dismiss-alert>.
     * Returns empty string if not set.
     */
    function dismissAlertAriaLabel() {
        return (document.body && document.body.dataset && document.body.dataset.lfSheetDismissAlert) || '';
    }

    /**
     * Show a toast notification — thin shim that delegates to the centralized
     * lf.Toast.show API. Kept on Sheet for backwards-compatibility with
     * pre-existing call sites that used lf.Sheet.showToast.
     *
     * @param {string} message
     * @param {string} [state] - success | error | warning | info (default: success)
     */
    function showToast(message, state) {
        if (!message) return;
        if (!window.lf || !window.lf.Toast || typeof window.lf.Toast.show !== 'function') {
            // Defensive: if toast.js failed to load, fall back to console.
            console.warn('lf.Toast not loaded; toast suppressed:', message);
            return;
        }
        window.lf.Toast.show(message, state || 'success');
    }

    /**
     * Trigger table refresh via HTMX
     * @param {string|null} tableID - Optional table ID from HX-Trigger header (e.g. "clients-table")
     */
    function refreshTable(tableID) {
        // Dispatch custom event for table refresh
        document.dispatchEvent(new CustomEvent('refreshTable', { detail: { tableID: tableID } }));

        // Find table card — prefer targeted lookup by ID, fall back to first match
        var tableCard = null;
        if (tableID) {
            tableCard = document.getElementById(tableID + '-card') || document.getElementById(tableID);
        }
        if (!tableCard) {
            tableCard = document.querySelector('.table-card[data-refresh-url]');
        }
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

        // CSP-prep (Plan-6): delegated close for form Cancel/close buttons that
        // previously carried inline `onclick="lf.ui.Sheet.close()"`. Inline
        // event-handler attributes cannot be nonced/hashed and block an
        // enforcing `script-src 'self'`, so footer cancel buttons now declare a
        // `data-sheet-close` (or `data-sheet-cancel`) hook instead. Document
        // delegation matches even freshly HTMX-swapped drawer content. Behavior
        // is identical to calling close() directly. `data-sheet-close` may carry
        // a component-id value (sheet.html) — it is ignored here; the global
        // drawer close() is the only close path the app uses.
        document.addEventListener('click', function(e) {
            if (e.target.closest('[data-sheet-close], [data-sheet-cancel]')) {
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
            // P1: set aria-busy before HTMX loads content into the sheet
            document.body.addEventListener('htmx:beforeRequest', function(e) {
                if (e.detail.target && e.detail.target.id === 'sheetContent') {
                    e.detail.target.setAttribute('aria-busy', 'true');
                }

                // Also disable submit button while a form inside the sheet is submitting
                var form = e.detail.elt;
                if (form && (form.closest('#sheetContent') || form.closest('.form-drawer-content'))) {
                    var submitBtn = form.querySelector('button[type="submit"]');
                    if (submitBtn) {
                        submitBtn.disabled = true;
                        submitBtn.classList.add('btn-loading');
                    }
                }
            });

            // After content is loaded into drawer
            document.body.addEventListener('htmx:afterSwap', function(e) {
                if (e.detail.target.id === 'sheetContent') {
                    // P1: remove aria-busy once content has swapped in
                    e.detail.target.removeAttribute('aria-busy');

                    hideError();
                    // Focus first input after content loads
                    setTimeout(() => {
                        const firstInput = e.detail.target.querySelector('input:not([type="hidden"]), select, textarea, button:not([disabled])');
                        if (firstInput) {
                            firstInput.focus();
                        }
                    }, 100);
                }
            });

            // P1: before outerHTML swap, capture focused element identity; restore after settle.
            // Stored in closure variable — DOM element is destroyed by outerHTML swap.
            var _sheetFocusId = null;
            document.body.addEventListener('htmx:beforeSwap', function(e) {
                if (e.detail.target && e.detail.target.id === 'sheetContent') {
                    var el = document.activeElement;
                    _sheetFocusId = el && el.id ? el.id : null;
                }
            });

            document.body.addEventListener('htmx:afterSettle', function(e) {
                if (!_sheetFocusId) return;
                var content = document.getElementById('sheetContent');
                if (!content) { _sheetFocusId = null; return; }
                var restored = document.getElementById(_sheetFocusId);
                if (restored && content.contains(restored) && typeof restored.focus === 'function') {
                    restored.focus();
                }
                _sheetFocusId = null;
            });

            // Global afterRequest handler for forms inside the sheet.
            // The form templates use hx-on::after-request (HTMX 2.x syntax)
            // but the app loads HTMX 1.9.x which ignores that attribute.
            // This global listener ensures Sheet.handleResponse fires on
            // both success and error for any form POST inside #sheetContent.
            // A flag on the event prevents double-calling if HTMX is later
            // upgraded to 2.x where the attribute handler would also fire.
            document.body.addEventListener('htmx:afterRequest', function(e) {
                var elt = e.detail.elt;
                if (!elt) return;
                // Only real form submissions should trigger close/toast/refresh.
                // In-sheet HTMX requests from selects/inputs (dependent dropdowns,
                // auto-complete, etc.) must pass through without closing the sheet.
                if (elt.tagName !== 'FORM') return;
                if (elt.closest('#sheetContent') || elt.closest('.form-drawer-content')) {
                    var submitBtn = elt.querySelector('button[type="submit"]');
                    if (submitBtn) {
                        submitBtn.disabled = false;
                        submitBtn.classList.remove('btn-loading');
                    }
                    if (!e.detail._sheetHandled) {
                        handleResponse(e);
                    }
                }
            });

            // HTMX history-restore guard. Backstop for the
            // pushUrl:false fix in table-actions.js — if any other code path
            // ever lets a drawer-state body snapshot enter history,
            // popstate-restore will leave #sheet open with empty content
            // because #sheet sits outside HTMX's #main-content swap target.
            // Force-close the drawer here whenever a snapshot is restored.
            document.body.addEventListener('htmx:historyRestore', function () {
                var drawer = getDrawer();
                if (!drawer) return;
                if (drawer.classList.contains('open') || drawer.classList.contains('active')) {
                    drawer.classList.remove('active', 'open');
                    document.body.style.overflow = '';
                    isOpen = false;
                    setBackgroundInert(false);
                    _opener = null;
                    if (window.lf && window.lf.FocusTrap) {
                        var panel = drawer.querySelector('.sheet-panel') || drawer;
                        window.lf.FocusTrap.releaseFocus(panel);
                    }
                    var content = getContent();
                    if (content) content.innerHTML = '';
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

    window.lf = window.lf || {};
    window.lf.ui = window.lf.ui || {};
    window.lf.ui.Sheet = {
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
