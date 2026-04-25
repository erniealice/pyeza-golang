// lf-on.js — document-level event delegation helper.
// See docs/wiki/articles/htmx-ui-patterns.md "JS event binding under hx-boost".
window.lf = window.lf || {};

/**
 * Attach a delegated event listener that survives HTMX DOM swaps.
 *
 * Instead of binding directly to an element (which dies when HTMX OOB-swaps
 * its containing region), this attaches a single listener to `document` and
 * uses `Element.closest()` to match the target on each event.
 *
 * @param {string} eventType - 'click', 'change', etc.
 * @param {string} selector - CSS selector identifying the target element(s).
 * @param {Function} handler - Called with `this` bound to the matching element.
 * @param {Object} [options] - addEventListener options (passive, capture, etc.).
 *
 * Example:
 *   lf.on('click', '#helpToggleBtn', toggleHelpPane);
 *   lf.on('click', '[data-action="close"]', function() { this.closest('.modal').remove(); });
 *
 * When NOT to use lf.on():
 *   - Focus-trap containers (need per-element keydown binding to define the trap boundary)
 *   - Non-bubbling events (focus, blur, mouseenter, mouseleave)
 *   - One-shot custom events on a specific element ({once: true} pattern for dialog:confirm)
 *
 * Reference implementation: packages/pyeza-golang/web/js/components/help-pane.js
 * Migration record: docs/plan/20260425-htmx-handler-delegation/plan.md
 */
lf.on = function(eventType, selector, handler, options) {
    document.addEventListener(eventType, function(e) {
        var target = e.target.closest(selector);
        if (target) handler.call(target, e);
    }, options);
};
