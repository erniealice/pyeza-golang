package types

import "html/template"

// PostRotationBannerData holds the data for the post-rotation visible
// interstitial banner (red-team A-2 / C-2 mitigation in
// docs/plan/20260521-workspace-keyed-routing). Rendered by app-shell.html
// on the first page render after a URL-driven workspace switch.
type PostRotationBannerData struct {
	// Active is true when the banner should be rendered. The view adapter
	// sets this from the workspace_path middleware's CtxKeyPostRotationBanner
	// context flag.
	Active bool
	// TargetSlug is the slug of the workspace just switched INTO.
	TargetSlug string
	// PreviousSlug is the slug of the workspace just switched FROM.
	// Empty when the previous workspace_id is not in the slug cache
	// (first request after server restart); in that case the "Switch back"
	// link is omitted in the template.
	PreviousSlug string
	// PreviousURL is the reconstructed /w/{prev-slug}/ URL for the
	// "Switch back" link. Empty when PreviousSlug is empty.
	PreviousURL string
	// RecentActivityURL is the link for "View recent activity" — always
	// /me/recent-activity.
	RecentActivityURL string
}

// PageData holds base data passed to all page templates
type PageData struct {
	CacheVersion string
	Title        string
	// ContentTemplate is the name of the content template to render inside app-shell.
	// SECURITY: Must always be a compile-time constant set in Go view code.
	// NEVER derive from user input (URL params, headers, form values, cookies).
	ContentTemplate     string
	CurrentPath         string
	ActiveNav           string
	ActiveSubNav        string // Active sub-navigation item (for sidebar sub-menus)
	Sidebar             SidebarConfig
	HeaderIcon          string
	HeaderTitle         string
	HeaderSubtitle      string
	HeaderBreadcrumb    string // optional text shown above the title (e.g., "← Rate Card XYZ")
	HeaderBreadcrumbURL string // optional href; when set, the breadcrumb renders as a link
	HeaderSubtitleURL   string // optional href; when set, HeaderSubtitle renders as a link
	SearchPlaceholder   string
	HasNotifications    bool
	// HasMessages gates the "Messages" header button (secure-messaging, Plan-4).
	// Set true when the session principal has conversation:list permission.
	HasMessages         bool
	// MessagesURL is the navigation target for the header Messages button —
	// the staff inbox for staff principals, the portal for client principals.
	MessagesURL         string
	// MessagesUnreadCount drives the optional unread indicator on the button.
	MessagesUnreadCount int
	HelpContent         template.HTML     // Server-rendered markdown content for help pane
	HasHelp             bool              // Whether this page has help content
	HeaderIconHTML      template.HTML     // Pre-rendered icon HTML for header
	CommonLabels        any               // i18n labels (avoids circular import)
	Messages            map[string]string // flat i18n messages (dot-notation keys)
	UserPermissions     *UserPermissions  // permission codes for current user (for UI adaptation)
	BottomNavTabs       []BottomNavTab    // mobile bottom navigation tabs
	AllApps             []AppGridItem     // all apps for mobile app grid overlay
	AppGroups           []AppGridGroup    // grouped apps for mobile bottom sheet
	DefaultTheme        string            // server-configured default theme (for <html> data-theme)
	DefaultFont         string            // server-configured default font (for <html> data-font)
	// Session user fields — populated from auth context by the ViewAdapter.
	// Used by settings-modal.html to display the authenticated user's name/email.
	// These use the "Session" prefix to avoid collision with domain-specific UserEmail
	// fields on concrete page data structs (e.g. user detail page).
	SessionUserName     string // authenticated user's display name (e.g. "John Doe")
	SessionUserEmail    string // authenticated user's email address
	SessionUserInitials string // two-letter initials derived from the display name (e.g. "JD")
	// PostRotationBanner is populated by the view adapter when the workspace_path
	// middleware sets CtxKeyPostRotationBanner on the first page render after a
	// URL-driven workspace switch (red-team A-2 / C-2 mitigation).
	PostRotationBanner PostRotationBannerData
	// WorkspaceID is the session's current workspace_id, populated by the
	// ViewAdapter from consumer.GetWorkspaceIDFromContext on every render.
	// Templates pass this to {{actionForm "/action/..." .WorkspaceID}} so the
	// action_workspace_guard middleware (P10c) can verify form/session
	// cross-binding. Empty for pre-workspace pages (login, signup, principal
	// switch); the helper renders nothing in that case and the guard exempts
	// those paths.
	WorkspaceID string
	// Nonce is the per-request CSP nonce minted by the SecurityHeaders
	// middleware (apps/service-admin .../middleware/security_headers.go) and
	// read back via middleware.Nonce(ctx). The ViewAdapter populates it in
	// injectPageData. Consumed by inline <script nonce="{{.Nonce}}"> blocks in a
	// LATER wave (CSP stage 2); no stage-1 template emits nonce= yet, so this
	// field is inert today and CSP stays report-only. Empty when the request
	// skipped SecurityHeaders (e.g. unit tests).
	Nonce string
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
	Key        string // canonical app key (e.g., "clients") — used for data-testid
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
