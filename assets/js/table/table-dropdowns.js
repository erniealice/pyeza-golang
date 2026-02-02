/**
 * Table Dropdowns - Toolbar dropdown management
 *
 * HTMX Navigation Compatibility:
 * When HTMX swaps content, buttons are replaced with new DOM elements that don't
 * have event listeners. This module's init() function must be called after each swap
 * to re-attach listeners to the new buttons.
 */

(function() {
    'use strict';

    // Track if document-level listeners have been added
    let documentListenersInitialized = false;

    // Define handlers outside init so references are stable
    const clickOutsideHandler = function(e) {
        if (!e.target.closest('.toolbar-dropdown')) {
            if (window.TableCore) {
                window.TableCore.closeAllDropdowns();
            }
        }
    };

    const escapeKeyHandler = function(e) {
        if (e.key === 'Escape') {
            if (window.TableCore) {
                window.TableCore.closeAllDropdowns();
            }
        }
    };

    function init() {
        const dropdowns = document.querySelectorAll('.toolbar-dropdown');

        // Add click listeners to all toolbar buttons
        // This MUST run on every init() call for HTMX navigation
        dropdowns.forEach(dropdown => {
            const btn = dropdown.querySelector('.toolbar-btn');
            if (!btn) return;

            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const isOpen = dropdown.classList.contains('open');

                // Close all dropdowns
                if (window.TableCore) {
                    window.TableCore.closeAllDropdowns();
                }

                // Toggle current dropdown
                if (!isOpen) {
                    dropdown.classList.add('open');
                    btn.setAttribute('aria-expanded', 'true');
                }
            });
        });

        // Add document-level listeners (only once)
        // These close dropdowns when clicking outside or pressing Escape
        if (!documentListenersInitialized) {
            document.addEventListener('click', clickOutsideHandler);
            document.addEventListener('keydown', escapeKeyHandler);
            documentListenersInitialized = true;
        }
    }

    // Expose module
    window.TableDropdowns = { init };

})();
