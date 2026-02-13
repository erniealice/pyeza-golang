package pyeza

// CommonLabels holds translatable strings for common/shared ui.
type CommonLabels struct {
	Sidebar       SidebarLabels       `json:"sidebar"`
	Header        HeaderLabels        `json:"header"`
	Notifications NotificationLabels  `json:"notifications"`
	Settings      SettingsLabels      `json:"settings"`
	Theme         ThemeLabels         `json:"theme"`
	HelpPane      HelpPaneLabels      `json:"helpPane"`
	Table         CommonTableLabels   `json:"table"`
	Pagination    PaginationLabels    `json:"pagination"`
	Buttons       ButtonLabels        `json:"buttons"`
	Actions       ActionLabels        `json:"actions"`
	Bulk          BulkLabels          `json:"bulk"`
	Status        StatusLabels        `json:"status"`
	Empty         EmptyLabels         `json:"empty"`
	Loading       LoadingLabels       `json:"loading"`
	Errors        ErrorLabels         `json:"errors"`
	Dropdown      DropdownLabels      `json:"dropdown"`
	Integration   IntegrationLabels   `json:"integration"`
	Card          CardLabels          `json:"card"`
}

// SidebarLabels holds sidebar navigation labels
type SidebarLabels struct {
	AppSwitcher AppSwitcherLabels        `json:"appSwitcher"`
	Apps        AppLabels                `json:"apps"`
	Clients     SidebarClientsLabels     `json:"clients"`
	Regulations SidebarRegulationsLabels `json:"regulations"`
	Marketplace SidebarMarketplaceLabels `json:"marketplace"`
	Quotes      SidebarQuotesLabels      `json:"quotes"`
	Users       SidebarUsersLabels       `json:"users"`
	Reports     SidebarReportsLabels     `json:"reports"`
	Main        SidebarMainLabels        `json:"main"`
	Support     SidebarSupportLabels     `json:"support"`
	UserMenu    UserMenuLabels           `json:"userMenu"`
	UserCard    UserCardLabels           `json:"userCard"`
}

type AppSwitcherLabels struct {
	SwitchApp string `json:"switchApp"`
}

type AppLabels struct {
	Clients     string `json:"clients"`
	Regulations string `json:"regulations"`
	Marketplace string `json:"marketplace"`
	Quotes      string `json:"quotes"`
	Users       string `json:"users"`
	Reports     string `json:"reports"`
}

type SidebarClientsLabels struct {
	Title        string `json:"title"`
	Active       string `json:"active"`
	Prospect     string `json:"prospect"`
	Inactive     string `json:"inactive"`
	Settings     string `json:"settings"`
	PaymentTerms string `json:"paymentTerms"`
}

type SidebarRegulationsLabels struct {
	Title            string `json:"title"`
	Awards           string `json:"awards"`
	Agreements       string `json:"agreements"`
	WorkersComp      string `json:"workersComp"`
	Superannuation   string `json:"superannuation"`
	PayrollTax       string `json:"payrollTax"`
	Settings         string `json:"settings"`
	PayItems         string `json:"payItems"`
	PayItemsMapping  string `json:"payItemsMapping"`
	AwardMultipliers string `json:"awardMultipliers"`
	AdditionalItems  string `json:"additionalItems"`
}

type SidebarMarketplaceLabels struct {
	Title      string `json:"title"`
	CRM        string `json:"crm"`
	RMS        string `json:"rms"`
	Payroll    string `json:"payroll"`
	Accounting string `json:"accounting"`
}

type SidebarQuotesLabels struct {
	Title             string `json:"title"`
	Calculation       string `json:"calculation"`
	ApprovedSigned    string `json:"approvedSigned"`
	ForApproval       string `json:"forApproval"`
	Templates         string `json:"templates"`
	Archived          string `json:"archived"`
	Settings          string `json:"settings"`
	QuoteTemplates    string `json:"quoteTemplates"`
	ContractTemplates string `json:"contractTemplates"`
	ProposalTemplates string `json:"proposalTemplates"`
	CostManagement    string `json:"costManagement"`
}

type SidebarUsersLabels struct {
	Title         string `json:"title"`
	AdminManagers string `json:"adminManagers"`
	Managers      string `json:"managers"`
	Standard      string `json:"standard"`
	Spectator     string `json:"spectator"`
	Settings      string `json:"settings"`
	UserDivisions string `json:"userDivisions"`
}

type SidebarReportsLabels struct {
	Title       string `json:"title"`
	Quote       string `json:"quote"`
	AwardChanges string `json:"awardChanges"`
}

type SidebarMainLabels struct {
	Title     string `json:"title"`
	Dashboard string `json:"dashboard"`
}

type SidebarSupportLabels struct {
	Title      string `json:"title"`
	HelpCenter string `json:"helpCenter"`
}

type UserMenuLabels struct {
	Profile string `json:"profile"`
	Billing string `json:"billing"`
	Logout  string `json:"logout"`
}

type UserCardLabels struct {
	ProPlan string `json:"proPlan"`
}

type HeaderLabels struct {
	WelcomeBack       string `json:"welcomeBack"`
	SearchPlaceholder string `json:"searchPlaceholder"`
	SearchShortcut    string `json:"searchShortcut"`
	Notifications     string `json:"notifications"`
	ShowHelp          string `json:"showHelp"`
}

type NotificationLabels struct {
	Title       string                  `json:"title"`
	MarkAllRead string                  `json:"markAllRead"`
	Close       string                  `json:"close"`
	Tabs        NotificationTabLabels   `json:"tabs"`
	Loading     string                  `json:"loading"`
	Empty       NotificationEmptyLabels `json:"empty"`
	ViewAll     string                  `json:"viewAll"`
}

type NotificationTabLabels struct {
	All    string `json:"all"`
	Unread string `json:"unread"`
	Alerts string `json:"alerts"`
}

type NotificationEmptyLabels struct {
	Title   string `json:"title"`
	Message string `json:"message"`
}

type SettingsLabels struct {
	Title   string                `json:"title"`
	Close   string                `json:"close"`
	Account SettingsAccountLabels `json:"account"`
	Billing SettingsBillingLabels `json:"billing"`
	Loading string                `json:"loading"`
}

type SettingsAccountLabels struct {
	Title    string `json:"title"`
	Profile  string `json:"profile"`
	Security string `json:"security"`
}

type SettingsBillingLabels struct {
	Title   string `json:"title"`
	Billing string `json:"billing"`
}

type ThemeLabels struct {
	Title       string            `json:"title"`
	Toggle      string            `json:"toggle"`
	ChangeTheme string            `json:"changeTheme"`
	Themes      ThemeOptionLabels `json:"themes"`
	FontFamily  string            `json:"fontFamily"`
	Fonts       FontOptionLabels  `json:"fonts"`
}

type ThemeOptionLabels struct {
	WarmCream      string `json:"warmCream"`
	OceanDeep      string `json:"oceanDeep"`
	ForestNight    string `json:"forestNight"`
	MinimalLight   string `json:"minimalLight"`
	SunsetGlow     string `json:"sunsetGlow"`
	CorporateSteel string `json:"corporateSteel"`
	PaperInk       string `json:"paperInk"`
	PeachFizz      string `json:"peachFizz"`
}

type FontOptionLabels struct {
	Default   string `json:"default"`
	Serif     string `json:"serif"`
	Mono      string `json:"mono"`
	Rounded   string `json:"rounded"`
	Condensed string `json:"condensed"`
	Exa       string `json:"exa"`
}

type HelpPaneLabels struct {
	Title string `json:"title"`
	Close string `json:"close"`
}

type CommonTableLabels struct {
	Search            string              `json:"search"`
	SearchPlaceholder string              `json:"searchPlaceholder"`
	Filters           string              `json:"filters"`
	FilterConditions  string              `json:"filterConditions"`
	ClearAll          string              `json:"clearAll"`
	AddCondition      string              `json:"addCondition"`
	Clear             string              `json:"clear"`
	ApplyFilters      string              `json:"applyFilters"`
	Sort              string              `json:"sort"`
	Ascending         string              `json:"ascending"`
	Descending        string              `json:"descending"`
	Columns           string              `json:"columns"`
	Export            string              `json:"export"`
	ExportCsv         string              `json:"exportCsv"`
	ExportExcel       string              `json:"exportExcel"`
	Density           TableDensityLabels  `json:"density"`
	SelectAll         string              `json:"selectAll"`
	SelectRow         string              `json:"selectRow"`
	Actions           string              `json:"actions"`
	Show              string              `json:"show"`
	Entries           string              `json:"entries"`
	Showing           string              `json:"showing"`
	To                string              `json:"to"`
	Of                string              `json:"of"`
	EntriesLabel      string              `json:"entriesLabel"`
	ColumnsLabel      TableColumnLabels   `json:"columnsLabel"`
}

type TableColumnLabels struct {
	Name    string `json:"name"`
	Email   string `json:"email"`
	Division string `json:"division"`
	Office  string `json:"office"`
	Status  string `json:"status"`
	Slug    string `json:"slug"`
	Town    string `json:"town"`
	State   string `json:"state"`
	Country string `json:"country"`
	Phone   string `json:"phone"`
}

type TableDensityLabels struct {
	Title       string `json:"title"`
	Default     string `json:"default"`
	Comfortable string `json:"comfortable"`
	Compact     string `json:"compact"`
}

type PaginationLabels struct {
	Prev         string `json:"prev"`
	Next         string `json:"next"`
	Previous     string `json:"previous"`
	Page         string `json:"page"`
	Of           string `json:"of"`
	LoadMore     string `json:"loadMore"`
	Showing      string `json:"showing"`
	Items        string `json:"items"`
	AllLoaded    string `json:"allLoaded"`
	PreviousPage string `json:"previousPage"`
	NextPage     string `json:"nextPage"`
}

type ButtonLabels struct {
	Save        string `json:"save"`
	Cancel      string `json:"cancel"`
	Delete      string `json:"delete"`
	Edit        string `json:"edit"`
	View        string `json:"view"`
	Add         string `json:"add"`
	Create      string `json:"create"`
	Update      string `json:"update"`
	Submit      string `json:"submit"`
	Close       string `json:"close"`
	Confirm     string `json:"confirm"`
	Back        string `json:"back"`
	Next        string `json:"next"`
	Previous    string `json:"previous"`
	Done        string `json:"done"`
	Apply       string `json:"apply"`
	Reset       string `json:"reset"`
	Refresh     string `json:"refresh"`
	Download    string `json:"download"`
	Upload      string `json:"upload"`
	Export      string `json:"export"`
	Import      string `json:"import"`
	Search      string `json:"search"`
	Filter      string `json:"filter"`
	Clear       string `json:"clear"`
	SelectAll   string `json:"selectAll"`
	DeselectAll string `json:"deselectAll"`
	More        string `json:"more"`
	Less        string `json:"less"`
	SeeMore     string `json:"seeMore"`
	SeeLess     string `json:"seeLess"`
	MoreOptions string `json:"moreOptions"`
	Settings    string `json:"settings"`
	Connect     string `json:"connect"`
	Configure   string `json:"configure"`
	ReadMore    string `json:"readMore"`
}

type ActionLabels struct {
	View       string `json:"view"`
	Edit       string `json:"edit"`
	Clone      string `json:"clone"`
	Delete     string `json:"delete"`
	Download   string `json:"download"`
	Archive    string `json:"archive"`
	Restore    string `json:"restore"`
	Activate   string `json:"activate"`
	Deactivate string `json:"deactivate"`
	Approve    string `json:"approve"`
	Export     string `json:"export"`
}

type BulkLabels struct {
	SelectAll      string `json:"selectAll"`
	Selected       string `json:"selected"`
	Cancel         string `json:"cancel"`
	ClearSelection string `json:"clearSelection"`
	Activate       string `json:"activate"`
	Deactivate     string `json:"deactivate"`
	Delete         string `json:"delete"`
	Archive        string `json:"archive"`
	Approve        string `json:"approve"`
}

type StatusLabels struct {
	Active       string `json:"active"`
	Inactive     string `json:"inactive"`
	Pending      string `json:"pending"`
	Draft        string `json:"draft"`
	Approved     string `json:"approved"`
	Archived     string `json:"archived"`
	Connected    string `json:"connected"`
	Disconnected string `json:"disconnected"`
	Default      string `json:"default"`
}

type EmptyLabels struct {
	NoResults string `json:"noResults"`
	NoData    string `json:"noData"`
}

type LoadingLabels struct {
	Loading    string `json:"loading"`
	PleaseWait string `json:"pleaseWait"`
}

type ErrorLabels struct {
	General      string `json:"general"`
	NotFound     string `json:"notFound"`
	Unauthorized string `json:"unauthorized"`
	Forbidden    string `json:"forbidden"`
}

type DropdownLabels struct {
	MoreOptions string `json:"moreOptions"`
}

type IntegrationLabels struct {
	Popular   string `json:"popular"`
	Connected string `json:"connected"`
	Settings  string `json:"settings"`
	Connect   string `json:"connect"`
}

type CardLabels struct {
	ReadMore string `json:"readMore"`
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
