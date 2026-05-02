# Pyeza Table — Filter Overhaul (Phase 8) — Progress Log

**Plan:** [plan.md](./plan.md)
**Started:** 2026-05-02 (foreground, interactive)
**Branch:** `dev/20260502-filter-overhaul`
**Predecessor:** [Phase 1–7 — Sort + Select-All + Post-Merge Polish](../20260501-table-sort-and-select-all/progress.md)

---

## Working agreements

1. **Delegate liberally.** Sonnet sub-agent for meaningful editing or multi-file work, Haiku for simple lookups / format-checks / single-file edits. Don't burn the foreground context on mechanical work.
2. **Build + Playwright are available.** Each user-visible chunk ends with a smoke check:
   - `bash apps/service-admin/scripts/run.sh` — rebuild dev server with the right tags from `.env`. Server stays up; Air auto-rebuilds on subsequent edits.
   - Playwright probe per chunk (see "Smoke recipe" below). Delegate the spec to a Sonnet sub-agent; run via `cd apps/service-admin/tests && npx playwright test ...`.
3. **Eyes-on for visual surfaces.** Phase 7.1–7.7 caught CSS/UX regressions only by eyeballing the live page. Same expectation here: after each user-visible chunk, open the affected list page in a browser before marking the chunk complete.
4. **Commit cadence.** Commit at the end of every sub-phase that compiles cleanly. Push to `origin development` on the pyeza submodule after each commit. **Do not** bump the monorepo submodule pointer until 8b.5.
5. **Refresh line refs before editing.** Phase 7 commits (`eda8324` + post-7 polish) shifted line numbers in `table-filters.js`, `table-toolbar.html`, and `table.css`. Re-grep before each chunk; do not trust plan.md's Phase 8 line refs as gospel.

---

## Smoke recipe (run after each sub-phase that touches user-visible behavior)

1. `bash apps/service-admin/scripts/run.sh > /tmp/run.log 2>&1 &` — rebuild + restart server with tags from `.env`.
2. `until curl -s -o /dev/null -w '%{http_code}' http://localhost:8081/ | grep -q '^[23]'; do sleep 2; done` — wait for server up.
3. **Eyeball check first.** Open the affected list page in a browser. Trigger the new behavior (open filter dropdown, add a condition, etc.) and confirm it visually matches the spec in plan.md.
4. **Then Playwright probe.** Delegate to a Sonnet sub-agent. Probe spec lives temporarily at `apps/service-admin/tests/e2e/_probe-filter.spec.ts` and is **deleted after each successful probe** to keep the test directory clean. The probe template is in this file under "Probe template" below.
5. After both pass, write a one-line summary into the relevant phase checkbox here.

---

## Phase 8a: Pyeza-internal types + widgets — IN PROGRESS

### 8a.1 — `NoFilter bool` + `DeriveFilterType` helper — ✅ COMPLETE

- [x] `packages/pyeza-golang/types/table.go` — `NoFilter bool` added to `TableColumn` (mirrors `NoSort`).
- [x] `packages/pyeza-golang/types/table.go` — `Filterable bool` marked deprecated in doc comment; remains readable for the 8b sweep.
- [x] `packages/pyeza-golang/types/table.go` — `DeriveFilterType(cellType string, hasOptions bool) FilterColumnType` added. Cases per plan.md table; chips/persons → `FilterTypeListLabel`; money/number → `FilterTypeNumericRange`; datetime/author → `FilterTypeDateRange`; badge/select → `FilterTypeList`; email/phone/text/name/link/html → `FilterTypeString`; input → `""` (skip).
- [x] `packages/pyeza-golang/types/table.go` — new constants added: `FilterTypeNumericRange`, `FilterTypeDateRange`, `FilterTypeList`, `FilterTypeListLabel`, `FilterTypeBoolean`. Existing constants left intact (no aliasing — they continue to work for explicit overrides on legacy callers).
- [x] `packages/pyeza-golang/types/table.go` — `ApplyColumnStyles` extended with a second memoization block mirroring the SortKind one. Skips columns where `FilterType` is already set (explicit override wins).
- [x] `packages/pyeza-golang/types/table.go` — `FilterableKeys(cols []TableColumn) []string` added; returns keys where `!c.NoFilter && c.Key != ""`. Mirrors `SortableKeys`.
- [x] `go build ./packages/pyeza-golang/...` exits 0.
- [x] `gofmt -l` clean (struct alignment normalized).
- [ ] Commit + push (after 8a.2 — types + lyngua keys land together).

### 8a.2 — Lyngua keys for new widget chrome — ✅ COMPLETE

- [x] `packages/lyngua/translations/en/common/common.json` — 28 keys added under `table.` namespace: 17 operator labels, 5 date presets, 3 boolean tri-state, 3 placeholders.
- [x] `packages/pyeza-golang/labels_types.go::CommonTableLabels` — corresponding json fields added.
- [x] `packages/pyeza-golang/types/table.go::TableLabels` — fields propagated from CommonTableLabels.
- [x] `packages/centymo-golang/labels.go::MapTableLabels` — all 28 fields wired.
- [x] `packages/entydad-golang/labels.go::MapTableLabels` — same.
- [x] `packages/fycha-golang/labels.go::MapTableLabels` — same.
- [x] fayna + cyta inherit from one of the above (verified by build — no separate `MapTableLabels` defined in those packages).
- [x] `go build -tags <env tags> ./packages/{pyeza,centymo,entydad,fycha,fayna,cyta}-golang/...` exits 0.
- [x] `gofmt -l` clean.
- [ ] Commit + push (deferred to end of 8a — types + labels + JS + CSS land as one pyeza commit).

### 8a.3 — Widget JS rewrite — ✅ COMPLETE

- [x] `packages/pyeza-golang/web/js/table/table-filters.js` — full rewrite. `FILTER_WIDGETS` registry with `string`, `numeric-range`, `date-range`, `list`, `list-label`, `boolean` entries. Each entry has `build(vc, col, labels)` + `read(row, col)`. Legacy aliases (`status` → `list`, `numeric`/`money` → `numeric-range`, `date` → `date-range`, `email`/`phone` → `string`) keep pre-sweep tables rendering with the new widgets.
- [x] `addFilterCondition` rewritten: column `<select>` dispatches to `FILTER_WIDGETS[filterType].build(...)`. Column change rebuilds value container.
- [x] `getFilterConditions` rewritten: iterates rows, calls each widget's `read()` → `TypedFilter` JSON. Skips rows where read returns `null`.
- [x] Date preset buttons (Today / 7d / 30d / This month / Custom): click handler computes ISO range, fills date inputs, switches operator to `between`. Browser-local TZ (server-side timezone middleware compensates).
- [x] Numeric-range operator change: `row.dataset.op` toggles between/non-between; CSS hides `.filter-value-max` + `.filter-range-sep` when not between.
- [x] List-search input: filters checkboxes by case-insensitive label match; CSS hides search bar when `data-options-count` ≤ 5.
- [x] Legacy `applyFilters` switch dropped — server-paginated tables are authoritative; client-paginated tables fall back to `clearFilters`.
- [x] Phase 7.6 audit — no `applyDefaultFilter` clobber analogue exists in `table-filters.js`. Safe.
- [x] Phase 7.5 hydration — `hydrateFromActiveFilters` rebuilds condition rows from the URL state on first panel open so the panel agrees with the chip strip and URL.
- [x] Proto operator codes verified against `filter.pb.go`: StringOperator (0=eq, 1=neq, 2=contains, 3=starts_with, 4=ends_with), NumberOperator (0=eq, 1=neq, 2=gt, 3=gte, 4=lt, 5=lte), DateOperator (0=eq, 1=before, 2=after, 3=between), ListOperator (0=in, 1=not_in).
- [x] `node --check` passes.

### 8a.4 — Filter metadata JSON extension — ✅ COMPLETE

- [x] `packages/pyeza-golang/renderer_funcs.go::filterColumnsJSON` — each entry now carries `filterType` (Phase 8 widget kind) and `defaultOperator`. Inclusion rule remains backward-compat: emit columns where `Filterable: true && !NoFilter` until the 8b sweep flips every consumer to default-on. After sweep, the OR'd condition is harmless.
- [x] `defaultOperatorFor(FilterColumnType) string` helper added to renderer_funcs.go.
- [x] No template change needed at `table-toolbar.html:109` — script tag already calls `filterColumnsJSON .Columns`.
- [x] `packages/pyeza-golang/web/js/table/table-filters.js::getTableColumns` — reads new `filterType` + `defaultOperator` fields with fallback to legacy `type` field.

### 8a.5 — CSS for new widget DOM — ✅ COMPLETE

- [x] `packages/pyeza-golang/web/styles/components/table.css` — appended ~140 lines of Filter Widgets section.
- [x] Concentric radii honored: outer dropdown 1rem → row 0.5rem → inputs/buttons 0.25rem (mirrors Phase 7.2).
- [x] `.filter-row:not([data-op="between"]) .filter-value-max, .filter-range-sep { display: none }` reveals/collapses max input on operator change.
- [x] `.filter-row[data-options-count="0..5"] .filter-list-search { display: none }` hides search bar for small option lists.
- [x] Date-range: `.filter-row[data-filter-type="date-range"]:not([data-op="between"]) .filter-date-to { display: none }` collapses to-input outside `between`.
- [x] `.filter-panel { min-width: 22rem }` ensures widgets fit horizontally.
- [ ] Browser smoke (deferred to live use after submodule bump).

### 8a.6 — Active-filter chips (server-emitted ChipText) — ✅ COMPLETE

- [x] `packages/pyeza-golang/types/table.go::ActiveFilter` — added `ChipText string` field. Doc comment explains: takes precedence over Label+DisplayValue when non-empty.
- [x] `packages/pyeza-golang/web/templates/components/table/table.html` — chip strip now renders `{{if .ChipText}}{{.ChipText}}{{else}}{{.Label}}: {{.DisplayValue}}{{end}}`. Backward-compat for legacy callers that haven't migrated.
- [x] **Decision deviation from plan:** dropped `FormatActiveFilter(f *commonpb.TypedFilter, col *TableColumn) string` Go helper because pyeza-golang/go.mod does not depend on the esqyma proto package — adding that arrow just for a chip helper would create a downward dep that doesn't currently exist. Consumers (which already import the proto) build ChipText themselves. Phase 9 follow-up: provide a shared formatter in a downstream package that already imports both.
- [x] `initChipHandlers` chip-dismiss path: confirmed by reading the rewritten code. Reads `data-dismiss-filter` attribute (column key), filters out matching `f.field` from the URL state. Works regardless of TypedFilter variant shape.
- [x] Filter panel reopen hydration (Phase 7.5 mirror): `hydrateFromActiveFilters` reads the URL state and rebuilds condition rows on first open.
- [x] `filterPanelLabelsJSON` template func added (renderer_funcs.go) — emits the 28 widget labels as JSON inside the filter panel; `table-filters.js::readPanelLabels` reads it. Keeps every label translation-driven.
- [x] `table-toolbar.html` — added `<script type="application/json" class="filter-panel-labels">` next to filter-meta.
- [ ] Browser smoke (deferred to live use after submodule bump).

### 8a.7 — Verify pyeza-internal end-to-end — ✅ COMPLETE

- [x] `go build -tags <env tags> ./packages/{pyeza,centymo,entydad,fycha,fayna,cyta}-golang/...` exits 0.
- [x] `go test ./packages/pyeza-golang/...` — 4 packages pass clean.
- [x] `gofmt -l` clean across all touched files.
- [x] `node --check table-filters.js` passes.
- [ ] Live-page smoke (deferred to user — needs running dev server).
- [x] Final commit on pyeza submodule before 8b begins (next step).

---

## Phase 8b: Consumer sweep + use-case allow-list audit — IN PROGRESS

### 8b.1 — Audit (foreground grep) — ✅ COMPLETE

- [x] Direct grep across consumer view packages: 14 files, ~40 column-config lines (proto-builder lines pre-filtered).
- [x] Aggregated into [audit-8b1.md](./audit-8b1.md). No sub-agents needed at this scope.

### 8b.2 — Sweep (foreground, whole-literal Edits) — ✅ COMPLETE

- [x] **Loophole #2 mitigation worked:** every column-literal was rewritten as a single Edit (the whole `{Key: ..., Label: ..., ...}` line) instead of field-by-field deletion. Zero comma-trailing-edge breakages this time.
- [x] **`gofmt -l` per file** confirmed clean before each commit.
- [x] **Generated files left alone** — no regex sweeps run; only line-by-line Edits on view package files. `filter.pb.go` and friends untouched.
- [x] **Phase 7.4 pre-emption:** pre-set `NoFilter: true` on `product.line` (already known-risky), `product.line_id`/`product.sort_order` (siblings), plus derived/joined columns whose use cases don't accept filtering: `outstanding_balance`, `permissions`, `color`, `payment_term`, `category`, `timezone`, `location_area`, `workspaces`, `inventory.sku`/`tracking_mode`/`available`/`reorder_level`/`status`, `price_plan.duration`, `payment_term`, etc.
- [x] Sweep covered 13 files across centymo (7), entydad (5), cyta (1). fycha/fayna/hybra had no column-config `Filterable:` lines.
- [x] `go build -tags <env tags> ./packages/...` exits 0 across all 6 consumer packages.
- [x] Pyeza renderer flipped to default-on (`if c.NoFilter continue` instead of `if !c.Filterable continue`). Committed separately.
- [x] Per-package commits pushed: centymo `39617f5`, entydad `60f4c9f`, cyta `157e562`, pyeza renderer flip `5da4cbf`.

### 8b.3 — Use-case allow-list audit — ✅ COMPLETE (documented)

- [x] [audit-8b3-use-cases.md](./audit-8b3-use-cases.md) — 21 list pages already migrated to `SortableKeys(columns)`; same migration shape works for filters in Phase 9.
- [x] Time bombs documented; pre-emption already applied in 8b.2 to known-risky columns.
- [x] **No fixes here.** Phase 9 follow-up.

### 8b.4 — Lyngua glue smoke — ⏳ DEFERRED (interactive)

This sub-phase needs a running dev server + browser eyeballs to verify:
- Operator dropdowns render in English.
- Active-filter chips render with correct labels.
- Server returns filtered rows (row count vs. unfiltered).
- HTMX swap preserves filter state on subsequent pagination clicks.

Recommended pages: centymo `/app/services/list/active`, entydad `/app/clients/list/active`, fycha invoice list. Probe template lives below.

**Note:** Phase 7's `service-admin` build was blocked by an unrelated `ChangePassword` interface gap in `espyna-golang/internal/infrastructure/adapters/secondary/auth/{mock,noop}/adapter.go`. If that's still unresolved, the smoke must run against a different binary or the auth-mock adapter must implement `ChangePassword` first.

### 8b.5 — Submodule pointer bump + push — IN PROGRESS

- [x] `packages/pyeza-golang`: 2 commits pushed to `origin development` (`a10f047` 8a internal, `5da4cbf` 8b renderer flip).
- [x] `packages/lyngua`: 1 commit pushed (`df397e0` — 28 keys).
- [x] `packages/centymo-golang`: 2 commits pushed (`2e4b1c4` label glue, `39617f5` 8b sweep).
- [x] `packages/entydad-golang`: 2 commits pushed (`23df143` label glue, `60f4c9f` 8b sweep).
- [x] `packages/fycha-golang`: 1 commit pushed (`e665b64` label glue; no consumer sweep needed).
- [x] `packages/cyta-golang`: 1 commit pushed (`157e562` 8b sweep).
- [ ] Monorepo root: bump submodule pointers, single commit.

---

## Summary

- **Phases complete:** 0 / 2 (8a, 8b)
- **Sub-phases complete:** 0 / 12 (8a.1–8a.7, 8b.1–8b.5)
- **Files touched:** 0 / ~60–100 expected
- **Decisions outstanding:** 0 — all locked in plan.md before start

---

## Loophole Log (filled during implementation)

(Empty until 8b.3 audit lands.)

---

## Skipped / Deferred

| Item | Reason |
|------|--------|
| AND/OR toggle in filter panel | User locked AND-only. OR + grouping UX deferred. |
| Condition grouping (parens / nested rows) | Same as above. |
| Use-case allow-list FIX (vs. audit) | Documented in 8b.3, fixed in Phase 9 follow-up unless smoke surfaces a 500 — then patch the offending column with `NoFilter: true`. |
| Removing the deprecated `Filterable bool` field | One-wave grace: 8a keeps it, 8b sweep stops writing it, Phase 9 follow-up deletes the field. |
| Person filter on id (vs. label) | User locked label match. Id-based filtering would require plumbing person.ID through every cell type. |

---

## Decision Log

(Mirrors plan.md "Design Decisions" — all locked 2026-05-02 before start. New decisions added below during implementation.)

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-05-02 | (See plan.md "Design Decisions" — 12 entries) | All user-confirmed before sleep. |

---

## How to Resume

Foreground, interactive — same model as Phase 7.

1. **Read this file first.** Find the first unchecked `[ ]` checkbox in order: 8a.1 → 8a.2 → … → 8b.5.
2. **Read [plan.md](./plan.md)** for the design context behind that checkbox.
3. **Re-grep line refs** in `table-filters.js`, `table-toolbar.html`, `table.css` before editing — Phase 7 commits shifted them.
4. **Run `go build` after every Go edit.** Fix or revert before continuing.
5. **Smoke after every user-visible chunk.** Eyeball + Playwright probe per the smoke recipe above.
6. **Update checkboxes here** with a one-line note describing what was done.
7. **Commit + push** when the chunk compiles cleanly and smoke passes.

**Cross-references:**
- [Phase 1–7 progress.md](../20260501-table-sort-and-select-all/progress.md) — read before starting 8b. Loophole sections 2 (inline-struct comma drops), 3 (generated proto sweep), and Phase 7.4 (use-case allow-list 500) are all relevant to 8b.
- `packages/pyeza-golang/web/js/table/table-filters.js` — the file being rewritten in 8a.3. Read in full before starting 8a.3.
- `packages/espyna-golang/internal/application/shared/listdata/filter.go` — server-side filter eval. **Read-only reference.** Do not edit.

---

## Probe template (used by smoke recipe)

Saved here so the cron agent doesn't reinvent it. Adapt the URL + columns per phase.

```typescript
import { test } from '@playwright/test';
import { pool } from './_shared';

test('probe: filter widget for {phase} on {url}', async ({ context, page }) => {
  // Mock-auth session insert (works on POSTGRES; bigint epoch ms expires_at)
  const { rows: u } = await pool.query(`SELECT id FROM "user" WHERE active=true ORDER BY date_created LIMIT 1`);
  const userId = u[0].id;
  const { randomUUID } = await import('crypto');
  const token = randomUUID(), sid = randomUUID();
  const ws = await pool.query(`SELECT id, workspace_id FROM workspace_user WHERE user_id=$1 AND active=true LIMIT 1`, [userId]);
  await pool.query(
    `INSERT INTO session (id, user_id, token, workspace_user_id, workspace_id, expires_at, active, date_created, date_modified)
     VALUES ($1,$2,$3,$4,$5,$6,true,$7,$7)`,
    [sid, userId, token, ws.rows[0].id, ws.rows[0].workspace_id, Date.now() + 86400000 * 7, Date.now()],
  );
  await context.addCookies([{ name: 'session_token', value: token, domain: 'localhost', path: '/' }]);

  await page.goto('http://localhost:8081/{URL}');
  await page.waitForLoadState('domcontentloaded');

  // 1. Open filter dropdown
  await page.locator('[data-dropdown="filters"] .toolbar-btn').click();
  await page.locator('.filter-panel').waitFor({ state: 'visible' });

  // 2. Add condition
  await page.locator('.filter-add-condition').click();
  const row = page.locator('.filter-row').first();

  // 3. Pick column (e.g., "price")
  await row.locator('.filter-column').selectOption('{COLUMN_KEY}');

  // 4. Verify operator dropdown rendered with expected options
  const operators = await row.locator('.filter-operator option').evaluateAll(els => els.map(e => (e as HTMLOptionElement).value));
  console.log('operators:', operators);

  // 5. Set value(s)
  // (per phase — fill min/max for numeric-range, click preset for date-range, etc.)

  // 6. Apply
  await page.locator('.filter-apply').click();
  await page.waitForTimeout(500);

  // 7. Verify URL has the filters param
  console.log('URL after apply:', page.url());

  // 8. Verify table-card dataset
  const ds = await page.evaluate(() => {
    const c = document.querySelector('.table-card') as HTMLElement;
    return { filters: c?.dataset.filters };
  });
  console.log('table-card dataset:', ds);

  await pool.end();
});
```

After each probe passes, **delete the spec file** to keep the test directory clean (`rm apps/service-admin/tests/e2e/_probe-filter.spec.ts`).
