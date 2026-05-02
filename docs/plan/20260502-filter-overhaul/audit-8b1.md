# Phase 8b.1 — Filterable Caller Audit

**Date:** 2026-05-02
**Method:** `grep -rn 'Filterable:\|FilterType: types\.'` across consumer view packages.
**Scope:** column-config lines only — proto-builder lines (`FilterType: &commonpb.TypedFilter_*`) are pre-filtered out and untouched by the sweep.

---

## Files (14)

### centymo-golang/views (9)
- `inventory/list/page.go` — 8 column-config lines
- `pricelist/list/page.go` — 3 lines
- `price_plan/list/page.go` — 2 lines
- `price_schedule/list/page.go` — 2 lines
- `product/line/list/page.go` — 3 lines
- `product/list/page.go` — 2 lines
- `revenue/list/page.go` — 4 lines
- (no Filterable in `collection/list`, `plan/*`, `pricelist/list` already counted)

### entydad-golang/views (5)
- `client/list/page.go` — 2 lines
- `location/list/page.go` — 2 lines
- `location_area/list/page.go` — 2 lines
- `role/list/page.go` — 3 lines
- `user/list/page.go` — 4 lines

### cyta-golang/views (1)
- `event_tag/list/page.go` — 3 lines

### fycha-golang, fayna-golang, hybra-golang
- 0 column-config `Filterable:` lines (only proto-builder lines, untouched).

---

## Sweep rules

For each line in scope:

1. `Filterable: true, FilterType: types.FilterTypeString` (paired) on text/name/email columns → **drop both** — `DeriveFilterType` auto-derives `string` from cell type.
2. `Filterable: true, FilterType: types.FilterTypeDate` on datetime columns → **drop both** — auto-derives `date-range` (legacy `date` aliased).
3. `Filterable: true, FilterType: types.FilterTypeNumeric` on number columns → **drop both** — auto-derives `numeric-range` (legacy `numeric` aliased).
4. `Filterable: true, FilterType: types.FilterTypeMoney` on money columns → **drop both** — auto-derives `numeric-range` (legacy `money` aliased).
5. `Filterable: true` alone (no FilterType) → drop.
6. `Filterable: false` → flip to `NoFilter: true`.

## Phase 7.4 risk pre-emption

Columns currently *implicitly* off (no Filterable flag) that will become filterable after default-on flip. Pre-set `NoFilter: true` on every column whose use-case allow-list won't accept filtering on it:

### centymo-golang/views/product/list/page.go (lines 324–326)
- `description` — full-text on description column, use case may not support → `NoFilter: true`
- `line` — Phase 7.4 already burned on this → `NoFilter: true` (locked out)
- `price` — money-typed but joined from price_plan, use-case may not support → `NoFilter: true`

### centymo-golang/views/product/line/list/page.go
- `description` (if present) → `NoFilter: true`

### centymo-golang/views/inventory/list/page.go
- `available` (already `Filterable: false`) → flip to `NoFilter: true` — derived field, can't filter
- `reorder_level` (already `Filterable: false`) → flip to `NoFilter: true`

(The remaining 3 of the 5 known-risky columns — `product.line_id`, `product.sort_order`, `price_plan.duration` — don't appear in any column slice, so the default-on flip won't expose them. No pre-emption needed.)

---

## Time bombs documented for Phase 9 (NOT fixed here)

After the sweep, every column with no `NoFilter: true` becomes filterable. Use cases that don't validate the filter field will 500 on first user click. Phase 7.4 fix recipe: `types.FilterableKeys(cols)` at the view layer; reject unknown filter fields in the use case before passing to repo.

To track: every list page where `ParseTableParams` accepts filters but the use case does not pass them through `FilterableKeys`.
