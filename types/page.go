package types

import "html/template"

// PageData holds base data passed to all page templates
type PageData struct {
	CacheVersion      string
	Title             string
	CurrentPath       string
	ActiveNav         string
	ActiveSubNav      string // Active sub-navigation item (for sidebar sub-menus)
	HeaderIcon        string
	HeaderTitle       string
	HeaderSubtitle    string
	SearchPlaceholder string
	HasNotifications  bool
	HelpContent       template.HTML // Server-rendered markdown content for help pane
	HasHelp           bool          // Whether this page has help content
	HeaderIconHTML    template.HTML // Pre-rendered icon HTML for header
	CommonLabels      any           // i18n labels (avoids circular import)
}
