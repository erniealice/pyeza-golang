package types

// SidebarConfig holds all data needed to render a sidebar block.
// Apps populate this struct to drive sidebar rendering without hardcoding HTML.
type SidebarConfig struct {
	LogoText     string
	LogoURL      string
	Apps         []SidebarApp
	ActiveApp    string
	Sections     []SidebarSection
	ActiveNav    string
	ActiveSubNav string
}

// SidebarApp represents an entry in the app switcher dropdown.
type SidebarApp struct {
	Key   string
	Label string
	Icon  string // template name, e.g. "icon-users"
	URL   string
}

// SidebarSection is a group of navigation items with an optional title.
type SidebarSection struct {
	Title string // empty = no section title rendered
	Items []SidebarItem
}

// SidebarItem is a single navigation link in the sidebar.
type SidebarItem struct {
	Key      string
	Label    string
	Icon     string // template name, e.g. "icon-dashboard"
	Href     string
	Tooltip  string
	Children []SidebarItem
}
