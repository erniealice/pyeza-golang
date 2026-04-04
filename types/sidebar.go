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
	// Shared item labels and icons
	DashboardLabel string `json:"dashboard_label"`
	DashboardIcon  string `json:"dashboard_icon"`
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
	AssetsAppLabel    string `json:"assets_app_label"`
	AssetsAppIcon     string `json:"assets_app_icon"`
	SuppliersAppLabel string `json:"suppliers_app_label"`
	SuppliersAppIcon  string `json:"suppliers_app_icon"`
	PurchasesAppLabel string `json:"purchases_app_label"`
	PurchasesAppIcon  string `json:"purchases_app_icon"`
	ExpensesAppLabel  string `json:"expenses_app_label"`
	ExpensesAppIcon   string `json:"expenses_app_icon"`
	CashAppLabel      string `json:"cash_app_label"`
	CashAppIcon       string `json:"cash_app_icon"`
	ReportsAppLabel   string `json:"reports_app_label"`
	ReportsAppIcon    string `json:"reports_app_icon"`
	AdminAppLabel     string `json:"admin_app_label"`
	AdminAppIcon      string `json:"admin_app_icon"`

	// App group titles
	MasterlistsGroupTitle  string `json:"masterlists_group_title"`
	TransactionsGroupTitle string `json:"transactions_group_title"`
	ReportsGroupTitle      string `json:"reports_group_title"`
	AdminGroupTitle        string `json:"admin_group_title"`
	FoundationGroupTitle   string `json:"foundation_group_title"`
	CoreDataGroupTitle     string `json:"core_data_group_title"`
	OperationsGroupTitle   string `json:"operations_group_title"`
	IntelligenceGroupTitle string `json:"intelligence_group_title"`

	// Section titles
	ClientsTitle       string `json:"clients_title"`
	UsersTitle         string `json:"users_title"`
	SalesTitle         string `json:"sales_title"`
	PurchasesTitle     string `json:"purchases_title"`
	ExpensesTitle      string `json:"expenses_title"`
	PriceListsTitle    string `json:"price_lists_title"`
	ProductsTitle      string `json:"products_title"`
	TransactionsTitle  string `json:"transactions_title"`
	ReportsTitle       string `json:"reports_title"`
	LocationsTitle     string `json:"locations_title"`
	AssetsTitle        string `json:"assets_title"`
	SuppliersTitle     string `json:"suppliers_title"`
	PlansTitle         string `json:"plans_title"`
	SubscriptionsTitle string `json:"subscriptions_title"`
	CashTitle          string `json:"cash_title"`
	CollectionsTitle   string `json:"collections_title"`
	DisbursementsTitle string `json:"disbursements_title"`
	PermissionsTitle   string `json:"permissions_title"`
	WorkspacesTitle    string `json:"workspaces_title"`

	// Shared status labels and icons (used across purchase, expense, supplier, etc.)
	AllLabel      string `json:"all_label"`
	AllIcon       string `json:"all_icon"`
	DraftLabel    string `json:"draft_label"`
	PendingLabel  string `json:"pending_label"`
	ApprovedLabel string `json:"approved_label"`
	PaidLabel     string `json:"paid_label"`
	BlockedLabel  string `json:"blocked_label"`
	OnHoldLabel   string `json:"on_hold_label"`
	CompleteLabel string `json:"complete_label"`

	// Purchase nav icons
	PurchasesPendingIcon  string `json:"purchases_pending_icon"`
	PurchasesApprovedIcon string `json:"purchases_approved_icon"`
	PurchasesPaidIcon     string `json:"purchases_paid_icon"`

	// Expense nav icons
	ExpensesPendingIcon  string `json:"expenses_pending_icon"`
	ExpensesApprovedIcon string `json:"expenses_approved_icon"`
	ExpensesPaidIcon     string `json:"expenses_paid_icon"`

	// Unique nav item labels and icons
	ClientsActiveIcon         string `json:"clients_active_icon"`
	ClientsInactiveIcon       string `json:"clients_inactive_icon"`
	ClientsTagsLabel          string `json:"clients_tags_label"`
	ClientsTagsIcon           string `json:"clients_tags_icon"`
	UsersActiveIcon           string `json:"users_active_icon"`
	UsersInactiveIcon         string `json:"users_inactive_icon"`
	UsersRolesLabel           string `json:"users_roles_label"`
	UsersRolesIcon            string `json:"users_roles_icon"`
	SalesOngoingLabel         string `json:"sales_ongoing_label"`
	SalesOngoingIcon          string `json:"sales_ongoing_icon"`
	SalesCompleteLabel        string `json:"sales_complete_label"`
	SalesCompleteIcon         string `json:"sales_complete_icon"`
	SalesCancelledLabel       string `json:"sales_cancelled_label"`
	SalesCancelledIcon        string `json:"sales_cancelled_icon"`
	PriceListsActiveIcon      string `json:"price_lists_active_icon"`
	PriceListsInactiveIcon    string `json:"price_lists_inactive_icon"`
	MasterlistLabel           string `json:"masterlist_label"`
	MasterlistIcon            string `json:"masterlist_icon"`
	MovementsLabel            string `json:"movements_label"`
	MovementsIcon             string `json:"movements_icon"`
	RevenueLabel              string `json:"revenue_label"`
	RevenueIcon               string `json:"revenue_icon"`
	CostOfSalesLabel          string `json:"cost_of_sales_label"`
	CostOfSalesIcon           string `json:"cost_of_sales_icon"`
	GrossProfitLabel          string `json:"gross_profit_label"`
	GrossProfitIcon           string `json:"gross_profit_icon"`
	ExpensesReportLabel       string `json:"expenses_report_label"`
	ExpensesReportIcon        string `json:"expenses_report_icon"`
	NetProfitLabel            string `json:"net_profit_label"`
	NetProfitIcon             string `json:"net_profit_icon"`
	LocationsActiveIcon       string `json:"locations_active_icon"`
	LocationsInactiveIcon     string `json:"locations_inactive_icon"`
	AssetsActiveIcon          string `json:"assets_active_icon"`
	AssetsInactiveIcon        string `json:"assets_inactive_icon"`
	FixedAssetsLabel          string `json:"fixed_assets_label"`
	FixedAssetsIcon           string `json:"fixed_assets_icon"`
	SuppliersActiveIcon       string `json:"suppliers_active_icon"`
	SuppliersBlockedIcon      string `json:"suppliers_blocked_icon"`
	SuppliersOnHoldIcon       string `json:"suppliers_on_hold_icon"`
	PlansActiveIcon           string `json:"plans_active_icon"`
	PlansInactiveIcon         string `json:"plans_inactive_icon"`
	ServicesActiveIcon        string `json:"services_active_icon"`
	ServicesInactiveIcon      string `json:"services_inactive_icon"`
	SubscriptionsActiveIcon   string `json:"subscriptions_active_icon"`
	SubscriptionsInactiveIcon string `json:"subscriptions_inactive_icon"`
	CollectionsPendingIcon    string `json:"collections_pending_icon"`
	CollectionsCompleteIcon   string `json:"collections_complete_icon"`
	DisbursementsDraftIcon    string `json:"disbursements_draft_icon"`
	DisbursementsPendingIcon  string `json:"disbursements_pending_icon"`
	DisbursementsApprovedIcon string `json:"disbursements_approved_icon"`
	DisbursementsPaidIcon     string `json:"disbursements_paid_icon"`
	PermissionsActiveIcon     string `json:"permissions_active_icon"`
	PermissionsInactiveIcon   string `json:"permissions_inactive_icon"`
	WorkspacesActiveIcon      string `json:"workspaces_active_icon"`
	WorkspacesInactiveIcon    string `json:"workspaces_inactive_icon"`

	// Module-level report labels
	CashBookLabel             string `json:"cash_book_label"`
	CashBookIcon              string `json:"cash_book_icon"`
	PayablesAgingLabel        string `json:"payables_aging_label"`
	PayablesAgingIcon         string `json:"payables_aging_icon"`
	ReceivablesAgingLabel     string `json:"receivables_aging_label"`
	ReceivablesAgingIcon      string `json:"receivables_aging_icon"`
	SalesSummaryLabel         string `json:"sales_summary_label"`
	SalesSummaryIcon          string `json:"sales_summary_icon"`
	PurchasesSummaryLabel     string `json:"purchases_summary_label"`
	PurchasesSummaryIcon      string `json:"purchases_summary_icon"`
	ExpensesSummaryLabel      string `json:"expenses_summary_label"`
	ExpensesSummaryIcon       string `json:"expenses_summary_icon"`
	LapsingScheduleLabel      string `json:"lapsing_schedule_label"`
	LapsingScheduleIcon       string `json:"lapsing_schedule_icon"`
	DepreciationPoliciesLabel string `json:"depreciation_policies_label"`
	DepreciationPoliciesIcon  string `json:"depreciation_policies_icon"`

	// Invoice templates
	InvoiceTemplatesLabel string `json:"invoice_templates_label"`
	InvoiceTemplatesIcon  string `json:"invoice_templates_icon"`

	// Purchase templates
	PurchaseTemplatesLabel string `json:"purchase_templates_label"`
	PurchaseTemplatesIcon  string `json:"purchase_templates_icon"`

	// Expense categories
	ExpenseCategoriesLabel string `json:"expense_categories_label"`
	ExpenseCategoriesIcon  string `json:"expense_categories_icon"`

	// Bottom nav icons
	HomeIcon string `json:"home_icon"`
	FABIcon  string `json:"fab_icon"`
	MoreIcon string `json:"more_icon"`
}

// DefaultSidebarLabels returns Level 1 generic defaults for sidebar navigation.
// Industry-specific overrides come from sidebar.json via lyngua (Level 2).
func DefaultSidebarLabels() SidebarLabels {
	return SidebarLabels{
		DashboardLabel: "Dashboard",
		DashboardIcon:  "icon-dashboard",
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
		InventoryAppIcon:  "icon-package",
		ServicesAppLabel:  "Services",
		ServicesAppIcon:   "icon-layers",
		LocationsAppLabel: "Locations",
		LocationsAppIcon:  "icon-map-pin",
		AssetsAppLabel:    "Assets",
		AssetsAppIcon:     "icon-archive",
		SuppliersAppLabel: "Suppliers",
		SuppliersAppIcon:  "icon-truck",
		PurchasesAppLabel: "Purchases",
		PurchasesAppIcon:  "icon-clipboard",
		ExpensesAppLabel:  "Expenses",
		ExpensesAppIcon:   "icon-credit-card",
		CashAppLabel:      "Cash",
		CashAppIcon:       "icon-dollar-sign",
		ReportsAppLabel:   "Reports",
		ReportsAppIcon:    "icon-check-circle",
		AdminAppLabel:     "Settings",
		AdminAppIcon:      "icon-settings",

		MasterlistsGroupTitle:  "Masterlists",
		TransactionsGroupTitle: "Transactions",
		ReportsGroupTitle:      "Reports",
		AdminGroupTitle:        "Admin",
		FoundationGroupTitle:   "Foundation",
		CoreDataGroupTitle:     "Core Data",
		OperationsGroupTitle:   "Operations",
		IntelligenceGroupTitle: "Intelligence",

		ClientsTitle:       "Clients",
		UsersTitle:         "Users",
		SalesTitle:         "Sales",
		PurchasesTitle:     "Purchases",
		ExpensesTitle:      "Expenses",
		PriceListsTitle:    "Price Lists",
		ProductsTitle:      "Products",
		TransactionsTitle:  "Transactions",
		ReportsTitle:       "Reports",
		LocationsTitle:     "Locations",
		AssetsTitle:        "Assets",
		SuppliersTitle:     "Suppliers",
		PlansTitle:         "Plans",
		SubscriptionsTitle: "Subscriptions",
		CashTitle:          "Cash",
		CollectionsTitle:   "Collections",
		DisbursementsTitle: "Disbursements",
		PermissionsTitle:   "Permissions",
		WorkspacesTitle:    "Workspaces",

		AllLabel:      "All",
		AllIcon:       "icon-list",
		DraftLabel:    "Draft",
		PendingLabel:  "Pending",
		ApprovedLabel: "Approved",
		PaidLabel:     "Paid",
		BlockedLabel:  "Blocked",
		OnHoldLabel:   "On Hold",
		CompleteLabel: "Complete",

		PurchasesPendingIcon:  "icon-clock",
		PurchasesApprovedIcon: "icon-check-circle",
		PurchasesPaidIcon:     "icon-check-circle",

		ExpensesPendingIcon:  "icon-clock",
		ExpensesApprovedIcon: "icon-check-circle",
		ExpensesPaidIcon:     "icon-check-circle",

		ClientsActiveIcon:         "icon-user-check",
		ClientsInactiveIcon:       "icon-user-minus",
		ClientsTagsLabel:          "Tags",
		ClientsTagsIcon:           "icon-tag",
		UsersActiveIcon:           "icon-shield",
		UsersInactiveIcon:         "icon-user-minus",
		UsersRolesLabel:           "Roles",
		UsersRolesIcon:            "icon-shield",
		SalesOngoingLabel:         "Ongoing",
		SalesOngoingIcon:          "icon-shopping-bag",
		SalesCompleteLabel:        "Complete",
		SalesCompleteIcon:         "icon-check-circle",
		SalesCancelledLabel:       "Cancelled",
		SalesCancelledIcon:        "icon-x-circle",
		PriceListsActiveIcon:      "icon-tag",
		PriceListsInactiveIcon:    "icon-tag",
		MasterlistLabel:           "Masterlist",
		MasterlistIcon:            "icon-package",
		MovementsLabel:            "Transactions",
		MovementsIcon:             "icon-repeat",
		RevenueLabel:              "Revenue",
		RevenueIcon:               "icon-trending-up",
		CostOfSalesLabel:          "Cost of Sales",
		CostOfSalesIcon:           "icon-package",
		GrossProfitLabel:          "Gross Profit",
		GrossProfitIcon:           "icon-bar-chart",
		ExpensesReportLabel:       "Expenses",
		ExpensesReportIcon:        "icon-file-minus",
		NetProfitLabel:            "Net Profit",
		NetProfitIcon:             "icon-dollar-sign",
		LocationsActiveIcon:       "icon-map-pin",
		LocationsInactiveIcon:     "icon-map-pin",
		AssetsActiveIcon:          "icon-archive",
		AssetsInactiveIcon:        "icon-archive",
		FixedAssetsLabel:          "Fixed Assets",
		FixedAssetsIcon:           "icon-archive",
		SuppliersActiveIcon:       "icon-truck",
		SuppliersBlockedIcon:      "icon-x-circle",
		SuppliersOnHoldIcon:       "icon-pause-circle",
		PlansActiveIcon:           "icon-file-text",
		PlansInactiveIcon:         "icon-file-minus",
		ServicesActiveIcon:        "icon-layers",
		ServicesInactiveIcon:      "icon-x-circle",
		SubscriptionsActiveIcon:   "icon-refresh-cw",
		SubscriptionsInactiveIcon: "icon-x-circle",
		CollectionsPendingIcon:    "icon-clock",
		CollectionsCompleteIcon:   "icon-check-circle",
		DisbursementsDraftIcon:    "icon-edit",
		DisbursementsPendingIcon:  "icon-clock",
		DisbursementsApprovedIcon: "icon-check-circle",
		DisbursementsPaidIcon:     "icon-check-circle",
		PermissionsActiveIcon:     "icon-key",
		PermissionsInactiveIcon:   "icon-key",
		WorkspacesActiveIcon:      "icon-briefcase",
		WorkspacesInactiveIcon:    "icon-briefcase",

		CashBookLabel:             "Cash Book",
		CashBookIcon:              "icon-book",
		PayablesAgingLabel:        "Payables Aging",
		PayablesAgingIcon:         "icon-file-text",
		ReceivablesAgingLabel:     "Receivables Aging",
		ReceivablesAgingIcon:      "icon-file-text",
		SalesSummaryLabel:         "Sales Summary",
		SalesSummaryIcon:          "icon-bar-chart",
		PurchasesSummaryLabel:     "Purchases Summary",
		PurchasesSummaryIcon:      "icon-bar-chart",
		ExpensesSummaryLabel:      "Expenses Summary",
		ExpensesSummaryIcon:       "icon-bar-chart",
		LapsingScheduleLabel:      "Lapsing Schedule",
		LapsingScheduleIcon:       "icon-calendar",
		DepreciationPoliciesLabel: "Depreciation Policies",
		DepreciationPoliciesIcon:  "icon-settings",

		InvoiceTemplatesLabel: "Invoice Templates",
		InvoiceTemplatesIcon:  "icon-file-text",

		PurchaseTemplatesLabel: "Templates",
		PurchaseTemplatesIcon:  "icon-file-text",

		ExpenseCategoriesLabel: "Expense Categories",
		ExpenseCategoriesIcon:  "icon-tag",

		HomeIcon: "icon-home",
		FABIcon:  "icon-calendar-plus",
		MoreIcon: "icon-grid",
	}
}
