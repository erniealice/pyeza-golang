/**
 * Multi-Select Component — external, CSP-safe init for the `multi-select`
 * dict component (web/templates/components/multi-select.html).
 *
 * WHY EXTERNAL: like auto-complete, this dict-invoked component renders via the
 * {{template "multi-select" dict …}} path with no PageData / .Nonce in scope,
 * so its former inline <script> cannot carry nonce="{{.Nonce}}". Under the
 * enforcing `script-src 'self'` CSP an un-nonced inline script (including one
 * HTMX re-injects into a swapped drawer) is REFUSED. Sourcing the init from a
 * same-origin /assets/js file keeps the widget CSP-clean ('self' allows it).
 *
 * Behaviour-preserving: identical logic to the prior inline IIFE. The only
 * change is sourcing the two former template interpolations from the DOM:
 *   {{.ID}}          → container.id (we scan every `.multi-select[id]`)
 *   {{.Placeholder}} → container.dataset.placeholder (added to the template)
 *
 * Init lifecycle mirrors form-components.js: wire on DOMContentLoaded and again
 * on htmx:afterSwap so HTMX-loaded drawers initialise. Idempotent via a
 * per-container dataset.msInit guard.
 */
window.lf = window.lf || {};
window.lf.ui = window.lf.ui || {};

window.lf.ui.MultiSelect = (function () {
    'use strict';

    function initOne(container) {
        if (!container || container.dataset.msInit) return;
        container.dataset.msInit = '1';

        const trigger = container.querySelector('.multi-select-trigger');
        const selectedContainer = container.querySelector('.multi-select-selected');
        const optionsContainer = container.querySelector('.multi-select-options');
        const hiddenInput = container.querySelector('.multi-select-input');
        const searchInput = container.querySelector('.multi-select-search');
        const emptyState = container.querySelector('.multi-select-empty');
        const allOptions = Array.from(optionsContainer.querySelectorAll('.multi-select-option'));

        // Config from data attributes
        const MAX_VISIBLE_CHIPS = parseInt(container.dataset.maxChips) || 2;
        const moreSelectedTemplate = container.dataset.moreTemplate || '+{count} more';
        const placeholder = container.dataset.placeholder || '';

        // Initialize selected values from pre-selected chips
        const selected = new Map();
        container.querySelectorAll('.multi-select-chip').forEach(chip => {
            const value = chip.dataset.value;
            const label = chip.querySelector('.multi-select-chip-label')?.textContent || '';
            if (value) selected.set(value, label.trim());
        });

        function updateDisplay() {
            selectedContainer.innerHTML = '';

            if (selected.size === 0) {
                selectedContainer.innerHTML = `<span class="multi-select-placeholder">${placeholder}</span>`;
            } else {
                const isOpen = container.classList.contains('open');
                const entries = Array.from(selected.entries());
                const visibleCount = isOpen ? entries.length : Math.min(MAX_VISIBLE_CHIPS, entries.length);
                const hiddenCount = entries.length - visibleCount;

                // Show visible chips
                entries.slice(0, visibleCount).forEach(([value, label]) => {
                    const chip = document.createElement('span');
                    chip.className = 'multi-select-chip';
                    chip.dataset.value = value;
                    chip.innerHTML = `
                        <span class="multi-select-chip-label">${label}</span>
                        <button type="button" class="multi-select-chip-remove" aria-label="Remove ${label}">&times;</button>
                    `;
                    selectedContainer.appendChild(chip);
                });

                // Show "+X more" counter if there are hidden chips
                if (hiddenCount > 0 && !isOpen) {
                    const counter = document.createElement('span');
                    counter.className = 'multi-select-overflow-count';
                    counter.textContent = moreSelectedTemplate.replace('{count}', hiddenCount);
                    counter.title = entries.slice(visibleCount).map(([_, label]) => label).join(', ');
                    selectedContainer.appendChild(counter);
                }
            }

            // Update option visual states
            allOptions.forEach(opt => {
                opt.classList.toggle('selected', selected.has(opt.dataset.value));
            });

            // Update hidden input with comma-separated values
            hiddenInput.value = Array.from(selected.keys()).join(',');

            // Update ARIA state
            trigger.setAttribute('aria-expanded', container.classList.contains('open'));
        }

        function toggleOption(value, label) {
            if (selected.has(value)) {
                selected.delete(value);
            } else {
                selected.set(value, label);
            }
            updateDisplay();
        }

        function filterOptions(query) {
            const lowerQuery = query.toLowerCase();
            let visibleCount = 0;

            allOptions.forEach(opt => {
                const label = opt.dataset.label.toLowerCase();
                const matches = label.includes(lowerQuery);
                opt.classList.toggle('hidden', !matches);
                if (matches) visibleCount++;
            });

            // Show/hide empty state
            if (emptyState) {
                emptyState.classList.toggle('visible', visibleCount === 0);
            }
        }

        function openDropdown() {
            container.classList.add('open');
            trigger.setAttribute('aria-expanded', 'true');
            if (searchInput) {
                searchInput.value = '';
                filterOptions('');
                setTimeout(() => searchInput.focus(), 10);
            }
            updateDisplay(); // Re-render to show all chips
        }

        function closeDropdown() {
            container.classList.remove('open');
            trigger.setAttribute('aria-expanded', 'false');
            updateDisplay(); // Re-render to show collapsed state with overflow
        }

        // Click on trigger
        trigger.addEventListener('click', function(e) {
            // Handle chip remove button clicks
            if (e.target.classList.contains('multi-select-chip-remove')) {
                e.stopPropagation();
                const chip = e.target.closest('.multi-select-chip');
                if (chip) {
                    selected.delete(chip.dataset.value);
                    updateDisplay();
                }
                return;
            }

            // Toggle dropdown
            if (container.classList.contains('open')) {
                closeDropdown();
            } else {
                openDropdown();
            }
        });

        // Close dropdown when clicking outside
        document.addEventListener('click', function(e) {
            if (!container.contains(e.target)) {
                closeDropdown();
            }
        });

        // Option selection
        allOptions.forEach(opt => {
            opt.addEventListener('click', function(e) {
                e.stopPropagation();
                toggleOption(this.dataset.value, this.dataset.label);
            });
        });

        // Search functionality
        if (searchInput) {
            searchInput.addEventListener('input', function(e) {
                filterOptions(e.target.value);
            });

            // Prevent search input from closing dropdown
            searchInput.addEventListener('click', function(e) {
                e.stopPropagation();
            });

            searchInput.addEventListener('keydown', function(e) {
                if (e.key === 'Escape') {
                    closeDropdown();
                    trigger.focus();
                }
            });
        }

        // Keyboard navigation
        trigger.addEventListener('keydown', function(e) {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                if (container.classList.contains('open')) {
                    closeDropdown();
                } else {
                    openDropdown();
                }
            } else if (e.key === 'Escape') {
                closeDropdown();
            }
        });

        // Initialize display
        updateDisplay();
    }

    function init(root) {
        var scope = root || document;
        var containers = scope.querySelectorAll('.multi-select[id]');
        containers.forEach(initOne);
        // When the swapped root IS itself a multi-select container, the
        // descendant query above misses it — handle that case.
        if (scope.nodeType === 1 && scope.matches && scope.matches('.multi-select[id]')) {
            initOne(scope);
        }
    }

    // Auto-wire on initial load.
    document.addEventListener('DOMContentLoaded', function () { init(); });

    // Re-wire whenever HTMX swaps content (covers drawer / partial loads where
    // the inline <script> used to re-run). Scope to the swapped subtree.
    document.addEventListener('htmx:afterSwap', function (e) {
        init(e.detail && e.detail.target ? e.detail.target : document);
    });

    return { init: init };
})();
