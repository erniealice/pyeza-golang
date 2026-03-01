package types

// SidebarConfig holds all data needed to render a sidebar block.
// Apps populate this struct to drive sidebar rendering without hardcoding HTML.
type SidebarConfig struct {
	LogoText       string
	LogoURL        string
	Apps           []SidebarApp
	ActiveApp      string
	Sections       []SidebarSection
	ActiveNav      string
	ActiveSubNav   string
	AppGridColumns int    // 1 = single column, 2 = two columns (default)
	AppDisplayMode string // "" or "dropdown" = dropdown grid; "accordion" = grouped accordion
	AppGroups      []SidebarAppGroup
}

// SidebarAppGroup is a named group of apps for accordion display mode.
// Each group renders as a collapsible section in the sidebar.
type SidebarAppGroup struct {
	Title string
	Apps  []SidebarApp
}

// SidebarApp represents an entry in the app switcher dropdown.
type SidebarApp struct {
	Key        string
	Label      string
	Icon       string // template name, e.g. "icon-users"
	URL        string
	Permission string // e.g. "client:list" — if set, app hidden when user lacks permission
}

// SidebarSection is a group of navigation items with an optional title.
type SidebarSection struct {
	Title string // empty = no section title rendered
	Items []SidebarItem
}

// SidebarItem is a single navigation link in the sidebar.
type SidebarItem struct {
	Key        string
	Label      string
	Icon       string // template name, e.g. "icon-dashboard"
	Href       string
	Tooltip    string
	Children   []SidebarItem
	Permission string // e.g. "client:list" — if set, item hidden when user lacks permission
}

// SidebarLabels holds all labels and icons used in the sidebar navigation.
// Follows the three-level cascade: Go defaults → industry JSON → app override.
// Loaded from sidebar.json via lyngua LoadPathIfExists.
type SidebarLabels struct {
	// Shared item labels
	DashboardLabel string `json:"dashboard_label"`
	ActiveLabel    string `json:"active_label"`
	InactiveLabel  string `json:"inactive_label"`
	SettingsTitle  string `json:"settings_title"`

	// App switcher
	ClientsAppLabel   string `json:"clients_app_label"`
	ClientsAppIcon    string `json:"clients_app_icon"`
	UsersAppLabel     string `json:"users_app_label"`
	UsersAppIcon      string `json:"users_app_icon"`
	SalesAppLabel     string `json:"sales_app_label"`
	SalesAppIcon      string `json:"sales_app_icon"`
	InventoryAppLabel string `json:"inventory_app_label"`
	InventoryAppIcon  string `json:"inventory_app_icon"`
	ServicesAppLabel  string `json:"services_app_label"`
	ServicesAppIcon   string `json:"services_app_icon"`
	LocationsAppLabel string `json:"locations_app_label"`
	LocationsAppIcon  string `json:"locations_app_icon"`
	PurchasesAppLabel string `json:"purchases_app_label"`
	PurchasesAppIcon  string `json:"purchases_app_icon"`
	ExpensesAppLabel  string `json:"expenses_app_label"`
	ExpensesAppIcon   string `json:"expenses_app_icon"`
	ReportsAppLabel   string `json:"reports_app_label"`
	ReportsAppIcon    string `json:"reports_app_icon"`
	AdminAppLabel     string `json:"admin_app_label"`
	AdminAppIcon      string `json:"admin_app_icon"`

	// App group titles
	MasterlistsGroupTitle  string `json:"masterlists_group_title"`
	TransactionsGroupTitle string `json:"transactions_group_title"`
	ReportsGroupTitle      string `json:"reports_group_title"`
	AdminGroupTitle        string `json:"admin_group_title"`

	// Section titles
	ClientsTitle      string `json:"clients_title"`
	UsersTitle        string `json:"users_title"`
	SalesTitle        string `json:"sales_title"`
	PriceListsTitle   string `json:"price_lists_title"`
	ProductsTitle     string `json:"products_title"`
	TransactionsTitle string `json:"transactions_title"`
	ReportsTitle      string `json:"reports_title"`
	LocationsTitle    string `json:"locations_title"`
	PermissionsTitle  string `json:"permissions_title"`
	WorkspacesTitle   string `json:"workspaces_title"`

	// Unique nav item labels and icons
	ClientsActiveIcon      string `json:"clients_active_icon"`
	ClientsInactiveIcon    string `json:"clients_inactive_icon"`
	ClientsTagsLabel       string `json:"clients_tags_label"`
	ClientsTagsIcon        string `json:"clients_tags_icon"`
	UsersActiveIcon        string `json:"users_active_icon"`
	UsersInactiveIcon      string `json:"users_inactive_icon"`
	UsersRolesLabel        string `json:"users_roles_label"`
	UsersRolesIcon         string `json:"users_roles_icon"`
	SalesOngoingLabel      string `json:"sales_ongoing_label"`
	SalesOngoingIcon       string `json:"sales_ongoing_icon"`
	SalesCompleteLabel     string `json:"sales_complete_label"`
	SalesCompleteIcon      string `json:"sales_complete_icon"`
	SalesCancelledLabel    string `json:"sales_cancelled_label"`
	SalesCancelledIcon     string `json:"sales_cancelled_icon"`
	PriceListsActiveIcon   string `json:"price_lists_active_icon"`
	PriceListsInactiveIcon string `json:"price_lists_inactive_icon"`
	MasterlistLabel        string `json:"masterlist_label"`
	MasterlistIcon         string `json:"masterlist_icon"`
	MovementsLabel         string `json:"movements_label"`
	MovementsIcon          string `json:"movements_icon"`
	GrossProfitLabel       string `json:"gross_profit_label"`
	GrossProfitIcon        string `json:"gross_profit_icon"`
	LocationsActiveIcon    string `json:"locations_active_icon"`
	LocationsInactiveIcon  string `json:"locations_inactive_icon"`
	PermissionsActiveIcon  string `json:"permissions_active_icon"`
	PermissionsInactiveIcon string `json:"permissions_inactive_icon"`
	WorkspacesActiveIcon   string `json:"workspaces_active_icon"`
	WorkspacesInactiveIcon string `json:"workspaces_inactive_icon"`
}

// DefaultSidebarLabels returns Level 1 generic defaults for sidebar navigation.
// Industry-specific overrides come from sidebar.json via lyngua (Level 2).
func DefaultSidebarLabels() SidebarLabels {
	return SidebarLabels{
		DashboardLabel: "Dashboard",
		ActiveLabel:    "Active",
		InactiveLabel:  "Inactive",
		SettingsTitle:  "Settings",

		ClientsAppLabel:   "Clients",
		ClientsAppIcon:    "icon-users",
		UsersAppLabel:     "Users",
		UsersAppIcon:      "icon-shield",
		SalesAppLabel:     "Sales",
		SalesAppIcon:      "icon-shopping-bag",
		InventoryAppLabel: "Inventory",
		InventoryAppIcon:  "icon-briefcase",
		ServicesAppLabel:  "Services",
		ServicesAppIcon:   "icon-layers",
		LocationsAppLabel: "Locations",
		LocationsAppIcon:  "icon-map-pin",
		PurchasesAppLabel: "Purchases",
		PurchasesAppIcon:  "icon-clipboard",
		ExpensesAppLabel:  "Expenses",
		ExpensesAppIcon:   "icon-credit-card",
		ReportsAppLabel:   "Reports",
		ReportsAppIcon:    "icon-check-circle",
		AdminAppLabel:     "Settings",
		AdminAppIcon:      "icon-settings",

		MasterlistsGroupTitle:  "Masterlists",
		TransactionsGroupTitle: "Transactions",
		ReportsGroupTitle:      "Reports",
		AdminGroupTitle:        "Admin",

		ClientsTitle:      "Clients",
		UsersTitle:        "Users",
		SalesTitle:        "Sales",
		PriceListsTitle:   "Price Lists",
		ProductsTitle:     "Products",
		TransactionsTitle: "Transactions",
		ReportsTitle:      "Reports",
		LocationsTitle:    "Locations",
		PermissionsTitle:  "Permissions",
		WorkspacesTitle:   "Workspaces",

		ClientsActiveIcon:      "icon-user-check",
		ClientsInactiveIcon:    "icon-user-minus",
		ClientsTagsLabel:       "Tags",
		ClientsTagsIcon:        "icon-tag",
		UsersActiveIcon:        "icon-shield",
		UsersInactiveIcon:      "icon-user-minus",
		UsersRolesLabel:        "Roles",
		UsersRolesIcon:         "icon-shield",
		SalesOngoingLabel:      "Ongoing",
		SalesOngoingIcon:       "icon-shopping-bag",
		SalesCompleteLabel:     "Complete",
		SalesCompleteIcon:      "icon-check-circle",
		SalesCancelledLabel:    "Cancelled",
		SalesCancelledIcon:     "icon-x-circle",
		PriceListsActiveIcon:   "icon-tag",
		PriceListsInactiveIcon: "icon-tag",
		MasterlistLabel:        "Masterlist",
		MasterlistIcon:         "icon-package",
		MovementsLabel:         "Transactions",
		MovementsIcon:          "icon-repeat",
		GrossProfitLabel:       "Gross Profit",
		GrossProfitIcon:        "icon-bar-chart",
		LocationsActiveIcon:    "icon-map-pin",
		LocationsInactiveIcon:  "icon-map-pin",
		PermissionsActiveIcon:  "icon-key",
		PermissionsInactiveIcon: "icon-key",
		WorkspacesActiveIcon:   "icon-briefcase",
		WorkspacesInactiveIcon: "icon-briefcase",
	}
}
