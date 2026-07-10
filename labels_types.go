package pyeza

import "github.com/erniealice/pyeza-golang/types"

// TabLabels holds shared tab label strings used across all domain packages
type TabLabels struct {
	Attachments string `json:"attachments"`
}

// AuditLabels holds translatable strings for the audit history tab.
type AuditLabels struct {
	History       string               `json:"history"`
	Action        string               `json:"action"`
	Actor         string               `json:"actor"`
	Timestamp     string               `json:"timestamp"`
	ChangedFields string               `json:"changed_fields"`
	OldValue      string               `json:"old_value"`
	NewValue      string               `json:"new_value"`
	NoHistory     string               `json:"no_history"`
	Details       string               `json:"details"`
	Actions       AuditActionLabels    `json:"actions"`
	FieldTypes    AuditFieldTypeLabels `json:"field_types"`
}

// AuditActionLabels holds display names for audit action types.
type AuditActionLabels struct {
	Insert  string `json:"insert"`
	Update  string `json:"update"`
	Delete  string `json:"delete"`
	Restore string `json:"restore"`
	Archive string `json:"archive"`
}

// AuditFieldTypeLabels holds display names for field types.
type AuditFieldTypeLabels struct {
	String    string `json:"string"`
	Int64     string `json:"int64"`
	Bool      string `json:"bool"`
	Timestamp string `json:"timestamp"`
	UUID      string `json:"uuid"`
	Enum      string `json:"enum"`
	Text      string `json:"text"`
}

// SidebarLabels holds sidebar navigation labels
type SidebarLabels struct {
	AppSwitcher AppSwitcherLabels        `json:"app_switcher"`
	Apps        AppLabels                `json:"apps"`
	Clients     SidebarClientsLabels     `json:"clients"`
	Regulations SidebarRegulationsLabels `json:"regulations"`
	Marketplace SidebarMarketplaceLabels `json:"marketplace"`
	Quotes      SidebarQuotesLabels      `json:"quotes"`
	Users       SidebarUsersLabels       `json:"users"`
	Reports     SidebarReportsLabels     `json:"reports"`
	Main        SidebarMainLabels        `json:"main"`
	Support     SidebarSupportLabels     `json:"support"`
	UserMenu    UserMenuLabels           `json:"user_menu"`
	UserCard    UserCardLabels           `json:"user_card"`
}

type AppSwitcherLabels struct {
	SwitchApp string `json:"switch_app"`
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
	PaymentTerms string `json:"payment_terms"`
}

type SidebarRegulationsLabels struct {
	Title            string `json:"title"`
	Awards           string `json:"awards"`
	Agreements       string `json:"agreements"`
	WorkersComp      string `json:"workers_comp"`
	Superannuation   string `json:"superannuation"`
	PayrollTax       string `json:"payroll_tax"`
	Settings         string `json:"settings"`
	PayItems         string `json:"pay_items"`
	PayItemsMapping  string `json:"pay_items_mapping"`
	AwardMultipliers string `json:"award_multipliers"`
	AdditionalItems  string `json:"additional_items"`
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
	ApprovedSigned    string `json:"approved_signed"`
	ForApproval       string `json:"for_approval"`
	Templates         string `json:"templates"`
	Archived          string `json:"archived"`
	Settings          string `json:"settings"`
	QuoteTemplates    string `json:"quote_templates"`
	ContractTemplates string `json:"contract_templates"`
	ProposalTemplates string `json:"proposal_templates"`
	CostManagement    string `json:"cost_management"`
}

type SidebarUsersLabels struct {
	Title         string `json:"title"`
	AdminManagers string `json:"admin_managers"`
	Managers      string `json:"managers"`
	Standard      string `json:"standard"`
	Spectator     string `json:"spectator"`
	Settings      string `json:"settings"`
	UserDivisions string `json:"user_divisions"`
}

type SidebarReportsLabels struct {
	Title        string `json:"title"`
	Quote        string `json:"quote"`
	AwardChanges string `json:"award_changes"`
}

type SidebarMainLabels struct {
	Title     string `json:"title"`
	Dashboard string `json:"dashboard"`
}

type SidebarSupportLabels struct {
	Title      string `json:"title"`
	HelpCenter string `json:"help_center"`
}

type UserMenuLabels struct {
	Profile string `json:"profile"`
	Billing string `json:"billing"`
	Logout  string `json:"logout"`
}

type UserCardLabels struct {
	ProPlan string `json:"pro_plan"`
}

type HeaderLabels struct {
	WelcomeBack       string `json:"welcome_back"`
	SearchPlaceholder string `json:"search_placeholder"`
	SearchShortcut    string `json:"search_shortcut"`
	Notifications     string `json:"notifications"`
	ShowHelp          string `json:"show_help"`
}

type NotificationLabels struct {
	Title       string                  `json:"title"`
	MarkAllRead string                  `json:"mark_all_read"`
	Close       string                  `json:"close"`
	Tabs        NotificationTabLabels   `json:"tabs"`
	Loading     string                  `json:"loading"`
	Empty       NotificationEmptyLabels `json:"empty"`
	ViewAll     string                  `json:"view_all"`
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
	Title         string             `json:"title"`
	Toggle        string             `json:"toggle"`
	ChangeTheme   string             `json:"change_theme"`
	Themes        ThemeOptionLabels  `json:"themes"`
	FontFamily    string             `json:"font_family"`
	Fonts         FontOptionLabels   `json:"fonts"`
	Density       ThemeDensityLabels `json:"density"`
	Radius        ThemeRadiusLabels  `json:"radius"`
	Border        ThemeBorderLabels  `json:"border"`
	ResetDefaults string             `json:"reset_defaults"`
}

type ThemeOptionLabels struct {
	WarmCream        string `json:"warm_cream"`
	OceanDeep        string `json:"ocean_deep"`
	ForestNight      string `json:"forest_night"`
	MinimalLight     string `json:"minimal_light"`
	SunsetGlow       string `json:"sunset_glow"`
	CorporateSteel   string `json:"corporate_steel"`
	PaperInk         string `json:"paper_ink"`
	PeachFizz        string `json:"peach_fizz"`
	ModernRetail     string `json:"modern_retail"`
	IchizenDefault   string `json:"ichizen_default"`
	SalonBlush       string `json:"salon_blush"`
	LedgerMono       string `json:"ledger_mono"`
	BrutalistInk     string `json:"brutalist_ink"`
	SoftClay         string `json:"soft_clay"`
	RisoPop          string `json:"riso_pop"`
	AtelierInk       string `json:"atelier_ink"`
	Ultramarine      string `json:"ultramarine"`
	TerminalPhosphor string `json:"terminal_phosphor"`
	VelvetNoir       string `json:"velvet_noir"`
	KyotoIndigo      string `json:"kyoto_indigo"`
	MatchaGarden     string `json:"matcha_garden"`
	MidnightScholar  string `json:"midnight_scholar"`
	AuroraHaze       string `json:"aurora_haze"`
	BlueprintDraft   string `json:"blueprint_draft"`
}

type ThemeDensityLabels struct {
	Title       string `json:"title"`
	Dense       string `json:"dense"`
	Compact     string `json:"compact"`
	Default     string `json:"default"`
	Comfortable string `json:"comfortable"`
}

type ThemeRadiusLabels struct {
	Title   string `json:"title"`
	None    string `json:"none"`
	Sm      string `json:"sm"`
	Default string `json:"default"`
	Lg      string `json:"lg"`
	Full    string `json:"full"`
}

type ThemeBorderLabels struct {
	Title   string `json:"title"`
	None    string `json:"none"`
	Default string `json:"default"`
	Heavy   string `json:"heavy"`
}

type FontOptionLabels struct {
	Default        string `json:"default"`
	Serif          string `json:"serif"`
	Mono           string `json:"mono"`
	Rounded        string `json:"rounded"`
	Condensed      string `json:"condensed"`
	Exa            string `json:"exa"`
	IchizenMinimal string `json:"ichizen_minimal"`
}

type HelpPaneLabels struct {
	Title string `json:"title"`
	Close string `json:"close"`
}

// CommonColumnLabels holds genuinely-shared table column-header names reused
// across many domain list/report views (Code, Name, Amount, Status, Date,
// etc.). Domain-specific column names stay in their own domain label structs.
type CommonColumnLabels struct {
	Code        string `json:"code"`
	Name        string `json:"name"`
	Amount      string `json:"amount"`
	Status      string `json:"status"`
	Date        string `json:"date"`
	Description string `json:"description"`
	Reference   string `json:"reference"`
	Type        string `json:"type"`
	Total       string `json:"total"`
}

type CommonTableLabels struct {
	Search                   string             `json:"search"`
	SearchPlaceholder        string             `json:"search_placeholder"`
	Filters                  string             `json:"filters"`
	FilterConditions         string             `json:"filter_conditions"`
	ClearAll                 string             `json:"clear_all"`
	AddCondition             string             `json:"add_condition"`
	Clear                    string             `json:"clear"`
	ApplyFilters             string             `json:"apply_filters"`
	Sort                     string             `json:"sort"`
	Ascending                string             `json:"ascending"`
	Descending               string             `json:"descending"`
	Columns                  string             `json:"columns"`
	Export                   string             `json:"export"`
	ExportCsv                string             `json:"export_csv"`
	ExportExcel              string             `json:"export_excel"`
	Density                  TableDensityLabels `json:"density"`
	SelectAll                string             `json:"select_all"`
	BulkSelectAllPage        string             `json:"bulk_select_all_page"`
	BulkSelectAllAcrossPages string             `json:"bulk_select_all_across_pages"`
	BulkClearSelection       string             `json:"bulk_clear_selection"`
	ColumnSortLockedHint     string             `json:"column_sort_locked_hint"`
	SortAscText              string             `json:"sort_asc_text"`
	SortDescText             string             `json:"sort_desc_text"`
	SortAscNumber            string             `json:"sort_asc_number"`
	SortDescNumber           string             `json:"sort_desc_number"`
	SortAscDate              string             `json:"sort_asc_date"`
	SortDescDate             string             `json:"sort_desc_date"`
	SortAscEnum              string             `json:"sort_asc_enum"`
	SortDescEnum             string             `json:"sort_desc_enum"`
	// Phase 8 — filter widget operator labels
	FilterOpContains   string `json:"filter_op_contains"`
	FilterOpEquals     string `json:"filter_op_equals"`
	FilterOpStartsWith string `json:"filter_op_starts_with"`
	FilterOpEndsWith   string `json:"filter_op_ends_with"`
	FilterOpNotEquals  string `json:"filter_op_not_equals"`
	FilterOpBetween    string `json:"filter_op_between"`
	FilterOpEq         string `json:"filter_op_eq"`
	FilterOpNeq        string `json:"filter_op_neq"`
	FilterOpGt         string `json:"filter_op_gt"`
	FilterOpGte        string `json:"filter_op_gte"`
	FilterOpLt         string `json:"filter_op_lt"`
	FilterOpLte        string `json:"filter_op_lte"`
	FilterOpOn         string `json:"filter_op_on"`
	FilterOpBefore     string `json:"filter_op_before"`
	FilterOpAfter      string `json:"filter_op_after"`
	FilterOpIn         string `json:"filter_op_in"`
	FilterOpNotIn      string `json:"filter_op_not_in"`
	// Phase 8 — date preset chips
	FilterPresetToday  string `json:"filter_preset_today"`
	FilterPreset7d     string `json:"filter_preset7d"`
	FilterPreset30d    string `json:"filter_preset30d"`
	FilterPresetMonth  string `json:"filter_preset_month"`
	FilterPresetCustom string `json:"filter_preset_custom"`
	// Phase 8 — boolean tri-state labels
	FilterAny string `json:"filter_any"`
	FilterYes string `json:"filter_yes"`
	FilterNo  string `json:"filter_no"`
	// Phase 8 — placeholders
	FilterSearchPlaceholder string            `json:"filter_search_placeholder"`
	FilterMinPlaceholder    string            `json:"filter_min_placeholder"`
	FilterMaxPlaceholder    string            `json:"filter_max_placeholder"`
	SelectRow               string            `json:"select_row"`
	Actions                 string            `json:"actions"`
	Show                    string            `json:"show"`
	Entries                 string            `json:"entries"`
	Showing                 string            `json:"showing"`
	To                      string            `json:"to"`
	Of                      string            `json:"of"`
	EntriesLabel            string            `json:"entries_label"`
	ColumnsLabel            TableColumnLabels `json:"columns_label"`
}

type TableColumnLabels struct {
	Name     string `json:"name"`
	Email    string `json:"email"`
	Division string `json:"division"`
	Office   string `json:"office"`
	Status   string `json:"status"`
	Slug     string `json:"slug"`
	Town     string `json:"town"`
	State    string `json:"state"`
	Country  string `json:"country"`
	Phone    string `json:"phone"`
}

type TableDensityLabels struct {
	Title       string `json:"title"`
	Dense       string `json:"dense"`
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
	LoadMore     string `json:"load_more"`
	Showing      string `json:"showing"`
	Items        string `json:"items"`
	AllLoaded    string `json:"all_loaded"`
	PreviousPage string `json:"previous_page"`
	NextPage     string `json:"next_page"`
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
	SelectAll   string `json:"select_all"`
	DeselectAll string `json:"deselect_all"`
	More        string `json:"more"`
	Less        string `json:"less"`
	SeeMore     string `json:"see_more"`
	SeeLess     string `json:"see_less"`
	MoreOptions string `json:"more_options"`
	Settings    string `json:"settings"`
	Connect     string `json:"connect"`
	Configure   string `json:"configure"`
	ReadMore    string `json:"read_more"`
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
	// CopySuffix feeds the flat-message key "actions.copySuffix" consumed by
	// view.ViewContext.CopySuffix(); keep it on the struct so the lyngua
	// audit tooling reports missing translations.
	CopySuffix string `json:"copy_suffix"`
}

type BulkLabels struct {
	SelectAll      string `json:"select_all"`
	Selected       string `json:"selected"`
	Cancel         string `json:"cancel"`
	ClearSelection string `json:"clear_selection"`
	Activate       string `json:"activate"`
	Deactivate     string `json:"deactivate"`
	Delete         string `json:"delete"`
	Archive        string `json:"archive"`
	Approve        string `json:"approve"`
}

type StatusLabels struct {
	Active       string `json:"active"`
	Inactive     string `json:"inactive"`
	Blocked      string `json:"blocked"`
	OnHold       string `json:"on_hold"`
	Prospect     string `json:"prospect"`
	Pending      string `json:"pending"`
	Draft        string `json:"draft"`
	Approved     string `json:"approved"`
	Archived     string `json:"archived"`
	Connected    string `json:"connected"`
	Disconnected string `json:"disconnected"`
	Default      string `json:"default"`
}

type EmptyLabels struct {
	NoResults string `json:"no_results"`
	NoData    string `json:"no_data"`
}

// BadgeLabels holds short translatable values rendered as table badges
// or inline status indicators across packages. Source of truth lives in
// lyngua's shared.json under the "badges" subtree; loaded into
// CommonLabels.Badges by composition.loadTranslations so any view across
// any package can read e.g. .CommonLabels.Badges.Yes / .No.
type BadgeLabels struct {
	Allow        string `json:"allow"`
	Deny         string `json:"deny"`
	Yes          string `json:"yes"`
	No           string `json:"no"`
	NoPermission string `json:"no_permission"`
}

type LoadingLabels struct {
	Loading    string `json:"loading"`
	PleaseWait string `json:"please_wait"`
}

type ErrorLabels struct {
	General      string `json:"general"`
	NotFound     string `json:"not_found"`
	Unauthorized string `json:"unauthorized"`
	Forbidden    string `json:"forbidden"`
	// NoPermission is the legacy static tooltip ("No permission") still used
	// for status-gated (non-permission) Disabled tooltips, e.g. "Paid invoice
	// cannot be edited" surfaces are NOT permission errors.
	NoPermission string `json:"no_permission"`
	// MissingPermission is a printf template ("Missing permission: %s") used
	// by permission-gated widgets to surface the specific entity:action code
	// the user is missing. AWS-style — actionable. See plan
	// docs/plan/20260514-permission-gates/plan.md §"Pyeza primitive contract".
	MissingPermission   string `json:"missing_permission"`
	PermissionDenied    string `json:"permission_denied"`
	InvalidFormData     string `json:"invalid_form_data"`
	InvalidStatus       string `json:"invalid_status"`
	InvalidTargetStatus string `json:"invalid_target_status"`
	IDRequired          string `json:"id_required"`
	NoIDsProvided       string `json:"no_ids_provided"`
}

type DropdownLabels struct {
	MoreOptions string `json:"more_options"`
}

type IntegrationLabels struct {
	Popular   string `json:"popular"`
	Connected string `json:"connected"`
	Settings  string `json:"settings"`
	Connect   string `json:"connect"`
}

type CardLabels struct {
	ReadMore string `json:"read_more"`
}

// DurationUnitLabels holds duration unit display variants.
// The DB stores the plural stem ("days", "weeks", "months", "years").
// - Singular/Plural: count-aware display ("1 day" / "3 days") — used by FormatDuration.
// - Select: type-selector form ("day(s)") — used by drawer form dropdowns.
type DurationUnitLabels struct {
	DaySingular   string `json:"day_singular"`
	DayPlural     string `json:"day_plural"`
	DaySelect     string `json:"day_select"`
	WeekSingular  string `json:"week_singular"`
	WeekPlural    string `json:"week_plural"`
	WeekSelect    string `json:"week_select"`
	MonthSingular string `json:"month_singular"`
	MonthPlural   string `json:"month_plural"`
	MonthSelect   string `json:"month_select"`
	YearSingular  string `json:"year_singular"`
	YearPlural    string `json:"year_plural"`
	YearSelect    string `json:"year_select"`
}

// CurrencyLabels is the shape of a translatable currency picker — a
// placeholder string plus a list of select options. Pyeza owns this shape
// (same role it plays for every other common-block label type) so any
// consumer view can declare a field of this type and have lyngua's loader
// populate it from a JSON bundle. Pyeza never owns the curated list — that
// lives here in pyeza (DefaultCurrencyOptions, BuildCurrencyOptions).
//
// Conventionally loaded from translations/en/common/currency.json by each
// view that renders a currency picker, mirroring how DurationUnitLabels is
// loaded from translations/en/common/common.json.
type CurrencyLabels struct {
	Placeholder string               `json:"placeholder"`
	Options     []types.SelectOption `json:"options"`
}

// ToastLabels holds translatable strings for the centralized toast component.
// Surfaced to JS via <body data-lf-toast-*> attributes set by the app shell;
// the lf.Toast module reads them at runtime so no English text is hardcoded
// on the JS side. Loaded from common/common.json#toast.
type ToastLabels struct {
	// Saved is the message used by Sheet.handleResponse when a generic form
	// submit succeeds. Empty value suppresses the toast (no English fallback).
	Saved string `json:"saved"`
	// Dismiss is the aria-label applied to a toast's close button.
	Dismiss string `json:"dismiss"`
}

// SheetLabels holds translatable strings for the form-drawer (sheet)
// component. Surfaced to JS via <body data-lf-sheet-*> attrs. Loaded from
// common/common.json#sheet.
type SheetLabels struct {
	// ErrorFallback is the message shown when a sheet-form submit returns
	// a non-2xx response without HX-Error-Message. Empty value suppresses.
	ErrorFallback string `json:"error_fallback"`
	// DismissAlert is the aria-label for the close button on the inline
	// error alert that appears inside the drawer body on submit failure.
	DismissAlert string `json:"dismiss_alert"`
}

// A11yLabels holds tier-invariant accessibility strings shared across every
// page and component — skip-links, icon-only control labels, etc. These are
// assistive-technology affordances, not business copy, so they live in the
// common tier (general.json) and are NOT tier-overridden. Loaded from
// common/common.json#a11y into CommonLabels.A11y.
type A11yLabels struct {
	// SkipToContent is the visually-hidden "skip to main content" link text
	// rendered at the top of every shell so keyboard users can bypass the
	// sidebar/header. Read by app-shell / portal-shell.
	SkipToContent string `json:"skip_to_content"`
	// MoreInfo is the aria-label on the icon-only (i) popover trigger beside
	// a form label. Read by the form-group component when an Info param is set.
	MoreInfo string `json:"more_info"`
}
