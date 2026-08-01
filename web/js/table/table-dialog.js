/**
 * Table Dialog - deprecation shim.
 *
 * showConfirmDialog(options) is kept only so the frozen lf.ui.table.* SDK
 * surface (and the flat lf.TableDialog alias) stays intact. It now delegates
 * to the app-shell dialog promise API: callback semantics are preserved, but
 * onConfirm/onCancel fire one microtask later than the retired inline
 * implementation did.
 *
 * The dialog API is resolved at call time — dialog.js exposes it only after
 * an overlay-bearing init — and a missing API degrades to the browser's own
 * prompt, so the confirmation stays gated on every page.
 *
 * Rendering invariant: no markup is built here. Every caller-supplied string
 * reaches the DOM through the dialog API, which renders via textContent only.
 * Label invariant: no English literal lives here; copy resolves per-call
 * option -> <body data-lf-dialog-*> -> overlay data-default-* -> empty string,
 * all inside the dialog API.
 */

(function() {
    'use strict';

    function noop() {}

    function showConfirmDialog(options) {
        var o = options || {};
        var api = window.lf && window.lf.ui && window.lf.ui.Dialog;
        var ask = (api && typeof api.confirm === 'function')
            ? api.confirm
            : function(opts) {
                var answer;
                try {
                    answer = window.confirm((opts && opts.message) || '');
                } catch (err) {
                    answer = false;
                }
                return Promise.resolve(!!answer);
            };
        return ask(o).then(function(confirmed) {
            return confirmed ? (o.onConfirm || noop)() : (o.onCancel || noop)();
        });
    }

    // Expose module
    window.lf = window.lf || {};
    window.lf.ui = window.lf.ui || {};
    window.lf.ui.table = window.lf.ui.table || {};
    window.lf.ui.table.TableDialog = {
        showConfirmDialog
    };

})();
