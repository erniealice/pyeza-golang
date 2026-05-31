// lf-hx-on.js — document-level delegation for HTMX *lifecycle* events.
//
// Sibling of lf-on.js. Where lf.on() delegates STANDARD DOM events
// ('click', 'change', …), lf.hxOn() delegates HTMX LIFECYCLE events
// ('htmx:afterRequest', 'htmx:beforeRequest', 'htmx:afterSettle', …).
//
// WHY A SEPARATE SYMBOL (not an lf.on overload): keeping DOM vs. lifecycle
// explicit honours the js-guide single-owner rule. The two event families
// spell their names differently and the distinction is load-bearing:
//   - DOM event name        → 'click'              (lf.on)
//   - HTMX lifecycle name    → 'htmx:afterRequest'  (lf.hxOn)
// In the HTML attribute spelling these lifecycle events appear with a DOUBLE
// colon, e.g. hx-on::after-request — that is the ATTRIBUTE spelling, NOT the
// dispatched event name. lf.hxOn() always takes the REAL bubbled event name
// ('htmx:afterRequest'), never the attribute spelling.
//
// WHY DELEGATION WORKS FOR htmx:* EVENTS: htmx dispatches its lifecycle events
// on the element that OWNS the hx-* request and they BUBBLE to document. htmx
// also sets event.target to that triggering element, so e.target.closest(sel)
// matches it — identical mechanics to lf.on(). The handler receives the event
// as its single argument with `this` bound to the matched element, so
// event.detail (xhr, elt, successful, …) is available via the argument.
//
// This is the infra the per-package hx-on:: → data-hx-on migrations depend on.
// See docs/wiki/articles/htmx-ui-patterns.md "JS event binding under hx-boost".
//
// Auto-copied verbatim to apps/service-admin/assets/js/pyeza/ at startup via
// pyeza.CopyStaticAssets — NEVER edit the app copy; edit here.
//
// LOAD ORDER: the numeric-free name 'lf-hx-on.js' sorts AFTER '00-lf-namespace.js'
// in the filepath.Glob("*.js") alphabetical copy (assets_scripts.go), so
// window.lf exists before this file runs. The lf.hxOn() helper itself only needs
// window.lf; the registrar below resolves lf.ui.* targets LAZILY at event-fire
// time, so it is robust regardless of where sheet.js / dialog.js load relative
// to this file.

window.lf = window.lf || {};

/**
 * Attach a delegated listener for an HTMX *lifecycle* event that survives
 * HTMX DOM swaps.
 *
 * A single listener is attached to `document`; on each dispatched lifecycle
 * event it uses Element.closest() to find the owning element matching the
 * selector and invokes the handler with `this` bound to it.
 *
 * @param {string}   htmxEvent - the REAL bubbled htmx event name, e.g.
 *                               'htmx:afterRequest', 'htmx:beforeRequest',
 *                               'htmx:afterSettle'. NOT the 'hx-on::after-request'
 *                               attribute spelling.
 * @param {string}   selector  - CSS selector identifying the owning element(s),
 *                               typically a `[data-hx-on="…"]` marker.
 * @param {Function} handler    - Called with `this` = the matched element and the
 *                               htmx event as the single argument (carries
 *                               event.detail.xhr / .elt / .successful).
 * @param {Object}  [options]   - addEventListener options (capture, etc.).
 *
 * Example (a per-package registrar, in that package's own JS module):
 *   lf.hxOn('htmx:afterRequest', '[data-hx-on="sheet-response"]', function(e) {
 *       lf.ui.Sheet.handleResponse(e);
 *   });
 */
lf.hxOn = function(htmxEvent, selector, handler, options) {
    document.addEventListener(htmxEvent, function(e) {
        var t = (e.target && e.target.closest) ? e.target.closest(selector) : null;
        if (t) handler.call(t, e);
    }, options);
};

// ---------------------------------------------------------------------------
// Shared registrar — pyeza owns the registrations whose handlers target the
// lf.ui.* design-system primitives (Sheet / handleFormResult). Domain packages
// (centymo / entydad / fycha / fayna / cyta) only emit the data-hx-on="…"
// markers on their templates; they do NOT re-register these keys. Package-owned
// keys whose handler targets a package symbol (e.g. account-template-apply →
// lf.fycha.ledger.*, password-reset → lf.entydad.user.*) are registered by that
// package's OWN JS module, never here.
//
// All handler bodies resolve lf.ui.* LAZILY (read at event-fire time), so this
// registrar is correct no matter the relative <script> load order of sheet.js /
// ui-form-result.js — by the time any htmx:* event fires the whole bundle has
// loaded.
//
// data-hx-on hook convention (one marker per element; the registered event +
// selector decide the behaviour):
//
//   data-hx-on="sheet-response"  htmx:afterRequest  → lf.ui.Sheet.handleResponse(e)
//       Drawer-form <form>s. Replaces hx-on::after-request="lf.Sheet.handleResponse(event)".
//       Carries the elt-guard: only fires when the htmx request was owned by the
//       form itself (e.detail.elt === this), NOT by a bubbled child-input request
//       (dependent dropdowns, auto-complete), mirroring the centymo elt===this
//       guarded forms and sheet.js's own body-listener elt/FORM guard.
//       Idempotent with sheet.js's body-level htmx:afterRequest listener via the
//       xhr._sheetHandled / event.detail._sheetHandled flag inside handleResponse.
//
//   data-hx-on="sheet-open"      htmx:afterRequest  → lf.ui.Sheet.open()
//       Detail-page edit links that open the drawer after the partial loads.
//
//   data-hx-on="sheet-close"     htmx:beforeRequest → lf.ui.Sheet.close()
//       Report-filter forms / clear links that close the drawer before the request.
//
//   data-hx-on="scroll-top"      htmx:afterSettle   → window.scrollTo(0, 0)
//       Report filters that scroll to top after the results settle.
//
//   data-hx-on="form-result"     htmx:afterRequest  → lf.ui.handleFormResult(e, opts)
//       Detail-page inline info forms. The handler reads its options off the
//       element's own data-* attributes (data-result-id / data-success-source /
//       data-success-header / data-success-fallback / data-error-fallback /
//       data-hide-mode), so a single registration serves every entity.
//
// Report-filter forms that need BOTH close-on-beforeRequest AND scroll-on-afterSettle
// carry ONE shared marker (e.g. data-hx-on="report-filter") and are registered by
// fycha with TWO lf.hxOn calls (one per event) against that same selector — a
// single data-hx-on value is single-purpose, so two lifecycle hooks on one element
// use two registrations, never a space-separated list.
(function registerSheetPrimitives() {
    'use strict';

    // sheet-response — in-drawer form submit. elt-guard prevents bubbled
    // child-input htmx requests (dependent dropdowns) from closing the sheet.
    lf.hxOn('htmx:afterRequest', '[data-hx-on="sheet-response"]', function(e) {
        if (e.detail && e.detail.elt && e.detail.elt !== this) return;
        if (window.lf && window.lf.ui && window.lf.ui.Sheet) {
            window.lf.ui.Sheet.handleResponse(e);
        }
    });

    // sheet-open — open the drawer after a detail-page edit-link partial loads.
    lf.hxOn('htmx:afterRequest', '[data-hx-on="sheet-open"]', function() {
        if (window.lf && window.lf.ui && window.lf.ui.Sheet) {
            window.lf.ui.Sheet.open();
        }
    });

    // sheet-close — close the drawer before a report-filter request fires.
    lf.hxOn('htmx:beforeRequest', '[data-hx-on="sheet-close"]', function() {
        if (window.lf && window.lf.ui && window.lf.ui.Sheet) {
            window.lf.ui.Sheet.close();
        }
    });

    // scroll-top — scroll to top after report results settle.
    lf.hxOn('htmx:afterSettle', '[data-hx-on="scroll-top"]', function() {
        window.scrollTo(0, 0);
    });

    // form-result — inline info-form banner; options carried as data-* on the form.
    lf.hxOn('htmx:afterRequest', '[data-hx-on="form-result"]', function(e) {
        if (e.detail && e.detail.elt && e.detail.elt !== this) return;
        if (window.lf && window.lf.ui && typeof window.lf.ui.handleFormResult === 'function') {
            window.lf.ui.handleFormResult(e, {
                resultId: this.dataset.resultId,
                successSource: this.dataset.successSource,
                successHeader: this.dataset.successHeader,
                successFallback: this.dataset.successFallback,
                errorFallback: this.dataset.errorFallback,
                hideMode: this.dataset.hideMode
            });
        }
    });
})();
