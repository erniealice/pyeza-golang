// 00-lf-namespace.js — the lf registry foundation. LOADS FIRST.
//
// The numeric "00-" prefix forces this file to sort first in the
// filepath.Glob("*.js") alphabetical copy performed by assets_scripts.go
// (copyDirAssets). Because the <script> tags are emitted in that same
// copy order, the registry, the ns()/define() helpers, the pre-created
// ui / ui.table namespaces, the _internal channel, and lf.version all
// exist BEFORE any component file (calendar.js, sheet.js, table/*.js, ...)
// runs and assigns its leaf.
//
// Q-JS1 (LOCKED, Option A): window.lf is a REGISTRY ONLY.
//   window.lf.ui.*           pyeza design-system primitives
//   window.lf.ui.table.*     pyeza table primitives
//   window.lf.<pkg>.<entity>.<fn>   page logic (owned by its package)
//   window.lf._internal.*    private / unstable helpers
// A back-compat ALIAS layer (installed at the BOTTOM of this file) keeps
// every legacy flat `lf.<Primitive>` call-site resolving during the soak.
// Aliases are getter-based so they resolve their target LAZILY — correct
// even though the targets (lf.ui.Sheet, lf.ui.table.TableSort, the inline-
// HTML lf.ui.Popover, etc.) are assigned by files that load AFTER this one.
//
// Auto-copied verbatim to apps/service-admin/assets/js/pyeza/ at startup
// via pyeza.CopyStaticAssets — NEVER edit the app copy; edit here.

(function () {
    'use strict';

    // --- Registry root (create once; never clobber) -----------------------
    window.lf = window.lf || {};
    var lf = window.lf;

    // --- Version (semver, stamped once) -----------------------------------
    // No build-time injection step exists today and this file copies verbatim,
    // so the version is a source constant. Bump on a public-surface change.
    // Assigned non-destructively so a re-eval of this file is idempotent.
    if (typeof lf.version === 'undefined') {
        lf.version = '1.0.0';
    }

    // --- ns(path): idempotent intermediate-namespace creator --------------
    // Splits a dotted path, creates each missing segment as a plain object,
    // never overwrites an existing branch, returns the leaf object.
    //   lf.ns('ui.table') -> walks/creates lf.ui then lf.ui.table, returns it.
    //   lf.ns('') / lf.ns() -> returns the registry root (lf) itself.
    if (typeof lf.ns !== 'function') {
        lf.ns = function (path) {
            var node = lf;
            if (!path) return node;
            var segments = String(path).split('.');
            for (var i = 0; i < segments.length; i++) {
                var key = segments[i];
                if (!key) continue;
                if (node[key] === undefined || node[key] === null) {
                    node[key] = {};
                }
                node = node[key];
            }
            return node;
        };
    }

    // --- isDevHost(): dev-only gate for the redefinition warning ----------
    function isDevHost() {
        try {
            var h = (window.location && window.location.hostname) || '';
            return h === 'localhost' || h === '127.0.0.1' || h === '[::1]' || h === '';
        } catch (e) {
            return false;
        }
    }

    // --- define(path, obj): idempotent leaf assignment --------------------
    // Resolves the parent namespace via ns(), then assigns the leaf.
    // Dev-warns (console.warn, localhost only) when an existing leaf with a
    // DIFFERENT value is being redefined — the Q-JS1 dev-warn-on-redefinition
    // guard that kills the silent last-loaded-wins collision class
    // (the F-NS-2 lf.handleInfoUpdate trio).
    if (typeof lf.define !== 'function') {
        lf.define = function (path, obj) {
            if (!path) {
                throw new Error('lf.define: path is required');
            }
            var segments = String(path).split('.');
            var leaf = segments.pop();
            // Drop empty trailing segment(s) defensively.
            while (leaf === '' && segments.length) {
                leaf = segments.pop();
            }
            if (leaf === '') {
                throw new Error('lf.define: path must end in a name: ' + path);
            }
            var parent = lf.ns(segments.join('.'));
            if (Object.prototype.hasOwnProperty.call(parent, leaf) &&
                parent[leaf] !== obj &&
                parent[leaf] !== undefined &&
                isDevHost()) {
                console.warn(
                    '[lf] redefinition of lf.' + path +
                    ' — last assignment wins. Each symbol must have a single owner ' +
                    '(see Q-JS1 / docs/plan/20260530-js-css-architecture).'
                );
            }
            parent[leaf] = obj;
            return parent[leaf];
        };
    }

    // --- Pre-created namespaces (so component guards have a home) ----------
    // Matches the already-shipped ui-form-result.js guard
    //   window.lf.ui = window.lf.ui || {}
    // and pre-creates ui.table for the 16-module table system.
    lf.ns('ui');
    lf.ns('ui.table');

    // --- Private / unstable channel ---------------------------------------
    // __-helpers demote here: _internal.tableSelectionCleanupAll,
    // _internal.popoverInit, plus the TableServer-scoped applyPaginationMeta /
    // captureFocusIdentity stay private under their owning module.
    lf.ns('_internal');

    // ======================================================================
    // BACK-COMPAT ALIAS LAYER (installed last in this file).
    //
    // Every legacy flat symbol keeps resolving during the soak. Aliases are
    // getter-based (Object.defineProperty) so each resolves its tiered target
    // LAZILY at read time — correct regardless of which later-loading file
    // (or inline <script>) assigns the target. Do NOT drop aliases this wave;
    // alias removal is a later soak-gated step.
    //
    // Each entry: [legacyKey-on-lf, tiered-target-path].
    // ======================================================================
    var ALIASES = [
        // pyeza ui primitives -------------------------------------------------
        ['Sheet',                     'ui.Sheet'],
        ['Dialog',                    'ui.Dialog'],
        ['Toast',                     'ui.Toast'],
        ['FocusTrap',                 'ui.FocusTrap'],
        ['Calendar',                  'ui.Calendar'],
        ['calendar',                  'ui.Calendar'],
        ['FormComponents',            'ui.FormComponents'],
        ['FormPassword',              'ui.FormPassword'],
        ['Popover',                   'ui.Popover'],                 // inline-HTML target
        ['NotificationDrawer',        'ui.NotificationDrawer'],
        ['NotificationSheet',         'ui.NotificationSheet'],       // inline-HTML target
        ['toggleAuditDetails',        'ui.toggleAuditDetails'],      // inline-HTML target
        // pyeza ui.table primitives ------------------------------------------
        ['TableCore',                 'ui.table.TableCore'],
        ['TableState',                'ui.table.TableState'],
        ['TableToolbar',              'ui.table.TableToolbar'],
        ['TableColumns',              'ui.table.TableColumns'],
        ['TableDialog',               'ui.table.TableDialog'],
        ['TableDropdowns',            'ui.table.TableDropdowns'],
        ['TableExport',               'ui.table.TableExport'],
        ['TablePagination',           'ui.table.TablePagination'],
        ['TableSearch',               'ui.table.TableSearch'],
        ['TableSort',                 'ui.table.TableSort'],
        ['TableSelection',            'ui.table.TableSelection'],
        ['TableFilters',              'ui.table.TableFilters'],
        ['TableDensity',              'ui.table.TableDensity'],
        ['TableServer',               'ui.table.TableServer'],
        ['TableActions',              'ui.table.TableActions'],
        ['BulkAction',                'ui.table.BulkAction'],
        // private channel ----------------------------------------------------
        ['__tableSelectionCleanupAll', '_internal.tableSelectionCleanupAll'],
        ['__popoverInit',             '_internal.popoverInit'],      // inline-HTML target
        // page logic (owned by domain packages; targets land later) ----------
        ['eventDrawerForm',           'ui.eventDrawerForm'],
        ['PriceProductForm',          'centymo.pricelist.PriceProductForm'],
        ['downloadInvoice',           'centymo.revenue.downloadInvoice'],
        ['updatePasswordStrength',    'entydad.signup.updatePasswordStrength'],
        ['handlePasswordReset',       'entydad.user.handlePasswordReset'],
        ['AccountTemplates',          'fycha.ledger.AccountTemplates'],
        ['AccountTree',               'fycha.ledger.AccountTree'],
        ['settingsModal',             'serviceAdmin.settingsModal']
    ];

    // resolveTarget walks a dotted path WITHOUT creating segments, returning
    // undefined if any segment is missing (so an alias read before its target
    // exists yields undefined rather than a half-built namespace).
    function resolveTarget(path) {
        var node = lf;
        var segments = path.split('.');
        for (var i = 0; i < segments.length; i++) {
            if (node === undefined || node === null) return undefined;
            node = node[segments[i]];
        }
        return node;
    }

    function installAlias(legacyKey, targetPath) {
        // Never shadow a real own-property already sitting on the registry
        // root (e.g. ns/define/version/ui/_internal or a package namespace).
        if (Object.prototype.hasOwnProperty.call(lf, legacyKey)) {
            return;
        }
        try {
            Object.defineProperty(lf, legacyKey, {
                configurable: true,   // allow alias removal in the later soak step
                enumerable: false,    // keep the flat-root key-set lint clean
                get: function () {
                    return resolveTarget(targetPath);
                },
                set: function (value) {
                    // A legacy call-site still assigning lf.<Primitive> = ...
                    // is redirected to the tiered home so provenance holds.
                    lf.define(targetPath, value);
                }
            });
        } catch (e) {
            // Defensive: if defineProperty is unavailable, fall back to a
            // one-time value copy (best-effort; may be undefined this early).
            lf[legacyKey] = resolveTarget(targetPath);
        }
    }

    for (var a = 0; a < ALIASES.length; a++) {
        installAlias(ALIASES[a][0], ALIASES[a][1]);
    }
})();
