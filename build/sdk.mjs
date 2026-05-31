// build/sdk.mjs — esbuild dual-build for the @leapfor/ui SDK.
//
// ONE config, TWO output targets, SAME src/index.js entry (which side-effect
// imports the existing export-free IIFE component sources via bootstrap.js):
//
//   dist/lf.esm.js  — format:'esm'                  -> `import { Sheet } from '@leapfor/ui'`
//   dist/lf.umd.js  — format:'iife', globalName:'lf' -> <script> / CDN, exposes window.lf
//
// NON-BREAKING: these artifacts are ADDITIVE. The running service-admin app is
// NOT changed — it keeps loading the per-file IIFE scripts that
// pyeza.CopyStaticAssets copies verbatim. NO Go copy step and NO <script>
// partial references dist/. esbuild only WRITES to dist/ (outside every Go
// copy glob: web/js/components, web/js/table, and outside assets/js/pyeza).
//
// lf.version is injected at build time via `define` from package.json so both
// dist artifacts expose the SAME version (build/version-check.mjs asserts it
// equals the verbatim source constant in 00-lf-namespace.js).
//
// Mirrors the established esqyma Node-in-a-Go-package precedent
// (packages/esqyma/package.json pnpm scripts + @bufbuild devDeps).

import esbuild from 'esbuild';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PKG_DIR = resolve(__dirname, '..');
const DIST_DIR = resolve(PKG_DIR, 'dist');

const pkg = JSON.parse(readFileSync(resolve(PKG_DIR, 'package.json'), 'utf8'));
const VERSION = pkg.version;

const ENTRY = resolve(PKG_DIR, 'src/index.js');

mkdirSync(DIST_DIR, { recursive: true });

const banner = {
    js:
        `/* ${pkg.name} v${VERSION} — additive ESM+UMD SDK for the lf.ui.* surface.\n` +
        `   NON-BREAKING: the service-admin app does NOT consume this; it loads the\n` +
        `   per-file IIFE scripts copied verbatim by pyeza.CopyStaticAssets. */`,
};

// Shared options — lf.version injected from package.json (build-time stamp).
const common = {
    entryPoints: [ENTRY],
    bundle: true,
    platform: 'browser',
    target: ['es2019'],
    legalComments: 'none',
    logLevel: 'info',
    banner,
    define: {
        // Replaces the bare identifier __LF_VERSION__ in src/index.js.
        '__LF_VERSION__': JSON.stringify(VERSION),
    },
};

async function run() {
    // --- ESM target ---------------------------------------------------------
    // ESM is module-scoped + strict, so the bundled sources' BARE global `lf`
    // (lf-on.js etc.) would throw ReferenceError. Re-create it bound to
    // window.lf via the banner — same NON-BREAKING shim as the UMD target,
    // zero source edits.
    await esbuild.build({
        ...common,
        format: 'esm',
        outfile: resolve(DIST_DIR, 'lf.esm.js'),
        banner: {
            js:
                banner.js + '\n' +
                'var lf=(typeof window!=="undefined"?(window.lf=window.lf||{}):(typeof globalThis!=="undefined"?(globalThis.lf=globalThis.lf||{}):{}));',
        },
    });

    // --- UMD / IIFE target --------------------------------------------------
    // esbuild's 'iife' with globalName:'lf' assigns the module's exports to the
    // global `lf`. A small footer makes it a UMD-ish dual: it also publishes to
    // module.exports / define when those loaders are present, while STILL
    // exposing window.lf for plain <script>/CDN use.
    // IMPORTANT: the globalName MUST NOT be `lf`. The bundled IIFE component
    // sources reference a BARE global `lf` (e.g. lf-on.js: `window.lf = ...; lf.on = ...`)
    // which, in a real browser top-level script, resolves to `window.lf`. If
    // esbuild's wrapper declared `var lf = (() => {...})()`, that binding would
    // shadow the global and the bare `lf` reads inside the bundle would hit the
    // still-undefined SDK object. We therefore expose the SDK module object as
    // `window.lfui` and let the sources own `window.lf` (the registry). The
    // banner re-aliases bare `lf`/`window.lf` to the true global so the wrapped
    // sources keep resolving exactly as they do under <script> tags.
    await esbuild.build({
        ...common,
        format: 'iife',
        globalName: 'lfui',
        // .cjs extension: package.json has "type":"module", so Node would load a
        // .js as ESM (ignoring module.exports). The CommonJS/UMD artifact must be
        // .cjs for `require('@leapfor/ui')` to work. Browser <script>/CDN loads
        // the same bytes regardless of extension and uses the window globals the
        // bundled sources build (window.lf) + the SDK object (lfui).
        outfile: resolve(DIST_DIR, 'lf.umd.cjs'),
        // Re-create the source files' assumed top-level global `lf` INSIDE the
        // esbuild IIFE before any bundled source runs, bound to window.lf. This
        // restores the browser-script semantics the export-free sources rely on
        // without editing a single source file (NON-BREAKING).
        banner: {
            js:
                banner.js + '\n' +
                'var lf=(typeof window!=="undefined"?(window.lf=window.lf||{}):(typeof globalThis!=="undefined"?(globalThis.lf=globalThis.lf||{}):{}));',
        },
        footer: {
            js:
                // Publish the SDK module object for UMD/CommonJS/AMD consumers,
                // but NEVER clobber the registry the sources built on window.lf.
                'if(typeof module!=="undefined"&&module.exports){module.exports=lfui;}' +
                'else if(typeof define==="function"&&define.amd){define(function(){return lfui;});}',
        },
    });

    // --- minimal hand-authored type stub ------------------------------------
    // A full .d.ts generation is a documented TODO (no TS source yet); this stub
    // satisfies the package.json "types" field and the frozen export surface.
    writeFileSync(resolve(DIST_DIR, 'lf.d.ts'), TYPE_STUB, 'utf8');

    console.log(`[sdk] built dist/lf.esm.js + dist/lf.umd.cjs + dist/lf.d.ts (lf.version=${VERSION})`);
}

const TYPE_STUB = `// Generated by build/sdk.mjs — frozen @leapfor/ui surface (lf.ui.*).
// TODO(W4): replace this hand stub with generated .d.ts once the per-file
// component sources gain JSDoc-driven or TS-authored declarations.
export const version: string;
export const Sheet: any;
export const Dialog: any;
export const Toast: any;
export const FocusTrap: any;
export const Calendar: any;
export const FormComponents: any;
export const FormPassword: any;
export const Popover: any;
export const NotificationDrawer: any;
export const NotificationSheet: any;
export const handleFormResult: any;
export const toggleAuditDetails: any;
export const table: Record<string, any>;
export function normalizeAuthz(p?: { disabled?: boolean; disabledTooltip?: string }): { disabled: boolean; disabledTooltip: string };
export function isAuthorized(p?: { disabled?: boolean }): boolean;
export function applyAuthzAttributes<T = any>(el: T, p?: { disabled?: boolean; disabledTooltip?: string }): T;
export function isElementInert(el: any): boolean;
export function guardDispatch(p: { disabled?: boolean; disabledTooltip?: string }, action: () => any): boolean;
export function renderInert(p?: { disabled?: boolean; disabledTooltip?: string }): { disabled: boolean; ariaDisabled: 'true' | null; title: string; attrs: Record<string, string> };
export const authz: any;
declare const _default: any;
export default _default;
`;

run().catch((err) => {
    console.error('[sdk] build failed:', err);
    process.exit(1);
});
