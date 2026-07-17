/**
 * Omni Search — command-palette overlay ("Search Anything")
 *
 * Public API (window.lf namespace):
 *   window.lf.ui.OmniSearch = { open, close, toggle }
 *   window.lf.commandPalette = { open }   // alias — the dashboard quick-action
 *                                         // (apps/[app]/assets/js/home.js) starts working
 *
 * Behaviors:
 *   - Global shortcuts: Cmd/Ctrl+K + Alt+K toggle; Escape closes (gated on isOpen).
 *     Shortcut key matched via e.code === 'KeyK' (layout-independent).
 *   - The palette markup lives in #omni-search-root, lazy-loaded via HTMX on first
 *     open (GET the dialog partial). If #omni-search-root is ABSENT (apps not yet
 *     wired — a later wave), every trigger no-ops silently.
 *   - FocusTrap + inert sidebar while open; opener focus restored on close.
 *   - Results are fetched by the dialog partial's own hx-get input (debounced
 *     declaratively via hx-trigger delay). This module provides a JS-side debounced
 *     fallback ONLY if that input is not HTMX-wired.
 *   - Keyboard result nav: ArrowUp/Down move the active .omni-search-item, Enter
 *     follows the focused result link; aria-activedescendant bookkeeping on the input.
 *   - Triggers bind via document delegation (lf.on) — the header is OOB-swapped on
 *     every boosted nav, so per-element binding is forbidden.
 */

(function () {
    'use strict';

    // Single-registration guard (external <script src> executes once, but a double
    // include or a re-parse must stay a safe no-op).
    if (window.__lfOmniSearchInit) return;
    window.__lfOmniSearchInit = true;

    var ROOT_ID = 'omni-search-root';
    var INPUT_ID = 'omni-search-input';
    var RESULTS_ID = 'omni-search-results';
    var LOADING_ID = 'omni-search-loading';
    var DEFAULT_DIALOG_URL = '/action/omni-search/dialog';
    var DEFAULT_RESULTS_URL = '/action/omni-search/results';

    var _opener = null;      // element focused before open — restored on close
    var _isOpen = false;
    var _activeIndex = -1;   // keyboard-highlighted result row

    // --- element resolvers (never cache — content is HTMX-swapped) ---

    function root() { return document.getElementById(ROOT_ID); }

    function overlay() {
        var r = root();
        return r ? r.querySelector('.omni-search-overlay') : null;
    }

    function inputEl() { return document.getElementById(INPUT_ID); }

    function items() {
        var ov = overlay();
        if (!ov) return [];
        return Array.prototype.slice.call(ov.querySelectorAll('.omni-search-item'));
    }

    function focusTrap() {
        if (window.lf && window.lf.ui && window.lf.ui.FocusTrap) return window.lf.ui.FocusTrap;
        if (window.lf && window.lf.FocusTrap) return window.lf.FocusTrap;
        return null;
    }

    // Inert only the sidebar — the overlay + focus trap handle the rest (mirrors
    // dialog.js: inerting <main> lets <body> intercept pointer events on the panel).
    function setBackgroundInert(inert) {
        var sidebar = document.getElementById('sidebar');
        if (!sidebar) return;
        if (inert) sidebar.setAttribute('inert', '');
        else sidebar.removeAttribute('inert');
    }

    // Document-delegated binding: prefer lf.on (survives OOB swaps), fall back to a
    // plain document listener if lf-on.js has not loaded yet.
    function delegate(evt, selector, handler) {
        if (window.lf && typeof window.lf.on === 'function') {
            window.lf.on(evt, selector, handler);
            return;
        }
        document.addEventListener(evt, function (e) {
            var t = e.target.closest ? e.target.closest(selector) : null;
            if (t) handler.call(t, e);
        });
    }

    // --- open / close ---

    // Lazy-load the dialog partial into #omni-search-root on first open, then run cb.
    function ensureLoaded(cb) {
        var r = root();
        if (!r) return; // fail-safe: palette not mounted
        if (r.querySelector('.omni-search-overlay')) { cb(); return; }
        if (typeof htmx === 'undefined') return;
        var dialogURL = r.getAttribute('data-dialog-url') || DEFAULT_DIALOG_URL;
        var p = htmx.ajax('GET', dialogURL, {
            target: '#' + ROOT_ID,
            swap: 'innerHTML',
            pushUrl: false   // /action/* partials never pollute the address bar
        });
        if (p && typeof p.then === 'function') p.then(function () { cb(); });
        else cb();
    }

    function open() {
        if (!root()) return;   // fail-safe: no palette mounted → silent no-op
        if (_isOpen) return;
        _opener = document.activeElement;
        ensureLoaded(function () {
            var ov = overlay();
            if (!ov) return;
            ov.hidden = false;
            void ov.offsetWidth;            // reflow so the transition runs
            ov.classList.add('visible');
            setBackgroundInert(true);
            _isOpen = true;
            _activeIndex = -1;
            var ft = focusTrap();
            if (ft) ft.trapFocus(ov);
            var input = inputEl();
            if (input) {
                input.setAttribute('aria-expanded', 'true');
                input.focus();
                if (typeof input.select === 'function') input.select();
            }
        });
    }

    function close() {
        var ov = overlay();
        if (!ov) { _isOpen = false; return; }
        var ft = focusTrap();
        if (ft) ft.releaseFocus(ov);
        ov.classList.remove('visible');
        setBackgroundInert(false);
        _isOpen = false;
        _activeIndex = -1;
        var input = inputEl();
        if (input) {
            input.removeAttribute('aria-expanded');
            input.removeAttribute('aria-activedescendant');
        }
        if (_opener && typeof _opener.focus === 'function') _opener.focus();
        _opener = null;
        setTimeout(function () { ov.hidden = true; }, 200);
    }

    function toggle() { if (_isOpen) close(); else open(); }

    // --- keyboard result navigation ---

    function moveActive(delta) {
        var list = items();
        if (!list.length) return;
        if (_activeIndex >= 0 && list[_activeIndex]) list[_activeIndex].classList.remove('active');
        _activeIndex += delta;
        if (_activeIndex < 0) _activeIndex = list.length - 1;
        if (_activeIndex >= list.length) _activeIndex = 0;
        var el = list[_activeIndex];
        el.classList.add('active');
        if (typeof el.scrollIntoView === 'function') el.scrollIntoView({ block: 'nearest' });
        var input = inputEl();
        if (input) {
            if (!el.id) el.id = 'omni-search-item-' + _activeIndex;
            input.setAttribute('aria-activedescendant', el.id);
        }
    }

    function activateActive(e) {
        var list = items();
        if (_activeIndex < 0 || !list[_activeIndex]) return;
        e.preventDefault();
        var el = list[_activeIndex];
        // Result rows are <a>; click() follows the link (honors hx-boost nav).
        if (typeof el.click === 'function') { el.click(); return; }
        var href = el.getAttribute('href');
        if (href) window.location.assign(href);
    }

    // Reset keyboard state whenever the results region is swapped.
    function resetActive() {
        _activeIndex = -1;
        var input = inputEl();
        if (input) input.removeAttribute('aria-activedescendant');
    }

    // --- optional JS-side debounced fallback fetch ---
    // The dialog partial's input is expected to carry hx-get + hx-trigger
    // "input changed delay:250ms" (declarative debounce). This fallback fires
    // ONLY when that input is not HTMX-wired, so we never double-fetch.

    function makeDebounce() {
        if (window.lf && window.lf.TableCore && typeof window.lf.TableCore.debounce === 'function') {
            return window.lf.TableCore.debounce;
        }
        return function (fn, wait) {
            var t;
            return function () {
                var ctx = this, args = arguments;
                clearTimeout(t);
                t = setTimeout(function () { fn.apply(ctx, args); }, wait);
            };
        };
    }

    var _debouncedFetch = makeDebounce()(function (query) {
        var r = root();
        if (!r || typeof htmx === 'undefined') return;
        var base = r.getAttribute('data-results-url') || DEFAULT_RESULTS_URL;
        var url = base + (base.indexOf('?') === -1 ? '?' : '&') + 'q=' + encodeURIComponent(query);
        htmx.ajax('GET', url, {
            target: '#' + RESULTS_ID,
            swap: 'innerHTML',
            pushUrl: false,
            source: inputEl() || undefined,
            indicator: '#' + LOADING_ID
        });
    }, 250);

    function onInput(e) {
        resetActive();
        var input = e.target;
        if (!input || input.id !== INPUT_ID) return;
        // If the input is HTMX-wired, HTMX owns the (debounced) fetch — do nothing else.
        if (input.hasAttribute('hx-get')) return;
        _debouncedFetch(input.value || '');
    }

    // --- wiring ---

    // One document keydown owns every shortcut + in-palette navigation.
    document.addEventListener('keydown', function (e) {
        // Global open/toggle: Cmd/Ctrl+K or Alt+K (layout-independent via e.code).
        if (e.code === 'KeyK' && (e.metaKey || e.ctrlKey || e.altKey)) {
            e.preventDefault();
            toggle();
            return;
        }
        if (!_isOpen) return;
        if (e.key === 'Escape') { e.preventDefault(); close(); return; }
        if (e.key === 'ArrowDown') { e.preventDefault(); moveActive(1); return; }
        if (e.key === 'ArrowUp') { e.preventDefault(); moveActive(-1); return; }
        if (e.key === 'Enter') { activateActive(e); return; }
    });

    // Header field is now a readonly palette trigger; it lives in the OOB-swapped
    // header, so bind via delegation, never per-element.
    delegate('click', '#header-search', function (e) {
        e.preventDefault();
        open();
    });

    // Backdrop click closes; a result-row click closes after navigation starts.
    delegate('click', '.omni-search-overlay', function (e) {
        if (e.target === this) close();
    });
    delegate('click', '.omni-search-item', function () { close(); });
    delegate('click', '[data-omni-search-close]', function (e) { e.preventDefault(); close(); });

    // Debounced-fallback input handler (delegated — input is HTMX-swapped content).
    delegate('input', '#' + INPUT_ID, onInput);

    // Any results swap resets keyboard nav state.
    document.addEventListener('htmx:afterSwap', function (e) {
        if (e.target && e.target.id === RESULTS_ID) resetActive();
    });

    // Expose the public API.
    window.lf = window.lf || {};
    window.lf.ui = window.lf.ui || {};
    window.lf.ui.OmniSearch = { open: open, close: close, toggle: toggle };
    window.lf.commandPalette = { open: open };
})();
