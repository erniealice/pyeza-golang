# @leapfor/ui — SDK dual-build (W4)

This directory holds the additive ESM + UMD bundler for the `@leapfor/ui` SDK
(the pyeza `window.lf.ui.*` design-system surface). It mirrors the established
esqyma Node-in-a-Go-package precedent (`packages/esqyma/package.json` pnpm
scripts + `@bufbuild` devDeps), so Node tooling inside a Go package is an
existing monorepo pattern.

## NON-BREAKING is the hard gate

The running `service-admin` app is **NOT** changed and does **NOT** consume
these artifacts. It keeps loading the per-file IIFE scripts that
`pyeza.CopyStaticAssets` copies **verbatim** (`assets_scripts.go` →
`/assets/js/pyeza/*.js`) and the hand-listed `<script>` tags in
`app-shell.html` / `table-scripts.html`. The SDK build writes **only** to
`dist/` — outside every Go copy glob (`web/js/components`, `web/js/table`) and
referenced by **no** `<script>` partial and **no** `container.go` boot step.

Proof the IIFE path is untouched:
- `git diff` shows **zero modifications** to any IIFE source, to
  `assets_scripts.go`, or to any `<script>` partial. Only additions + a benign
  `.gitignore` line.
- `lint-lf-namespace.sh` still passes (W1 provenance holds).

## Commands

| Command | Output |
|---|---|
| `pnpm build:bundle` | `dist/table.bundle.js` — interim concat of the 14 table modules in the **explicit** `table-scripts.html` order (NOT the alphabetical Glob). |
| `pnpm build:sdk` | `dist/lf.esm.js` (ESM) + `dist/lf.umd.cjs` (UMD/IIFE, `window.lf` + CJS/AMD) + `dist/lf.d.ts`. `lf.version` injected from `package.json`. |
| `pnpm build` | both of the above. |
| `pnpm check:js` | `node --check` over every IIFE + SDK source. |
| `pnpm version:check` | asserts `package.json.version` === the `lf.version` constant in `00-lf-namespace.js`. |
| `pnpm test` | the authz negative test (`test/authz.negative.test.mjs`). |
| `pnpm lint:namespace` | the W1 `window.lf` provenance lint. |

## Public surface (frozen)

`src/index.js` is the **only** file that uses `export`. The per-file component
sources stay export-free IIFEs. The barrel side-effect-imports the IIFE sources
(via `src/bootstrap.js`, in the same dependency order the app partials enforce)
and re-exports the frozen registry symbols:

- `lf.ui.*` → `Sheet, Dialog, Toast, FocusTrap, Calendar, FormComponents,
  FormPassword, Popover, NotificationDrawer, NotificationSheet,
  handleFormResult, toggleAuditDetails`
- `lf.ui.table.*` → `export const table` (the 16-module system)
- the JS-side authz contract → `normalizeAuthz, isAuthorized,
  applyAuthzAttributes, isElementInert, guardDispatch, renderInert, authz`
- `version`

`lf._internal.*` is the **unstable** channel and is **deliberately NOT
exported** — the non-export IS the contract.

Consumer usage:

```js
import { Sheet, table, guardDispatch } from '@leapfor/ui';   // ESM
const lf = require('@leapfor/ui');                            // UMD/CJS
<script src="https://cdn/.../lf.umd.cjs"></script>           // window.lf
```

## JS-side authz parameter (pyeza stays dumb)

`src/authz.js` is the JS projection of `permission-reflection-pattern.md §4`.
pyeza never imports the perm model and never decides authz. The **host** view
layer (server-authz-checked) passes `{disabled, disabledTooltip}` — mirroring
the Go `Disabled`/`DisabledTooltip` fields on `TableAction`/`PrimaryAction`/
`BulkAction` (`types/table.go`). The SDK only **reflects** that decision:
renders `disabled` + `aria-disabled="true"` + `title=tooltip`, and hard-aborts
any dispatch (the `bulk-action.js:54-58` seam) when the host marked the control
inert. The host endpoint stays the real gate (authz W0 backstop).

`test/authz.negative.test.mjs` proves: an unauthorized host param (1) renders
inert (disabled + aria-disabled + tooltip) and (2) fires **no** network /
use-case call, while an authorized param dispatches exactly once.

## TODO — incremental per-component ESM exports

This pass lands the bundler + dual-build + `lf.version` + authz contract and
exports the already-clean `lf.ui.*` surface via the runtime-registry barrel
(side-effect bootstrap → re-export). The re-export reads the symbols off the
live `window.lf.ui.*` registry the bundled IIFEs build, which is the
non-breaking minimum.

A later wave can incrementally convert each component to a true ES module
(`export function Sheet…`) so the ESM target tree-shakes per component without
loading the whole bundle. That is a larger, per-file change and is intentionally
deferred — it must never come at the cost of breaking the IIFE app. Track here:

- [ ] per-component `export` in `web/js/components/*.js` behind a dual entry
      (keep the IIFE side-effect for the app; add a named export for the SDK).
- [ ] generated `.d.ts` from JSDoc/TS instead of the hand stub in `sdk.mjs`.
- [ ] wire `pnpm build:bundle` + `pnpm build:sdk` + `pnpm version:check` +
      `pnpm lint:namespace` into CI next to `audit-tags.sh`.
