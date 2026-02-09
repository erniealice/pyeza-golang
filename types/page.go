package types

import "html/template"

// PageData holds base data passed to all page templates
type PageData struct {
	CacheVersion      string
	Title             string
	// ContentTemplate is the name of the content template to render inside app-shell.
	// SECURITY: Must always be a compile-time constant set in Go view code.
	// NEVER derive from user input (URL params, headers, form values, cookies).
	ContentTemplate   string
	CurrentPath       string
	ActiveNav         string
	ActiveSubNav      string // Active sub-navigation item (for sidebar sub-menus)
	Sidebar           SidebarConfig
	HeaderIcon        string
	HeaderTitle       string
	HeaderSubtitle    string
	SearchPlaceholder string
	HasNotifications  bool
	HelpContent       template.HTML // Server-rendered markdown content for help pane
	HasHelp           bool          // Whether this page has help content
	HeaderIconHTML    template.HTML    // Pre-rendered icon HTML for header
	CommonLabels      any              // i18n labels (avoids circular import)
	Messages          map[string]string // flat i18n messages (dot-notation keys)
	UserPermissions   *UserPermissions         // permission codes for current user (for UI adaptation)
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
