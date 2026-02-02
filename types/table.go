package types

import (
	"html/template"
	"strconv"
)

// TableColumn defines a column in a data table
type TableColumn struct {
	Key      string // Data attribute key for sorting
	Label    string // Column header label
	Sortable bool   // Whether column is sortable
	Width    string // Optional fixed width (e.g., "200px", "20%")
	MinWidth string // Optional minimum width (e.g., "100px") - column can grow but not shrink below this
	Align    string // Optional horizontal alignment: "left" (default), "center", "right"
	VAlign   string // Optional vertical alignment: "top" (default), "middle", "bottom"
}

// ColumnGroup defines a group of columns with a shared parent header.
// Used for multi-level table headers (e.g., "Job Rates" spanning "Default" and "Minimum" sub-columns).
type ColumnGroup struct {
	Label   string        // Group header label (e.g., "Job Rates")
	Columns []TableColumn // Sub-columns within this group
}

// SelectOption defines a dropdown option for "select" type cells
type SelectOption struct {
	Value    string // Option value attribute
	Label    string // Option display text
	Selected bool   // Whether this option is selected
}

// TableCell defines a cell value with optional formatting
type TableCell struct {
	Type      string        // Cell type: "text", "badge", "name", "link", "chips", "html", "author", "input", "select"
	Value     string        // Text value to display
	Variant   string        // For badges: variant class (e.g., "success", "error", "warning")
	BadgeType string        // For badges: badge type ("status", "count", "type") - defaults to "status"
	Alert     bool          // For name cells: show alert icon
	Href      string        // For links: href attribute
	HTML      template.HTML // For custom HTML content
	Align     string        // Horizontal alignment (set automatically from column, do not set manually)
	VAlign    string        // Vertical alignment: "top" (default), "middle", "bottom"
	Width     string        // Width (set automatically from column, do not set manually)
	MinWidth  string        // MinWidth (set automatically from column, do not set manually)
	// Chip fields for "chips" type
	Chips        []ChipData // For "chips" type: visible chip labels (max N)
	ChipOverflow int        // Count of hidden chips beyond max visible
	ChipTooltip  string     // Tooltip showing all chip names
	// Input fields for "input" type
	InputName   string // Form field name attribute
	InputPrefix string // Prefix text displayed before input (e.g., "$")
	InputSuffix string // Suffix text displayed after input (e.g., "%")
	InputType   string // HTML input type: "text" (default), "number"
	// Select fields for "select" type
	SelectName string         // Form field name attribute
	Options    []SelectOption // Dropdown options
}

// ApplyColumnStyles copies alignment, width, minWidth, and vAlign from columns to cells in all rows.
// Call this after building rows to ensure cells inherit column styles.
func ApplyColumnStyles(columns []TableColumn, rows []TableRow) {
	for i := range rows {
		for j := range rows[i].Cells {
			if j < len(columns) {
				if columns[j].Align != "" {
					rows[i].Cells[j].Align = columns[j].Align
				}
				if columns[j].VAlign != "" {
					rows[i].Cells[j].VAlign = columns[j].VAlign
				}
				if columns[j].Width != "" {
					rows[i].Cells[j].Width = columns[j].Width
				}
				if columns[j].MinWidth != "" {
					rows[i].Cells[j].MinWidth = columns[j].MinWidth
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
}

// TableAction defines an action button for a table row
type TableAction struct {
	Type            string // Action type: "view", "edit", "clone", "delete", "download"
	Label           string // Tooltip/aria-label text
	Action          string // data-action value for JS handling
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
	ID         string            // Group identifier
	Title      string            // Group title/header
	Subtitle   string            // Optional subtitle for the group
	Collapsed  bool              // Whether the group is collapsed by default
	Rows       []TableRow        // Rows in this group
	DataAttrs  map[string]string // Data attributes for the group
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
	Filters          string
	Sort             string
	Columns          string
	Export           string
	// Filter panel
	FilterConditions string
	ClearAll         string
	AddCondition     string
	Clear            string
	ApplyFilters     string
	// Density options
	DensityDefault     string
	DensityComfortable string
	DensityCompact     string
	// Footer/Pagination
	Show         string
	Entries      string
	Showing      string
	To           string
	Of           string
	EntriesLabel string
	SelectAll    string
	Actions      string
	Prev         string
	Next         string
}

// PrimaryAction defines a primary action button for the table toolbar
type PrimaryAction struct {
	Label     string // Button label text
	Href      string // Button href (for link-based actions)
	Icon      string // Icon template name (e.g., "icon-plus")
	ActionURL string // HTMX action URL for form loading
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
	ID                   string             // Table ID
	Title                string             // Table title (legacy, not displayed in toolbar)
	CardClass            string             // Additional class for table-card
	RefreshURL           string             // URL to fetch table partial for HTMX refresh (e.g., "/action/user/user-division/table")
	Columns              []TableColumn      // Column definitions (single-level headers)
	ColumnGroups         []ColumnGroup      // Nested column groups (alternative to Columns for multi-level headers)
	Rows                 []TableRow         // Row data (use Groups instead for grouped tables)
	Groups               []TableRowGroup    // Row groups (alternative to Rows for grouped tables)
	Minimal              bool               // When true, hide toolbar and footer (for embedded/settings tables)
	ShowCheckbox         bool               // Show row checkboxes (legacy, use BulkActions.Enabled instead)
	ShowSearch           bool               // Show search input in toolbar
	ShowFilters          bool               // Show advanced filter builder in toolbar
	ShowSort             bool               // Show sort dropdown in toolbar
	ShowColumns          bool               // Show column visibility toggle in toolbar
	ShowExport           bool               // Show export dropdown (CSV/Excel) in toolbar
	ShowDensity          bool               // Show row density toggle in toolbar
	ShowEntries          bool               // Show entries selector in footer
	ShowActions          bool               // Show actions column
	DefaultSortColumn    string             // Column key for default sort (e.g., "name")
	DefaultSortDirection string             // "asc" or "desc" (defaults to "asc")
	Labels               TableLabels        // Table labels
	EmptyState           TableEmptyState    // Empty state configuration
	ImportAction         *ImportAction      // Optional import action button in toolbar (before primary action)
	PrimaryAction        *PrimaryAction     // Optional primary action button in toolbar
	BulkActions          *BulkActionsConfig // Optional bulk selection configuration
	FixedLayout          bool               // When true, use table-layout: fixed (columns respect declared widths exactly)
	ServerPagination     *ServerPagination  // Optional server-side pagination configuration (nil = client-side mode)
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
	Enabled       bool   // true = server-side, false/nil = client-side (default)
	Mode          string // "offset" (page numbers) or "cursor" (keyset, prev/next only)
	PageSize      int    // current page size
	CurrentPage   int    // current page number (offset mode)
	TotalRows     int    // total matching rows (offset mode; optional for cursor)
	TotalPages    int    // pre-calculated total pages (offset mode)
	StartRow      int    // pre-calculated first row number on current page (1-based, for display)
	EndRow        int    // pre-calculated last row number on current page (for display)
	HasNextPage   bool   // more rows forward?
	HasPrevPage   bool   // more rows backward?
	NextCursor    string // cursor mode: cursor token for next page (base64 encoded)
	PrevCursor    string // cursor mode: cursor token for previous page (base64 encoded)
	SearchQuery   string // current search term (reflected in search input)
	SortColumn    string // current sort column key
	SortDirection string // current sort direction ("asc" or "desc")
	FiltersJSON   string // current advanced filters (base64 encoded JSON)
	PaginationURL     string // base URL for HTMX page requests
	PaginationBodyURL string // base URL for body-only targeted swap requests

	// Pre-computed display fields — populated by BuildDisplay()
	PageNumbers   []PageNumber // page buttons for offset mode (with smart windowing)
	PrevPageURL   string       // HTMX URL for prev page button (offset mode)
	NextPageURL   string       // HTMX URL for next page button (offset mode)
	PrevCursorURL string       // HTMX URL for prev button (cursor mode)
	NextCursorURL string       // HTMX URL for next button (cursor mode)
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
	if sp.FiltersJSON != "" {
		url += "&filters=" + sp.FiltersJSON
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
	if sp.FiltersJSON != "" {
		url += "&filters=" + sp.FiltersJSON
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
