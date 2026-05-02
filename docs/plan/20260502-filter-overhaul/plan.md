# Pyeza Table — Filter Overhaul (Phase 8) — Design Plan

**Date:** 2026-05-02
**Branch:** `dev/20260502-filter-overhaul`
**Status:** Draft (locked decisions, ready to implement)
**App/Package:** `packages/pyeza-golang` (with sweep into ~50–80 list pages across `centymo-golang`, `entydad-golang`, `fycha-golang`, `fayna-golang`, `cyta-golang`, `hybra-golang`, plus `apps/service-admin`)

**Cross-references:**
- Predecessor: [Phase 1–7 — Sort + Select-All + Post-Merge Polish](../20260501-table-sort-and-select-all/plan.md) ([progress](../20260501-table-sort-and-select-all/progress.md))
- Server-side filter shape: `packages/espyna-golang/internal/application/shared/listdata/filter.go`
- Proto: `commonpb.FilterRequest{filters []TypedFilter, logic AND|OR}` with `TypedFilter.oneof FilterType: StringFilter | NumberFilter | DateFilter | ListFilter | RangeFilter | BooleanFilter`
- Current JS: `packages/pyeza-golang/web/js/table/table-filters.js`
- Current template: `packages/pyeza-golang/web/templates/components/table/table-toolbar.html:96-124`

---

## Overview

Bring filters up to the same level as sort: default-on per column with explicit opt-out, automatic widget selection from cell type, per-type operator-aware UI, and a documented use-case allow-list path that prevents the same SQL whitelist loophole sort hit in Phase 7.4. Multiple AND filters across columns is the success criterion. AND/OR logic and condition grouping are explicitly out of scope (deferred until grouping UX is decided).

---

## Motivation

**Three independent gaps compound today:**

1. **Filterable opt-in.** Most columns aren't filterable because the consumer must remember to set `Filterable: true` + `FilterType: types.FilterTypeXxx` per column. The result: most list pages have 1–3 filterable columns, even though the proto layer can filter any field.
2. **`FilterType` is hand-coded** even though `TableCell.Type` already encodes the same kind information. Phase 7.7 demonstrated the pattern works — `DeriveSortKind(cellType)` powers per-cell-type sort labels. Same pattern fits filters.
3. **UI widgets are too thin.** String = single contains input (no operator pick). Number = single value (no `>`, `<`, `between`). Date = bare `from`+`to`. Status = checkbox set with no search. No widget for money / chips / person / boolean.

Filter is the third foundational table affordance after sort and bulk-select. The other two are now uniform across every list page; filter is still uneven. This plan closes the gap.

**The proto already supports multi-column AND** via `FilterRequest.filters[]` and `FilterRequest.logic`. `EvaluateFilters` (filter.go:23-49) already evaluates AND short-circuit and OR fan-out. **No proto change needed.** The wire format stays unchanged: URL `filters=<protojson of FilterRequest>`. The variant field name (`stringFilter` / `numberFilter` / etc.) **is** the type tag — no second-tag layer.

---

## Locked decisions

| # | Decision | Rationale |
|---|----------|-----------|
| 1 | **AND only** for now. No OR, no condition grouping. | Multi-AND is the success criterion. OR/grouping requires UX design (parens? nested rows?) the user wants to defer. |
| 2 | **Default operators by kind:** `string=contains`, `number=between`, `date=between`, `enum=in`, `bool=equals`. | Matches existing user expectations from current UI (string is contains, date is between). Number/range default falls out naturally from the range filter being the most common use of "filter by money". |
| 3 | **Chips / multi-person filter matches on label** (not id). Simple ListFilter on the rendered string. | Cells already expose label text in textContent; no need to plumb id through. Trade-off: same name across two records won't disambiguate, but for chips/persons that's already the user's mental model. |
| 4 | **Date presets:** Today / Last 7 days / Last 30 days / This month + Custom range. | Covers the 80% case without a calendar widget. Custom range falls back to the existing two-input pattern. |
| 5 | **Sweep same 7 packages as Phase 2b**: centymo, entydad, fycha, fayna, cyta, hybra, pyeza (self). plus `apps/service-admin` views. | Same blast radius as the `Sortable bool` → `NoSort bool` migration. ~50–80 files based on grep (40 `Filterable: true|false` + 30 `FilterType: types.X`). |

---

## Architecture

### Type-derivation chain (mirror of SortKind)

```
TableCell.Type         (e.g. "money", "datetime", "badge", "chips")
   │
   │ DeriveFilterType(cellType, filterOptions)
   ▼
TableColumn.FilterType (e.g. "numeric-range", "date-range", "list", "list")
   │
   │ template.HTML widget per FilterType
   ▼
filter-conditions row  (operator <select> + value <input(s)>)
   │
   │ getFilterConditions() builds TypedFilter{}
   ▼
URL: filters=<protojson>
```

Auto-derivation memoizes onto the column from the first row's cell type, exactly like `SortKind` (Phase 3, see types/table.go:DeriveSortKind + ApplyColumnStyles). Caller can override by setting `FilterType` explicitly.

### Cell-type → FilterType derivation table

| Cell `Type` | Derived `FilterType` | Operators in widget | Default operator |
|---|---|---|---|
| `money`, `number` | `numeric-range` | `=`, `≠`, `>`, `≥`, `<`, `≤`, `between` | `between` |
| `datetime`, `author` | `date-range` | preset chips + `=`, `before`, `after`, `between (custom)` | `between` (custom range) |
| `badge`, `select` | `list` (server-side: ListFilter IN) | `in`, `not in` | `in` |
| `chips`, `multi-person` | `list-label` (ListFilter IN against rendered labels) | `in`, `not in` | `in` |
| `single-person` | `list-label` | `in`, `not in` | `in` |
| `email` | `string` | `equals`, `not equals`, `contains` | `equals` |
| `phone` | `string` | `contains`, `equals` | `contains` |
| `text`, `name`, `link`, `html`, default | `string` | `contains`, `equals`, `starts_with`, `ends_with`, `not_equals` | `contains` |
| `input` | `none` (skip — interactive cell) | — | — |

### Proto mapping

| FilterType (UI) | TypedFilter variant | Operator enum source |
|---|---|---|
| `string` | `StringFilter` | `commonpb.StringOperator` |
| `numeric-range` | `NumberFilter` (single op) or `RangeFilter` (when `between`) | `NumberOperator` / `Range.IncludeMin/Max` |
| `date-range` | `DateFilter` (with optional `RangeEnd`) | `commonpb.DateOperator` |
| `list`, `list-label` | `ListFilter` | `commonpb.ListOperator` |
| `boolean` | `BooleanFilter` | (no operator — value is the assertion) |

### Filter panel UI (rebuilt addFilterCondition)

```
┌─ Filter Panel ────────────────────────────┐
│ Filter conditions             [Clear all] │
├───────────────────────────────────────────┤
│ ┌─ Row 1 ───────────────────────────────┐ │
│ │ [Column ▼]  [Operator ▼]  [Input(s)]  │ │
│ │                                    [✕]│ │
│ └───────────────────────────────────────┘ │
│ ┌─ Row 2 ───────────────────────────────┐ │
│ │ [Column ▼]  (kind-aware widget)    [✕]│ │
│ └───────────────────────────────────────┘ │
│ + Add condition                           │
├───────────────────────────────────────────┤
│ AND between conditions (locked, no UI)    │
├───────────────────────────────────────────┤
│              [Clear]   [Apply Filters]    │
└───────────────────────────────────────────┘
```

Each row's widget tree depends on the column's resolved `FilterType`. The "AND between conditions" line is just a comment in the panel — no toggle, no grouping affordance. (When OR/grouping ships, this is where the toggle goes.)

### Per-widget DOM shape

**String widget:**
```html
<select class="filter-operator" data-kind="string">
  <option value="contains">contains</option>
  <option value="equals">equals</option>
  <option value="starts_with">starts with</option>
  <option value="ends_with">ends with</option>
  <option value="not_equals">does not equal</option>
</select>
<input type="text" class="filter-value" placeholder="…">
```

**Numeric-range widget:**
```html
<select class="filter-operator" data-kind="number">
  <option value="between">between</option>
  <option value="eq">=</option>
  <option value="neq">≠</option>
  <option value="gt">&gt;</option>
  <option value="gte">≥</option>
  <option value="lt">&lt;</option>
  <option value="lte">≤</option>
</select>
<input type="number" step="any" class="filter-value-min" placeholder="Min">
<span class="filter-range-sep">–</span>
<input type="number" step="any" class="filter-value-max" placeholder="Max">
```
The `–` separator and `filter-value-max` hide unless operator is `between`.

**Date-range widget:**
```html
<select class="filter-operator" data-kind="date">
  <option value="between">between</option>
  <option value="eq">on</option>
  <option value="before">before</option>
  <option value="after">after</option>
</select>
<div class="filter-date-presets">
  <button data-preset="today">Today</button>
  <button data-preset="7d">Last 7 days</button>
  <button data-preset="30d">Last 30 days</button>
  <button data-preset="month">This month</button>
  <button data-preset="custom" class="active">Custom</button>
</div>
<input type="date" class="filter-date-from">
<input type="date" class="filter-date-to">
```
Preset chip click pre-fills the date inputs with the computed range and switches operator to `between`. `Custom` reveals the inputs without changing them.

**List widget (badge / select / chips / persons):**
```html
<div class="filter-list-search">
  <input type="search" class="filter-list-search-input" placeholder="Search…">
</div>
<div class="filter-list-options">
  {{range .Options}}
  <label><input type="checkbox" class="filter-value-checkbox" value="{{.Value}}"> {{.Label}}</label>
  {{end}}
</div>
```
The search input filters the visible checkboxes client-side. Search bar hides when option count ≤ 5.

**Boolean widget:**
```html
<select class="filter-value-bool" data-kind="bool">
  <option value="">Any</option>
  <option value="true">Yes</option>
  <option value="false">No</option>
</select>
```

### Widget registry (JS)

JS gets a `FILTER_WIDGETS` map keyed by FilterType. Each entry has:
- `build(container, column, options)` — render the operator + value DOM
- `read(row)` — return a `TypedFilter` JSON shape, or `null` if the row is empty/incomplete
- `chip(condition, column)` — return chip label like `"Price: ≥ 1,000.00"` for the active-filters bar

This replaces the inline if/else chain in current `addFilterCondition` / `getFilterConditions`.

---

## Implementation Steps

Two-phase split (8a / 8b) so the pyeza-internal change can be reviewed in isolation before the consumer sweep. Each phase is independently committable.

### Phase 8a: Pyeza-internal types + widgets (self-consistent, no consumers touched)

**8a.1 — `NoFilter bool` + `DeriveFilterType` helper**
- `packages/pyeza-golang/types/table.go` — add `NoFilter bool` to `TableColumn`. Mark `Filterable bool` deprecated (doc comment) but keep readable until 8b sweep finishes (read order: `!c.NoFilter` wins; legacy `Filterable: false` continues to work as opt-out via the same code path).
- Add `DeriveFilterType(cellType string, hasOptions bool) FilterColumnType` mirroring `DeriveSortKind`.
- Extend `ApplyColumnStyles` to memoize `FilterType` from first row's cell, like `SortKind`.
- Add `FilterableKeys(cols []TableColumn) []string` (analogue of `SortableKeys`).
- Add new `FilterColumnType` constants: `FilterTypeNumericRange`, `FilterTypeDateRange`, `FilterTypeList`, `FilterTypeListLabel`, `FilterTypeBoolean`. Keep existing constants as aliases / deprecated where they map.

**8a.2 — Lyngua keys for new widget chrome**
- `packages/lyngua/translations/en/common/common.json` — add under `table.`:
  - `filterOpContains`, `filterOpEquals`, `filterOpStartsWith`, `filterOpEndsWith`, `filterOpNotEquals` (string operators)
  - `filterOpBetween`, `filterOpEq`, `filterOpNeq`, `filterOpGt`, `filterOpGte`, `filterOpLt`, `filterOpLte` (number operators — reuse symbols where they're universal)
  - `filterOpOn`, `filterOpBefore`, `filterOpAfter` (date operators)
  - `filterOpIn`, `filterOpNotIn` (list operators)
  - `filterPresetToday`, `filterPreset7d`, `filterPreset30d`, `filterPresetMonth`, `filterPresetCustom`
  - `filterAny`, `filterYes`, `filterNo` (boolean tri-state)
  - `filterSearchPlaceholder`, `filterMinPlaceholder`, `filterMaxPlaceholder`
- `packages/pyeza-golang/labels_types.go::CommonTableLabels` — add the corresponding `json:"..."` fields.
- `packages/centymo-golang/labels.go`, `packages/entydad-golang/labels.go`, `packages/fycha-golang/labels.go` — wire all new fields through each `MapTableLabels`. (fayna + cyta inherit.)
- `packages/pyeza-golang/types/table.go::TableLabels` — extend with the same fields, propagated via the existing label-glue path.

**8a.3 — Widget JS rewrite**
- `packages/pyeza-golang/web/js/table/table-filters.js` — full rewrite of `addFilterCondition` and `getFilterConditions`:
  - Introduce `FILTER_WIDGETS` registry (string / numeric-range / date-range / list / list-label / boolean) — each with `build()` / `read()` / `chip()`.
  - `addFilterCondition` delegates to widget `build()` based on resolved `FilterType` of selected column.
  - On column change, rebuild the value container via the new column's widget.
  - `getFilterConditions` calls each row's widget `read()` to produce `TypedFilter` JSON.
  - Date preset buttons: click pre-fills `filter-date-from` + `filter-date-to` with the computed ISO date range and sets operator to `between`.
  - List search input: shows when option count > 5, filters checkboxes by case-insensitive label match.
  - Operator change handler for numeric-range: shows/hides the `filter-value-max` input + `–` separator depending on whether operator is `between`.
  - Drop the legacy client-side `applyFilters` switch on string operators (replaced by per-widget `read()` + server eval). Keep `clearFilters` as-is for client-paginated tables.

**8a.4 — Filter metadata JSON extension**
- `packages/pyeza-golang/renderer_funcs.go::filterColumnsJSON` — extend each entry with derived `filterType` (from `DeriveFilterType`) and `defaultOperator`, so JS doesn't need to recompute. Backward-compatible (existing entries get the new fields, JS that only reads `key`/`label`/`type`/`options` still works).
- The script block in `table-toolbar.html:109` already serializes `.Columns` — update consumers via the func change only. No template change needed for metadata.

**8a.5 — CSS for new widget DOM**
- `packages/pyeza-golang/web/styles/components/table.css` — append a `Filter Widgets` section:
  - `.filter-operator` select styling
  - `.filter-value-min`, `.filter-value-max` numeric range inputs + `.filter-range-sep`
  - `.filter-date-presets` button group + `.filter-date-presets button.active`
  - `.filter-list-search` + `.filter-list-search-input`
  - `.filter-list-options` scroll container with max-height
  - Concentric radii (mirror Phase 7.2: outer dropdown 1rem → row 0.5rem → inputs/buttons 0.25rem)
- Hide `filter-value-max` + `.filter-range-sep` by default; reveal via `[data-op="between"]` attribute on the row.
- Hide `.filter-list-search` when option count ≤ 5 (set via `data-options-count` attribute on the row).

**8a.6 — Active-filter chips in toolbar**
- **Single source of truth for chip text: server.** `ServerPagination.ActiveFilter` gets a `ChipText string` field populated server-side from a new `FormatActiveFilter(f *commonpb.TypedFilter, col *TableColumn) string` helper. The chip strip in `table.html:81-92` renders `{{.ChipText}}` verbatim. JS does not reformat. (Eliminates the Go ↔ widget `chip()` JS duplication that would otherwise drift.)
- Each chip shows `column • operator • value` (e.g., `"Price: ≥ ₱1,000.00 ✕"`).
- Confirm chip dismiss handler in `table-filters.js::initChipHandlers` works with the new TypedFilter shapes (the dismiss path reads the filter's index/key from the chip's data attribute, not the chip text — should be unaffected).
- Filter panel reopen: when the panel opens with active filters, hydrate condition rows from `ServerPagination.ActiveFilters` so the user sees what's currently applied (mirrors Phase 7.5 — sort-dropdown active state must agree with the URL).

**8a.7 — Verify pyeza-internal**
- `go build ./packages/pyeza-golang/...` exits 0.
- Manual smoke (deferred to 8b smoke): open a list page using legacy `Filterable: true, FilterType: types.FilterTypeString` — confirm widget still renders and sends the same `StringFilter{operator: contains}` it did before.

### Phase 8b: Consumer sweep + use-case allow-list audit

**8b.1 — Audit sub-agent** (delegated, parallel)
- Spawn `Explore` sub-agent over the 7 packages + `apps/service-admin/views`. Report: every file with `Filterable: true|false` or `FilterType: types.X` lines. Group by package. Flag any column where the `FilterType` differs from what `DeriveFilterType` would auto-derive from the cell type (those keep the explicit override; everything else gets dropped).

**8b.2 — Sweep agent** (delegated, similar to Phase 2b)
- Brief: same edit pattern as Phase 2b's `Sortable: true` removal:
  - Drop `Filterable: true` lines (default-on after the sweep).
  - Convert `Filterable: false` → `NoFilter: true`.
  - Drop `FilterType: types.FilterTypeXxx` only when it matches `DeriveFilterType(cellType)`. Keep when it's an override.
- **Pre-set `NoFilter: true` on the 5 known-risky columns** (Phase 7.4 burned on `product.line`; the 5 siblings have the same use-case allow-list gap): `product.line_id`, `product.sort_order`, `inventory.sku`, `price_plan.duration`, plus filter analogues on the same use cases. Lock these out before the sweep ships so the user never hits a 500.
- **Loophole #2 prevention (the recurring bug):** sweep agent rewrites the *entire* composite literal as one Edit when removing fields, never field-by-field. Last sweep produced 48 comma-trailing-edge breakages doing it field-by-field; that approach is banned here.
- **`gofmt -l` after each file edit.** Non-empty output halts the chunk. Catches comma drops at edit time, not smoke-compile time.
- **Generated-file exclusion:** sweep agent passes `--exclude='*.pb.go'` (or `rg --glob '!*.pb.go'`) on any regex pass. Phase 6 loophole #3 mangled `filter.pb.go` last time.
- Run `go build ./packages/<pkg>-golang/...` after each package as a final sanity check.

**8b.3 — Use-case allow-list audit** (separate agent, parallel)
- Brief: for every `List<Entity>` use case in `packages/centymo-golang/use_cases`, `packages/entydad-golang/use_cases`, `packages/fycha-golang/use_cases`, `packages/fayna-golang/use_cases`, `packages/cyta-golang/use_cases`, identify the filter allow-list (the equivalent of sort's `allowedSortColumns`). Report:
  - Use cases that already have an allow-list — what's in it.
  - Use cases that don't validate filter columns at all — these are the time bombs.
  - Mismatches between column config keys and use-case allow-list entries.
- The fix recipe (out of scope for this plan, but documented): each use case must call `types.FilterableKeys(cols)`-equivalent at the view layer and reject unknown filter fields before passing to the repo. Where SQL doesn't support a filter (joined columns, computed fields), set `NoFilter: true` on the column.
- For this plan, just *document* the gaps in `progress.md`'s "Loophole Log" section. Wiring the allow-list properly is a Phase 9 follow-up unless a column produces a 500 during smoke.

**8b.4 — Lyngua glue smoke**
- After the sweep, every list page renders with the new widget panel. Open one page per business-type tier (centymo product list, entydad client list, fycha invoice list) — confirm operator dropdowns render in English and persist across HTMX swaps.

**8b.5 — Submodule pointer bump + push**
- `packages/pyeza-golang`: commit + push (types + JS + CSS + lyngua glue).
- Each consumer package: commit + push.
- Monorepo root: bump submodule pointers, single commit.

---

## File References

| File | Change | Phase |
|------|--------|-------|
| `packages/pyeza-golang/types/table.go` | Add `NoFilter bool`; deprecate `Filterable`; add `DeriveFilterType`, `FilterableKeys`; new FilterColumnType constants; extend `ApplyColumnStyles` to memoize FilterType | 8a.1 |
| `packages/pyeza-golang/labels_types.go` | Add `CommonTableLabels` json fields for new operator/preset/placeholder labels | 8a.2 |
| `packages/lyngua/translations/en/common/common.json` | Add ~25 keys under `table.` namespace | 8a.2 |
| `packages/centymo-golang/labels.go` | Wire new label fields into `MapTableLabels` | 8a.2 |
| `packages/entydad-golang/labels.go` | Same | 8a.2 |
| `packages/fycha-golang/labels.go` | Same | 8a.2 |
| `packages/pyeza-golang/types/table.go::TableLabels` | Add same fields (consumed by template) | 8a.2 |
| `packages/pyeza-golang/web/js/table/table-filters.js` | **Full rewrite** of addFilterCondition / getFilterConditions; add FILTER_WIDGETS registry; date-preset handler; list-search; operator-aware show/hide | 8a.3 |
| `packages/pyeza-golang/renderer_funcs.go` | Extend `filterColumnsJSON` to include derived `filterType` + `defaultOperator` per column | 8a.4 |
| `packages/pyeza-golang/web/styles/components/table.css` | Append Filter Widgets section (~80-120 lines) | 8a.5 |
| `packages/pyeza-golang/web/templates/components/table/table-toolbar.html` | (No change — `filterColumnsJSON` carries the metadata; new widgets are JS-driven.) | 8a.4 |
| `packages/pyeza-golang/web/templates/components/table/table.html` | (Minor) confirm `ServerPagination.ActiveFilters` chip strip works with new TypedFilter shapes; no structural change | 8a.6 |
| `packages/pyeza-golang/types/table.go::FormatActiveFilter` | New helper that returns chip text. Server is the single source of truth — exposed to template as `{{.ChipText}}` on each `ActiveFilter`. JS reads verbatim, does not reformat. | 8a.6 |
| Sweep: ~50–80 consumer files | Drop `Filterable: true`; flip `Filterable: false`→`NoFilter: true`; drop redundant `FilterType` | 8b.2 |
| `progress.md` (this plan) | Document use-case allow-list gaps as a Loophole Log entry | 8b.3 |

---

## Context & Sub-Agent Strategy

**Estimated files to read (Phase 8a):** ~15
**Estimated files to modify (Phase 8a):** ~10
**Estimated files to modify (Phase 8b sweep):** ~50–80
**Estimated context usage:** Medium for 8a (single session); High for 8b (mandatory sub-agents).

**Sub-agent plan:**
- **Phase 8a** runs in a single foreground session (Sonnet). All work is in pyeza-golang; the touched files are well-known.
- **Phase 8b.1** (audit) — `Explore` sub-agent, parallel-able across 3 packages at a time. Output is a report, no edits.
- **Phase 8b.2** (sweep) — `general-purpose` sub-agent (Sonnet) with the Phase 2b template adapted. Mechanical edits across 50–80 files. The agent must run `go build` after each package to catch comma-trailing-edge breakages immediately (Phase 2b loophole #2 is a known risk).
- **Phase 8b.3** (use-case audit) — separate `Explore` sub-agent. Reports gaps to progress.md; no edits this plan.
- **Phase 8b.4** (smoke) — foreground; manual.
- **Phase 8b.5** (submodule bump) — foreground; manual.

---

## Risk & Dependencies

| Risk | Impact | Mitigation |
|------|--------|------------|
| Sweep agent drops trailing commas inside inline struct literals (Phase 2b loophole #2 — 48 breakages last time) | Compile failure in 20+ files | Sweep rewrites entire composite literals in one Edit (never field-by-field); `gofmt -l` halts on each file; `go build` per package as final check |
| Use-case allow-list missing a newly-exposed filter column (Phase 7.4 loophole) | 500 on first user click | Pre-set `NoFilter: true` on the 5 columns Phase 7.4 already proved risky (`product.line_id`, `product.sort_order`, `inventory.sku`, `price_plan.duration`, plus filter analogues). 8b.3 audit documents the rest; Phase 9 wires the allow-list properly |
| Generated proto file caught by sweep regex (Phase 6 loophole #3) | Broken `.pb.go` reverted by `git checkout` | Sweep agent must `--exclude="*.pb.go"` from any regex pass |
| Existing `Filterable: true` callers break if I remove the field too eagerly | Compile failure across all consumer pages | Keep `Filterable bool` deprecated-but-readable for one wave (8a). Sweep deletes it (8b). Then a follow-up plan removes the field after the wave is committed. |
| `DeriveFilterType` returns wrong default for an edge case (e.g. a money cell that should actually be a list filter on currency code) | User sees the wrong widget on one page | Auto-derivation is overrideable via explicit `FilterType: types.FilterTypeXxx`. The sweep keeps explicit overrides intact; only redundant overrides are dropped. |

**Dependencies:**
- 8a.1 (types) → 8a.2 (labels) → 8a.3 (JS) → 8a.4 (filterColumnsJSON) → 8a.5 (CSS) → 8a.6 (chip)
- 8b depends on 8a being committed and pushed to the pyeza submodule (so consumers compile against the new types).
- 8b.1 (audit) → 8b.2 (sweep) sequentially. 8b.3 (use-case audit) is independent and can run in parallel with 8b.2.

---

## Acceptance Criteria

- [ ] Filtering by 2+ columns (string + number, string + date, etc.) on a server-paginated list page returns the correct intersection.
- [ ] Every column on every list page is filterable by default (verified by opening the filter dropdown on a sampling of list pages — sort dropdown count == filter dropdown count, minus columns with `NoFilter: true`).
- [ ] Number / money columns expose a `between` operator that accepts two values; clicking another operator (`>`, `<`, etc.) collapses the second input.
- [ ] Date columns expose preset chips (Today / 7d / 30d / This month / Custom) that pre-fill the from/to inputs.
- [ ] Badge / select / chips / multi-person columns expose a multi-select widget; when option count > 5 a search input appears above the list.
- [ ] Boolean columns expose a tri-state Any / Yes / No select.
- [ ] Active filter chips in the toolbar show `column • operator • value` and dismiss correctly.
- [ ] No 500s on smoke across centymo product / entydad client / fycha invoice list pages with multi-column filter applied.
- [ ] `go build ./packages/...` exits 0 after the consumer sweep.
- [ ] Phase 7.4 loophole class (use-case allow-list missing a newly-filterable column) is *documented* in this plan's progress.md "Loophole Log", even if not all gaps are fixed.

---

## Design Decisions

| Date | Decision | Rationale |
|---|---|---|
| 2026-05-02 | Keep wire format (`filters=<protojson of FilterRequest>`) unchanged | Proto's `oneof` already encodes type via field name. Adding a `type` tag would be redundant and require server-side migration. The user explicitly preferred no extra type tagging if the proto already carried it — and it does. |
| 2026-05-02 | AND only; no OR; no condition grouping | User decision: grouping UX (parens? nested rows?) needs design. Multi-AND is the success criterion. |
| 2026-05-02 | Default operators per kind: string=contains, number=between, date=between, enum=in, bool=equals | User-confirmed. Falls naturally from the most common use cases. |
| 2026-05-02 | Chip / multi-person filter matches on label, not id | User decision. Cells already expose label text; plumbing id through every cell type would be a separate refactor. Trade-off (same name across two records) is acceptable for the chip use case. |
| 2026-05-02 | Date presets: Today / 7d / 30d / This month + Custom | User-confirmed. Custom range falls back to existing two-input pattern. |
| 2026-05-02 | Sweep same 7 packages as Phase 2b | User-confirmed. Same blast radius as the `Sortable bool` migration. |
| 2026-05-02 | `NoFilter bool` opt-out, mirroring `NoSort` | Default-on filterable matches default-on sortable; the sweep is mechanical and forces conscious opt-out where the SQL layer can't filter the column. |
| 2026-05-02 | Auto-derive `FilterType` from cell type, allow override | Same pattern as Phase 3's `DeriveSortKind`. Most columns are unambiguous; explicit override exists for edge cases. |
| 2026-05-02 | Memoize derived `FilterType` onto the column via `ApplyColumnStyles` | Mirrors how `SortKind` is memoized. Single derivation per column per page render. |
| 2026-05-02 | Widget operators rendered as `<select>` (not chips/segmented control) | Saves horizontal space in the dropdown. Operator change is rare per row. |
| 2026-05-02 | Use-case allow-list audit defers the *fix* to a Phase 9 follow-up | Audit (Phase 8b.3) just *documents*. Fix recipe is known: each use case calls `FilterableKeys(cols)`-equivalent. But applying it to ~30 use cases is a separate sweep. |
| 2026-05-02 | Drop legacy client-side `applyFilters` operator switch in `table-filters.js` | New widgets emit `TypedFilter` JSON; server-side `EvaluateFilters` is authoritative. Client-side filtering for non-server tables is rare and the existing switch is incomplete (mismatched proto enums). |

---

## Open Questions

None — all decisions locked before plan was written. Section retained for resume-flow consistency.

---

## How to Resume

To continue this work in a fresh session:

1. Read [plan.md](./plan.md) (this file) and [progress.md](./progress.md).
2. Check `git status` in monorepo root and `cd packages/pyeza-golang && git status` for uncommitted work.
3. Resume from the first phase that's not COMPLETE in progress.md.
4. **Refresh line refs.** Phase 7 commits (`eda8324` + post-7 polish) shifted line numbers in `table-filters.js`, `table-toolbar.html`, `table.css`. Re-grep for the anchor strings before editing — the line numbers cited in this plan are approximate.
5. **Hard rule:** sub-phases within 8a must run sequentially (8a.1 → 8a.2 → … → 8a.7). Sub-phases within 8b: 8b.1 (audit) before 8b.2 (sweep); 8b.3 (use-case audit) is parallel-able.
6. Always run `go build ./packages/pyeza-golang/...` after each 8a sub-phase. Always run `go build ./packages/<pkg>/...` after each consumer-package edit in 8b.

**Cross-references for context:**
- [Phase 1–7 progress.md](../20260501-table-sort-and-select-all/progress.md) — read the "Loophole Log" sections (especially loophole #2 inline-struct comma drops, loophole #3 generated proto sweep collision, and Phase 7.4 use-case allow-list 500). The same risks apply here.
- `packages/espyna-golang/internal/application/shared/listdata/filter.go` — server-side filter evaluation (already supports multi-column AND/OR). No change needed.
- `packages/pyeza-golang/web/js/table/table-filters.js` — the file being rewritten in 8a.3.

---

## Companion docs

- [progress.md](./progress.md) — phase checklist, decision log, loophole log (filled during implementation).
- **flow.md not needed** — this plan does not introduce a new flow / entity / branching state. It rewrites a UI surface backed by an existing proto. The "flow" is "user clicks dropdown → adds N rows → clicks Apply → server filters." That's covered by the Architecture section + Acceptance Criteria.
- **verticals.md not needed** — the filter system is vertical-agnostic. Every list page in every vertical inherits the same widgets. No vertical-specific scenarios to document.
