// src/bootstrap.js — side-effect import manifest for the SDK bundle.
//
// Imports the EXISTING export-free IIFE component sources (web/js/{components,
// table}/*.js) for their side effects ONLY. Each file assigns its leaf onto
// window.lf.ui.* exactly as it does when loaded via a <script> tag in the
// running app. We do NOT edit those files; esbuild simply concatenates them
// into the bundle in this explicit, dependency-correct order.
//
// ORDER MATTERS and is the SAME load order the app's partials enforce:
//   1. 00-lf-namespace.js  — registry + ns()/define() + ui/ui.table/_internal
//                            + lf.version + the back-compat ALIAS layer. FIRST.
//   2. component primitives — each populates lf.ui.<Primitive>.
//   3. table modules        — the 14-module order from table-scripts.html
//                             (table-core ... bulk-action, then table.js).
//
// This order is the SDK twin of the partial <script> ordering; the interim
// table.bundle.js concat (build/bundle.mjs) shares the same 14-name list.
// Both are EXPLICIT lists — never the alphabetical Glob, which is wrong
// (table-server must precede table-dropdowns, etc.).

// --- 1. registry foundation (loads first) -----------------------------------
import '../web/js/components/00-lf-namespace.js';
// lf.on() delegation helper — app-shell.html lists it right after the registry;
// notification-drawer.js (and others) call lf.on(...) at load, so it must
// initialize before the component primitives.
import '../web/js/components/lf-on.js';

// --- 2. component primitives ------------------------------------------------
import '../web/js/components/focus-trap.js';
import '../web/js/components/calendar.js';
import '../web/js/components/dialog.js';
import '../web/js/components/toast.js';
import '../web/js/components/sheet.js';
import '../web/js/components/form-components.js';
import '../web/js/components/form-password.js';
import '../web/js/components/notification-drawer.js';
import '../web/js/components/ui-form-result.js';

// --- 3. table modules (14-module order — table-scripts.html lines 31-46) -----
import '../web/js/table/table-core.js';
import '../web/js/table/table-server.js';
import '../web/js/table/table-dropdowns.js';
import '../web/js/table/table-search.js';
import '../web/js/table/table-sort.js';
import '../web/js/table/table-columns.js';
import '../web/js/table/table-filters.js';
import '../web/js/table/table-export.js';
import '../web/js/table/table-density.js';
import '../web/js/table/table-pagination.js';
import '../web/js/table/table-selection.js';
import '../web/js/table/table-actions.js';
import '../web/js/table/bulk-action.js';
import '../web/js/table/table.js';
