package pyeza

// CommonLabels holds translatable strings for common/shared ui.
type CommonLabels struct {
	Sidebar       SidebarLabels      `json:"sidebar"`
	Header        HeaderLabels       `json:"header"`
	Notifications NotificationLabels `json:"notifications"`
	Settings      SettingsLabels     `json:"settings"`
	Theme         ThemeLabels        `json:"theme"`
	HelpPane      HelpPaneLabels     `json:"helpPane"`
	Table         CommonTableLabels  `json:"table"`
	Pagination    PaginationLabels   `json:"pagination"`
	Buttons       ButtonLabels       `json:"buttons"`
	Actions       ActionLabels       `json:"actions"`
	Bulk          BulkLabels         `json:"bulk"`
	Status        StatusLabels       `json:"status"`
	Empty         EmptyLabels        `json:"empty"`
	Loading       LoadingLabels      `json:"loading"`
	Errors        ErrorLabels        `json:"errors"`
	Dropdown      DropdownLabels     `json:"dropdown"`
	Integration   IntegrationLabels  `json:"integration"`
	Card          CardLabels         `json:"card"`
	Tabs          TabLabels          `json:"tabs"`
	Audit         AuditLabels        `json:"audit"`
	DurationUnit  DurationUnitLabels  `json:"durationUnit"`
	Currency      CurrencyOptionLabels `json:"currency"`
}

// TabItem represents a single tab in a tab component
type TabItem struct {
	Key      string // Unique identifier (used for URL/data-tab)
	Label    string // Display text
	Href     string // Link URL (for link-based tabs), or hx-push-url when HxGet is set
	HxGet    string // HTMX endpoint (optional — renders as HTMX button, swaps #tabContent)
	Icon     string // Icon template name (optional)
	Count    int    // Badge count (optional)
	Disabled bool   // Whether the tab is disabled
}
