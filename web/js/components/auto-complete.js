/**
 * Auto-Complete Component — external, CSP-safe init for the
 * `auto-complete` dict component (web/templates/components/auto-complete.html).
 *
 * WHY EXTERNAL: the dict-invoked component renders via the {{template
 * "auto-complete" dict …}} path, so it has no PageData / .Nonce in scope and
 * cannot carry nonce="{{.Nonce}}" on an inline <script>. Under the enforcing
 * `script-src 'self'` CSP an un-nonced inline script (including one re-injected
 * by HTMX into a swapped drawer) is REFUSED by the browser. Moving the init
 * here keeps the widget CSP-clean: a same-origin /assets/js file is allowed by
 * 'self', no nonce required.
 *
 * Behaviour-preserving: identical logic to the prior inline IIFE. The only
 * change is sourcing the two former template interpolations from the DOM
 * instead of Go string substitution:
 *   {{.ID}}          → container.id (we scan every `.auto-complete[id]`)
 *   {{.Placeholder}} → container.dataset.placeholder (added to the template)
 *
 * Init lifecycle mirrors form-components.js: wire on DOMContentLoaded and again
 * on htmx:afterSwap so HTMX-loaded drawers initialise. Idempotent via the
 * existing `container.dataset.init` guard the inline script already used.
 */
window.lf = window.lf || {};
window.lf.ui = window.lf.ui || {};

window.lf.ui.AutoComplete = (function () {
    'use strict';

    function initOne(container) {
        if (!container || container.dataset.init) return;
        container.dataset.init = '1';

        const searchURL = container.dataset.searchUrl;
        const isActionMode = !!searchURL;
        const minChars = parseInt(container.dataset.minChars, 10) || 0;
        const hintEl = container.querySelector('.auto-complete-hint');

        const trigger = container.querySelector('.auto-complete-trigger');
        const display = container.querySelector('.auto-complete-display');
        const clearBtn = container.querySelector('.auto-complete-clear');
        const results = container.querySelector('.auto-complete-results');
        const hiddenInput = container.querySelector('.auto-complete-input');
        const searchInput = container.querySelector('.auto-complete-search');
        const emptyState = container.querySelector('.auto-complete-empty');
        const loadingState = container.querySelector('.auto-complete-loading');
        const descriptionEl = document.getElementById(container.id + '-description');
        const placeholder = container.dataset.placeholder || '';

        let debounceTimer = null;
        let abortController = null;
        let focusedIndex = -1;

        // In filter mode, cache the pre-rendered options for client-side filtering
        const allOptions = isActionMode ? [] : Array.from(results.querySelectorAll('.auto-complete-option'));
        // Cache group wrappers so we can hide a whole group (header + options) when
        // none of its children match. Present in filter mode when OptionGroups is
        // used, and (re)populated in action mode after a grouped response renders.
        let allGroups = isActionMode ? [] : Array.from(results.querySelectorAll('.auto-complete-group'));

        function updateGroupVisibility() {
            allGroups.forEach(function(group) {
                var anyVisible = Array.prototype.some.call(
                    group.querySelectorAll('.auto-complete-option'),
                    function(opt) { return !opt.classList.contains('hidden'); }
                );
                group.classList.toggle('hidden', !anyVisible);
            });
        }

        function updateDescription(value) {
            if (!descriptionEl || isActionMode) return;
            var desc = '';
            if (value) {
                var match = allOptions.find(function(opt) { return opt.dataset.value === value; });
                if (match) desc = match.dataset.description || '';
            }
            descriptionEl.textContent = desc;
        }

        function setSelected(value, label) {
            hiddenInput.value = value;
            hiddenInput.setAttribute('value', value); // sync attribute so MutationObservers fire
            display.innerHTML = value
                ? '<span class="auto-complete-value">' + escapeHTML(label) + '</span>'
                : '<span class="auto-complete-placeholder">' + escapeHTML(placeholder) + '</span>';
            clearBtn.style.display = value ? '' : 'none';

            // Update selected class + aria-selected on options (for filter
            // mode, keeps visual + ARIA state consistent)
            if (!isActionMode) {
                allOptions.forEach(function(opt) {
                    var on = opt.dataset.value === value;
                    opt.classList.toggle('selected', on);
                    opt.setAttribute('aria-selected', on ? 'true' : 'false');
                });
            }

            updateDescription(value);

            // Notify the outside world. Two events:
            //   1. Native `change` on the hidden input — dependent autocompletes /
            //      generic form code listens for this.
            //   2. A custom `auto-complete-change` event on the container — HTMX
            //      `hx-trigger="auto-complete-change from:#…"` consumes this to
            //      re-fetch dependent partials (e.g., the subscription drawer's
            //      Spawn Jobs section per
            //      `docs/plan/20260429-auto-spawn-jobs-from-subscription/plan.md §5.1`).
            try {
                hiddenInput.dispatchEvent(new Event('change', { bubbles: true }));
                container.dispatchEvent(new CustomEvent('auto-complete-change', {
                    bubbles: true,
                    detail: { value: value, label: label },
                }));
            } catch (_) { /* older browsers — best-effort */ }

            closeDropdown();
        }

        // Show description for the initially selected value (filter mode only)
        if (!isActionMode) {
            updateDescription(hiddenInput.value);
        }

        function clearSelection() {
            setSelected('', '');
            // Re-open so user can pick a new value
            openDropdown();
        }

        function escapeHTML(str) {
            const d = document.createElement('div');
            d.textContent = str;
            return d.innerHTML;
        }

        function openDropdown() {
            container.classList.add('open');
            trigger.setAttribute('aria-expanded', 'true');
            searchInput.value = '';
            focusedIndex = -1;
            setActiveDescendant('');
            emptyState.classList.remove('visible');
            loadingState.classList.remove('visible');

            if (hintEl) hintEl.classList.remove('visible');

            if (isActionMode) {
                // Action mode: clear results and fetch from server
                results.innerHTML = '';
                if (minChars > 0) {
                    // Show hint until user types enough characters
                    if (hintEl) hintEl.classList.add('visible');
                } else {
                    doSearch('');
                }
            } else {
                // Filter mode: show all pre-rendered options
                allOptions.forEach(function(opt) {
                    opt.classList.remove('hidden');
                });
                allGroups.forEach(function(group) {
                    group.classList.remove('hidden');
                });
                emptyState.classList.remove('visible');
            }

            setTimeout(function() { searchInput.focus(); }, 10);
        }

        function closeDropdown() {
            container.classList.remove('open');
            trigger.setAttribute('aria-expanded', 'false');
            focusedIndex = -1;
            setActiveDescendant('');
        }

        // --- Action mode: server-side search ---

        function doSearch(query) {
            // Re-read the search URL from the dataset each time so that external scripts
            // (e.g. a client autocomplete that appends ?client_id=…) are respected.
            var currentSearchURL = container.dataset.searchUrl;
            if (!currentSearchURL) {
                // No URL set yet (e.g. waiting for a parent selection) — show empty state.
                loadingState.classList.remove('visible');
                emptyState.classList.add('visible');
                return;
            }

            if (abortController) abortController.abort();
            abortController = new AbortController();

            loadingState.classList.add('visible');
            emptyState.classList.remove('visible');
            results.innerHTML = '';

            var url = currentSearchURL + (currentSearchURL.includes('?') ? '&' : '?') + 'q=' + encodeURIComponent(query);

            fetch(url, { signal: abortController.signal })
                .then(function(r) { return r.json(); })
                .then(function(data) {
                    loadingState.classList.remove('visible');
                    focusedIndex = -1;
                    setActiveDescendant('');

                    if (!data || data.length === 0) {
                        emptyState.classList.add('visible');
                        return;
                    }

                    // Grouped shape: [{group, options: [...]}]. Flat: [{value,label}].
                    var grouped = data[0] && Array.isArray(data[0].options);
                    var html = '';
                    if (grouped) {
                        for (var g = 0; g < data.length; g++) {
                            var grp = data[g];
                            var groupLabel = grp.group || '';
                            html += '<div class="auto-complete-group" data-group-label="' + escapeHTML(groupLabel) + '">'
                                + '<div class="auto-complete-group-header" role="presentation">'
                                + escapeHTML(groupLabel)
                                + '</div>';
                            var opts = grp.options || [];
                            for (var j = 0; j < opts.length; j++) {
                                var opt = opts[j];
                                var isSelG = opt.value === hiddenInput.value;
                                var selG = isSelG ? ' selected' : '';
                                html += '<div class="auto-complete-option' + selG + '" '
                                    + 'id="' + container.id + '-option-' + g + '-' + j + '" '
                                    + 'data-value="' + escapeHTML(opt.value) + '" '
                                    + 'data-label="' + escapeHTML(opt.label) + '" '
                                    + 'data-group="' + escapeHTML(groupLabel) + '" '
                                    + 'role="option" '
                                    + 'aria-selected="' + (isSelG ? 'true' : 'false') + '">'
                                    + escapeHTML(opt.label)
                                    + '</div>';
                            }
                            html += '</div>';
                        }
                    } else {
                        for (var i = 0; i < data.length; i++) {
                            var item = data[i];
                            var isSel = item.value === hiddenInput.value;
                            var sel = isSel ? ' selected' : '';
                            html += '<div class="auto-complete-option' + sel + '" '
                                + 'id="' + container.id + '-option-' + i + '" '
                                + 'data-value="' + escapeHTML(item.value) + '" '
                                + 'data-label="' + escapeHTML(item.label) + '" '
                                + 'role="option" '
                                + 'aria-selected="' + (isSel ? 'true' : 'false') + '">'
                                + escapeHTML(item.label)
                                + '</div>';
                        }
                    }
                    results.innerHTML = html;
                    allGroups = Array.from(results.querySelectorAll('.auto-complete-group'));

                    // Attach click handlers to dynamically created options
                    results.querySelectorAll('.auto-complete-option').forEach(function(opt) {
                        opt.addEventListener('click', function(e) {
                            e.stopPropagation();
                            setSelected(this.dataset.value, this.dataset.label);
                        });
                    });
                })
                .catch(function(err) {
                    if (err.name !== 'AbortError') {
                        loadingState.classList.remove('visible');
                        emptyState.classList.add('visible');
                    }
                });
        }

        // --- Filter mode: client-side filtering ---

        function filterOptions(query) {
            var lowerQuery = query.toLowerCase();
            var visibleCount = 0;

            allOptions.forEach(function(opt) {
                var matches = opt.dataset.label.toLowerCase().includes(lowerQuery);
                opt.classList.toggle('hidden', !matches);
                if (matches) visibleCount++;
            });

            updateGroupVisibility();
            emptyState.classList.toggle('visible', visibleCount === 0);
            focusedIndex = -1;
            setActiveDescendant('');
        }

        // --- Shared: search input handler ---

        searchInput.addEventListener('input', function() {
            if (isActionMode) {
                clearTimeout(debounceTimer);
                var val = searchInput.value.trim();
                if (minChars > 0 && val.length < minChars) {
                    // Not enough characters — show hint, clear results
                    results.innerHTML = '';
                    emptyState.classList.remove('visible');
                    loadingState.classList.remove('visible');
                    if (hintEl) hintEl.classList.add('visible');
                    return;
                }
                if (hintEl) hintEl.classList.remove('visible');
                debounceTimer = setTimeout(function() {
                    doSearch(val);
                }, 300);
            } else {
                filterOptions(searchInput.value);
            }
        });

        // Prevent search input from closing dropdown
        searchInput.addEventListener('click', function(e) { e.stopPropagation(); });

        // --- Shared: keyboard navigation ---

        searchInput.addEventListener('keydown', function(e) {
            var options = results.querySelectorAll('.auto-complete-option:not(.hidden):not(.disabled)');

            if (e.key === 'ArrowDown') {
                e.preventDefault();
                focusedIndex = Math.min(focusedIndex + 1, options.length - 1);
                updateFocus(options);
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                focusedIndex = Math.max(focusedIndex - 1, 0);
                updateFocus(options);
            } else if (e.key === 'Enter') {
                e.preventDefault();
                if (focusedIndex >= 0 && focusedIndex < options.length) {
                    var opt = options[focusedIndex];
                    setSelected(opt.dataset.value, opt.dataset.label);
                }
            } else if (e.key === 'Escape') {
                closeDropdown();
                trigger.focus();
            }
        });

        function ensureOptionId(opt, i) {
            // Dynamically-rendered options always get an id from doSearch, and
            // server-rendered ones from the template; this is a belt-and-braces
            // fallback so aria-activedescendant can always point somewhere real.
            if (!opt.id) opt.id = container.id + '-option-nav-' + i;
            return opt.id;
        }

        // aria-activedescendant lives on the element that owns keyboard focus
        // while the listbox is open. Focus moves into .auto-complete-search on
        // open, so the search input is the active-descendant container; the
        // trigger (role="combobox") mirrors it so AT that tracks the combobox
        // still gets the active option.
        function setActiveDescendant(id) {
            if (id) {
                searchInput.setAttribute('aria-activedescendant', id);
                trigger.setAttribute('aria-activedescendant', id);
            } else {
                searchInput.removeAttribute('aria-activedescendant');
                trigger.removeAttribute('aria-activedescendant');
            }
        }

        function updateFocus(options) {
            var activeId = '';
            options.forEach(function(o, i) {
                var on = i === focusedIndex;
                o.classList.toggle('focused', on);
                if (on) {
                    activeId = ensureOptionId(o, i);
                    o.scrollIntoView({ block: 'nearest' });
                }
            });
            setActiveDescendant(activeId);
        }

        // --- Shared: trigger interactions ---

        trigger.addEventListener('click', function(e) {
            if (e.target.closest('.auto-complete-clear')) return;
            container.classList.contains('open') ? closeDropdown() : openDropdown();
        });

        clearBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            clearSelection();
        });

        document.addEventListener('click', function(e) {
            if (!container.contains(e.target)) closeDropdown();
        });

        trigger.addEventListener('keydown', function(e) {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                container.classList.contains('open') ? closeDropdown() : openDropdown();
            } else if (e.key === 'Escape') {
                closeDropdown();
            }
        });

        // --- Filter mode: attach click handlers to pre-rendered options ---

        if (!isActionMode) {
            allOptions.forEach(function(opt) {
                opt.addEventListener('click', function(e) {
                    e.stopPropagation();
                    if (this.classList.contains('disabled')) return;
                    setSelected(this.dataset.value, this.dataset.label);
                });
            });
        }
    }

    function init(root) {
        var scope = root || document;
        // Initialise every auto-complete container in scope. Each is keyed by
        // its own id; the per-container dataset.init guard makes re-runs safe.
        var containers = scope.querySelectorAll('.auto-complete[id]');
        containers.forEach(initOne);
        // When the swapped root IS itself an auto-complete container, the
        // descendant query above misses it — handle that case.
        if (scope.nodeType === 1 && scope.matches && scope.matches('.auto-complete[id]')) {
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
