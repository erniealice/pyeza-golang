# Table Component

A reusable data table component with toolbar (search, filters, sort, columns, export, density), sortable column headers, pagination (client-side and server-side), row selection, bulk actions, row actions, and row groups.

## Quick Start

```go
// In your handler:
table := types.TableConfig{
    ID:           "clients",
    ShowSearch:   true,
    ShowSort:     true,
    ShowColumns:  true,
    ShowExport:   true,
    ShowEntries:  true,
    Columns: []types.TableColumn{
        {Key: "name", Label: "Name", Sortable: true, MinWidth: "150px"},
        {Key: "status", Label: "Status", Sortable: true, MinWidth: "100px"},
        {Key: "amount", Label: "Amount", Align: "right", Width: "120px"},
    },
    Rows: []types.TableRow{
        {
            ID:        "1",
            DataAttrs: map[string]string{"name": "acme corp", "status": "active"},
            Cells: []types.TableCell{
                {Type: "name", Value: "Acme Corp"},
                {Type: "badge", Value: "Active", Variant: "success"},
                {Type: "text", Value: "$12,500.00"},
            },
        },
    },
    Labels: types.TableLabels{
        SearchPlaceholder: "Search clients...",
    },
    EmptyState: types.TableEmptyState{
        Title:   "No clients found",
        Message: "Add your first client to get started.",
    },
}
types.ApplyColumnStyles(table.Columns, table.Rows)
types.ApplyTableSettings(&table)
```

```html
<!-- In your template: -->
{{template "table-card" .Table}}

<!-- Include table scripts (once per page): -->
{{template "table-scripts" .}}
```

---

## Table Structure

Every table is wrapped in a `table-card` div and consists of three regions:

1. **Toolbar** — search input, filter/sort/columns/export/density dropdowns, import button, primary action button
2. **Content** — the `<table>` element with `<thead>` and `<tbody>`
3. **Footer** — entries selector, "Showing X to Y of Z" info, pagination buttons

Setting `Minimal: true` hides the toolbar and footer (useful for embedded settings tables).

---

## Columns

### Standard Columns

```go
Columns: []types.TableColumn{
    {Key: "name",   Label: "Name",   Sortable: true,  MinWidth: "150px"},
    {Key: "email",  Label: "Email",  Sortable: true,  MinWidth: "200px"},
    {Key: "role",   Label: "Role",   Sortable: false, Width: "120px"},
    {Key: "amount", Label: "Amount", Sortable: true,  Width: "100px", Align: "right"},
}
```

| Field      | Type   | Description |
|------------|--------|-------------|
| `Key`      | string | Data attribute key used for sorting and filtering. Must match keys in `DataAttrs`. |
| `Label`    | string | Column header text. |
| `Sortable` | bool   | Makes the column header clickable for sorting, and includes it in the sort/filter dropdowns. |
| `Width`    | string | Fixed width (e.g., `"120px"`, `"20%"`). Column cannot grow or shrink. |
| `MinWidth` | string | Minimum width (e.g., `"150px"`). Column can grow but not shrink below this. |
| `Align`    | string | Horizontal alignment: `"left"` (default), `"center"`, `"right"`. Applied to header and all cells in the column. |

### Column Groups (Multi-Level Headers)

Use `ColumnGroups` instead of `Columns` for two-level headers. Each group renders a parent `<th>` with `colspan` spanning its sub-columns.

```go
ColumnGroups: []types.ColumnGroup{
    {
        Label: "Job Rates",
        Columns: []types.TableColumn{
            {Key: "jobDefault", Label: "Default", Sortable: true, Align: "right"},
            {Key: "jobMinimum", Label: "Minimum", Sortable: true, Align: "right"},
        },
    },
    {
        Label: "Employee Rates",
        Columns: []types.TableColumn{
            {Key: "empDefault", Label: "Default", Sortable: true, Align: "right"},
            {Key: "empMinimum", Label: "Minimum", Sortable: true, Align: "right"},
        },
    },
}
```

### Fixed Layout

Set `FixedLayout: true` to use `table-layout: fixed`. Columns will respect declared widths exactly rather than auto-sizing to content.

---

## Cell Types

Each cell in a row has a `Type` that controls how it renders.

### `text` (default)

Plain text. If no `Type` is set, the cell renders as text.

```go
{Type: "text", Value: "$12,500.00"}
```

### `name`

Name with optional alert icon. Supports linking.

```go
// Plain name
{Type: "name", Value: "Acme Corp"}

// Name with link
{Type: "name", Value: "Acme Corp", Href: "/clients/123"}

// Name with alert icon
{Type: "name", Value: "Acme Corp", Alert: true}
```

### `badge`

Badge with variant styling. Three badge types control the visual style.

```go
// Status badge (default) — pill-shaped, colored background
{Type: "badge", Value: "Active", Variant: "success"}
{Type: "badge", Value: "Inactive", Variant: "error"}
{Type: "badge", Value: "Pending", Variant: "warning"}

// Count badge — smaller, numeric
{Type: "badge", Value: "12", Variant: "info", BadgeType: "count"}

// Type badge — categorical label
{Type: "badge", Value: "Full-Time", Variant: "primary", BadgeType: "type"}
```

### `link`

Clickable link.

```go
{Type: "link", Value: "View Report", Href: "/reports/123"}
```

### `html`

Custom HTML content (use `template.HTML` to prevent escaping).

```go
{Type: "html", HTML: template.HTML(`<span class="custom">Custom content</span>`)}
```

### `author`

Author cell showing name on the first line and date below.

```go
{Type: "author", Value: "Jane Smith", Variant: "Jan 15, 2025"}
```

### `chips`

Expandable tag/chip list. Shows first 3 chips, with a "+N more" toggle button if there are more.

```go
{Type: "chips", Chips: []types.ChipData{
    {Label: "Concrete"},
    {Label: "Framing"},
    {Label: "Electrical"},
    {Label: "Plumbing"},
    {Label: "HVAC"},
}}
```

### `input`

Editable text or number input inside the cell, with optional prefix/suffix.

```go
// Dollar input
{Type: "input", Value: "45.00", InputName: "rate_default", InputPrefix: "$", InputType: "number"}

// Percentage input
{Type: "input", Value: "10", InputName: "markup", InputSuffix: "%", InputType: "number"}

// Text input
{Type: "input", Value: "Notes here", InputName: "notes"}
```

### `select`

Dropdown select inside the cell.

```go
{Type: "select", SelectName: "pay_type", Options: []types.SelectOption{
    {Value: "hourly", Label: "Hourly", Selected: true},
    {Value: "salary", Label: "Salary"},
    {Value: "unit",   Label: "Per Unit"},
}}
```

---

## Rows

### Basic Row

```go
types.TableRow{
    ID:        "123",
    DataAttrs: map[string]string{"name": "acme", "status": "active", "amount": "12500"},
    Cells: []types.TableCell{
        {Type: "name", Value: "Acme Corp"},
        {Type: "badge", Value: "Active", Variant: "success"},
        {Type: "text", Value: "$12,500.00"},
    },
}
```

`DataAttrs` are rendered as `data-*` attributes on the `<tr>`. They are used by client-side search (full text match on row content), filtering (matches against specific `data-*` values), and sorting (reads `data-*` values for comparison).

### Clickable Rows

Set `Href` to make the entire row clickable. Clicks on checkboxes, buttons, links, and action buttons are excluded from navigation.

```go
types.TableRow{
    ID:   "123",
    Href: "/clients/123",
    Cells: []types.TableCell{ /* ... */ },
}
```

### Vertical Alignment

Set `VAlign` on the row to control vertical alignment of all cells. Default is `"top"`.

```go
types.TableRow{
    VAlign: "middle", // "top", "middle", "bottom"
    Cells:  []types.TableCell{ /* ... */ },
}
```

### Row Groups

Use `Groups` instead of `Rows` on the `TableConfig` for collapsible grouped rows. Each group has a toggle header, selection controls, and a row count badge.

```go
Groups: []types.TableRowGroup{
    {
        ID:        "dept-engineering",
        Title:     "Engineering",
        Collapsed: false,
        Rows: []types.TableRow{
            {ID: "1", Cells: []types.TableCell{ /* ... */ }},
            {ID: "2", Cells: []types.TableCell{ /* ... */ }},
        },
    },
    {
        ID:        "dept-sales",
        Title:     "Sales",
        Collapsed: true, // collapsed by default
        Rows: []types.TableRow{
            {ID: "3", Cells: []types.TableCell{ /* ... */ }},
        },
    },
}
```

---

## Row Actions

Per-row action buttons appear in the last column. Set `ShowActions: true` on the `TableConfig`.

```go
types.TableRow{
    ID: "123",
    Cells: []types.TableCell{ /* ... */ },
    Actions: []types.TableAction{
        {Type: "edit", Label: "Edit", Action: "edit", URL: "/action/clients/edit", DrawerTitle: "Edit Client"},
        {Type: "delete", Label: "Delete", Action: "delete", URL: "/action/clients/delete", ItemName: "Acme Corp"},
        {Type: "view", Label: "View", Action: "view", Href: "/clients/123"},
    },
}
```

### Action Types

| Type         | Icon            | Behavior |
|--------------|-----------------|----------|
| `view`       | eye             | Navigates to `Href` or triggers `data-action="view"` |
| `preview`    | eye             | Same icon as view, used for preview context |
| `edit`       | pencil          | Opens sheet/drawer via HTMX with `data-edit-url` |
| `clone`      | copy            | Triggers `data-action="clone"` |
| `delete`     | trash           | Shows confirmation dialog, then POSTs to `data-delete-url` |
| `deactivate` | pause           | Shows confirmation dialog, then POSTs to `data-deactivate-url` |
| `activate`   | play            | Shows confirmation dialog, then POSTs to `data-activate-url` |
| `download`   | download        | Triggers `data-action="download"` |
| `archive`    | archive         | Triggers `data-action="archive"` |
| `check`      | checkmark       | Triggers `data-action="check"` |

### Disabled Actions

```go
{Type: "delete", Label: "Delete", Action: "delete", Disabled: true, DisabledTooltip: "Cannot delete active items"}
```

### Custom Confirmation Messages

```go
{
    Type:           "delete",
    Action:         "delete",
    URL:            "/action/clients/delete",
    ItemName:       "Acme Corp",
    ConfirmTitle:   "Delete Client",
    ConfirmMessage: "This will permanently delete Acme Corp and all associated data. Continue?",
}
```

On mobile, action buttons collapse into an "Actions" dropdown menu.

---

## Toolbar Features

Control which toolbar features are shown via boolean flags on `TableConfig`:

| Field          | Toolbar Element |
|----------------|-----------------|
| `ShowSearch`   | Search text input |
| `ShowFilters`  | Advanced filter builder dropdown |
| `ShowSort`     | Sort column/direction dropdown |
| `ShowColumns`  | Column visibility toggle dropdown |
| `ShowExport`   | Export dropdown (CSV, Excel) |
| `ShowDensity`  | Row density toggle (Default, Comfortable, Compact) |

### Search

- **Client-side**: Debounced (200ms) full-text search across all visible row content. Hides non-matching rows and resets pagination to page 1.
- **Server-side**: Debounced (300ms) search that sends `?search=term&page=1` to the server.

### Filters

Dynamic filter builder where users add conditions with:
- **Column** — auto-populated from sortable columns
- **Operator** — `contains`, `equals`, `starts_with`, `ends_with`, `not_equals`, `is_empty`, `is_not_empty`
- **Value** — free text input
- **Logic connector** — AND / OR between conditions

Client-side filters match against `data-*` attributes on rows. Server-side filters are base64-encoded JSON sent as `?filters=<base64>`.

### Sort

Two ways to sort:
1. **Toolbar dropdown** — lists all sortable columns with asc/desc direction buttons
2. **Column header click** — toggles asc/desc on the clicked column

Client-side sort uses numeric-first comparison (`parseFloat`, fallback to `localeCompare`). Server-side sort sends `?sort=column&dir=asc`.

Tables can declare a default sort:

```go
DefaultSortColumn:    "name",
DefaultSortDirection: "asc", // defaults to "asc" if omitted
```

### Column Visibility

Checkboxes toggle column header and all cells in that column. Preferences are persisted to `localStorage` per table ID and restored on page load.

### Export

- **CSV** — Generates proper CSV with quoted fields and escaped double-quotes. Respects column visibility (hidden columns are excluded) and only includes visible rows.
- **Excel** — Generates an HTML-table-based `.xls` file compatible with Microsoft Excel.

### Density

Three levels applied as a class on `<body>` (page-wide setting):
- **Default** — standard row height
- **Comfortable** — more padding
- **Compact** — tighter rows

Persisted to `localStorage` (`page_density` key) and restored on page load.

### Import Action

Optional button in the toolbar for import workflows.

```go
ImportAction: &types.ImportAction{
    Label:     "Import",
    Icon:      "icon-upload",
    ActionURL: "/action/clients/import", // opens drawer via HTMX
}
// Or with a direct link:
ImportAction: &types.ImportAction{
    Label: "Import",
    Icon:  "icon-upload",
    Href:  "/clients/import",
}
```

### Primary Action

Optional button in the toolbar (e.g., "+ Add Client").

```go
PrimaryAction: &types.PrimaryAction{
    Label:     "Add Client",
    Icon:      "icon-plus",
    ActionURL: "/action/clients/new", // opens drawer via HTMX
}
// Or with a direct link:
PrimaryAction: &types.PrimaryAction{
    Label: "Add Client",
    Icon:  "icon-plus",
    Href:  "/clients/new",
}
```

---

## Bulk Selection & Bulk Actions

Enable row checkboxes and a bulk action toolbar by configuring `BulkActions`.

```go
BulkActions: &types.BulkActionsConfig{
    Enabled:        true,
    SelectedLabel:  "selected",
    SelectAllLabel: "Select all",
    Actions: []types.BulkAction{
        {
            Key:            "delete",
            Label:          "Delete",
            Icon:           "icon-trash",
            Variant:        "danger",
            Endpoint:       "/action/clients/bulk-delete",
            ConfirmTitle:   "Delete Clients",
            ConfirmMessage: "Are you sure you want to delete {{count}} client(s)?",
        },
        {
            Key:      "export",
            Label:    "Export",
            Icon:     "icon-download",
            Variant:  "default",
            Endpoint: "/action/clients/bulk-export",
        },
    },
},
```

### How It Works

1. When any row checkbox is checked, the **bulk toolbar** appears (replacing the normal toolbar) showing the selected count and action buttons.
2. The header "select all" checkbox selects/deselects all visible rows. It shows an indeterminate state when some (but not all) rows are selected.
3. Clicking a bulk action button shows a confirmation dialog (with `{{count}}` replaced by the actual count), then POSTs the selected IDs to the endpoint.
4. After success, the table auto-refreshes via `RefreshURL`.

### Supported Icons

`icon-trash`, `icon-archive`, `icon-download`, `icon-copy`, `icon-edit`, `icon-eye`, `icon-check`, `icon-user`, `icon-user-minus`, `icon-user-plus`, `icon-user-check`, `icon-user-search`, `icon-shield`

### Conditional Visibility

A bulk action button can be hidden unless all selected rows have a specific data attribute set to `"true"`:

```go
{
    Key:              "delete",
    Label:            "Delete",
    Icon:             "icon-trash",
    Variant:          "danger",
    Endpoint:         "/action/items/bulk-delete",
    RequiresDataAttr: "deletable", // button hidden if any selected row has data-deletable != "true"
}
```

In your row definition:

```go
DataAttrs: map[string]string{"deletable": "true"},
```

### Extra Parameters

Send additional form parameters with the bulk action POST:

```go
{
    Key:             "set-role",
    Label:           "Set as Manager",
    Icon:             "icon-user-check",
    Variant:         "primary",
    Endpoint:        "/action/users/bulk-update-role",
    ExtraParamsJSON: `{"role":"manager"}`, // sent as additional form fields
}
```

---

## Pagination

### Client-Side Pagination

The default mode. All rows are rendered in the DOM; JavaScript hides/shows rows based on the current page. The footer shows an entries selector (10/25/50/100), "Showing X to Y of Z entries" info, and page number buttons with smart ellipsis.

No special configuration needed — just include `ShowEntries: true`.

### Server-Side Pagination

Enable by setting `ServerPagination` on the `TableConfig`. In this mode, search, sort, filter, and page changes trigger HTMX requests to the server. Only the current page of rows is rendered in the DOM.

```go
ServerPagination: &types.ServerPagination{
    Enabled:           true,
    Mode:              "offset",                         // "offset" or "cursor"
    PageSize:          25,
    CurrentPage:       1,
    TotalRows:         150,
    TotalPages:        6,
    HasNextPage:       true,
    HasPrevPage:       false,
    PaginationURL:     "/action/clients/table",          // full card refresh URL
    PaginationBodyURL: "/action/clients/table-body",     // body-only targeted swap URL (preferred)
    SearchQuery:       "",
    SortColumn:        "name",
    SortDirection:     "asc",
},
```

After setting the core fields, call `BuildDisplay()` to compute derived display values:

```go
table.ServerPagination.BuildDisplay()
```

This pre-computes `StartRow`, `EndRow`, `PageNumbers` (with smart windowing), and pagination URLs.

### Offset Mode vs Cursor Mode

| Feature | Offset (`"offset"`) | Cursor (`"cursor"`) |
|---------|--------------------|--------------------|
| Page numbers | Yes (1, 2, ... N) | No |
| "Showing X to Y of Z" | Yes | No |
| Jump to page | Yes | No |
| Prev/Next | Yes | Yes |
| Requires total count | Yes (`TotalRows`, `TotalPages`) | No |
| Cursor tokens | No | Yes (`NextCursor`, `PrevCursor`) |
| Best for | Known-size datasets | Large/streaming datasets |

### Targeted Body Swap

When `PaginationBodyURL` is set, the JS uses a **targeted swap** instead of replacing the entire table card. This is faster because:

- Only `<tbody>` content is replaced (toolbar stays untouched)
- Footer is replaced via OOB (out-of-band) swap
- Metadata is carried via a hidden `<div>` that updates the card's `data-*` attributes

The server endpoint should return the `table-body-partial` template:

```html
{{template "table-body-partial" .Table}}
```

This renders a swap carrier `<table>` wrapping the `<tbody>`, plus OOB footer and metadata divs.

### Browser URL Sync

Server-side pagination automatically syncs the browser URL via `history.replaceState`. Only non-default parameters are included:

- `page` — only if > 1
- `size` — only if != 25
- `search` — only if non-empty
- `sort` — only if != "name"
- `dir` — only if != "asc"
- `filters` — only if non-empty

This means the URL stays clean (e.g., `/clients` for page 1, default sort) and supports deep-linking/refresh.

### Query Parameters

The server handler should read these query parameters:

| Parameter | Description | Default |
|-----------|-------------|---------|
| `page`    | Page number (offset mode) | `1` |
| `size`    | Rows per page | `25` |
| `search`  | Search query | `""` |
| `sort`    | Sort column key | `""` |
| `dir`     | Sort direction (`asc`/`desc`) | `"asc"` |
| `filters` | Base64-encoded JSON filter conditions | `""` |
| `cursor`  | Cursor token (cursor mode) | `""` |
| `curdir`  | Cursor direction: `next`/`prev` (cursor mode) | `""` |

---

## Refresh & HTMX Integration

### Table Refresh After Actions

Set `RefreshURL` on the table config so that after row actions (edit, delete, activate, deactivate) or bulk actions, the table automatically refreshes:

```go
RefreshURL: "/action/clients/table",
```

After a successful action POST, the JS fetches this URL via HTMX and replaces the table card with `outerHTML` swap.

### HTMX Re-Initialization

After any HTMX swap that includes table content, the table JS modules automatically re-initialize:

- **Targeted body swap**: Only pagination is re-initialized (toolbar modules stay untouched).
- **Full card swap**: All modules are re-initialized (dropdowns, search, sort, columns, filters, export, density, pagination, selection, actions).

This is handled by the `htmx:afterSettle` event listener in `table.js`.

---

## Labels (i18n)

All text in the table is customizable via the `Labels` field for internationalization.

```go
Labels: types.TableLabels{
    // Search
    SearchPlaceholder: "Buscar...",
    // Toolbar
    Filters: "Filtros",
    Sort:    "Ordenar",
    Columns: "Columnas",
    Export:  "Exportar",
    // Filter panel
    FilterConditions: "Condiciones de filtro",
    ClearAll:         "Limpiar todo",
    AddCondition:     "Agregar condicion",
    Clear:            "Limpiar",
    ApplyFilters:     "Aplicar filtros",
    // Density
    DensityDefault:     "Normal",
    DensityComfortable: "Comodo",
    DensityCompact:     "Compacto",
    // Footer
    Show:         "Mostrar",
    Entries:      "entradas",
    Showing:      "Mostrando",
    To:           "a",
    Of:           "de",
    EntriesLabel: "entradas",
    Prev:         "Anterior",
    Next:         "Siguiente",
    // Other
    SelectAll: "Seleccionar fila",
    Actions:   "Acciones",
},
```

---

## Empty State

Displayed when the table has no rows.

```go
EmptyState: types.TableEmptyState{
    Icon:    "icon-file-text", // icon template name
    Title:   "No clients found",
    Message: "Add your first client to get started.",
},
```

---

## Confirmation Dialogs

Row actions and bulk actions use HTMX-based confirmation dialogs served from `/ui/dialog/confirm`. The dialog system supports:

- **Variant styling**: `default`, `danger`, `primary`, `warning`
- **Dismissal**: Click overlay background, press Escape, or click Cancel
- **Custom event**: Dispatches `dialog:confirm` event on the dialog overlay element

A fallback `window.confirm()` is used if the dialog element is not found in the DOM.

---

## Helper Functions

### `ApplyColumnStyles`

Copies `Align`, `VAlign`, `Width`, and `MinWidth` from column definitions to all cells in all rows. Call this after building your rows.

```go
types.ApplyColumnStyles(table.Columns, table.Rows)
```

### `ApplyTableSettings`

Applies table-level settings to all rows (e.g., propagates `ShowCheckbox` when bulk actions are enabled). Call this after building your config.

```go
types.ApplyTableSettings(&table)
```

### `BuildDisplay`

Pre-computes server pagination display fields (`StartRow`, `EndRow`, `PageNumbers`, URLs). Call this after setting the pagination core fields.

```go
table.ServerPagination.BuildDisplay()
```

---

## JavaScript Modules

The table JS is split into 14 modules loaded in order:

| # | Module | Global | Purpose |
|---|--------|--------|---------|
| 1 | `table-core.js` | `TableCore` | Shared utilities: debounce, close dropdowns, update info |
| 2 | `table-server.js` | `TableServer` | Server-side URL builder, targeted swap, browser URL sync |
| 3 | `table-dropdowns.js` | `TableDropdowns` | Toolbar dropdown toggle, click-outside/escape close |
| 4 | `table-search.js` | `TableSearch` | Client-side and server-side search |
| 5 | `table-sort.js` | `TableSort` | Client-side and server-side sort, default sort |
| 6 | `table-columns.js` | `TableColumns` | Column visibility toggle with localStorage persistence |
| 7 | `table-filters.js` | `TableFilters` | Dynamic filter builder with AND/OR logic |
| 8 | `table-export.js` | `TableExport` | CSV and Excel export |
| 9 | `table-density.js` | `TableDensity` | Row density toggle with localStorage persistence |
| 10 | `table-pagination.js` | `TablePagination` | Client-side and server-side pagination |
| 11 | `table-selection.js` | `TableSelection` | Bulk row selection with event cleanup |
| 12 | `table-actions.js` | `TableActions` | Row actions (edit/delete/activate/deactivate) and row navigation |
| 13 | `table-dialog.js` | `TableDialog` | Standalone confirmation dialog factory |
| 14 | `table.js` | `TableToolbar` | Main entry point, initializes all modules, handles HTMX re-init |

### Public API (`window.TableToolbar`)

A unified backwards-compatible API is exposed on `window.TableToolbar`:

```js
// Sort
TableToolbar.sortTable(tbody, column, direction)
TableToolbar.updateTableSortIndicators(table, column, direction)

// Filters
TableToolbar.applyFilters(table, conditions)
TableToolbar.clearFilters(table)
TableToolbar.getTableColumns(table)

// Export
TableToolbar.exportToCSV(table, filename)
TableToolbar.exportToExcel(table, filename)

// Density
TableToolbar.setDensity('compact') // 'default', 'comfortable', 'compact'

// Pagination
TableToolbar.updatePagination(tableId)
TableToolbar.applyPagination(tableId)
TableToolbar.setRowFilterState(tableId, filterFn)
TableToolbar.getPaginationState(tableId)

// Selection
TableToolbar.clearAllSelections(table, card, selectedIds, selectedCountEl, selectAllCheckbox)

// Dialogs
TableToolbar.showConfirmDialog({ title, message, confirmLabel, variant, onConfirm })

// Utilities
TableToolbar.closeAllDropdowns()
TableToolbar.updateTableInfo(tableId)
```

---

## Full Example

```go
table := types.TableConfig{
    ID:                   "clientsTable",
    CardClass:            "clients-table-card",
    RefreshURL:           "/action/clients/table",
    ShowSearch:           true,
    ShowFilters:          true,
    ShowSort:             true,
    ShowColumns:          true,
    ShowExport:           true,
    ShowDensity:          true,
    ShowEntries:          true,
    ShowActions:          true,
    DefaultSortColumn:    "name",
    DefaultSortDirection: "asc",
    Columns: []types.TableColumn{
        {Key: "name",       Label: "Client Name", Sortable: true, MinWidth: "200px"},
        {Key: "status",     Label: "Status",      Sortable: true, Width: "120px"},
        {Key: "contact",    Label: "Contact",     Sortable: true, MinWidth: "150px"},
        {Key: "totalValue", Label: "Total Value",  Sortable: true, Width: "130px", Align: "right"},
    },
    Rows: buildClientRows(clients), // your row builder function
    Labels: types.TableLabels{
        SearchPlaceholder: "Search clients...",
        SelectAll:         "Select row",
        Actions:           "Actions",
    },
    EmptyState: types.TableEmptyState{
        Title:   "No clients yet",
        Message: "Create your first client to get started.",
    },
    PrimaryAction: &types.PrimaryAction{
        Label:     "Add Client",
        Icon:      "icon-plus",
        ActionURL: "/action/clients/new",
    },
    BulkActions: &types.BulkActionsConfig{
        Enabled: true,
        Actions: []types.BulkAction{
            {
                Key:            "delete",
                Label:          "Delete",
                Icon:           "icon-trash",
                Variant:        "danger",
                Endpoint:       "/action/clients/bulk-delete",
                ConfirmTitle:   "Delete Clients",
                ConfirmMessage: "Are you sure you want to delete {{count}} client(s)? This cannot be undone.",
            },
        },
    },
}
types.ApplyColumnStyles(table.Columns, table.Rows)
types.ApplyTableSettings(&table)
```
