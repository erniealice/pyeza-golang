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
 */
window.lf.ui.handleFormResult = function(event, opts) {
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

    if (event.detail.successful) {
        el.className = 'form-result form-result--success';
        if (successSource === 'header') {
            el.textContent = xhr.getResponseHeader(successHeader) || '';
        } else {
            el.textContent = el.dataset.successMessage || successFallback;
        }
    } else {
        var msg = xhr.getResponseHeader(errorHeader) || el.dataset.errorMessage || errorFallback;
        el.className = 'form-result form-result--error';
        el.textContent = msg;
    }

    setTimeout(function() {
        if (hideMode === 'style') {
            el.style.display = 'none';
        } else {
            el.classList.add('form-result--hidden');
        }
    }, hideDelay);
};
