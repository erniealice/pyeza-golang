/**
 * Help Pane - Knowledge Base Side Panel
 *
 * Controls the help pane toggle behavior and keyboard shortcuts.
 * The help pane pushes main content to the left when opened.
 * Handles HTMX OOB swaps to maintain state across navigation.
 */

(function() {
    'use strict';

    // Get fresh references to DOM elements
    function getElements() {
        return {
            helpToggleBtn: document.getElementById('helpToggleBtn'),
            helpPane: document.getElementById('helpPane'),
            helpPaneClose: document.getElementById('helpPaneClose')
        };
    }

    // Toggle help pane
    function toggleHelpPane() {
        const { helpPane } = getElements();
        if (!helpPane) return;

        const isOpen = helpPane.classList.contains('open');
        if (isOpen) {
            closeHelpPane();
        } else {
            openHelpPane();
        }
    }

    function openHelpPane() {
        const { helpToggleBtn, helpPane } = getElements();
        if (!helpPane) return;

        helpPane.classList.add('open');
        document.body.classList.add('help-pane-open');
        if (helpToggleBtn) {
            helpToggleBtn.classList.add('active');
            helpToggleBtn.setAttribute('aria-expanded', 'true');
        }
        localStorage.setItem('helpPaneOpen', 'true');
    }

    function closeHelpPane() {
        const { helpToggleBtn, helpPane } = getElements();
        if (!helpPane) return;

        helpPane.classList.remove('open');
        document.body.classList.remove('help-pane-open');
        if (helpToggleBtn) {
            helpToggleBtn.classList.remove('active');
            helpToggleBtn.setAttribute('aria-expanded', 'false');
        }
        localStorage.setItem('helpPaneOpen', 'false');
    }

    // Initialize event listeners on elements
    function initEventListeners() {
        const { helpToggleBtn, helpPaneClose } = getElements();

        if (helpToggleBtn && !helpToggleBtn._helpPaneInitialized) {
            helpToggleBtn.addEventListener('click', toggleHelpPane);
            helpToggleBtn._helpPaneInitialized = true;
        }

        if (helpPaneClose && !helpPaneClose._helpPaneInitialized) {
            helpPaneClose.addEventListener('click', closeHelpPane);
            helpPaneClose._helpPaneInitialized = true;
        }
    }

    // Restore state from localStorage
    function restoreState() {
        if (localStorage.getItem('helpPaneOpen') === 'true') {
            openHelpPane();
        }
    }

    // Initialize on page load
    function init() {
        const { helpToggleBtn, helpPane } = getElements();
        if (!helpToggleBtn || !helpPane) return;

        initEventListeners();
        restoreState();
    }

    // Initial setup
    init();

    // Check if state needs restoration and apply it
    function ensureState() {
        const shouldBeOpen = localStorage.getItem('helpPaneOpen') === 'true';
        const { helpPane, helpToggleBtn } = getElements();

        if (!helpPane) return;

        const isCurrentlyOpen = helpPane.classList.contains('open');

        // Only apply state if it doesn't match localStorage
        if (shouldBeOpen && !isCurrentlyOpen) {
            helpPane.classList.add('open');
            document.body.classList.add('help-pane-open');
            if (helpToggleBtn) {
                helpToggleBtn.classList.add('active');
                helpToggleBtn.setAttribute('aria-expanded', 'true');
            }
        } else if (!shouldBeOpen && isCurrentlyOpen) {
            helpPane.classList.remove('open');
            document.body.classList.remove('help-pane-open');
            if (helpToggleBtn) {
                helpToggleBtn.classList.remove('active');
                helpToggleBtn.setAttribute('aria-expanded', 'false');
            }
        }

        // Always ensure event listeners are attached
        initEventListeners();
    }

    // Continuous background check - runs every 100ms to ensure state consistency
    // This is the most reliable approach for catching OOB swaps
    setInterval(function() {
        const shouldBeOpen = localStorage.getItem('helpPaneOpen') === 'true';
        const { helpPane, helpToggleBtn } = getElements();

        if (!helpPane) return;

        const isCurrentlyOpen = helpPane.classList.contains('open');

        // Only fix if state doesn't match
        if (shouldBeOpen !== isCurrentlyOpen) {
            if (shouldBeOpen) {
                helpPane.classList.add('open');
                document.body.classList.add('help-pane-open');
                if (helpToggleBtn) {
                    helpToggleBtn.classList.add('active');
                    helpToggleBtn.setAttribute('aria-expanded', 'true');
                }
            } else {
                helpPane.classList.remove('open');
                document.body.classList.remove('help-pane-open');
                if (helpToggleBtn) {
                    helpToggleBtn.classList.remove('active');
                    helpToggleBtn.setAttribute('aria-expanded', 'false');
                }
            }
        }

        // Always re-initialize event listeners to catch OOB swaps
        // even when visual state doesn't change
        initEventListeners();
    }, 100);

    // Keyboard shortcut: ? to toggle help
    document.addEventListener('keydown', function(e) {
        // Skip if user is typing in an input
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) {
            return;
        }

        // ? key (Shift + /)
        if (e.key === '?' || (e.shiftKey && e.key === '/')) {
            e.preventDefault();
            toggleHelpPane();
        }

        // Escape to close
        const { helpPane } = getElements();
        if (e.key === 'Escape' && helpPane && helpPane.classList.contains('open')) {
            closeHelpPane();
        }
    });
})();
