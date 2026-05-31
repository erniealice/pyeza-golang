// component-actions.js — document-level delegation for pyeza component
// behaviours that were previously expressed as inline on* handler attributes
// (onclick / onkeydown / onerror).
//
// WHY: under an enforcing `script-src 'self'` CSP (no 'unsafe-inline'), inline
// event-handler ATTRIBUTES are refused by the browser exactly like inline
// <script> blocks. This file moves every static inline handler in pyeza's own
// web/templates to a delegated lf.on() listener keyed by a data-* hook, so the
// markup stays declarative and the policy can enforce. Behaviour-preserving:
// each handler reproduces the prior inline expression verbatim.
//
// Pairs with lf-on.js (the lf.on registrar) and lf-hx-on.js (HTMX lifecycle
// delegation). Auto-copied verbatim to apps/service-admin/assets/js/pyeza/ at
// startup via pyeza.CopyStaticAssets — NEVER edit the app copy; edit here.
//
// LOAD ORDER: must load AFTER lf-on.js (defines lf.on) and AFTER sheet.js
// (defines lf.Sheet) — the shell loads sheet.js via the sheet-form-container
// partial. lf.on attaches to `document`, so handlers survive HTMX swaps and a
// late-loaded lf.Sheet is resolved lazily at click time.
window.lf = window.lf || {};

(function () {
    'use strict';

    if (!window.lf || typeof window.lf.on !== 'function') {
        // lf.on is the hard dependency; without it there is nothing to register.
        // (Should never happen given the documented load order.)
        return;
    }

    // ------------------------------------------------------------------
    // Sheet drawer — open / close
    // ------------------------------------------------------------------
    // Former inline handlers:
    //   onclick="lf.Sheet.close()"
    //   onclick="lf.Sheet.open('<Label>')"
    //   onclick="if(window.lf&&window.lf.Sheet){window.lf.Sheet.open();}"  (calendar)
    //
    // Hooks:
    //   data-lf-action="sheet-close"                       → lf.Sheet.close()
    //   data-lf-action="sheet-open" [data-lf-sheet-title]  → lf.Sheet.open(title?)
    //   .calendar-cell-popover-action                      → lf.Sheet.open()
    //
    // The hx-get/hx-target wiring that loaded the drawer body stays on the same
    // element untouched; this only reproduces the side-effect of opening the
    // drawer chrome (and setting its title).

    lf.on('click', '[data-lf-action="sheet-close"]', function () {
        if (window.lf && window.lf.Sheet) window.lf.Sheet.close();
    });

    lf.on('click', '[data-lf-action="sheet-open"]', function () {
        if (window.lf && window.lf.Sheet) {
            var title = this.getAttribute('data-lf-sheet-title');
            // open(undefined) leaves the existing title untouched — matches the
            // calendar's prior no-arg lf.Sheet.open() call.
            window.lf.Sheet.open(title || undefined);
        }
    });

    // Calendar "New event" popover actions all share this class and previously
    // called the no-arg open(). Delegate by class so no per-link attribute is
    // needed.
    lf.on('click', '.calendar-cell-popover-action', function () {
        if (window.lf && window.lf.Sheet) window.lf.Sheet.open();
    });

    // ------------------------------------------------------------------
    // Audit history — expand/collapse a row's field changes
    // ------------------------------------------------------------------
    // Former: onclick="lf.toggleAuditDetails(this)" on .audit-expand-btn.
    lf.on('click', '.audit-expand-btn', function () {
        if (window.lf && typeof window.lf.toggleAuditDetails === 'function') {
            window.lf.toggleAuditDetails(this);
        }
    });

    // ------------------------------------------------------------------
    // Self-contained DOM toggles (no lf.* dependency)
    // ------------------------------------------------------------------

    // Chip overflow expand — former:
    //   onclick="this.parentElement.classList.toggle('expanded')"
    lf.on('click', '.chip-expand-toggle', function () {
        if (this.parentElement) this.parentElement.classList.toggle('expanded');
    });

    // Multi-person overflow expand — former:
    //   onclick="this.closest('.multi-person-cell').classList.toggle('expanded')"
    lf.on('click', '.person-expand-toggle', function () {
        var cell = this.closest('.multi-person-cell');
        if (cell) cell.classList.toggle('expanded');
    });

    // Alert dismiss — former: onclick="this.closest('.alert').remove()"
    lf.on('click', '.alert-dismiss', function () {
        var alert = this.closest('.alert');
        if (alert) alert.remove();
    });

    // Toast close — former: onclick="this.closest('.toast').classList.add('toast-exit')"
    lf.on('click', '.toast-close', function () {
        var toast = this.closest('.toast');
        if (toast) toast.classList.add('toast-exit');
    });

    // Workspace switcher button — former (inline, on .workspace-switcher-btn):
    //   onclick="this.nextElementSibling.classList.toggle('hidden');
    //            this.setAttribute('aria-expanded',
    //              this.nextElementSibling.classList.contains('hidden')?'false':'true')"
    lf.on('click', '.workspace-switcher-btn', function () {
        var dropdown = this.nextElementSibling;
        if (!dropdown) return;
        dropdown.classList.toggle('hidden');
        this.setAttribute('aria-expanded', dropdown.classList.contains('hidden') ? 'false' : 'true');
    });

    // Table toolbar mobile-options toggle — former:
    //   onclick="this.closest('.table-toolbar').classList.toggle('actions-open')"
    lf.on('click', '.toolbar-mobile-toggle', function () {
        var toolbar = this.closest('.table-toolbar');
        if (toolbar) toolbar.classList.toggle('actions-open');
    });

    // Table toolbar mobile backdrop — former (click + keydown):
    //   onclick="this.closest('.table-toolbar').classList.remove('actions-open')"
    //   onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();
    //              this.closest('.table-toolbar').classList.remove('actions-open')}"
    function closeToolbarActions(el) {
        var toolbar = el.closest('.table-toolbar');
        if (toolbar) toolbar.classList.remove('actions-open');
    }
    lf.on('click', '.toolbar-mobile-backdrop', function () {
        closeToolbarActions(this);
    });
    lf.on('keydown', '.toolbar-mobile-backdrop', function (e) {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            closeToolbarActions(this);
        }
    });

    // ------------------------------------------------------------------
    // Table row-action OnClick (consumer-supplied, CSP-safe dispatch)
    // ------------------------------------------------------------------
    // The pyeza TableAction.OnClick field (types/table.go) is a string set by
    // domain views in OTHER submodules (centymo/fayna/fycha). It used to render
    // as a raw onclick="..." attribute, which an enforcing CSP refuses. The
    // template now emits it as data-lf-onclick="..." instead; here we map the
    // KNOWN consumer values to a real call via an explicit dispatch table — no
    // eval / new Function, so an unexpected value is ignored (fail-safe), never
    // executed as arbitrary JS. Every current consumer passes one of the
    // sheet-open spellings; both resolve to opening the drawer chrome (the
    // drawer BODY is loaded by the element's own hx-get).
    var ON_CLICK_DISPATCH = {
        'lf.Sheet.open()': openSheetNoTitle,
        'lf.ui.Sheet.open()': openSheetNoTitle,
    };
    function openSheetNoTitle() {
        if (window.lf && window.lf.Sheet) window.lf.Sheet.open();
        else if (window.lf && window.lf.ui && window.lf.ui.Sheet) window.lf.ui.Sheet.open();
    }
    lf.on('click', '[data-lf-onclick]', function () {
        var expr = this.getAttribute('data-lf-onclick');
        var fn = ON_CLICK_DISPATCH[expr];
        if (fn) {
            fn.call(this);
        } else if (window.console && console.warn) {
            // Unrecognised handler string — refuse to execute it (CSP-safe).
            console.warn('component-actions: unmapped data-lf-onclick value:', expr);
        }
    });

    // ------------------------------------------------------------------
    // Avatar image error fallback (non-delegable — `error` does NOT bubble)
    // ------------------------------------------------------------------
    // Former: <img onerror="this.style.display='none'">.
    // `error` events from <img> do not bubble, so lf.on() (document delegation)
    // cannot catch them. Use a CAPTURE-phase document listener instead: capture
    // sees the event on the way down even for non-bubbling events. Scope to the
    // avatar image class so we don't touch unrelated <img>s.
    document.addEventListener('error', function (e) {
        var t = e.target;
        if (t && t.classList && t.classList.contains('avatar-img')) {
            t.style.display = 'none';
        }
    }, true); // useCapture = true
})();
