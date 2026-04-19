package types

import "html/template"

// PageData holds base data passed to all page templates
type PageData struct {
	CacheVersion string
	Title        string
	// ContentTemplate is the name of the content template to render inside app-shell.
	// SECURITY: Must always be a compile-time constant set in Go view code.
	// NEVER derive from user input (URL params, headers, form values, cookies).
	ContentTemplate   string
	CurrentPath       string
	ActiveNav         string
	ActiveSubNav      string // Active sub-navigation item (for sidebar sub-menus)
	Sidebar           SidebarConfig
	HeaderIcon          string
	HeaderTitle         string
	HeaderSubtitle      string
	HeaderBreadcrumb    string // optional text shown above the title (e.g., "← Rate Card XYZ")
	HeaderBreadcrumbURL string // optional href; when set, the breadcrumb renders as a link
	SearchPlaceholder string
	HasNotifications  bool
	HelpContent       template.HTML     // Server-rendered markdown content for help pane
	HasHelp           bool              // Whether this page has help content
	HeaderIconHTML    template.HTML     // Pre-rendered icon HTML for header
	CommonLabels      any               // i18n labels (avoids circular import)
	Messages          map[string]string // flat i18n messages (dot-notation keys)
	UserPermissions   *UserPermissions  // permission codes for current user (for UI adaptation)
	BottomNavTabs     []BottomNavTab    // mobile bottom navigation tabs
	AllApps           []AppGridItem     // all apps for mobile app grid overlay
	AppGroups         []AppGridGroup    // grouped apps for mobile bottom sheet
	DefaultTheme      string            // server-configured default theme (for <html> data-theme)
	DefaultFont       string            // server-configured default font (for <html> data-font)
	// Session user fields — populated from auth context by the ViewAdapter.
	// Used by settings-modal.html to display the authenticated user's name/email.
	// These use the "Session" prefix to avoid collision with domain-specific UserEmail
	// fields on concrete page data structs (e.g. user detail page).
	SessionUserName     string // authenticated user's display name (e.g. "John Doe")
	SessionUserEmail    string // authenticated user's email address
	SessionUserInitials string // two-letter initials derived from the display name (e.g. "JD")
}

// BottomNavTab represents a single tab in the mobile bottom navigation bar.
// Used by the "bottom-nav" template component.
type BottomNavTab struct {
	Key     string // identifier for the tab
	Label   string // display text
	Icon    string // icon template name (e.g., "icon-users")
	Href    string // link URL
	Badge   string // optional badge text (e.g., notification count)
	Active  bool   // true if this tab is the current page
	IsFAB   bool   // true for the center floating action button
	FABIcon string // icon template name for FAB (e.g., "icon-calendar-plus")
}

// AppGridItem represents a single app in the mobile app grid overlay.
// Used by the "mobile-app-grid" template component.
type AppGridItem struct {
	Label      string // display text
	Icon       string // icon template name (e.g., "icon-users")
	Href       string // link URL
	Group      string // group header (e.g., "Manage", "Transactions")
	Permission string // permission code required (empty = always visible)
}

// AppGridGroup represents a group of apps in the mobile app grid.
type AppGridGroup struct {
	Title string        // group header text
	Items []AppGridItem // apps in this group
}

// T returns the translation for the given dot-notation key.
// Falls back to the key itself if not found.
// Usable in templates: {{.T "client.page.title"}}
func (p PageData) T(key string) string {
	if p.Messages != nil {
		if msg, ok := p.Messages[key]; ok {
			return msg
		}
	}
	return key
}
