# Pyeza Table — Filter Overhaul (Phase 8) — Progress Log

**Plan:** [plan.md](./plan.md)
**Started:** 2026-05-02 (planned overnight; user is resting)
**Branch:** `dev/20260502-filter-overhaul`
**Predecessor:** [Phase 1–7 — Sort + Select-All + Post-Merge Polish](../20260501-table-sort-and-select-all/progress.md)

---

## Working agreements (set by user before sleep)

1. **Delegate liberally.** Sonnet sub-agent for meaningful editing or multi-file work, Haiku for simple lookups / format-checks / single-file edits. Don't burn the foreground context on mechanical work.
2. **Build + Playwright are available.** Each phase must end with a smoke check:
   - `bash apps/service-admin/scripts/run.sh` — rebuild dev server with the right tags from `.env`. Server stays up; Air auto-rebuilds on subsequent edits.
   - Playwright probe per phase (see "Smoke recipe" below). Use a sonnet sub-agent to author the spec; run via `cd apps/service-admin/tests && npx playwright test ...`.
3. **Respect the schedule.** Cron fires every 30 minutes. Each fire reads this file, picks up at the first incomplete checkbox, executes one chunk of work, updates this file, then exits. No long-running work in a single fire — split into the smallest committable unit. **Hard stop at 03:00 local** regardless of progress.
4. **Commit cadence.** Commit at the end of every sub-phase that compiles cleanly. Push to `origin development` on the pyeza submodule after each commit. **Do not** bump the monorepo submodule pointer until 8b.5.

---

## Smoke recipe (run after each sub-phase that touches user-visible behavior)

1. `bash apps/service-admin/scripts/run.sh > /tmp/run.log 2>&1 &` — rebuild + restart server with tags from `.env`.
2. `until curl -s -o /dev/null -w '%{http_code}' http://localhost:8081/ | grep -q '^[23]'; do sleep 2; done` — wait for server up.
3. Delegate Playwright probe to a Sonnet sub-agent. Probe spec lives temporarily at `apps/service-admin/tests/e2e/_probe-filter.spec.ts` and is **deleted after each successful probe** to keep the test directory clean. The probe template is in this file under "Probe template" below.
4. After the probe passes, the sub-agent writes a one-line summary into the relevant phase checkbox here.

---

## Phase 8a: Pyeza-internal types + widgets — NOT STARTED

### 8a.1 — `NoFilter bool` + `DeriveFilterType` helper

- [ ] `packages/pyeza-golang/types/table.go` — add `NoFilter bool` to `TableColumn` (mirror `NoSort`).
- [ ] `packages/pyeza-golang/types/table.go` — add doc comment to `Filterable bool` marking it deprecated; keep readable.
- [ ] `packages/pyeza-golang/types/table.go` — add `DeriveFilterType(cellType string, hasOptions bool) FilterColumnType`. Cases per plan.md table.
- [ ] `packages/pyeza-golang/types/table.go` — add new `FilterColumnType` constants: `FilterTypeNumericRange`, `FilterTypeDateRange`, `FilterTypeList`, `FilterTypeListLabel`, `FilterTypeBoolean`. Keep existing constants as aliases.
- [ ] `packages/pyeza-golang/types/table.go` — extend `ApplyColumnStyles` to memoize `FilterType` from first row's cell, like `SortKind` (memoization block at top).
- [ ] `packages/pyeza-golang/types/table.go` — add `FilterableKeys(cols []TableColumn) []string` — returns keys where `!c.NoFilter && c.Key != ""`. Mirror `SortableKeys`.
- [ ] `go build ./packages/pyeza-golang/...` exits 0.
- [ ] Commit + push.

### 8a.2 — Lyngua keys for new widget chrome

- [ ] `packages/lyngua/translations/en/common/common.json` — add ~25 keys under `table.` namespace per plan.md §8a.2.
- [ ] `packages/pyeza-golang/labels_types.go::CommonTableLabels` — add corresponding json fields.
- [ ] `packages/pyeza-golang/types/table.go::TableLabels` — add fields propagated from CommonTableLabels.
- [ ] `packages/centymo-golang/labels.go::MapTableLabels` — wire all new fields.
- [ ] `packages/entydad-golang/labels.go::MapTableLabels` — same.
- [ ] `packages/fycha-golang/labels.go::MapTableLabels` — same.
- [ ] (fayna + cyta inherit; verify by reading their `MapTableLabels` and confirming they call into one of the above.)
- [ ] `go build ./packages/{pyeza,centymo,entydad,fycha,fayna,cyta}-golang/...` exits 0.
- [ ] Commit + push (lyngua has its own repo; pyeza + 3 consumers are submodule commits).

### 8a.3 — Widget JS rewrite

- [ ] `packages/pyeza-golang/web/js/table/table-filters.js` — introduce `FILTER_WIDGETS` registry with entries for: `string`, `numeric-range`, `date-range`, `list`, `list-label`, `boolean`. Each entry has `build(container, column, options)`, `read(row)`, `chip(condition, column)`.
- [ ] Rewrite `addFilterCondition`: column `<select>` + dispatch to `FILTER_WIDGETS[derivedType].build(...)`. On column change, rebuild value container via the new column's widget.
- [ ] Rewrite `getFilterConditions`: iterate rows, call each row's widget `read()` → `TypedFilter` JSON. Skip rows where read returns `null`.
- [ ] Date preset buttons: click handler sets `filter-date-from` / `filter-date-to` to the computed ISO range and switches operator to `between`. Computed ranges per plan.md §Architecture.
- [ ] Numeric-range operator change handler: hides/shows `filter-value-max` + `.filter-range-sep` based on operator (`between` reveals; everything else hides).
- [ ] List-search input: filters checkboxes by case-insensitive label match. Hidden when option count ≤ 5.
- [ ] Drop the legacy `applyFilters` switch on string operators (replaced by per-widget `read()` + server eval). Keep `clearFilters` as-is for client-paginated tables.
- [ ] Commit + push.

### 8a.4 — Filter metadata JSON extension

- [ ] `packages/pyeza-golang/renderer_funcs.go::filterColumnsJSON` — add `filterType` (from `DeriveFilterType` at render time) and `defaultOperator` per entry. Backward-compatible.
- [ ] No template change needed; the script block at `table-toolbar.html:109` already calls `filterColumnsJSON .Columns`.
- [ ] `packages/pyeza-golang/web/js/table/table-filters.js::getTableColumns` — read the new fields where present, fall back to old behavior when absent.
- [ ] Commit + push.

### 8a.5 — CSS for new widget DOM

- [ ] `packages/pyeza-golang/web/styles/components/table.css` — append a `Filter Widgets` section. Shape per plan.md §8a.5.
- [ ] Concentric radii: outer dropdown 1rem → row 0.5rem → inputs/buttons 0.25rem (mirror Phase 7.2).
- [ ] Hide-by-default rules using `[data-op]` attributes on the row (`[data-op="between"]` reveals max input + sep).
- [ ] Hide-by-default rules using `[data-options-count]` on the row (`[data-options-count="0"]` through `[data-options-count="5"]` hide the search input).
- [ ] Smoke: open a list page, open filter dropdown, add a numeric-range condition with `between`, confirm both inputs visible. Switch operator to `>`, confirm right input collapses.
- [ ] Commit + push.

### 8a.6 — Active-filter chips in toolbar

- [ ] `packages/pyeza-golang/types/table.go` — add `FormatActiveFilter(f *commonpb.TypedFilter, col *TableColumn) string` that returns chip text like `"Price: ≥ ₱1,000.00"`. Mirrors widget `chip()` JS.
- [ ] `packages/pyeza-golang/web/templates/components/table/table.html:81-92` — confirm `ServerPagination.ActiveFilters` chip strip uses `FormatActiveFilter` (or update if it doesn't).
- [ ] Confirm `table-filters.js::initChipHandlers` chip-dismiss path works with new `TypedFilter` shapes (operator change shouldn't break dismissal).
- [ ] Smoke: apply 2 filters; confirm 2 chips render with correct text; dismiss one; confirm the other persists in URL + DOM.
- [ ] Commit + push.

### 8a.7 — Verify pyeza-internal end-to-end

- [ ] `go build ./packages/pyeza-golang/...` exits 0.
- [ ] Smoke a list page that uses legacy `Filterable: true, FilterType: types.FilterTypeString` (e.g., centymo product list before 8b sweep). Confirm widget renders, sends `StringFilter{operator: contains}`, server filters correctly.
- [ ] Smoke a list page with a money column. Confirm numeric-range widget renders, `between` works (2 inputs), `>` works (1 input).
- [ ] Smoke a list page with a date column. Confirm date-range widget renders, presets pre-fill inputs, custom range works.
- [ ] Final commit on pyeza submodule before 8b begins.

---

## Phase 8b: Consumer sweep + use-case allow-list audit — NOT STARTED

### 8b.1 — Audit sub-agent (Explore, parallel-able)

- [ ] Spawn 3 parallel `Explore` sub-agents over: (a) centymo + entydad, (b) fycha + fayna, (c) cyta + hybra + apps/service-admin/views.
- [ ] Each agent reports: every file with `Filterable: true|false` or `FilterType: types.X`, grouped by file, with line numbers. Flag every column where `FilterType` matches what `DeriveFilterType` would auto-derive (those become drop candidates).
- [ ] Aggregate the three reports into `audit-8b1.md` in this plan directory.

### 8b.2 — Sweep agent (Sonnet general-purpose)

- [ ] Brief: same edit pattern as Phase 2b's `Sortable: true` removal. Drop `Filterable: true`; convert `Filterable: false` → `NoFilter: true`; drop redundant `FilterType: types.X`.
- [ ] **Pre-flight check** in the sweep brief: after every deletion in an inline composite literal (`{Key: "x", Filterable: true, WidthClass: "y"}`), confirm adjacent fields still have commas. (Phase 2b loophole #2 prevention.)
- [ ] **Exclude generated files**: agent must skip `*.pb.go` and any generated `gen/*` paths. (Phase 6 loophole #3 prevention.)
- [ ] After each package, run `go build ./packages/<pkg>-golang/...` automated. Halt + report on failure.
- [ ] Sweep runs: centymo → entydad → fycha → fayna → cyta → hybra. Then `apps/service-admin/views` if any view files have inline `Filterable:` lines.
- [ ] Final `go build ./packages/...` exits 0.
- [ ] Commit + push per package.

### 8b.3 — Use-case allow-list audit (Explore, parallel)

- [ ] Spawn `Explore` sub-agent over `packages/{centymo,entydad,fycha,fayna,cyta}-golang/use_cases`. Brief per plan.md §8b.3.
- [ ] Output report to `audit-8b3-use-cases.md` in this plan directory: every `List<Entity>` use case, its current filter allow-list (if any), and the keys from the column config that are NOT in the allow-list (loophole-class candidates).
- [ ] Cross-reference with the new column configs (post-sweep). Document the gap count + per-use-case breakdown.
- [ ] **Do not fix here.** Just document. Wiring the allow-list is Phase 9.

### 8b.4 — Lyngua glue smoke

- [ ] Open one list page per business-type tier (centymo product, entydad client, fycha invoice). Add multi-column filter (string + number, then string + date, then string + list). Confirm:
  - Operator dropdowns render in English.
  - Active-filter chips render with correct labels.
  - Server returns filtered rows (compare row count vs. unfiltered).
  - HTMX swap preserves filter state on subsequent pagination clicks.
- [ ] Smoke captures via Playwright probe (delegated to Sonnet sub-agent per smoke recipe above). Each smoke produces a single-line pass/fail entry below.

### 8b.5 — Submodule pointer bump + push

- [ ] `packages/pyeza-golang`: confirm all 8a commits pushed.
- [ ] Each consumer package (`centymo`, `entydad`, `fycha`, `fayna`, `cyta`, `hybra`): commit any sweep edits + push.
- [ ] Monorepo root: bump submodule pointers, single commit. Message format: `20260502: Phase 8 — filter overhaul (NoFilter default-on + auto-derived FilterType + per-type widgets + multi-column AND)`.

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

This plan is designed to be picked up by a 30-minute cron agent. Each fire:

1. **Read this file first.** Find the first unchecked `[ ]` checkbox in order: 8a.1 → 8a.2 → … → 8b.5.
2. **Read [plan.md](./plan.md)** for the design context behind that checkbox.
3. **Execute one logical chunk.** Examples:
   - "8a.1: add `NoFilter bool` to TableColumn and add `DeriveFilterType` helper" — one chunk.
   - "8a.3: introduce FILTER_WIDGETS registry with the string widget" — one chunk; subsequent widgets are separate chunks.
4. **Run `go build` after every Go edit.** If it fails, fix or revert before exiting.
5. **Smoke after every user-visible chunk.** Use the smoke recipe above; delegate the Playwright probe to a Sonnet sub-agent.
6. **Update checkboxes here** before exiting. Append a one-line note describing what was done.
7. **Commit + push** if the chunk compiles cleanly.
8. **Exit.** Do not start the next chunk in the same fire — let the next cron tick pick it up. (This keeps each fire's context fresh and recoverable.)

**Hard stop:** 03:00 local on 2026-05-02. After 03:00, the cron writes a final summary line to this file and stops scheduling further fires.

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
