// build/bundle.mjs — interim concat of the 14 table tags into one bundle.
//
// Writes dist/table.bundle.js by concatenating the 14 table/*.js IIFE files in
// the EXPLICIT, dependency-correct order — the SAME order enumerated in
// web/templates/partials/table-scripts.html (lines 31-46), NOT the alphabetical
// filepath.Glob order (which is wrong: table-server must precede table-dropdowns,
// table-actions must precede bulk-action, table.js must be last).
//
// NON-BREAKING: the app keeps loading the 14 individual <script> tags until a
// template flip is deliberately chosen. This artifact lands in dist/ — outside
// every Go copy glob and referenced by NO <script> partial — so it changes
// NOTHING about how the running app loads scripts. It exists so the "missing
// dependency = build error" / one-request table delivery is ready when desired.
//
// We use esbuild in bundle:false concat mode (no module transform) to preserve
// each IIFE byte-for-byte semantics; the files are independent IIFEs that share
// state only through window.lf, so plain ordered concatenation is correct.

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PKG_DIR = resolve(__dirname, '..');
const TABLE_DIR = resolve(PKG_DIR, 'web/js/table');
const DIST_DIR = resolve(PKG_DIR, 'dist');

// EXPLICIT ordered list — mirrors table-scripts.html. Keep in lockstep with
// src/bootstrap.js. Adding/removing a table module updates BOTH lists + the
// partial.
const TABLE_FILES = [
    'table-core.js',
    'table-server.js',
    'table-dropdowns.js',
    'table-search.js',
    'table-sort.js',
    'table-columns.js',
    'table-filters.js',
    'table-export.js',
    'table-density.js',
    'table-pagination.js',
    'table-selection.js',
    'table-actions.js',
    'bulk-action.js',
    'table.js', // main entry point — LAST
];

mkdirSync(DIST_DIR, { recursive: true });

const header =
    `/* @leapfor/ui — table.bundle.js (interim concat of ${TABLE_FILES.length} table modules).\n` +
    ` * Explicit dependency order from table-scripts.html — NOT the alphabetical Glob.\n` +
    ` * ADDITIVE: the running app still loads the ${TABLE_FILES.length} individual tags. */\n`;

const parts = [header];
for (const name of TABLE_FILES) {
    const full = resolve(TABLE_DIR, name);
    const code = readFileSync(full, 'utf8');
    parts.push(`\n/* ===== ${name} ===== */\n`);
    parts.push(code);
    if (!code.endsWith('\n')) parts.push('\n');
}

const out = resolve(DIST_DIR, 'table.bundle.js');
writeFileSync(out, parts.join(''), 'utf8');

console.log(`[bundle] wrote dist/table.bundle.js (${TABLE_FILES.length} modules, ordered)`);
