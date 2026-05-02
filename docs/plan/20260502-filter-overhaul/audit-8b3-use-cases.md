# Phase 8b.3 — Use-Case Filter Allow-list Audit

**Date:** 2026-05-02
**Status:** Documented gaps. **No fixes** — Phase 9 follow-up.

---

## Context

`espynahttp.ParseTableParams(r, allowedSortColumns, defaultSort, defaultDir)` validates the `?sort=` query against an explicit allow-list (Phase 7's mitigation). It does **not** validate the `?filters=` payload — filters are passed through as raw protojson (`FiltersRaw`) and the proto (`listParams.Filters`).

Net effect: every list page now exposes a default-on filter dropdown for every column where `!NoFilter`. If the use case doesn't explicitly handle the filter field, behavior depends on the repo:
- Most adapters silently ignore unknown filter fields. Safe.
- A small number 500 (Phase 7.4 burned on `product.line` for sort; same class of bug exists for filters).

**Mitigation already in this plan (Phase 8b.2):** pre-set `NoFilter: true` on the 5 known-risky columns (`product.line`, `product.line_id`, `product.sort_order`, `inventory.sku`, `price_plan.duration`) AND on derived/joined columns whose use cases don't accept filtering (`outstanding_balance`, `permissions`, `color`, `payment_term`, etc.).

---

## Pages with `SortableKeys(columns)` (Phase 7.4 migration completed)

These 21 list pages migrated to call-site `types.SortableKeys(columns)` for the sort allow-list. The same migration would work for filters — call `types.FilterableKeys(columns)` and pass into a new `ParseTableParams` overload that validates filter fields. **Phase 9 work.**

### centymo-golang (12)
- `views/collection/list/page.go`
- `views/inventory/list/page.go`
- `views/plan/list/page.go`
- `views/price_plan/list/page.go`
- `views/price_schedule/list/page.go`
- `views/pricelist/list/page.go`
- `views/product/line/list/page.go`
- `views/product/list/page.go`
- `views/resource/list/page.go`
- `views/revenue/list/page.go`
- (sub-pages not counted)

### entydad-golang (8)
- `views/client/list/page.go`
- `views/location/list/page.go`
- `views/location_area/list/page.go`
- `views/role/list/page.go`
- `views/supplier/list/page.go`
- `views/user/list/page.go`
- `views/workspace/list/page.go`

### cyta-golang (1)
- `views/event_tag/list/page.go`

### fayna-golang (2)
- `views/fulfillment/list/page.go`
- `views/job_template/list/page.go`

---

## Pages NOT migrated to SortableKeys (potential 500 risk on sort too)

A small number of list pages may still pass hand-written allowed-sort slices. Sweep would need to run again to enumerate them — out of scope for this audit. **Phase 9 work** combines this with the filter-allow-list extension.

---

## Recommended Phase 9 fix shape

1. Add `ParseTableParamsV2(r, allowedSort, allowedFilter, defaultSort, defaultDir)` (or extend `ParseTableParams`).
2. Inside, drop unknown filter fields from `listParams.Filters` instead of passing them down. **Drop, don't 500** — silent ignore is the right failure mode here.
3. Migrate every list page to call `types.FilterableKeys(columns)` for the filter allow-list.
4. Delete `Filterable bool` from `TableColumn` after the migration lands.

---

## Time bombs documented (NOT fixed)

Until Phase 9 lands, every list page with `!NoFilter` columns relies on the repo to silently ignore unknown filter fields. Where it doesn't (a few centymo repo paths), a 500 is possible if a user clicks an unexpected filter column. The 8b.2 sweep pre-empted the 5 known-risky columns by setting `NoFilter: true`. New columns added to existing list pages between now and Phase 9 carry the same risk and should set `NoFilter: true` if their backing use case doesn't validate filters.
