/**
 * Help Pane - Knowledge Base Side Panel
 *
 * Controls the help pane toggle behavior and keyboard shortcuts.
 * The help pane pushes main content to the left when opened.
 *
 * Binding model: document-level event delegation. Works across HTMX OOB
 * swaps of the header (#helpToggleBtn) and the help pane (#helpPane,
 * #helpPaneClose) without needing to re-attach listeners on every
 * htmx:afterSwap. Also re-applies the persisted open state from
 * localStorage on every htmx:afterSettle so an OOB-swapped fresh
 * #helpPane reflects the previous user choice.
 */

(function() {
    'use strict';

    var STORAGE_KEY = 'lf-help-pane-open';

    function getElements() {
        return {
            helpToggleBtn: document.getElementById('helpToggleBtn'),
            helpPane: document.getElementById('helpPane'),
            helpPaneClose: document.getElementById('helpPaneClose')
        };
    }

    function isOpen() {
        var helpPane = document.getElementById('helpPane');
        return !!(helpPane && helpPane.classList.contains('open'));
    }

    function openHelpPane() {
        var els = getElements();
        if (!els.helpPane) return;
        els.helpPane.classList.add('open');
        document.body.classList.add('help-pane-open');
        if (els.helpToggleBtn) {
            els.helpToggleBtn.classList.add('active');
            els.helpToggleBtn.setAttribute('aria-expanded', 'true');
        }
        localStorage.setItem(STORAGE_KEY, 'true');
    }

    function closeHelpPane() {
        var els = getElements();
        if (!els.helpPane) return;
        els.helpPane.classList.remove('open');
        document.body.classList.remove('help-pane-open');
        if (els.helpToggleBtn) {
            els.helpToggleBtn.classList.remove('active');
            els.helpToggleBtn.setAttribute('aria-expanded', 'false');
        }
        localStorage.setItem(STORAGE_KEY, 'false');
    }

    function toggleHelpPane() {
        if (isOpen()) {
            closeHelpPane();
        } else {
            openHelpPane();
        }
    }

    // Re-apply persisted open state to whatever #helpPane currently exists.
    // Called on initial load and after every HTMX settle (which is when
    // OOB-swapped #helpPane / #helpToggleBtn become live in the DOM).
    function syncStateFromStorage() {
        var shouldBeOpen = localStorage.getItem(STORAGE_KEY) === 'true';
        var els = getElements();
        if (!els.helpPane) return;

        var currentlyOpen = els.helpPane.classList.contains('open');
        if (shouldBeOpen && !currentlyOpen) {
            els.helpPane.classList.add('open');
            document.body.classList.add('help-pane-open');
            if (els.helpToggleBtn) {
                els.helpToggleBtn.classList.add('active');
                els.helpToggleBtn.setAttribute('aria-expanded', 'true');
            }
        } else if (!shouldBeOpen && currentlyOpen) {
            els.helpPane.classList.remove('open');
            document.body.classList.remove('help-pane-open');
            if (els.helpToggleBtn) {
                els.helpToggleBtn.classList.remove('active');
                els.helpToggleBtn.setAttribute('aria-expanded', 'false');
            }
        }
    }

    // Document-level event delegation — survives any HTMX swap.
    document.addEventListener('click', function(e) {
        if (e.target.closest('#helpToggleBtn')) {
            e.preventDefault();
            toggleHelpPane();
            return;
        }
        if (e.target.closest('#helpPaneClose')) {
            e.preventDefault();
            closeHelpPane();
            return;
        }
    });

    // Keyboard shortcuts: ? toggles, Escape closes.
    document.addEventListener('keydown', function(e) {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) {
            return;
        }
        if (e.key === '?' || (e.shiftKey && e.key === '/')) {
            e.preventDefault();
            toggleHelpPane();
            return;
        }
        if (e.key === 'Escape' && isOpen()) {
            closeHelpPane();
        }
    });

    // Sync state on first load and after every HTMX swap (OOB header
    // and help-pane swaps land in the DOM by the time afterSettle fires).
    syncStateFromStorage();
    document.body.addEventListener('htmx:afterSettle', syncStateFromStorage);
})();
