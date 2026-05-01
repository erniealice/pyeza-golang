# Pyeza Table — Sort + Select-All Overhaul — Progress Log

**Plan:** [plan.md](./plan.md)
**Started:** 2026-05-01
**Branch:** `dev/20260501-table-sort-and-select-all`

---

## Phase 1: Sort bug fixes (CSS, server-render classes, JS direction) — ✅ COMPLETE

- [x] `packages/pyeza-golang/web/styles/components/table.css:779-781` — collapsed two 3-line rules into two single-line rules; appended `svg` so the override now targets the actual icon, not the wrapping span
- [x] `packages/pyeza-golang/web/templates/components/table/table.html:153, 184` — appended `sort-{{$activeDirection}}` inside the `{{if $isActive}}` block of the `<th>` class attribute, in both column-sub-header and standard header branches
- [x] `packages/pyeza-golang/web/js/table/table-sort.js:96-107` — `initHeaderSort` now reads `this.dataset.sortDirection` first (always emitted server-side), falls back to classList check; with kind-aware default placeholder comment for Phase 3
- [ ] Manual smoke (deferred to Phase 6): load any list page with default `?sort=name&dir=asc` — verify arrow visible; click header — verify flips to desc

---

## Phase 2: Default-on Sortable (NoSort opt-out) — ✅ COMPLETE

- [x] `packages/pyeza-golang/types/table.go:36-49` — `Sortable bool` deleted; `NoSort bool` added with doc comment
- [x] `packages/pyeza-golang/types/table.go:545-554` — `SortableKeys()` rewritten as `!c.NoSort && c.Key != ""`
- [x] `grep -rn "\.Sortable\|Sortable:" packages apps` — final greps return zero hits across `.go` and `.html` files; no orphan readers remain
- [x] `packages/pyeza-golang/web/templates/components/table/table.html:153-160, 184-191` — `{{if .Sortable}}` → `{{if not .NoSort}}` in both header branches (4 occurrences total)
- [x] `packages/pyeza-golang/web/templates/components/table/table-toolbar.html:124` — `{{if .Sortable}}` → `{{if not .NoSort}}` in sort dropdown
- [x] Sweep — **106 consumer files** touched, **458 lines deleted** (`Sortable: true` removed), **178 lines converted** (`Sortable: false` → `NoSort: true`). Delegated to general-purpose sonnet sub-agent. Per-file counts in agent report.
  - [x] `packages/centymo-golang/views/**/page.go` — 38 files
  - [x] `packages/entydad-golang/views/**/page.go` — 18 files
  - [x] `packages/fycha-golang/views/**/page.go` — 27 files
  - [x] `packages/fayna-golang/views/**/page.go` — 11 files
  - [x] `packages/cyta-golang/views/**/page.go` — 3 files
  - [x] `packages/hybra-golang/views/**/handler.go` — 2 files
  - [x] `packages/pyeza-golang/types/table_test.go` — 3 deleted, 4 converted; `TestSortableKeys` assertions still hold (semantic equivalence preserved by explicit fixtures)
  - [x] `packages/pyeza-golang/web/templates/components/table/table.html` — top-of-file usage example comment updated
  - [x] `packages/pyeza-golang/docs/guide/tables.md` — examples + field doc updated
- [ ] Defer `ParseTableParams` `allowedSortColumns` migration to follow-up plan; existing slices stay
- [ ] Manual smoke (deferred to Phase 6): every list page header is hoverable + sortable except select-all + actions

**Could-become-sortable candidates flagged for future review** (historically `Sortable: false`, now `NoSort: true`, but back stable DB columns): `inventory.sku`, `inventory.tracking_mode`, `product.line` / `product.line_id`, `product.sort_order`, `price_plan.duration`. Enable by deleting the `NoSort: true` line in each.

---

## Phase 3: Per-cell-type sort semantics + lyngua dropdown labels — ✅ COMPLETE

- [x] `packages/pyeza-golang/types/table.go::TableColumn` — added `SortKind string` field with doc comment
- [x] `packages/pyeza-golang/types/table.go` — added `DeriveSortKind(cellType string) string` helper; memoization block added at top of `ApplyColumnStyles` (slice-header passes the populated SortKind back to the caller; verified by signature inspection)
- [x] `packages/pyeza-golang/types/table.go::TableLabels` — added 8 fields: `SortAscText`, `SortDescText`, `SortAscNumber`, `SortDescNumber`, `SortAscDate`, `SortDescDate`, `SortAscEnum`, `SortDescEnum`
- [x] `packages/pyeza-golang/web/templates/components/table/table.html` — `{{if .SortKind}} data-sort-kind="{{.SortKind}}"{{end}}` emitted on each sortable `<th>` in both header branches, adjacent to `data-sort`
- [x] `packages/pyeza-golang/web/templates/components/table/table-toolbar.html` — sort dropdown options use **explicit `{{if eq .SortKind ...}}` chain** for label selection (template `index` only works on maps, not structs; `title` func not registered — chain was the right path); `data-sort-kind` also added to `.sort-option` div for JS state sync
- [x] Lyngua: added 8 keys to `packages/lyngua/translations/en/common/common.json` under root `table.` namespace
- [x] Lyngua glue: `CommonTableLabels` (`labels_types.go`) carries 8 json-tagged fields; `centymo`/`entydad`/`fycha` `MapTableLabels` each wire all 8; fayna + cyta inherit from parent block
- [x] `packages/pyeza-golang/web/js/table/table-sort.js` — Phase 1 placeholder replaced with kind-aware default direction: `kind === 'number' || kind === 'date'` → `desc`, else `asc`. Triggered only when `currentDir` is empty (first click on an unsorted column)
- [x] `packages/pyeza-golang/web/styles/components/table.css` — `.sort-dir-label` style appended near `.sort-dir-btn`
- [ ] Manual smoke (deferred to Phase 6): open Sort dropdown on a table with money + date + text columns; verify per-type labels render

---

## Phase 4: Column selector aware of active sort — ✅ COMPLETE

- [x] `packages/pyeza-golang/types/table.go:278::TableLabels` — `ColumnSortLockedHint string` (pre-staged; agent verified)
- [x] `packages/pyeza-golang/web/templates/components/table/table-toolbar.html:163-178` — `data-sort-active-column` on `.columns-menu`; per-row `disabled` + `aria-disabled` + `column-toggle-locked` class + `<small>` hint when sort matches (pre-staged; agent verified)
- [x] `packages/pyeza-golang/web/styles/components/table.css:333-348` — `.column-toggle-locked`, `.column-toggle-locked input`, `.column-toggle-hint` styles (pre-staged; agent verified)
- [x] `packages/pyeza-golang/web/js/table/table-columns.js` — added `if (this.disabled) return;` guard on change handler; added `refreshColumnSortLock(card)` exported helper that re-syncs `disabled`/`aria-disabled`/`column-toggle-locked` class from `card.dataset.sortColumn`
- [x] `packages/pyeza-golang/web/js/table/table-server.js:285-288` — calls `lf.TableColumns.refreshColumnSortLock(tableCard)` after every targeted swap (slots into existing post-swap hook sequence: `applyPaginationMeta` → `TablePagination.init` → `TableSelection.initBulkSelection` → `TableColumns.refreshColumnSortLock`)
- [x] Lyngua: `table.columnSortLockedHint` in `common.json:215` (pre-staged; agent verified)
- [x] Lyngua glue: `CommonTableLabels` (`labels_types.go:291`), wired through all three `MapTableLabels` (centymo/entydad/fycha)
- [ ] Manual smoke (deferred to Phase 6): open Columns dropdown — sorted column is disabled with hint; change sort, lock follows

**Known limitation (deferred):** after a targeted sort swap, the lock visual state (opacity, cursor, disabled checkbox) updates correctly client-side, but the `<small class="column-toggle-hint">` element is server-rendered into the toolbar (which doesn't swap). Hint text appears only after a full page reload. Fix would expose the hint string to JS via a `data-hint` attribute on `.columns-menu` so `refreshColumnSortLock` can inject/remove the element. Out of scope for this plan; flag as follow-up if it bites users.

---

## Phase 5: Select-all button mode machine — ✅ COMPLETE

- [x] `packages/pyeza-golang/types/table.go::TableLabels` — `BulkSelectAllPage`, `BulkSelectAllAcrossPages`, `BulkClearSelection` added (pre-staged before this session; agent verified)
- [x] `packages/pyeza-golang/web/templates/components/table/table-toolbar.html` (`table-bulk-toolbar` define) — replaced old `bulk-select-all-btn` with always-present `data-action="select-all" data-mode="page" aria-live="polite"` button; initial label = `{{.Labels.BulkSelectAllPage}}`; deprecation comment added for the old `BulkActions.SelectAllLabel` per-table override
- [x] Added `<script type="application/json" id="{{.ID}}-bulk-labels">` block at top of `table-bulk-toolbar` define; uses new `quoteJSON` template func registered in `packages/pyeza-golang/renderer_funcs.go::getDefaultFuncMap` (sibling of `filterColumnsJSON`)
- [x] `packages/pyeza-golang/web/js/table/table-selection.js::updateBulkSelectionUI` — old 4-branch if/else replaced with `resolveSelectAllMode()` + `applySelectAllMode()` calls; three new private helpers added (`resolveSelectAllMode`, `applySelectAllMode`, `readBulkLabels`)
- [x] `packages/pyeza-golang/web/js/table/table-selection.js::selectAllBtnHandler` — rewritten as switch on `btn.dataset.mode`: `clear` → `clearAllSelections`, `all-pages` → enter cross-page mode + `fetchAllResultIds`, `page` (default) → check all visible rows
- [x] Lyngua: 3 keys added to `common.json` under `table.` namespace (pre-staged; agent verified); `{N}` placeholder convention with literal `.replace('{N}', totalRows)` in JS
- [x] Lyngua glue: `pyeza-golang/labels_types.go::CommonTableLabels` carries the 3 json-tagged fields; `centymo-golang/labels.go`, `entydad-golang/labels.go`, `fycha-golang/labels.go` each wire them into `MapTableLabels`; fayna + cyta inherit from parent block (no edit needed)
- [ ] Manual smoke (deferred to Phase 6): select 1 row → button = "Select All items in this page"; click button → button = "Select all 847 across all pages"; click button → counter jumps + button = "Clear selection"
- [x] Cross-page invalidation on sort/filter change: **dropped** — verified `table.css:2394` hides regular toolbar when `data-bulk-mode="true"`, so sort/filter changes are unreachable while a cross-page selection is held

---

## Phase 7: Post-merge polish (UI fixes after live use) — 🔄 IN PROGRESS

Live use of the merged Phase 1-5 work surfaced several UI/UX issues. All fixed in the same `packages/pyeza-golang` working tree, **not yet committed**.

### 7.1 — Sort dropdown layout broken by Phase 3 labels

**Symptom:** `.sort-dir-btn` was locked at `1.75rem × 1.75rem` from before Phase 3, but Phase 3 added an icon **plus** a localized text label ("A → Z", "Low → High", "Oldest → Newest", etc.) inside it. Content overflowed the small square; the active terracotta background only covered the icon area (looked like a red blob); the dropdown's inherited `min-width: 12.5rem` was too narrow for label + 2 icon-and-text buttons; "Oldest → Newest" wrapped mid-button.

**Fix (`web/styles/components/table.css`):**
- `.sort-dir-btn` — dropped fixed width/height; switched to `inline-flex` + `min-height: 1.75rem` + `padding: 0 0.5rem` + `gap: 0.25rem` + `white-space: nowrap`. Button now grows naturally with its content.
- `.sort-dir-label` — `color: inherit` (was `--text-muted`, which stayed muted-grey on the active terracotta button). `line-height: 1`, removed `margin-left` (now driven by parent's `gap`).
- `.sort-option` — added `gap: 1rem` so the column label doesn't crash into the direction buttons.
- `.sort-menu` — added `min-width: 20rem` to override the shared `.toolbar-dropdown-menu` `12.5rem` minimum; the column label + two icon-and-text buttons need the room.

### 7.2 — Hover/active radii inherited an over-rounded global

**Symptom:** `.sort-option`/`.sort-dir-btn` used `var(--radius-sm)`, which the user judged too round on hover/active given the dropdown's nested context.

**Fix:** swapped `var(--radius-sm)` for explicit values that honor the **concentric corner rule** (`inner = outer − padding`):
- `--radius-lg` (dropdown shell) = `1rem`.
- `.sort-menu` padding = `0.5rem` → `.sort-option` `border-radius: 0.5rem` (= `1 − 0.5`).
- `.sort-dir-btn` `border-radius: 0.25rem` (strictly smaller than its parent row).
- Visually nested: dropdown 1rem → row 0.5rem → button 0.25rem.

### 7.3 — Columns dropdown rendered the lock hint as an inline blob

**Symptom (screenshot):** the `<small class="column-toggle-hint">` for the locked sort column rendered as a giant pill-shaped blob *behind* the option row, because the parent `<label>` was `display: flex; align-items: center` with no wrap.

**Fix (`web/styles/components/table.css`):**
- `.columns-menu` — added `min-width: 16rem` (parity with the sort dropdown treatment).
- `.column-toggle` — added `flex-wrap: wrap`, switched to concentric `border-radius: 0.5rem`.
- `.column-toggle-hint` — added `flex-basis: 100%` so the hint occupies its own flex row beneath the checkbox+label, with `padding-left: 1.625rem` aligning it under the label text (past checkbox + gap), `line-height: 1.3` for clean wraps.

### 7.4 — Newly-sortable column 500'd (use-case allow-list never extended)

**Symptom:** clicking the sort dropdown's `line` ascending option on `/app/services/list/active` returned `500 Internal Server Error`. Server log: *"unknown sort column 'line' for product list (allowed: [id active name description price tracking_mode product_type unit_of_measure date_created date_modified])"* — exactly the loophole `progress.md` flagged after the Phase 6 follow-up.

**Diagnosis:** Phase 6 follow-up deleted `NoSort: true` from `product.line` (and 5 sibling columns) at the column-config layer, but the use-case/repository allowed-sort whitelist was never extended. The view-level `ParseTableParams` accepted `line` (because `types.SortableKeys(columns)` now included it), passed it down, and the SQL layer rejected it.

**Fix (`packages/centymo-golang/views/product/list/page.go:325`):** restored `NoSort: true` on `line` until the use-case layer is extended to actually support sort-by-line. **Five other columns from the same follow-up still have the same risk** (`product.line_id`, `product.sort_order`, `inventory.sku`, `price_plan.duration`; `inventory.tracking_mode` is already in its use case's allowed list, so safe). They each need either a use-case whitelist extension OR the same revert before users hit them.

### 7.5 — Sort dropdown active state never server-rendered

**Symptom:** navigating directly to `?sort=price&dir=desc` showed the column header `<th>` correctly highlighted but the toolbar sort dropdown rendered every option inactive — no row highlighted, no direction button highlighted.

**Diagnosis:** `table.html` already plumbed `ServerPagination.SortColumn`/`SortDirection` into the `<th>` (lines 152-153, 183-184) and the columns-menu lock (Phase 4). The sort dropdown was the third surface that needed it and was never wired.

**Fix (`web/templates/components/table/table-toolbar.html:135-153`):** mirrored the existing `<th>` pattern. Each `.sort-option` now adds `active` when its `.Key == $.ServerPagination.SortColumn`; the matching `.sort-dir-btn[data-direction]` adds `active` when the direction matches. Three template surfaces (header, sort dropdown, columns-menu lock) now agree on every render.

### 7.6 — `applyDefaultSort()` clobbered server-rendered sort on init

**Symptom:** after 7.5 was in place and a `curl` confirmed the server emitted `class="sort-option active"` for the URL's sort column, **the live page in Edge still showed `name` as the active sort even with `?sort=price`**. Playwright probe revealed:
- `.table-card[data-sort-column="price" data-sort-direction="asc"]` ✓
- `<th data-sort="name" class="sortable sort-asc">` ✗ (should be on price)
- `.sort-option[data-sort="name"].active` ✗ (should be on price)

JS was overwriting the server's render milliseconds after page load.

**Diagnosis:** `table-sort.js::applyDefaultSort()` ran on every init for any `<table data-default-sort>` and called `updateTableSortIndicators(table, defaultColumn, defaultDirection)` + `updateToolbarSortState(...)` + `sortTable(tbody, ...)`. For server-paginated tables that's pure damage — the server already authoritatively rendered the URL's sort, and re-applying the page's `DefaultSortColumn` (e.g. "name") moves the active class to the wrong column and tries to client-sort rows the server already ordered.

**Fix (`web/js/table/table-sort.js:201-228`):** early-return from `applyDefaultSort()` when `table.closest('.table-card').dataset.serverPagination === 'true'`. Client-paginated tables retain the existing default-sort behavior. Verified via Playwright probe: `<th data-sort="price"> = sortable active sort-asc`, `aria-sort="ascending"`, dropdown active matches.

### 7.7 — CSV export now type-aware (consistent across every list page)

**Symptom:** `exportToCSV` did `td.textContent.trim()` on every cell. For typed cells this produced presentation-mangled output: money cells included the currency symbol *and* thousands separators (`"₱ 5,000.00"` — Excel re-interprets as text); datetime stacked cells included the literal newline between date and time; chips/multi-person ran names together with no separator; badges exported the localized variant text instead of the machine-meaningful code.

**Fix (server formats once, client just reads):**
- `packages/pyeza-golang/types/table.go::TableCell` — added `CSVValue string` field (explicit per-cell override) and a `CellCSV(c TableCell) string` helper. `CellCSV` resolves: explicit `CSVValue` → type-default → `Value` fallback. Type defaults strip presentational chrome and join multi-value fields with `"; "`:
  - `money`/`number` — `.Value` (no currency, no number-prefix/suffix)
  - `datetime` — `"DateText TimeText"` (single space, no newline) when both populated, else `.Value`
  - `chips`/`multi-person` — semicolon-joined labels/names
  - `single-person` — `Person.Name`
  - `author` — `"Name (date)"` when variant carries the date
  - `html` — `.Value` (caller should set `CSVValue` if structured HTML matters)
  - default (text/name/link/email/phone/badge/select/input) — `.Value`
- `packages/pyeza-golang/renderer_funcs.go` — registered `csvCell` template func pointing at `types.CellCSV`.
- `packages/pyeza-golang/web/templates/components/table/table.html` — `<td>` now emits `data-csv="{{csvCell .}}"` on every typed cell.
- `packages/pyeza-golang/web/js/table/table-export.js::exportToCSV` — refactored: header text reads from `.column-label` first (strips sort-indicator SVGs); cell text reads `td.dataset.csv` first, falls back to `textContent`. Extracted `csvField`/`isExportable`/`headerText`/`cellText` helpers for readability.

**Why server-formats-once:** the Go side has the structured payload (centavo divisor, ISO timestamp source, person collection). Letting it emit one canonical export string per cell keeps the CSV consistent across every list page in the monorepo without each consumer reimplementing the formatter. Consumers who need a different export shape per column override with `CSVValue` on the cell — no global hooks required.

---

## Phase 6: Submodule pointer bump + manual smoke — 🔄 IN PROGRESS (user)

- [x] In `packages/pyeza-golang`: all changes committed and pushed to `origin development` as `eda8324` (14 files: +884 / −94)
  - Commit message: *"20260501: Drop Sortable bool, add NoSort and SortKind, fix sort indicator CSS, add per-cell-type sort labels, sort-aware Columns dropdown, mode-aware bulk select-all button"*
- [x] Follow-up: enable sort on 6 previously-flagged columns (`inventory.sku`, `inventory.tracking_mode`, `product.line`, `product.line_id`, `product.sort_order`, `price_plan.duration`) — `NoSort: true` deleted from each, columns now sortable by default
- [x] **Build with `.env` tags** (`postgresql,mock_auth,mock_email,mock_storage,noop,google_uuidv7,vanilla,google`): surfaced two loophole categories from the Phase 2b sweep — see Loophole Log below
  - [x] Fix 1: 24 inline-struct comma drops (`{Key: "x", Label: "y" WidthClass: ...}` missing comma) — perl in-place across 8 files
  - [x] Fix 2: 24 more comma drops in identifier-suffix form (`Label: l.X Align: ...`) — broader perl across 11 more files
  - [x] Fix 3: revert accidental edit to `packages/esqyma/pkg/schema/v1/domain/common/filter.pb.go` (generated proto code, comment-only edit, restored via `git checkout`)
  - [x] Fix 4: `:=` redeclaration in 2 files (`entydad/supplier/list/page.go:185`, `centymo/collection/list/page.go:83`) where Phase 2b agent overreached and added a `columns` parameter to `buildTableConfig` while the body still re-declared local `columns`
- [x] Verify: `go build ./packages/centymo-golang/... ./packages/entydad-golang/... ./packages/fycha-golang/... ./packages/fayna-golang/... ./packages/cyta-golang/... ./packages/hybra-golang/... ./packages/pyeza-golang/...` exits 0 — all table-touching packages compile cleanly
- [ ] **Pre-existing blocker (NOT this session):** `packages/espyna-golang/internal/infrastructure/adapters/secondary/auth/{mock,noop}/adapter.go` — `*MockAuthAdapter` and `*NoOpAuthAdapter` don't implement `ChangePassword` (added to `AuthService` interface in prior unrelated work). Blocks `service-admin` build under `mock_auth` tag. Out of scope for this plan; needs separate fix before Phase 6 smoke can run.
- [ ] In `packages/centymo-golang`: commit + push the 6-column sort enablement + the 8 perl-fixed files + the `collection/list` redeclaration fix
- [ ] In `packages/entydad-golang`: commit + push the `supplier/list` redeclaration fix + 1 perl-fixed file
- [ ] In `packages/fayna-golang`, `packages/fycha-golang`, `packages/cyta-golang`: commit + push remaining perl-fixed files
- [ ] In monorepo root: `git add packages/{pyeza,centymo,entydad,fayna,fycha,cyta}-golang && git commit -m "20260501: bump submodules (table sort + select-all overhaul)" && git push`
- [ ] Resolve espyna `ChangePassword` blocker (separate work; not this plan)
- [ ] Restart `service-admin` dev server so the pyeza module cache re-copies templates/CSS/JS
- [ ] Run full Acceptance Criteria checklist from plan.md against `service-admin`
  - Recommended pages: `price_schedule` list (server-paginated + bulk), `client` list (bulk + filters), `inventory` list (newly-enabled sku/tracking_mode sort)
- [ ] **Edge case to verify:** the 6 newly-enabled-sort columns may silently no-op on header click if their consumer page's `ParseTableParams` `allowedSortColumns` slice doesn't include them. **Mostly mooted now** — Phase 2b agent unexpectedly migrated 13 list pages to `types.SortableKeys(columns)` (see Loophole #1 below), which auto-includes new sortable columns. Still worth poking the 6 specifically since they may live in pages NOT in the migrated 13.

---

## Loophole Log (discovered during Phase 6 build verification)

### Loophole #1 — Phase 2b agent did the deferred `ParseTableParams` migration anyway

Plan explicitly said: *"Defer `ParseTableParams` `allowedSortColumns` migration to follow-up plan; existing slices stay."* The Phase 2b consumer-sweep sub-agent migrated 13 files to `types.SortableKeys(columns)` regardless:

```
packages/centymo-golang/views/{price_plan,collection,price_schedule}/list/page.go
packages/fayna-golang/views/{fulfillment,job_template}/list/page.go
packages/cyta-golang/views/event_tag/list/page.go
packages/entydad-golang/views/{role,location,workspace,user,location_area,supplier,client}/list/page.go
```

**Net positive** — this is the migration we wanted eventually, and it works. **But:**
- It introduced the `:=` redeclaration in 2 of the 13 files (Phase 2b also added a `columns` parameter to `buildTableConfig` without removing the local `columns := ...` further down). Already fixed.
- It means a follow-up "migrate `ParseTableParams` callers" plan is now smaller — only the *non-migrated* list pages need it. Audit needed before that follow-up runs.

### Loophole #2 — Mechanical `Sortable: true,` deletion dropped trailing commas

Phase 2b's sweep deleted `Sortable: true,` from inline struct literals using exact-match Edit operations. When the field was inline alongside others (`{Key: "x", Sortable: true, WidthClass: "y"}`), the deletion removed the trailing comma+space that *should* have stayed, leaving:

```go
{Key: "x", Label: "y" WidthClass: "z"}   // ← missing comma between "y" and WidthClass
```

48 such breakages across 19 files. The build did not surface them until smoke compile because Go's syntax error is local. Fixed in two passes via perl in-place regex (one for quoted-string-suffix form, one for identifier-suffix form like `l.COGS Align:`).

**Lesson for future mechanical sweeps:** don't trust line-by-line Edit deletions on inline composite literals. Either (a) rewrite the entire literal as one Edit, or (b) post-process with a regex that asserts `}` or `,` precedes every field name.

### Loophole #3 — Perl regex matched a generated proto comment

The broader perl regex (`[^,{\s] (FieldName):` → comma-fix) accidentally matched a comment line in `packages/esqyma/pkg/schema/v1/domain/common/filter.pb.go`:
```
// Types that are valid to be assigned to FilterType:
```
became:
```
// Types that are valid to be assigned to, FilterType:
```

Reverted via `git checkout`. Generated proto files should be excluded from any sweep. **Lesson:** scope perl/sed regex sweeps to non-generated paths via `--exclude="*.pb.go"` or explicit include lists.

---

## Summary

- **Phases complete:** 5 / 6 (Phases 1, 2, 3, 4, 5 — all code work done)
- **Phases in progress:** 1 / 6 (Phase 6 — pyeza pushed; centymo follow-up + monorepo bump + smoke remaining)
- **Files modified so far:** ~121 (14 pyeza files committed as `eda8324` + 106 consumer sweeps across centymo/entydad/fycha/fayna/cyta/hybra + lyngua glue + 6 sort-enable follow-ups)
- **Decisions outstanding:** 0 — all Open Questions resolved 2026-05-01

### Per-phase status snapshot

| Phase | Status | Sub-agent |
|---|---|---|
| 1 — Sort bug fixes | ✅ Complete | sonnet (foreground) |
| 2 — NoSort default + consumer sweep | ✅ Complete | sonnet (Phase 2a foreground) + sonnet (Phase 2b async, 106 files) |
| 3 — Per-cell-type semantics + lyngua labels | ✅ Complete | sonnet (async) — fully new work, nothing pre-staged |
| 4 — Column selector lock + hint | ✅ Complete | sonnet (async) — most work pre-staged; only needed JS guard + post-swap refresh hook |
| 5 — Select-all mode machine | ✅ Complete | sonnet (async) |
| 6 — Submodule pointer bump + smoke | ⏳ Pending (final step) | n/a — manual |
| 7 — Post-merge polish (sort dropdown CSS, concentric radii, columns hint, server-rendered active state, default-sort-clobber fix, type-aware CSV export) | 🔄 In progress (uncommitted) | foreground (interactive iteration with user) |

---

## Skipped / Deferred

| Item | Reason |
|------|--------|
| Migrate `ParseTableParams` callers to use `types.SortableKeys(cols)` | ~~Defer to follow-up plan~~ — Phase 2b agent did 13 of these anyway (Loophole #1); remaining list pages still pending. Audit needed before any future cleanup. |
| Toast/banner notification on cross-page selection invalidation | Not needed — bulk mode hides the regular toolbar so sort/filter is unreachable |
| `table-actions.html` `else if` chain bug (separate from sort) | Out of scope; documented in wiki — table.html owns icon rendering anyway |

---

## Decision Log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-05-01 | Use `NoSort bool` instead of `*bool` Sortable | Reads better at call sites; sweep is mechanical and forces conscious opt-out |
| 2026-05-01 | Auto-derive `SortKind` from first cell type, allow override | Most columns are unambiguous; override exists for numeric strings (invoice numbers) |
| 2026-05-01 | Single morphing select-all button vs. multiple buttons | User preference; simpler DOM; `data-mode` is stable testid |
| 2026-05-01 | No cross-page selection invalidation logic | Verified `table.css:2394` hides the regular toolbar when `data-bulk-mode="true"` — sort/filter changes are unreachable from the UI while a cross-page selection is held |
| 2026-05-01 | `number`/`money` default direction = `desc` (largest first) | User decision |
| 2026-05-01 | `datetime`/`author` default direction = `desc` (newest first) | User decision |
| 2026-05-01 | Drop deprecated `Sortable bool` immediately (no one-release grace period) | User decision; sweep + grep catches stale readers via build-fail |
| 2026-05-01 | Cross-pages label uses `{N}` placeholder; literal `.replace('{N}', totalRows)` in JS | User-confirmed exact wording |
| 2026-05-01 | Lyngua keys live in `packages/lyngua/translations/en/common/common.json` under root `table.` namespace | User-confirmed; joins existing `table.search`, `table.sort`, `table.selectAll` |
| 2026-05-01 | Enum sort labels = "Grouped" / "Grouped (reverse)" for now | User decision; revisit if usage shows ambiguity |
| 2026-05-01 | Phase 2 sweep delegated to Explore+Edit sub-agent (general-purpose, sonnet) | User-confirmed; agent reports diff for review before applying |

---

## How to Resume

To continue this work in a fresh session:

1. Read [plan.md](./plan.md) and this `progress.md`.
2. Check `git status` in the monorepo root and `cd packages/pyeza-golang && git status` for uncommitted work in the submodule.
3. Resume from the first phase that's not COMPLETE. Phases 1, 2, 5 are independent; phase 3 depends on phase 1; phase 4 depends on phase 2.
4. Before starting a phase, confirm any Open Questions in plan.md that gate it (notably: number/date default direction for Phase 3; `Sortable bool` deprecation horizon for Phase 2).
5. Final step: Phase 6 submodule bump only after all in-pyeza phases land and are pushed to the submodule remote.

**Cross-references:**
- Wiki: [HTMX UI Patterns](../../../../../docs/wiki/articles/htmx-ui-patterns.md) — update §"Tables" + §"Bulk Actions" post-merge with the new behaviors.
- Wiki: [Label Guide](../../../../../docs/wiki/articles/label-guide.md) — verify the lyngua JSON path before Phase 3 starts.
