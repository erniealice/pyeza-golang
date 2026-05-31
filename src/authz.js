// src/authz.js — the JS-side authz-parameter contract for the @leapfor/ui SDK.
//
// This is the JS/SDK projection of permission-reflection-pattern.md §4
// ("pyeza stays dumb"): pyeza has ZERO knowledge of the permission model,
// never imports it, and NEVER decides whether a control is authorized. The
// HOST view layer is the only authz authority — it is server-authz-checked
// and passes its decision down as two optional parameters on every
// interactive primitive:
//
//     { disabled: bool, disabledTooltip: string }
//
// mirroring the Go-side TableAction / PrimaryAction / BulkAction
// Disabled + DisabledTooltip fields (types/table.go:419-588). The host builds
// the tooltip via fmt.Sprintf(CommonLabels.Errors.MissingPermission, "<entity>:<verb>")
// -> "Missing permission: plan:create".
//
// The SDK NEVER computes authz. It only REFLECTS the host's decision:
//   - renders the control disabled + aria-disabled="true" + title=tooltip;
//   - hard-aborts any dispatch (HTMX / fetch / use-case call) when the host
//     marked it disabled — exactly the bulk-action.js:54-58 abort seam, which
//     is the JS enforcement point that already exists in the running app.
//
// The host's server-side endpoint remains the real gate (authz W0 backstop);
// this parameter is a UI reflection, not the security boundary.
//
// No DOM/window dependency at module top-level so this re-exports cleanly into
// both the ESM and UMD targets and is unit-testable under plain `node --test`.

'use strict';

/**
 * normalizeAuthz coerces a loose host-supplied authz parameter bag into the
 * canonical shape the SDK reflects. Missing / falsy => authorized (enabled).
 *
 * @param {{disabled?: boolean, disabledTooltip?: string}} [params]
 * @returns {{disabled: boolean, disabledTooltip: string}}
 */
export function normalizeAuthz(params) {
    params = params || {};
    return {
        disabled: params.disabled === true,
        disabledTooltip: typeof params.disabledTooltip === 'string' ? params.disabledTooltip : '',
    };
}

/**
 * isAuthorized — true when the host did NOT mark the control disabled.
 * pyeza never *computes* this; it only reads the host's reflected decision.
 *
 * @param {{disabled?: boolean}} [params]
 * @returns {boolean}
 */
export function isAuthorized(params) {
    return !normalizeAuthz(params).disabled;
}

/**
 * applyAuthzAttributes reflects the host's authz decision onto a DOM element:
 * sets `disabled`, `aria-disabled="true"`, and `title=<tooltip>` when the host
 * marked the control disabled; clears them when authorized. This is the render
 * half of the contract — identical to what the Go button/table components emit
 * server-side (aria-disabled + title in button.html / toggle.html / table).
 *
 * Returns the element for chaining. No-op (returns el) when el is falsy so
 * callers needn't guard.
 *
 * @param {HTMLElement|null|undefined} el
 * @param {{disabled?: boolean, disabledTooltip?: string}} [params]
 * @returns {HTMLElement|null|undefined}
 */
export function applyAuthzAttributes(el, params) {
    if (!el || typeof el.setAttribute !== 'function') return el;
    const { disabled, disabledTooltip } = normalizeAuthz(params);
    if (disabled) {
        // `disabled` is a real property on form controls; set both the property
        // (for <button>/<input>) and the attribute (for non-form elements/aria).
        try { el.disabled = true; } catch (e) { /* non-form element */ }
        el.setAttribute('aria-disabled', 'true');
        if (disabledTooltip) el.setAttribute('title', disabledTooltip);
    } else {
        try { el.disabled = false; } catch (e) { /* non-form element */ }
        el.removeAttribute('aria-disabled');
    }
    return el;
}

/**
 * isElementInert mirrors the bulk-action.js:57 abort predicate: a control the
 * host disabled (via the .disabled property OR aria-disabled="true") must
 * dispatch NOTHING. Any SDK entrypoint consults this before firing a network /
 * use-case call.
 *
 * @param {HTMLElement|null|undefined} el
 * @returns {boolean}
 */
export function isElementInert(el) {
    if (!el) return false;
    const ariaDisabled =
        typeof el.getAttribute === 'function' && el.getAttribute('aria-disabled') === 'true';
    return el.disabled === true || ariaDisabled;
}

/**
 * guardDispatch is the enforcement seam every SDK entrypoint runs before it
 * performs a side effect (HTMX ajax, fetch POST, use-case invocation). It
 * returns FALSE — and invokes neither `action` — when the host marked the
 * control inert, exactly mirroring bulk-action.js:54-58. Returns TRUE and runs
 * `action()` when authorized.
 *
 * This makes "renders inert under an unauthorized host authz parameter"
 * (plan.md W4 acceptance) a single greppable choke point: an unauthorized host
 * parameter fires NO network request / NO use-case call.
 *
 * @param {{disabled?: boolean, disabledTooltip?: string}} params  host authz decision
 * @param {() => any} action  the side effect to run only when authorized
 * @returns {boolean} whether the action ran
 */
export function guardDispatch(params, action) {
    if (normalizeAuthz(params).disabled) {
        return false;
    }
    if (typeof action === 'function') action();
    return true;
}

/**
 * renderInert builds the inert descriptor for a control the host marked
 * unauthorized — the SDK's render-inert path. Pure (no DOM) so the negative
 * test can assert the reflected attributes without a browser.
 *
 * @param {{disabled?: boolean, disabledTooltip?: string}} [params]
 * @returns {{disabled: boolean, ariaDisabled: 'true'|null, title: string, attrs: Object}}
 */
export function renderInert(params) {
    const { disabled, disabledTooltip } = normalizeAuthz(params);
    return {
        disabled,
        ariaDisabled: disabled ? 'true' : null,
        title: disabled ? disabledTooltip : '',
        attrs: disabled
            ? { 'disabled': '', 'aria-disabled': 'true', 'title': disabledTooltip }
            : {},
    };
}

export const authz = {
    normalizeAuthz,
    isAuthorized,
    applyAuthzAttributes,
    isElementInert,
    guardDispatch,
    renderInert,
};

export default authz;
