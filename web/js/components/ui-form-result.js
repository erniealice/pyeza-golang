// ui-form-result.js — shared inline form-result handler for detail-page edit forms.
//
// Single source of truth for the "hx-on::after-request" handler used by editable
// info forms on detail pages (asset / user / location, and any future entity).
// Previously each detail.html defined its own `lf.handleInfoUpdate(event)` on the
// flat `window.lf` namespace with a slightly divergent body; the three definitions
// clobbered one another (last-loaded wins) and the shared `id="info-result"` /
// `id="info-edit-form"` ids collided across co-rendered partials. This consolidates
// the logic under the tiered `window.lf.ui.*` namespace and parameterises the three
// divergences so each entity preserves its exact original behaviour.
//
// Usage (in a form's hx-on::after-request):
//   lf.ui.handleFormResult(event, {
//       resultId: 'asset-info-result',
//       successSource: 'header',
//       successHeader: 'HX-Success-Message',
//       hideMode: 'classList'
//   })
//
// Auto-copied to apps/service-admin/assets/js/pyeza/ at startup via
// pyeza.CopyStaticAssets — never edit the app copy.

window.lf = window.lf || {};
window.lf.ui = window.lf.ui || {};

/**
 * Handle an HTMX after-request event for an inline form-result banner.
 *
 * @param {CustomEvent} event  The HTMX after-request event (carries event.detail.xhr / .successful).
 * @param {Object} opts
 * @param {string}  opts.resultId        id of the form-result element to populate.
 * @param {string} [opts.successSource]  'header' to read the success text from a response
 *                                       header, 'dataset' to read el.dataset.successMessage
 *                                       with a fallback. Default 'dataset'.
 * @param {string} [opts.successHeader]  Response header name for successSource 'header'.
 *                                       Default 'HX-Success-Message'.
 * @param {string} [opts.successFallback] Fallback success text for successSource 'dataset'
 *                                        (used when el.dataset.successMessage is empty).
 *                                        Default ''.
 * @param {string} [opts.errorHeader]    Response header name for the error message.
 *                                        Default 'HX-Error-Message'.
 * @param {string} [opts.errorFallback]  Fallback error text when neither the header nor
 *                                        el.dataset.errorMessage is present. Default ''.
 * @param {string} [opts.hideMode]       'classList' adds/removes 'form-result--hidden';
 *                                        'style' toggles el.style.display (block→none).
 *                                        Default 'classList'.
 * @param {number} [opts.hideDelay]      Auto-hide delay in ms. Default 5000.
 * @param {string} [opts.connectionError] Opt-in text shown when the browser got no usable
 *                                        response (network failure, status 0, or a 5xx
 *                                        without an HX-Error-Message), so the outcome is
 *                                        unknown. When set, that banner does NOT auto-hide:
 *                                        it stays until the next request or the swap.
 *                                        Without it, failures behave exactly as before.
 *
 * Success detection: htmx 1.9.10 leaves event.detail.successful undefined on
 * HX-Location responses, so an undefined value with an HX-Location header falls
 * back to the HTTP status (2xx = success), unless the session expired. Every
 * other undefined (e.g. the 200 + HX-Redirect to /auth/login that dialog.js
 * cancels) stays a failure, as before. An explicit true/false is honoured.
 */
window.lf.ui.handleFormResult = function(event, opts) {
    function sessionExpiredSignal(xhr) {
        var s = window.lf.ui.session;
        if (s && typeof s.isExpired === 'function' && s.isExpired()) return true;
        if (xhr.getResponseHeader('X-Session-Expired') === '1') return true;
        var redirect = xhr.getResponseHeader('HX-Redirect');
        if (!redirect) return false;
        try {
            return new URL(redirect, window.location.origin).pathname.indexOf('/auth/login') === 0;
        } catch (err) {
            return false;
        }
    }

    // headerText reads a response header as UTF-8 text. XHR exposes header
    // bytes as Latin-1 code points, so a Go handler's raw UTF-8 label (an em
    // dash) arrives as mojibake. Re-decode those bytes as UTF-8; an ASCII value
    // is unchanged, and a value that is not valid UTF-8 is returned as is.
    function headerText(xhr, name) {
        var v = xhr ? xhr.getResponseHeader(name) : null;
        if (!v || !/[\u0080-\u00ff]/.test(v) || /[^\u0000-\u00ff]/.test(v) ||
                typeof TextDecoder !== 'function') {
            return v;
        }
        try {
            var bytes = new Uint8Array(v.length);
            for (var i = 0; i < v.length; i++) bytes[i] = v.charCodeAt(i);
            return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
        } catch (err) {
            return v;
        }
    }

    opts = opts || {};
    var el = document.getElementById(opts.resultId);
    if (!el) return;

    var successSource = opts.successSource || 'dataset';
    var successHeader = opts.successHeader || 'HX-Success-Message';
    var successFallback = opts.successFallback || '';
    var errorHeader = opts.errorHeader || 'HX-Error-Message';
    var errorFallback = opts.errorFallback || '';
    var hideMode = opts.hideMode || 'classList';
    var hideDelay = (typeof opts.hideDelay === 'number') ? opts.hideDelay : 5000;

    var xhr = event.detail.xhr;

    // 'style' hide mode reveals the banner up-front (matches the original location
    // handler which set el.style.display='block' before populating).
    if (hideMode === 'style') {
        el.style.display = 'block';
    }

    var status = xhr ? xhr.status : 0;
    // htmx leaves `successful` undefined on an HX-Location response; only then
    // does a 2xx count as success. A session-expiry response (200 + HX-Redirect
    // to the sign-in page, cancelled by dialog.js) is never a success.
    var hxLocation = xhr ? xhr.getResponseHeader('HX-Location') : null;
    var ok = event.detail.successful === true ||
        (event.detail.successful === undefined && !!hxLocation &&
            status >= 200 && status < 300 && !sessionExpiredSignal(xhr));
    var errHeader = headerText(xhr, errorHeader);
    var noAnswer = !xhr || status === 0 || (status >= 500 && !errHeader);

    // A newer request supersedes any pending auto-hide from an earlier one.
    if (el._lfFormResultTimer) {
        clearTimeout(el._lfFormResultTimer);
        el._lfFormResultTimer = null;
    }

    if (ok) {
        el.className = 'form-result form-result--success';
        if (successSource === 'header') {
            el.textContent = headerText(xhr, successHeader) || '';
        } else {
            el.textContent = el.dataset.successMessage || successFallback;
        }
    } else if (!ok && opts.connectionError && noAnswer) {
        // Outcome unknown: keep the message visible (no auto-hide).
        el.className = 'form-result form-result--error';
        el.textContent = opts.connectionError;
        return;
    } else {
        var msg = errHeader || el.dataset.errorMessage || errorFallback;
        el.className = 'form-result form-result--error';
        el.textContent = msg;
    }

    el._lfFormResultTimer = setTimeout(function() {
        if (hideMode === 'style') {
            el.style.display = 'none';
        } else {
            el.classList.add('form-result--hidden');
        }
    }, hideDelay);
};
