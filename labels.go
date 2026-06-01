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
	Columns       CommonColumnLabels `json:"columns"`
	Pagination    PaginationLabels   `json:"pagination"`
	Buttons       ButtonLabels       `json:"buttons"`
	Actions       ActionLabels       `json:"actions"`
	Bulk          BulkLabels         `json:"bulk"`
	Status        StatusLabels       `json:"status"`
	Badges        BadgeLabels        `json:"badges"`
	Empty         EmptyLabels        `json:"empty"`
	Loading       LoadingLabels      `json:"loading"`
	Errors        ErrorLabels        `json:"errors"`
	Dropdown      DropdownLabels     `json:"dropdown"`
	Integration   IntegrationLabels  `json:"integration"`
	Card          CardLabels         `json:"card"`
	Tabs          TabLabels          `json:"tabs"`
	Audit         AuditLabels        `json:"audit"`
	DurationUnit  DurationUnitLabels `json:"durationUnit"`
	Currency      CurrencyLabels     `json:"currency"`
	Toast         ToastLabels        `json:"toast"`
	Sheet         SheetLabels        `json:"sheet"`
	A11y          A11yLabels         `json:"a11y"`
}

// TabItem represents a single tab in a tab component
type TabItem struct {
	Key      string // Canonical identifier (used for state matching, data-tab, aria-controls). Never tier-overridden.
	URLSlug  string // Optional tier-resolved URL slug. Zero value falls back to Key. Used when constructing tab URLs / ?tab= query params so business-type tiers can rename slugs (e.g., "operations" → "work-plans") without changing the canonical Key.
	Label    string // Display text
	Href     string // Link URL (for link-based tabs), or hx-push-url when HxGet is set
	HxGet    string // HTMX endpoint (optional — renders as HTMX button, swaps #tabContent)
	Icon     string // Icon template name (optional)
	Count    int    // Badge count (optional)
	Disabled bool   // Whether the tab is disabled
}

// SlugOrKey returns the tab's URL slug if set, otherwise the canonical Key.
// Use this when building tab anchor URLs / ?tab= query params so business-type
// tiers can override the slug while leaving the canonical Key untouched.
func (t TabItem) SlugOrKey() string {
	if t.URLSlug != "" {
		return t.URLSlug
	}
	return t.Key
}
