// build/version-check.mjs — CI equality assert for lf.version.
//
// package.json is the SOURCE OF TRUTH for the SDK build-time version; the IIFE
// runtime constant in 00-lf-namespace.js is the verbatim-copied mirror the
// running app reads. This asserts the two are EQUAL so the additive build-time
// stamp (esbuild define) can never drift from the source/copy-time stamp.
//
// Exits non-zero on mismatch so it plugs straight into CI next to
// lint-lf-namespace.sh.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PKG_DIR = resolve(__dirname, '..');

const pkg = JSON.parse(readFileSync(resolve(PKG_DIR, 'package.json'), 'utf8'));
const ns = readFileSync(resolve(PKG_DIR, 'web/js/components/00-lf-namespace.js'), 'utf8');

// Match:  lf.version = '1.0.0';   (single- or double-quoted)
const m = ns.match(/lf\.version\s*=\s*['"]([^'"]+)['"]/);
if (!m) {
    console.error('[version-check] FAIL — could not find `lf.version = "..."` in 00-lf-namespace.js');
    process.exit(1);
}
const iifeVersion = m[1];

if (iifeVersion !== pkg.version) {
    console.error(
        `[version-check] FAIL — version drift:\n` +
        `  package.json           = ${pkg.version}\n` +
        `  00-lf-namespace.js     = ${iifeVersion}\n` +
        `Bump both in lockstep (package.json is source-of-truth; the IIFE constant is the mirror).`
    );
    process.exit(1);
}

console.log(`[version-check] PASS — lf.version is in sync: ${pkg.version}`);
