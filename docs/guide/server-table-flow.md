# Server-Side Table Flow

Reference guide for implementing server-side filter, sort, search, and pagination on any list view. This is the canonical flow — all entity list views follow this pattern.

## Request Flow

```
Browser (JS + HTMX)
    |
    |  User clicks filter/sort/page/search
    |
    v
[1] table-filters.js
    - Reads column metadata from <script type="application/json" id="{tableId}-filter-meta">
    - Serializes filters as proto-compatible JSON (TypedFilter shape)
    - Sends via hx-post to body-only route
    - Pagination buttons use hx-include to attach hidden filter input
    - Filter state is NEVER in URL params — only in POST body
    |
    v
[2] POST /app/{entity}/{status}/table
    - Body fields: page, size, sort, dir, search, tz
    - Hidden input (via hx-include): filters = raw JSON string
    - Initial page load is GET (NewView) — all subsequent interactions are POST (NewTableView)
    |
    v
[3] Go View Handler (NewTableView)
    - r.FormValue("page"), r.FormValue("sort"), r.FormValue("filters"), etc.
    - Parses into a params struct — never builds SQL or WHERE clauses
    - Calls buildTableConfig(ctx, deps, status, params)
    |
    v
[4] buildTableConfig
    - Populates proto request from params struct:
      deps.GetListPageData(ctx, &proto.GetListPageDataRequest{
          Search:     params.Search,
          Filters:    params.Filters,
          Sort:       params.Sort,
          Pagination: params.Pagination,
      })
    - All 30 entity protos already have these four fields defined
    |
    v
[5] Use Case (espyna)
    - Auth check (authcheck.Check) — verifies user has "list" permission
    - Pure pass-through — delegates directly to repository adapter
    - NO transformation of filter/sort/pagination params
    |
    v
[6] Postgres CTE Adapter
    - Calls shared core.BuildFilterWhere(req.Filters, req.Search, searchFields, paramIdx)
    - Returns (clauses []string, args []any, nextIdx int)
    - Entity-specific conditions added after (e.g., c.active, wu.workspace_id)
    - Sort column validated against allowlist before ORDER BY interpolation
    - Uses COUNT(*) OVER() AS total_count (no separate counted CTE)
    - LIMIT/OFFSET as parameterized $N values
    |
    v
[7] Response flows back up
    - CTE returns rows + total_count per row
    - View builds ServerPagination (page/total/sort state/FiltersJSON)
    - View builds ActiveFilters for chip rendering
    - FiltersJSON = raw JSON string from POST body, round-tripped back to template
    |
    v
[8] Template renders (table-card)
    - <script type="application/json" id="{tableId}-filter-meta"> for column metadata
    - Filter chips bar (chip-group with chip.css classes + icon-x dismiss)
    - Paginated tbody with row data
    - Hidden inputs: <input name="filters">, <input name="search">, <input name="tz">
    - Pagination buttons: hx-post with hx-include for filters/search/tz
    - Meta div with data-* attributes for JS state sync after swap
```

## Routes Per Entity

```
GET  /app/{entity}/{status}         -> NewView       (full page shell + table with defaults)
GET  /app/{entity}/{status}/table   -> NewTableView  (table-card, DEFAULT params — CRUD refresh)
POST /app/{entity}/{status}/table   -> NewTableView  (table-card, FILTER/SORT params from POST body)
```

All three call the same `buildTableConfig(ctx, deps, status, params)`.

- **NewView (GET)** — initial browser navigation, full page shell with table using defaults
- **NewTableView (GET)** — CRUD refresh after sheet close, dialog confirm, bulk action. Resets to defaults.
- **NewTableView (POST)** — filter/sort/pagination/search interactions via HTMX. Reads params from POST body.

Same handler, method check inside:
```go
func NewTableView(deps *Deps) view.View {
    return view.ViewFunc(func(ctx context.Context, viewCtx *view.ViewContext) view.ViewResult {
        status := viewCtx.Request.PathValue("status")
        var params TableParams
        if viewCtx.Request.Method == "POST" {
            params = parseTableParams(viewCtx.Request)
        }
        // GET uses zero-value defaults: page 1, no filters, default sort
        tableConfig, err := buildTableConfig(ctx, deps, status, params)
        if err != nil { return view.Error(err) }
        return view.OK("table-card", tableConfig)
    })
}
```

**CRUD refresh note:** After filtering, a CRUD operation (edit via sheet, delete via dialog) refreshes via GET — filter state resets to defaults. This is a known UX tradeoff; preserving filter state across CRUD refresh is a separate enhancement.

## Column Key Convention

Column keys use qualified `table.field` dot notation for JOINed columns:

```go
{Key: "date_created", ...}    // entity's own table
{Key: "u.first_name", ...}    // joined user table
{Key: "u.email_address", ...} // joined user table
```

Bare `field` = entity's own table. `table.field` = JOINed table.

The key serves triple duty:
1. **View validation** — `SortableKeys(columns)` extracts sortable keys for ParseTableParams
2. **Adapter allowlist** — same key validates ORDER BY (no separate mapping)
3. **Filter field** — same key becomes `TypedFilter.field` in the proto

## Column Filter Configuration

```go
columns := []types.TableColumn{
    {
        Key: "u.first_name", Label: "Name",
        Sortable: true,
        Filterable: true, FilterType: types.FilterTypeString,
    },
    {
        Key: "u.email_address", Label: "Email",
        Sortable: true,
        Filterable: true, FilterType: types.FilterTypeString,
    },
    {
        Key: "date_created", Label: "Date Created",
        Sortable: true,
        Filterable: true, FilterType: types.FilterTypeDate,
    },
}
```

**Filter types:** `FilterTypeString`, `FilterTypeNumeric`, `FilterTypeDate`, `FilterTypeMoney`, `FilterTypeStatus`, `FilterTypeToggle`

**Status columns with tabs:** When an entity uses URL path segments for status filtering (e.g., `/app/clients/active`), the status column should have `Filterable: false`. The tab controls status — it is not a user-configurable filter.

**Status columns without tabs** (standalone filter):
```go
{
    Key: "status", Label: "Status",
    Sortable: true,
    Filterable: true, FilterType: types.FilterTypeStatus,
    FilterOptions: []types.FilterOption{
        {Value: "active", Label: "Active"},
        {Value: "inactive", Label: "Inactive"},
    },
}
```

## Filter Metadata Template

Column filter configuration is passed from Go to JS via an inert JSON script block:

```html
{{if .Columns}}
<script type="application/json" id="{{.ID}}-filter-meta">
{{filterColumnsJSON .Columns}}
</script>
{{end}}
```

JS reads it with:
```js
function getFilterColumns(tableId) {
    const el = document.getElementById(tableId + '-filter-meta');
    if (!el) return [];
    try { return JSON.parse(el.textContent); } catch (e) { return []; }
}
```

This block is NOT executed by the browser. Go's `json.Marshal` auto-escapes `<`/`>` preventing injection.

## Filter Chips

Active filters render as dismissable chips using existing `chip.css` classes:

```html
<div class="chip-group" role="list">
  {{range .ServerPagination.ActiveFilters}}
  <span class="chip sm" data-filter-key="{{.Key}}" role="listitem">
    <span class="chip-label">{{.Label}}: {{.DisplayValue}}</span>
    <button type="button" class="chip-dismiss"
            data-dismiss-filter="{{.Key}}"
            aria-label="Remove {{.Label}} filter">
      {{template "icon-x" $}}
    </button>
  </span>
  {{end}}
  <button type="button" class="chip sm" data-clear-all-filters>Clear all</button>
</div>
```

## FiltersJSON Round-Trip

```
JS serializes filters -> JSON string
  -> POST body: filters={"filters":[{"field":"u.first_name","stringFilter":{"value":"John","operator":2}}]}
  -> Go view: filtersRaw := r.FormValue("filters")
  -> Go view: protojson.Unmarshal([]byte(filtersRaw), &filterRequest)  -- parse for CTE
  -> Go view: validate + re-marshal (reject malformed, return 400)
  -> Go view: sp.FiltersJSON = validatedJSON  -- round-trip back to template
  -> Template: <input type="hidden" name="filters" value="{{.FiltersJSON}}">
  -> Template: <input type="hidden" name="search" value="{{.SearchQuery}}">
  -> Template: <input type="hidden" name="tz" value="">  (populated by JS)
  -> Next request: hx-include picks up all three hidden inputs
```

FiltersJSON is a **raw JSON string** (not base64). No `encodeFilters`/`decodeFilters` helpers.
Server-side validation: unmarshal into proto, reject malformed → 400. Re-marshal to canonical JSON.

## Pagination Buttons

Pagination URLs contain only page/size/sort/dir — never filters:

```go
func (sp *ServerPagination) buildPageURL(page int) string {
    url := sp.PaginationURL + "?page=" + itoa(page) + "&size=" + itoa(sp.PageSize)
    if sp.SortColumn != "" {
        url += "&sort=" + sp.SortColumn + "&dir=" + sp.SortDirection
    }
    return url
}
```

Template emits `hx-post` with `hx-include` for all hidden state inputs:

```html
<a hx-post="{{.URL}}" hx-include="[name='filters'],[name='search'],[name='tz']" hx-target="...">2</a>
```

Filter logic is **AND-only** in v1. All filter conditions combine with AND. No OR toggle in the UI.

## Shared SQL Builder

All CTE adapters use `core.BuildFilterWhere()` for search + typed filters:

```go
// Entity-specific conditions
whereClauses := []string{"c.active = true"}
args := []any{}
paramIdx := 1

// Shared builder
filterClauses, filterArgs, nextIdx := core.BuildFilterWhere(
    req.Filters, req.Search,
    []string{"u.first_name", "u.last_name", "u.email_address"},
    paramIdx,
)
whereClauses = append(whereClauses, filterClauses...)
args = append(args, filterArgs...)
paramIdx = nextIdx

whereSQL := strings.Join(whereClauses, " AND ")
```

Entity-specific concerns (JOINs, JSONB aggregation, multi-tenancy) remain in the entity adapter. Only the filter/search WHERE building is shared.

## Files Changed Per Entity

When adding server-side table support to a new entity:

| File | Change |
|------|--------|
| `packages/{domain}/views/{entity}/list/page.go` | Parse POST params, populate proto request, build ServerPagination, add ActiveFilters, configure column filter metadata |
| `packages/{domain}/routes.go` | Add POST table route constant |
| `packages/{domain}/routes_config.go` | Add `TableURL string` to entity routes struct |
| `apps/{app}/internal/presentation/{entity}/module.go` | Wire NewTableView, register POST route |
| `packages/espyna-golang-ryta/.../adapter/entity/{entity}.go` | Call BuildFilterWhere, COUNT(*) OVER(), allowlisted ORDER BY |
