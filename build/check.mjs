// build/check.mjs — `node --check` syntax gate for every IIFE source + SDK src.
//
// Runs Node's parser (--check) over each web/js/{components,table}/*.js IIFE
// source and the src/*.js SDK barrel/authz/bootstrap. A parse error fails CI.
// This is the cheap "the bundler/sources are well-formed" gate the W4 task
// asks for, independent of esbuild.

import { execFileSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PKG_DIR = resolve(__dirname, '..');

const dirs = [
    resolve(PKG_DIR, 'web/js/components'),
    resolve(PKG_DIR, 'web/js/table'),
    resolve(PKG_DIR, 'web/js'),
    resolve(PKG_DIR, 'src'),
];

let files = [];
for (const d of dirs) {
    let entries = [];
    try { entries = readdirSync(d); } catch (e) { continue; }
    for (const f of entries) {
        if (f.endsWith('.js')) files.push(join(d, f));
    }
}

let failed = 0;
for (const f of files) {
    try {
        execFileSync(process.execPath, ['--check', f], { stdio: 'pipe' });
    } catch (e) {
        failed++;
        console.error(`[check] PARSE ERROR: ${f}`);
        console.error(String(e.stderr || e.message).trim());
    }
}

if (failed > 0) {
    console.error(`[check] FAIL — ${failed} file(s) failed node --check.`);
    process.exit(1);
}
console.log(`[check] PASS — ${files.length} JS files parse clean (node --check).`);
