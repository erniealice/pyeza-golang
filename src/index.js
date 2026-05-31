// src/index.js — the ADDITIVE ESM barrel for the @leapfor/ui SDK.
//
// This is the ONLY file in pyeza that uses `export`. The per-file component
// sources under web/js/{components,table}/ stay export-free IIFEs so the
// verbatim Glob+copy path (assets_scripts.go) and the hand-listed <script>
// tags (app-shell.html / table-scripts.html) are completely unaffected. This
// barrel is consumed ONLY by external `import`/CDN through the dual build; it
// is referenced by NO Go copy step and NO <script> partial.
//
// Boundary (frozen, shipped in W1 — 00-lf-namespace.js):
//   lf.ui.*        FROZEN public design-system surface (pyeza primitives).
//   lf.ui.table.*  FROZEN public table primitives (16-module system).
//   lf._internal.* UNSTABLE / private — DELIBERATELY NOT EXPORTED here.
//   lf.<pkg>.*     domain page logic — app-internal, NOT part of @leapfor/ui.
//
// How the re-export works without rewriting the IIFE sources:
//   1. `import './bootstrap.js'` runs the bundled IIFE component sources for
//      their side effects, which populate window.lf.ui.* exactly as the app's
//      <script> tags do (00-lf-namespace.js first, then each component).
//   2. We then read the frozen symbols off the registry and re-export them.
//   Because esbuild bundles bootstrap.js's transitive `import`s of the IIFE
//   files into the SAME output, a consumer's single `import '@leapfor/ui'`
//   self-initializes the registry — no separate <script> needed.
//
// lf.version is injected at BUILD time by esbuild `define` from package.json
// (see build/sdk.mjs) and is also readable off the live registry below.

import './bootstrap.js';
import * as authzModule from './authz.js';

// __LF_VERSION__ is replaced at build time by esbuild `define` with the
// package.json version literal. The fallback keeps the un-bundled source
// importable (e.g. under `node --check`) and mirrors the source constant in
// 00-lf-namespace.js (CI asserts the two are equal — build/version-check.mjs).
const LF_VERSION = (typeof __LF_VERSION__ !== 'undefined') ? __LF_VERSION__ : '1.0.0';

// Resolve the live registry that the bootstrapped IIFEs populated. Guarded so
// the barrel is importable in a non-DOM context (the bundle still defines
// window via its UMD/ESM footer when loaded in a browser).
const _root =
    (typeof window !== 'undefined' && window.lf) ? window.lf :
    (typeof globalThis !== 'undefined' && globalThis.lf) ? globalThis.lf :
    {};
const _ui = _root.ui || {};
const _table = _ui.table || {};

// --- FROZEN public primitives (lf.ui.*) -------------------------------------
// 1:1 with the frozen set enumerated in 00-lf-namespace.js + plan.md W4.
export const Sheet = _ui.Sheet;
export const Dialog = _ui.Dialog;
export const Toast = _ui.Toast;
export const FocusTrap = _ui.FocusTrap;
export const Calendar = _ui.Calendar;
export const FormComponents = _ui.FormComponents;
export const FormPassword = _ui.FormPassword;
export const Popover = _ui.Popover;
export const NotificationDrawer = _ui.NotificationDrawer;
export const NotificationSheet = _ui.NotificationSheet;
export const handleFormResult = _ui.handleFormResult;
export const toggleAuditDetails = _ui.toggleAuditDetails;

// --- FROZEN public table primitives (lf.ui.table.*) -------------------------
// Re-exported as a namespace object: `import { table } from '@leapfor/ui'`.
export const table = _table;

// --- JS-side authz-parameter contract (the W4 "pyeza stays dumb" seam) ------
// Every SDK entrypoint reflects the host's server authz decision via these and
// never computes authz itself. Exported so external consumers wire the same
// {disabled, disabledTooltip} reflection the app's IIFE controls already honor.
export const {
    normalizeAuthz,
    isAuthorized,
    applyAuthzAttributes,
    isElementInert,
    guardDispatch,
    renderInert,
} = authzModule;
export const authz = authzModule.authz;

// --- Version --------------------------------------------------------------
export const version = LF_VERSION;

// NOTE: lf._internal.* (tableSelectionCleanupAll, popoverInit,
// applyPaginationMeta, captureFocusIdentity) is the UNSTABLE channel and is
// deliberately NOT exported. Do not add it here — the non-export IS the
// contract.

export default {
    version: LF_VERSION,
    Sheet, Dialog, Toast, FocusTrap, Calendar,
    FormComponents, FormPassword, Popover,
    NotificationDrawer, NotificationSheet,
    handleFormResult, toggleAuditDetails,
    table,
    // authz contract
    normalizeAuthz, isAuthorized, applyAuthzAttributes,
    isElementInert, guardDispatch, renderInert, authz,
};
