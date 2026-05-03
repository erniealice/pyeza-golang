package types

import (
	"html/template"
	"strconv"
)

// FilterColumnType identifies the input type rendered in the filter panel
type FilterColumnType string

const (
	FilterTypeString  FilterColumnType = "string"
	FilterTypeNumeric FilterColumnType = "numeric"
	FilterTypeDate    FilterColumnType = "date"
	FilterTypeMoney   FilterColumnType = "money"
	FilterTypeStatus  FilterColumnType = "status"
	FilterTypeToggle  FilterColumnType = "toggle"
	FilterTypeEmail   FilterColumnType = "email"
	FilterTypePhone   FilterColumnType = "phone"

	// Phase 8 widget types — mirror sort kinds. Auto-derived from cell type via DeriveFilterType.
	FilterTypeNumericRange FilterColumnType = "numeric-range" // money/number cells: =, ≠, >, ≥, <, ≤, between (default)
	FilterTypeDateRange    FilterColumnType = "date-range"    // datetime/author cells: presets + on/before/after/between
	FilterTypeList         FilterColumnType = "list"          // badge/select cells: ListFilter IN against option values
	FilterTypeListLabel    FilterColumnType = "list-label"    // chips/person cells: ListFilter IN against rendered labels
	FilterTypeBoolean      FilterColumnType = "boolean"       // bool cells: tri-state Any/Yes/No
)

// FilterOption is a single option for FilterTypeStatus columns (value:label pair)
type FilterOption struct {
	Value string
	Label string
}

// ActiveFilter represents a currently-applied filter rendered as a chip.
//
// Phase 8: ChipText is the canonical chip-text source. When set, the template renders
// it verbatim and JS does not reformat. Label + DisplayValue remain for legacy callers
// that haven't migrated yet — the template falls back to "{Label}: {DisplayValue}".
type ActiveFilter struct {
	Key          string // column key (matches TypedFilter.field)
	Label        string // legacy: human-readable column label
	DisplayValue string // legacy: human-readable filter value
	ChipText     string // Phase 8: pre-formatted chip text (e.g. "Price: ≥ ₱1,000.00"); takes precedence over Label+DisplayValue when non-empty
}

// TableColumn defines a column in a data table
type TableColumn struct {
	Key   string // View-facing column key (data attribute, label lookup, filter binding)
	Label string // Column header label
	// SortKey is the wire/SQL key sent to the server when this column header is
	// clicked. Empty = use Key. Set this when the on-screen value is computed from
	// a joined or derived field whose Key isn't a real SQL column (e.g. a person
	// cell whose name comes from a joined user row → Key:"representative",
	// SortKey:"rep_name"; the adapter then maps "rep_name" to its SQL expression
	// via SortSpec.ColMap).
	SortKey string
	// Sortable controls whether the header is clickable / appears in the Sort
	// dropdown. Positive form, but kept opt-in/opt-out compatible with the legacy
	// NoSort flag via ApplyTableSettings, which sets Sortable = !NoSort during
	// the migration shim. Read .Sortable from templates and helpers; ignore
	// NoSort except in the shim itself.
	Sortable bool
	// NoSort is the legacy negative form. Still honored during the migration
	// shim — set to true to disable sorting. Prefer leaving unset and using the
	// positive Sortable field on new code. Will be removed after the call-site
	// sweep flips every column to opt-in Sortable.
	NoSort bool
	// SortKind influences the initial sort direction picked when the user first clicks a header,
	// and the labels rendered in the toolbar Sort dropdown.
	// Allowed values: "text" (A→Z asc, default), "number" (High→Low desc default),
	// "date" (Newest→Oldest desc default), "enum" (grouped, asc default).
	// Empty = auto-derived from the first cell type in the column via DeriveSortKind.
	SortKind   string
	Width      string // Optional fixed width (e.g., "200px", "20%") — prefer WidthClass
	WidthClass string // Optional density-responsive width class (e.g., "col-3xl") — preferred over Width
	MinWidth   string // Optional minimum width (e.g., "100px") - column can grow but not shrink below this
	Align      string // Optional horizontal alignment: "left" (default), "center", "right"
	VAlign     string // Optional vertical alignment: "top" (default), "middle", "bottom"
	// Filterable mirrors Sortable: positive form, set by ApplyTableSettings from
	// !NoFilter during the shim. Read .Filterable from templates and helpers.
	Filterable bool
	// NoFilter is the legacy negative form. See NoSort for migration notes.
	NoFilter      bool
	FilterType    FilterColumnType // Input type rendered in filter panel; empty = auto-derived from cell type via DeriveFilterType
	FilterOptions []FilterOption   // For list filters: checkbox options
}

// EffectiveSortKey returns the wire/SQL key the browser should send for this
// column. Prefers SortKey when set, falling back to Key. Used by both the
// template (data-sort=) and the view-layer SortableKeys helper so they stay in
// agreement.
func (c TableColumn) EffectiveSortKey() string {
	if c.SortKey != "" {
		return c.SortKey
	}
	return c.Key
}

// IsSortable returns the effective sortable state, bridging the legacy NoSort
// negative form to the positive Sortable field. Once the call-site sweep
// removes NoSort this collapses to `return c.Sortable`.
func (c TableColumn) IsSortable() bool {
	return c.Sortable || !c.NoSort
}

// IsFilterable mirrors IsSortable for the filter axis.
func (c TableColumn) IsFilterable() bool {
	return c.Filterable || !c.NoFilter
}

// ColumnGroup defines a group of columns with a shared parent header.
// Used for multi-level table headers (e.g., "Job Rates" spanning "Default" and "Minimum" sub-columns).
type ColumnGroup struct {
	Label   string        // Group header label (e.g., "Job Rates")
	Columns []TableColumn // Sub-columns within this group
}

// SelectOption is the canonical dropdown option shape for pyeza form components.
//
// This single struct must carry EVERY field that the form-group select component
// (components/form-group.html) and the auto-complete component
// (components/auto-complete.html) may access on an option entry. The templates
// unconditionally reference these fields via struct-field access (e.g.
// `data-description="{{.Description}}"`) and Go's html/template errors hard —
// not silently — when a referenced field is absent. That failure mode previously
// caused drawer forms to stop rendering mid-way, dropping the sheet-form footer
// (Save/Cancel buttons) from the browser output.
//
// Every view that previously declared a local SelectOption/PlanOption/etc. struct
// feeding a form-group select or auto-complete should import this type instead of
// redefining its own, so the field set stays in lockstep with the templates.
//
// Consumers:
//   - form-group.html (Type="select"): Value, Label, Selected, Description
//   - auto-complete.html (filter mode Options): Value, Label, Selected, Description, Disabled
//   - TableCell Options (select-type table cells): Value, Label, Selected
type SelectOption struct {
	Value       string // Option value attribute
	Label       string // Option display text
	Selected    bool   // Whether this option is selected
	Description string // Optional helper text — surfaced via data-description on <option>;
	//        must be present (even if empty) because form-group.html always reads it.
	Disabled bool // Whether this option is disabled (auto-complete only); renders
	//        the `disabled` class + aria-disabled on the option entry.
}

// SelectOptionGroup bundles a set of SelectOptions under a shared header.
// Passed to the auto-complete component via the OptionGroups param; each group
// renders a non-selectable header above its options. Group headers stay
// visible as long as at least one child option matches the active filter.
type SelectOptionGroup struct {
	GroupLabel string         // Header text shown above the group's options
	Options    []SelectOption // Options belonging to this group
}

// PersonData holds a single person's display info for person cell types
type PersonData struct {
	Name     string // Full name (first + last)
	Email    string // Email address (optional, shown below name)
	Src      string // Avatar image URL (optional)
	Fallback string // Initials fallback (e.g., "JD")
	Color    string // Avatar color: terracotta, sage, navy, amber, plum (auto-assigned from Name if empty)
	Status   string // Avatar status dot: online, offline, busy, away (optional)
}

// TableCell defines a cell value with optional formatting
type TableCell struct {
	Type       string        // Cell type: "text", "badge", "name", "link", "chips", "html", "author", "input", "select", "money", "datetime", "single-person", "multi-person", "email", "phone", "number"
	Value      string        // Text value to display
	Variant    string        // For badges: variant class (e.g., "success", "error", "warning")
	BadgeType  string        // For badges: badge type ("status", "count", "type") - defaults to "status"
	Alert      bool          // For name cells: show alert icon
	Href       string        // For links: href attribute
	HTML       template.HTML // For custom HTML content
	Label      string        // Column label for mobile card view (set automatically from column via ApplyColumnStyles)
	Align      string        // Horizontal alignment (set automatically from column, do not set manually)
	VAlign     string        // Vertical alignment: "top" (default), "middle", "bottom"
	Width      string        // Width (set automatically from column, do not set manually)
	WidthClass string        // Density-responsive width class (set automatically from column, do not set manually)
	MinWidth   string        // MinWidth (set automatically from column, do not set manually)
	// Chip fields for "chips" type
	Chips        []ChipData // For "chips" type: visible chip labels (max N)
	ChipOverflow int        // Count of hidden chips beyond max visible
	ChipTooltip  string     // Tooltip showing all chip names
	// Input fields for "input" type
	InputName   string // Form field name attribute
	InputPrefix string // Prefix text displayed before input (e.g., "$")
	InputSuffix string // Suffix text displayed after input (e.g., "%")
	InputType   string // HTML input type: "text" (default), "number"
	// Money fields for "money" type
	Currency string // Currency code prefix (e.g., "PHP", "USD")
	CentMode bool   // If true, Value is in centavos/cents (divide by 100 before formatting)
	// Select fields for "select" type
	SelectName string         // Form field name attribute
	Options    []SelectOption // Dropdown options
	// Person fields for "single-person" and "multi-person" types
	Person  *PersonData  // For "single-person": the person to display
	Persons []PersonData // For "multi-person": list of people to display
	// Number fields for "number" type
	NumberPrefix string // Prefix text (e.g., "#")
	NumberSuffix string // Suffix text (e.g., "units", "%")
	// Datetime split fields for "datetime" type — when both populated, the
	// template renders the cell stacked (date on top, time muted/smaller below).
	// When empty, the template falls back to a single-line .Value rendering.
	DateText string // Date portion (e.g., "Jan 02, 2026")
	TimeText string // Time portion (e.g., "3:04 PM")
	// TestID is an optional data-testid override for the cell's inner container.
	// When set, the cell wrapper (e.g., .table-cell-chips div) renders with data-testid="{{.TestID}}".
	TestID string
	// CSVValue is an explicit per-cell override for CSV export. When non-empty,
	// CellCSV returns this verbatim instead of deriving from Type. Use it when
	// the type-default formatter is wrong for a specific column (e.g., you want
	// the raw centavo integer instead of the formatted decimal, or an enum's
	// machine code instead of its localized label).
	CSVValue string
}

// CellCSV returns the canonical CSV-export representation of a TableCell.
// Order of resolution:
//  1. Explicit override via c.CSVValue.
//  2. Type-aware default that strips presentational chrome (currency symbols,
//     icons, multi-line layouts) and joins multi-value fields with "; ".
//  3. Fallback to c.Value.
//
// The goal is to keep export output consistent across every list page so an
// analyst opening the CSV gets clean numeric/date/text columns, not whatever
// happened to land in textContent at render time.
func CellCSV(c TableCell) string {
	if c.CSVValue != "" {
		return c.CSVValue
	}
	switch c.Type {
	case "money", "number":
		// Numeric. Drop currency prefix and number prefix/suffix — those are
		// presentation. Caller can override via CSVValue if they want raw cents.
		return c.Value
	case "datetime":
		if c.DateText != "" && c.TimeText != "" {
			return c.DateText + " " + c.TimeText
		}
		return c.Value
	case "chips":
		out := make([]string, 0, len(c.Chips))
		for _, ch := range c.Chips {
			out = append(out, ch.Label)
		}
		return joinSemi(out)
	case "multi-person":
		out := make([]string, 0, len(c.Persons))
		for _, p := range c.Persons {
			out = append(out, p.Name)
		}
		return joinSemi(out)
	case "single-person":
		if c.Person != nil {
			return c.Person.Name
		}
		return c.Value
	case "author":
		// "Name (date)" — the variant carries the date; export both for context.
		if c.Variant != "" {
			return c.Value + " (" + c.Variant + ")"
		}
		return c.Value
	case "html":
		// Raw HTML can't be safely flattened without a parser. Caller should set
		// CSVValue when this matters; default to Value (often empty for html cells).
		return c.Value
	default:
		// text, name, link, email, phone, badge, select, input, "" — Value is the
		// human-meaningful payload in every case.
		return c.Value
	}
}

func joinSemi(parts []string) string {
	switch len(parts) {
	case 0:
		return ""
	case 1:
		return parts[0]
	}
	out := parts[0]
	for _, p := range parts[1:] {
		out += "; " + p
	}
	return out
}

// DeriveSortKind returns the SortKind implied by a TableCell.Type.
// Used by ApplyColumnStyles to memoize SortKind onto each TableColumn from its first row's cell.
// Returns "" for unknown cell types (the template treats this as "text" by default).
func DeriveSortKind(cellType string) string {
	switch cellType {
	case "number", "money":
		return "number"
	case "datetime", "author":
		return "date"
	case "badge", "select":
		return "enum"
	case "text", "name", "link", "email", "phone", "html", "chips", "single-person", "multi-person", "input":
		return "text"
	default:
		return ""
	}
}

// DeriveFilterType returns the FilterColumnType implied by a TableCell.Type.
// Used by ApplyColumnStyles to memoize FilterType onto each TableColumn from its first row's cell.
// hasOptions=true biases badge/select cells toward FilterTypeList (option values) over the bare badge
// default; chips/person cells always derive to FilterTypeListLabel (label-match against rendered text).
// Returns "" for unknown cell types (the JS treats this as "string" by default).
func DeriveFilterType(cellType string, hasOptions bool) FilterColumnType {
	switch cellType {
	case "money", "number":
		return FilterTypeNumericRange
	case "datetime", "author":
		return FilterTypeDateRange
	case "badge", "select":
		if hasOptions {
			return FilterTypeList
		}
		return FilterTypeList
	case "chips", "multi-person", "single-person":
		return FilterTypeListLabel
	case "email", "phone", "text", "name", "link", "html":
		return FilterTypeString
	case "input":
		return "" // interactive cell — skip filtering
	default:
		return FilterTypeString
	}
}

// ApplyColumnStyles copies alignment, width, minWidth, vAlign, and label from columns to cells in all rows.
// Call this after building rows to ensure cells inherit column styles.
func ApplyColumnStyles(columns []TableColumn, rows []TableRow) {
	// Memoize SortKind for each column from the first row's matching cell, unless caller already set it.
	if len(rows) > 0 {
		for j := range columns {
			if columns[j].SortKind != "" {
				continue
			}
			if j < len(rows[0].Cells) {
				columns[j].SortKind = DeriveSortKind(rows[0].Cells[j].Type)
			}
		}
	}
	// Memoize FilterType for each column from the first row's matching cell, unless caller already set it.
	if len(rows) > 0 {
		for j := range columns {
			if columns[j].FilterType != "" {
				continue
			}
			if j < len(rows[0].Cells) {
				columns[j].FilterType = DeriveFilterType(rows[0].Cells[j].Type, len(columns[j].FilterOptions) > 0)
			}
		}
	}
	for i := range rows {
		for j := range rows[i].Cells {
			if j < len(columns) {
				if columns[j].Label != "" {
					rows[i].Cells[j].Label = columns[j].Label
				}
				if columns[j].Align != "" {
					rows[i].Cells[j].Align = columns[j].Align
				}
				if columns[j].VAlign != "" {
					rows[i].Cells[j].VAlign = columns[j].VAlign
				}
				if columns[j].Width != "" {
					rows[i].Cells[j].Width = columns[j].Width
				}
				if columns[j].WidthClass != "" {
					rows[i].Cells[j].WidthClass = columns[j].WidthClass
				}
				if columns[j].MinWidth != "" {
					rows[i].Cells[j].MinWidth = columns[j].MinWidth
				}
				// Default right-align for money cells
				if rows[i].Cells[j].Type == "money" && rows[i].Cells[j].Align == "" {
					rows[i].Cells[j].Align = "right"
				}
			}
		}
	}
}

// ApplyTableSettings applies table-level settings to all rows.
// Call this after building rows to ensure rows inherit table settings.
func ApplyTableSettings(config *TableConfig) {
	// If BulkActions is enabled, ensure ShowCheckbox is true
	if config.BulkActions != nil && config.BulkActions.Enabled {
		config.ShowCheckbox = true
	}
	for i := range config.Rows {
		config.Rows[i].ShowCheckbox = config.ShowCheckbox
	}

	// Migration shim: normalize Sortable/Filterable from legacy NoSort/NoFilter
	// so templates can read the positive fields without each call site needing
	// to know about both. Existing code that only sets NoSort:true continues to
	// work — Sortable derives from !NoSort. The eventual sweep flips every
	// column to declare Sortable explicitly and removes NoSort, at which point
	// this loop collapses to a no-op (or vanishes with NoSort itself).
	for i := range config.Columns {
		c := &config.Columns[i]
		c.Sortable = c.Sortable || !c.NoSort
		c.Filterable = c.Filterable || !c.NoFilter
	}
	for gi := range config.ColumnGroups {
		for i := range config.ColumnGroups[gi].Columns {
			c := &config.ColumnGroups[gi].Columns[i]
			c.Sortable = c.Sortable || !c.NoSort
			c.Filterable = c.Filterable || !c.NoFilter
		}
	}
}

// TableAction defines an action button for a table row
type TableAction struct {
	Type            string // Action type: "view", "edit", "clone", "delete", "download"
	Label           string // Tooltip/aria-label text
	Action          string // data-action value for JS handling
	TestID          string // Optional data-testid override; auto-generated from Action/Type + row ID if empty
	Href            string // Optional href for link-based actions
	URL             string // Action URL for HTMX calls (used as edit-url or delete-url based on type)
	DrawerTitle     string // Title for the form drawer (edit actions)
	ItemName        string // Item name for delete confirmation message
	ConfirmTitle    string // Custom title for confirmation dialog
	ConfirmMessage  string // Custom message for confirmation dialog
	Disabled        bool   // If true, action is disabled (grayed out, not clickable)
	DisabledTooltip string // Tooltip shown when hovering over disabled action
}

// TableRow defines a row in the table
type TableRow struct {
	ID           string            // Row identifier
	Href         string            // Optional: URL to navigate when row is clicked
	DataAttrs    map[string]string // Data attributes for filtering/sorting
	Cells        []TableCell       // Cell values
	Actions      []TableAction     // Row action buttons
	ShowCheckbox bool              // Show row checkbox (set automatically)
	VAlign       string            // Vertical alignment for all cells in row: "top" (default), "middle", "bottom"
}

// TableRowGroup represents a group of rows with a collapsible header
type TableRowGroup struct {
	ID        string            // Group identifier
	Title     string            // Group title/header
	Subtitle  string            // Optional subtitle for the group
	Collapsed bool              // Whether the group is collapsed by default
	Rows      []TableRow        // Rows in this group
	DataAttrs map[string]string // Data attributes for the group
}

// TableEmptyState defines the empty state message
type TableEmptyState struct {
	Icon    string // Icon template name
	Title   string // Empty state title
	Message string // Empty state message
}

// TableLabels holds table-related labels
type TableLabels struct {
	// Search
	Search            string
	SearchPlaceholder string
	// Toolbar buttons
	Filters string
	Sort    string
	Columns string
	Export  string
	// Filter panel
	FilterConditions string
	ClearAll         string
	AddCondition     string
	Clear            string
	ApplyFilters     string
	// Density options
	DensityLabel       string // Accessible label for the density toolbar button
	DensityDense       string
	DensityDefault     string
	DensityComfortable string
	DensityCompact     string
	// Footer/Pagination
	EntriesPerPage string // Accessible label for the entries-per-page selector
	Show           string
	Entries        string
	Showing        string
	To             string
	Of             string
	EntriesLabel   string
	SelectAll      string
	Actions        string
	Prev           string
	Next           string
	// Bulk select-all mode machine labels (Phase 5)
	BulkSelectAllPage        string // "Select All items in this page"
	BulkSelectAllAcrossPages string // "Select all {N} across all pages" — JS does literal .replace('{N}', totalRows)
	BulkClearSelection       string // "Clear selection"
	// Column selector sort-lock (Phase 4)
	ColumnSortLockedHint string // Hint shown below the disabled column-toggle checkbox when the column is the active sort. e.g. "Change the sort column before hiding this one."
	// Sort dropdown labels per SortKind (Phase 3). Rendered next to each direction button in the toolbar Sort dropdown.
	SortAscText    string // "A → Z"
	SortDescText   string // "Z → A"
	SortAscNumber  string // "Low → High"
	SortDescNumber string // "High → Low"
	SortAscDate    string // "Oldest → Newest"
	SortDescDate   string // "Newest → Oldest"
	SortAscEnum    string // "Grouped"
	SortDescEnum   string // "Grouped (reverse)"
	// Filter widget operator labels (Phase 8). Rendered inside the filter panel's per-row operator <select>.
	FilterOpContains   string // "contains"
	FilterOpEquals     string // "equals"
	FilterOpStartsWith string // "starts with"
	FilterOpEndsWith   string // "ends with"
	FilterOpNotEquals  string // "does not equal"
	FilterOpBetween    string // "between"
	FilterOpEq         string // "="
	FilterOpNeq        string // "≠"
	FilterOpGt         string // ">"
	FilterOpGte        string // "≥"
	FilterOpLt         string // "<"
	FilterOpLte        string // "≤"
	FilterOpOn         string // "on"
	FilterOpBefore     string // "before"
	FilterOpAfter      string // "after"
	FilterOpIn         string // "in"
	FilterOpNotIn      string // "not in"
	// Date preset chips (Phase 8).
	FilterPresetToday  string // "Today"
	FilterPreset7d     string // "Last 7 days"
	FilterPreset30d    string // "Last 30 days"
	FilterPresetMonth  string // "This month"
	FilterPresetCustom string // "Custom"
	// Boolean tri-state widget labels (Phase 8).
	FilterAny string // "Any"
	FilterYes string // "Yes"
	FilterNo  string // "No"
	// Filter widget placeholders (Phase 8).
	FilterSearchPlaceholder string // "Search…" (list widget option search)
	FilterMinPlaceholder    string // "Min" (numeric-range)
	FilterMaxPlaceholder    string // "Max" (numeric-range)
}

// PrimaryAction defines a primary action button for the table toolbar
type PrimaryAction struct {
	Label           string // Button label text
	Href            string // Button href (for link-based actions)
	Icon            string // Icon template name (e.g., "icon-plus")
	ActionURL       string // HTMX action URL for form loading
	Disabled        bool   // If true, render as disabled button (no click, no HTMX)
	DisabledTooltip string // Tooltip shown when hovering over disabled button
	TestID          string // Optional custom data-testid attribute for the button
}

// BulkAction defines an action available when multiple rows are selected
type BulkAction struct {
	Key     string // Unique identifier for the action
	Label   string // Display text
	Icon    string // Icon template name (e.g., "icon-trash")
	Variant string // Button variant: "default", "danger", "primary", "warning"
	// Unified bulk action configuration (for bulk-action.js):
	Endpoint        string // POST endpoint URL (e.g., "/action/regulations/pay-items/bulk-delete")
	ConfirmTitle    string // Dialog title (e.g., "Delete Pay Items")
	ConfirmMessage  string // Message with {{count}} placeholder (e.g., "Delete {{count}} pay item(s)?")
	ExtraParamsJSON string // Pre-rendered JSON for extra form params (e.g., '{"bulk_action":"set-admin-manager"}')
	// Dynamic visibility based on selected rows:
	RequiresDataAttr string // Data attribute name that must be "true" on ALL selected rows (e.g., "deletable")
}

// BulkActionsConfig holds configuration for bulk selection mode
type BulkActionsConfig struct {
	Enabled        bool         // Enable bulk selection mode
	Actions        []BulkAction // Available bulk actions
	SelectAllLabel string       // Label for "Select all" text
	SelectedLabel  string       // Label template for selected count (e.g., "{count} selected")
	CancelLabel    string       // Label for cancel/clear selection button
}

// TableConfig holds all configuration for the table component
type TableConfig struct {
	ID                    string             // Table ID
	ToolbarPrefix         template.HTML      // Optional HTML rendered at the start of the toolbar (before search)
	ToolbarPrefixTemplate string             // Template name to render via renderContent (preferred over ToolbarPrefix)
	ToolbarPrefixData     any                // Data passed to ToolbarPrefixTemplate
	Title                 string             // Table title (legacy, not displayed in toolbar)
	Caption               string             // Accessible caption for screen readers (falls back to Title, then "Data table")
	CardClass             string             // Additional class for table-card
	RefreshURL            string             // URL to fetch table partial for HTMX refresh (e.g., "/action/user/user-division/table")
	Columns               []TableColumn      // Column definitions (single-level headers)
	ColumnGroups          []ColumnGroup      // Nested column groups (alternative to Columns for multi-level headers)
	Rows                  []TableRow         // Row data (use Groups instead for grouped tables)
	Groups                []TableRowGroup    // Row groups (alternative to Rows for grouped tables)
	Minimal               bool               // When true, hide toolbar and footer (for embedded/settings tables)
	ShowCheckbox          bool               // Show row checkboxes (legacy, use BulkActions.Enabled instead)
	ShowSearch            bool               // Show search input in toolbar
	ShowFilters           bool               // Show advanced filter builder in toolbar
	ShowSort              bool               // Show sort dropdown in toolbar
	ShowColumns           bool               // Show column visibility toggle in toolbar
	ShowExport            bool               // Show export dropdown (CSV/Excel) in toolbar
	ShowDensity           bool               // Show row density toggle in toolbar
	DefaultDensity        string             // Default density: "default", "comfortable", "compact" (defaults to "default")
	ShowEntries           bool               // Show entries selector in footer
	ShowActions           bool               // Show actions column
	DefaultSortColumn     string             // Column key for default sort (e.g., "name")
	DefaultSortDirection  string             // "asc" or "desc" (defaults to "asc")
	Labels                TableLabels        // Table labels
	EmptyState            TableEmptyState    // Empty state configuration
	ImportAction          *ImportAction      // Optional import action button in toolbar (before primary action)
	PrimaryAction         *PrimaryAction     // Optional primary action button in toolbar
	BulkActions           *BulkActionsConfig // Optional bulk selection configuration
	FixedLayout           bool               // When true, use table-layout: fixed (columns respect declared widths exactly)
	NameColumnLabel       string             // Optional header label for the auto-generated name column (first column). Blank = no label.
	ServerPagination      *ServerPagination  // Optional server-side pagination configuration (nil = client-side mode)
	TotalsRow             []TableCell        // Optional totals row rendered in <tfoot> (e.g. for accounting reports)
}

// ImportAction defines the import button configuration
type ImportAction struct {
	Label     string // Button label (e.g., "Import")
	Icon      string // Icon name (e.g., "icon-upload")
	Href      string // Link URL (for anchor)
	ActionURL string // HTMX action URL (for opening a drawer/modal)
}

// ServerPagination holds server-side pagination state
// When enabled, search, sort, and filter operations are handled server-side
type ServerPagination struct {
	Enabled           bool   // true = server-side, false/nil = client-side (default)
	Mode              string // "offset" (page numbers) or "cursor" (keyset, prev/next only)
	PageSize          int    // current page size
	CurrentPage       int    // current page number (offset mode)
	TotalRows         int    // total matching rows (offset mode; optional for cursor)
	TotalPages        int    // pre-calculated total pages (offset mode)
	StartRow          int    // pre-calculated first row number on current page (1-based, for display)
	EndRow            int    // pre-calculated last row number on current page (for display)
	HasNextPage       bool   // more rows forward?
	HasPrevPage       bool   // more rows backward?
	NextCursor        string // cursor mode: cursor token for next page (base64 encoded)
	PrevCursor        string // cursor mode: cursor token for previous page (base64 encoded)
	SearchQuery       string // current search term (reflected in search input)
	SortColumn        string // current sort column key
	SortDirection     string // current sort direction ("asc" or "desc")
	FiltersJSON       string // current advanced filters (raw JSON string)
	PaginationURL     string // base URL for HTMX page requests
	PaginationBodyURL string // base URL for body-only targeted swap requests

	// Pre-computed display fields — populated by BuildDisplay()
	PageNumbers   []PageNumber // page buttons for offset mode (with smart windowing)
	PrevPageURL   string       // HTMX URL for prev page button (offset mode)
	NextPageURL   string       // HTMX URL for next page button (offset mode)
	PrevCursorURL string       // HTMX URL for prev button (cursor mode)
	NextCursorURL string       // HTMX URL for next button (cursor mode)

	// Active filter chips — populated by view controller from parsed filters
	ActiveFilters []ActiveFilter
}

// PageNumber represents a single page button in the pagination UI
type PageNumber struct {
	Number   int    // page number (0 for ellipsis)
	Active   bool   // true if this is the current page
	Ellipsis bool   // true if this is a "..." separator
	URL      string // pre-built HTMX URL for this page
}

// BuildDisplay pre-computes all display fields (StartRow, EndRow, PageNumbers, URLs).
// Call this after setting the core fields (CurrentPage, PageSize, TotalRows, TotalPages, etc.)
func (sp *ServerPagination) BuildDisplay() {
	if sp.Mode == "offset" {
		sp.buildOffsetDisplay()
	} else if sp.Mode == "cursor" {
		sp.buildCursorDisplay()
	}
}

// buildOffsetDisplay computes offset-mode display fields
func (sp *ServerPagination) buildOffsetDisplay() {
	// StartRow and EndRow
	sp.StartRow = (sp.CurrentPage-1)*sp.PageSize + 1
	sp.EndRow = sp.CurrentPage * sp.PageSize
	if sp.EndRow > sp.TotalRows {
		sp.EndRow = sp.TotalRows
	}
	if sp.TotalRows == 0 {
		sp.StartRow = 0
		sp.EndRow = 0
	}

	// HasNextPage and HasPrevPage
	sp.HasNextPage = sp.CurrentPage < sp.TotalPages
	sp.HasPrevPage = sp.CurrentPage > 1

	// Prev/Next page URLs
	if sp.HasPrevPage {
		sp.PrevPageURL = sp.buildPageURL(sp.CurrentPage - 1)
	}
	if sp.HasNextPage {
		sp.NextPageURL = sp.buildPageURL(sp.CurrentPage + 1)
	}

	// Page number buttons
	sp.PageNumbers = buildPageNumbers(sp.CurrentPage, sp.TotalPages, sp.buildPageURL)
}

// buildCursorDisplay computes cursor-mode display fields
func (sp *ServerPagination) buildCursorDisplay() {
	if sp.HasPrevPage && sp.PrevCursor != "" {
		sp.PrevCursorURL = sp.buildCursorURL(sp.PrevCursor, "prev")
	}
	if sp.HasNextPage && sp.NextCursor != "" {
		sp.NextCursorURL = sp.buildCursorURL(sp.NextCursor, "next")
	}
}

// buildCursorURL constructs the HTMX URL for cursor navigation
func (sp *ServerPagination) buildCursorURL(cursor, direction string) string {
	url := sp.PaginationURL + "?cursor=" + cursor + "&curdir=" + direction + "&size=" + itoa(sp.PageSize)
	if sp.SearchQuery != "" {
		url += "&search=" + sp.SearchQuery
	}
	if sp.SortColumn != "" {
		url += "&sort=" + sp.SortColumn
		dir := sp.SortDirection
		if dir == "" {
			dir = "asc"
		}
		url += "&dir=" + dir
	}
	return url
}

// buildPageURL constructs the HTMX URL for a specific page
func (sp *ServerPagination) buildPageURL(page int) string {
	url := sp.PaginationURL + "?page=" + itoa(page) + "&size=" + itoa(sp.PageSize)
	if sp.SearchQuery != "" {
		url += "&search=" + sp.SearchQuery
	}
	if sp.SortColumn != "" {
		url += "&sort=" + sp.SortColumn
		dir := sp.SortDirection
		if dir == "" {
			dir = "asc"
		}
		url += "&dir=" + dir
	}
	return url
}

// buildPageNumbers generates the slice of page buttons with smart windowing
// Shows: first | ... | window around current | ... | last
func buildPageNumbers(current, total int, urlBuilder func(int) string) []PageNumber {
	if total <= 0 {
		return nil
	}

	// For 7 or fewer pages, show all
	if total <= 7 {
		pages := make([]PageNumber, total)
		for i := 1; i <= total; i++ {
			pages[i-1] = PageNumber{Number: i, Active: i == current, URL: urlBuilder(i)}
		}
		return pages
	}

	// For more pages, use windowed display: 1 ... [window] ... last
	var pages []PageNumber

	// Calculate window (2 pages around current)
	windowStart := current - 2
	windowEnd := current + 2
	if windowStart < 1 {
		windowStart = 1
	}
	if windowEnd > total {
		windowEnd = total
	}
	// Ensure at least 5 pages in window
	if windowEnd-windowStart < 4 {
		if windowStart == 1 {
			windowEnd = min(5, total)
		} else if windowEnd == total {
			windowStart = max(total-4, 1)
		}
	}

	// First page
	if windowStart > 1 {
		pages = append(pages, PageNumber{Number: 1, Active: current == 1, URL: urlBuilder(1)})
		if windowStart > 2 {
			pages = append(pages, PageNumber{Ellipsis: true})
		}
	}

	// Window pages
	for i := windowStart; i <= windowEnd; i++ {
		pages = append(pages, PageNumber{Number: i, Active: i == current, URL: urlBuilder(i)})
	}

	// Last page
	if windowEnd < total {
		if windowEnd < total-1 {
			pages = append(pages, PageNumber{Ellipsis: true})
		}
		pages = append(pages, PageNumber{Number: total, Active: current == total, URL: urlBuilder(total)})
	}

	return pages
}

// itoa is a shorthand for strconv.Itoa
func itoa(n int) string {
	return strconv.Itoa(n)
}

// SortableKeys extracts the wire/SQL sort keys of all sortable columns. Used by
// view handlers to build the allowed-sort whitelist passed to ParseTableParams.
// For each sortable column with non-empty Key, prefers SortKey when set; falls
// back to Key. The shim's IsSortable bridges legacy NoSort and the new
// Sortable field so callers don't need to know which the column declares.
func SortableKeys(cols []TableColumn) []string {
	var keys []string
	for _, c := range cols {
		if c.Key == "" || !c.IsSortable() {
			continue
		}
		keys = append(keys, c.EffectiveSortKey())
	}
	return keys
}

// FilterableKeys extracts the keys of all filterable columns. Mirrors SortableKeys.
// Filtering still uses Key (not SortKey) because the filter UI binds by view-key.
func FilterableKeys(cols []TableColumn) []string {
	var keys []string
	for _, c := range cols {
		if c.Key == "" || !c.IsFilterable() {
			continue
		}
		keys = append(keys, c.Key)
	}
	return keys
}
