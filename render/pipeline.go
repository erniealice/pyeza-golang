package render

import (
	"context"
	"fmt"
	"log"
	"os"
	"reflect"
	"strings"
	"unicode/utf8"

	"github.com/erniealice/pyeza-golang/types"
	"github.com/erniealice/pyeza-golang/view"
)

// Pipeline holds the framework-agnostic render configuration and provides
// all inject/filter functions that transform ViewResult page data before
// it is handed to the template renderer.
//
// Construct via NewPipeline or zero-value + field assignment. All pointer
// fields and function fields are nil-safe (each method guards before use).
type Pipeline struct {
	// GetUserID extracts the authenticated user ID from a request context.
	// Wired from espyna consumer.ExtractUserIDFromContext by composition.
	GetUserID func(ctx context.Context) string

	// GetWorkspaceID extracts the active workspace ID from a request context.
	// Wired from espyna consumer.GetWorkspaceIDFromContext by composition.
	GetWorkspaceID func(ctx context.Context) string

	// PermLoader loads per-request RBAC permission codes. nil = no filtering.
	PermLoader PermissionLoader

	// WorkspaceLoader loads workspace data for the sidebar switcher. nil = disabled.
	WorkspaceLoader WorkspaceLoader

	// UserLoader loads the current user's display data for the sidebar profile
	// button. nil = disabled.
	UserLoader UserLoader

	// SidebarBuilder builds the staff (OPERATOR_OWNER / OPERATOR_STAFF) sidebar.
	SidebarBuilder SidebarBuilder

	// PortalSidebarBuilders maps PrincipalType to a portal sidebar builder.
	// nil = portal dispatch disabled (staff builder handles all routes).
	PortalSidebarBuilders map[PrincipalType]SidebarBuilder

	// BottomNavBuilder builds mobile bottom-nav tabs + app grid. nil = no bottom nav.
	BottomNavBuilder BottomNavBuilder

	// RenderIcon renders an icon name to template.HTML. nil = no icon rendering.
	RenderIcon IconRenderer

	// CommonLabels is injected into PageData.CommonLabels if not already set.
	CommonLabels any

	// Messages is injected into PageData.Messages if not already set.
	Messages map[string]string

	// DefaultTheme is injected into PageData.DefaultTheme if empty.
	DefaultTheme string

	// DefaultFont is injected into PageData.DefaultFont if empty.
	DefaultFont string

	// MessagesURL is the staff secure-messaging inbox URL (Plan-4). When set,
	// InjectUserPermissions populates PageData.HasMessages / .MessagesURL for
	// any principal holding conversation:list, lighting the header Messages button.
	// Empty disables the header Messages button.
	MessagesURL string

	// DevMode activates fail-loud nil-permissions panics (dev/test mode).
	// In production, nil UserPermissions is substituted with an empty set.
	DevMode bool
}

// portalPrincipalEntry maps a URL prefix to the PrincipalType it implies.
type portalPrincipalEntry struct {
	prefix        string
	principalType PrincipalType
}

// portalPrincipalPrefixes is the ordered list of portal URL prefixes.
// Longer prefixes appear first so that /portal/client-delegate/ does not
// match /portal/client/ when checking with strings.HasPrefix.
var portalPrincipalPrefixes = []portalPrincipalEntry{
	{"/portal/client-delegate/", PrincipalTypeClientDelegate},
	{"/portal/supplier-delegate/", PrincipalTypeSupplierDelegate},
	{"/portal/client/", PrincipalTypeClient},
	{"/portal/supplier/", PrincipalTypeSupplier},
}

// isDevMode reports whether the server is running in development mode.
// Development mode is detected by APP_ENV=development OR CONFIG_AUTH_PROVIDER=mock_auth.
// In dev mode, nil UserPermissions in context causes a panic so missing wiring is
// caught immediately rather than silently granting all permissions.
func isDevMode() bool {
	if os.Getenv("APP_ENV") == "development" {
		return true
	}
	provider := os.Getenv("CONFIG_AUTH_PROVIDER")
	return provider == "mock_auth"
}

// EnsureUserPermissionsInContext is a safety-net check that guarantees a non-nil
// *types.UserPermissions value in context before any view runs.
//
// Production: nil → types.NewEmptyUserPermissions() — fail-closed via the P3 type flip.
// Dev (APP_ENV=development or CONFIG_AUTH_PROVIDER=mock_auth): nil → panic with a
// descriptive message that identifies the missing wiring so developers fix it immediately.
//
// This must be called AFTER the permission-loading block in the adapter's Adapt() so
// that routes that legitimately load permissions (authenticated app routes) pass through
// unchanged. Routes that intentionally skip permission loading (login, static assets)
// will receive an empty UserPermissions — deny-by-default semantics apply.
func EnsureUserPermissionsInContext(ctx context.Context, path string, dev bool) context.Context {
	if view.GetUserPermissions(ctx) != nil {
		return ctx // already set — pass through unchanged
	}
	if dev {
		panic(fmt.Sprintf(
			"BUG: UserPermissions is nil at view layer — upstream middleware did not install permissions. "+
				"Check the loader chain (PermissionLoader.IsEnabled, getUserIDFromContext, workspaceID resolution). "+
				"Route: %s", path,
		))
	}
	// Production: substitute an explicit empty-but-valid set.
	return view.WithUserPermissions(ctx, types.NewEmptyUserPermissions())
}

// getUserID extracts the authenticated user ID from context using the
// injected GetUserID function. Returns "" when no function is wired.
func (p *Pipeline) getUserID(ctx context.Context) string {
	if p.GetUserID == nil {
		return ""
	}
	return p.GetUserID(ctx)
}

// getWorkspaceID extracts the active workspace ID from context using the
// injected GetWorkspaceID function. Returns "" when no function is wired.
func (p *Pipeline) getWorkspaceID(ctx context.Context) string {
	if p.GetWorkspaceID == nil {
		return ""
	}
	return p.GetWorkspaceID(ctx)
}

// InjectPageData sets CommonLabels, Messages, Nonce, HeaderIconHTML, Sidebar,
// DefaultTheme, DefaultFont, and BottomNav on the result data by reflecting
// into the embedded types.PageData struct.
//
// path is the request URL path used to select the correct sidebar builder.
// ctx carries the per-request workspace-rewritten RouteResult (installed by
// WorkspaceRouteRewriter in the adapter before view execution); the sidebar
// dispatch layer consumes it to rebuild the sidebar with workspace-prefixed URLs.
func (p *Pipeline) InjectPageData(ctx context.Context, data any, path string) {
	if data == nil {
		return
	}

	v := reflect.ValueOf(data)
	if v.Kind() == reflect.Ptr {
		v = v.Elem()
	}
	if v.Kind() != reflect.Struct {
		return
	}

	// Inject CommonLabels (only if not already set by the view)
	if p.CommonLabels != nil {
		if field := v.FieldByName("CommonLabels"); field.IsValid() && field.CanSet() {
			if field.IsZero() {
				field.Set(reflect.ValueOf(p.CommonLabels))
			}
		}
	}

	// Inject Messages (only if not already set by the view)
	if p.Messages != nil {
		if field := v.FieldByName("Messages"); field.IsValid() && field.CanSet() {
			if field.IsNil() {
				field.Set(reflect.ValueOf(p.Messages))
			}
		}
	}

	// Inject the per-request CSP nonce minted by the SecurityHeaders middleware
	// (only if not already set by the view).
	if n := NonceFromContext(ctx); n != "" {
		if f := v.FieldByName("Nonce"); f.IsValid() && f.CanSet() && f.String() == "" {
			f.SetString(n)
		}
		// Also inject into the nested Table field (types.TableConfig.Nonce) so that
		// inline <script> blocks inside the table component can carry the CSP nonce.
		if tableField := v.FieldByName("Table"); tableField.IsValid() {
			if tableField.Kind() == reflect.Ptr {
				tableField = tableField.Elem()
			}
			if tableField.Kind() == reflect.Struct {
				if tf := tableField.FieldByName("Nonce"); tf.IsValid() && tf.CanSet() && tf.String() == "" {
					tf.SetString(n)
				}
			}
		}
	}

	// Render HeaderIcon → HeaderIconHTML if icon name is set but HTML isn't
	if p.RenderIcon != nil {
		iconField := v.FieldByName("HeaderIcon")
		htmlField := v.FieldByName("HeaderIconHTML")
		if iconField.IsValid() && htmlField.IsValid() && htmlField.CanSet() {
			iconName := iconField.String()
			if iconName != "" && htmlField.Len() == 0 {
				htmlField.Set(reflect.ValueOf(p.RenderIcon(iconName)))
			}
		}
	}

	// Build and inject Sidebar config (only if not already set by the view).
	if builder := p.selectSidebarBuilder(ctx, path); builder != nil {
		sidebarField := v.FieldByName("Sidebar")
		if sidebarField.IsValid() && sidebarField.CanSet() && sidebarField.IsZero() {
			activeNav := ""
			activeSubNav := ""
			if f := v.FieldByName("ActiveNav"); f.IsValid() {
				activeNav = f.String()
			}
			if f := v.FieldByName("ActiveSubNav"); f.IsValid() {
				activeSubNav = f.String()
			}
			sidebar := builder(activeNav, activeSubNav)
			sidebarField.Set(reflect.ValueOf(sidebar))
		}
	}

	// Inject DefaultTheme and DefaultFont (only if not already set by the view)
	if p.DefaultTheme != "" {
		if field := v.FieldByName("DefaultTheme"); field.IsValid() && field.CanSet() {
			if field.String() == "" {
				field.SetString(p.DefaultTheme)
			}
		}
	}
	if p.DefaultFont != "" {
		if field := v.FieldByName("DefaultFont"); field.IsValid() && field.CanSet() {
			if field.String() == "" {
				field.SetString(p.DefaultFont)
			}
		}
	}

	// Build and inject BottomNav tabs + AllApps grid + AppGroups (only if not already set)
	if p.BottomNavBuilder != nil {
		activeNav := ""
		if f := v.FieldByName("ActiveNav"); f.IsValid() {
			activeNav = f.String()
		}
		if tabsField := v.FieldByName("BottomNavTabs"); tabsField.IsValid() && tabsField.CanSet() && tabsField.IsNil() {
			tabs, allApps, appGroups := p.BottomNavBuilder(activeNav)
			tabsField.Set(reflect.ValueOf(tabs))
			if appsField := v.FieldByName("AllApps"); appsField.IsValid() && appsField.CanSet() && appsField.IsNil() {
				appsField.Set(reflect.ValueOf(allApps))
			}
			if groupsField := v.FieldByName("AppGroups"); groupsField.IsValid() && groupsField.CanSet() && groupsField.IsNil() {
				groupsField.Set(reflect.ValueOf(appGroups))
			}
		}
	}
}

// InjectSessionUser populates SessionUserName, SessionUserEmail, and
// SessionUserInitials on the embedded types.PageData from the authenticated user
// stored in the request context by the session middleware.
// The context key "email" is set by both mock and real auth middleware.
// SessionUserName defaults to the email address when no display name is available.
func (p *Pipeline) InjectSessionUser(ctx context.Context, data any) {
	if data == nil {
		return
	}

	v := reflect.ValueOf(data)
	if v.Kind() == reflect.Ptr {
		v = v.Elem()
	}
	if v.Kind() != reflect.Struct {
		return
	}

	// Resolve via the embedded types.PageData struct to avoid shadowing by outer fields
	emailField := v.FieldByName("SessionUserEmail")
	if !emailField.IsValid() || !emailField.CanSet() {
		return
	}
	if emailField.String() != "" {
		return // already set
	}

	email, _ := ctx.Value("email").(string)
	name, _ := ctx.Value("display_name").(string)
	if name == "" {
		name = email // fall back to email as display name
	}

	emailField.SetString(email)
	if nameField := v.FieldByName("SessionUserName"); nameField.IsValid() && nameField.CanSet() {
		nameField.SetString(name)
	}
	if initialsField := v.FieldByName("SessionUserInitials"); initialsField.IsValid() && initialsField.CanSet() {
		initialsField.SetString(userInitials(name))
	}
}

// userInitials derives two uppercase initials from a display name or email.
// "John Doe" → "JD", "john.doe@example.com" → "J", "alice" → "A".
func userInitials(name string) string {
	if name == "" {
		return ""
	}
	parts := strings.Fields(name)
	if len(parts) == 0 {
		return ""
	}
	if len(parts) == 1 {
		r, _ := utf8.DecodeRuneInString(parts[0])
		return strings.ToUpper(string(r))
	}
	r0, _ := utf8.DecodeRuneInString(parts[0])
	r1, _ := utf8.DecodeRuneInString(parts[len(parts)-1])
	return strings.ToUpper(string(r0) + string(r1))
}

// InjectUserPermissions sets UserPermissions on PageData and filters sidebar/nav.
// Reuses permissions already loaded into context by the adapter's Adapt(), avoiding
// a second DB call.
func (p *Pipeline) InjectUserPermissions(ctx context.Context, data any) {
	if p.PermLoader == nil || !p.PermLoader.IsEnabled() {
		return
	}

	// Reuse permissions from context (loaded in Adapt before view execution)
	perms := view.GetUserPermissions(ctx)
	if perms == nil {
		// Fallback: load from DB if not in context (e.g., non-view handler paths)
		userID := p.getUserID(ctx)
		if userID == "" {
			return
		}
		workspaceID := p.getWorkspaceID(ctx)
		// No *http.Request available on this rendering-only path, so the
		// binding hint defaults to the legacy "no hint" tuple and the
		// loader falls back to its union behaviour.
		codes, err := p.PermLoader.GetUserPermissionCodes(ctx, userID, workspaceID,
			PrincipalTypeUnspecified, "", "", "")
		if err != nil {
			log.Printf("Failed to load user permissions: %v", err)
			return
		}
		perms = types.NewUserPermissions(codes)
	}

	// Inject UserPermissions into PageData via reflection
	v := reflect.ValueOf(data)
	if v.Kind() == reflect.Ptr {
		v = v.Elem()
	}
	if v.Kind() != reflect.Struct {
		return
	}

	if field := v.FieldByName("UserPermissions"); field.IsValid() && field.CanSet() {
		field.Set(reflect.ValueOf(perms))
	}

	// Header Messages button (Plan-4 secure messaging). Light it for any
	// principal holding conversation:list and point it at the staff inbox.
	if p.MessagesURL != "" && perms != nil && perms.HasCode("conversation:list") {
		if f := v.FieldByName("HasMessages"); f.IsValid() && f.CanSet() && f.Kind() == reflect.Bool {
			f.SetBool(true)
		}
		if f := v.FieldByName("MessagesURL"); f.IsValid() && f.CanSet() && f.Kind() == reflect.String && f.String() == "" {
			f.SetString(p.MessagesURL)
		}
	}

	// Filter sidebar based on permissions
	p.filterSidebar(v, perms)

	// Filter mobile app grid based on permissions
	if groupsField := v.FieldByName("AppGroups"); groupsField.IsValid() && groupsField.CanSet() && !groupsField.IsNil() {
		if groups, ok := groupsField.Interface().([]types.AppGridGroup); ok {
			groupsField.Set(reflect.ValueOf(FilterAppGroupsByPermissions(groups, perms)))
		}
	}
	if appsField := v.FieldByName("AllApps"); appsField.IsValid() && appsField.CanSet() && !appsField.IsNil() {
		if apps, ok := appsField.Interface().([]types.AppGridItem); ok {
			appsField.Set(reflect.ValueOf(FilterAppsByPermissions(apps, perms)))
		}
	}
}

// hasAnyPermission checks if the user has at least one of the permission codes.
// The permission string supports pipe-separated OR logic: "permission:list|workspace:list"
// means the item is visible if the user has EITHER permission.
func hasAnyPermission(perm string, perms *types.UserPermissions) bool {
	if perm == "" {
		return true
	}
	if !strings.Contains(perm, "|") {
		return perms.HasCode(perm)
	}
	for _, code := range strings.Split(perm, "|") {
		if perms.HasCode(code) {
			return true
		}
	}
	return false
}

// filterSidebar removes sidebar apps and items the user lacks permission for.
func (p *Pipeline) filterSidebar(v reflect.Value, perms *types.UserPermissions) {
	sidebarField := v.FieldByName("Sidebar")
	if !sidebarField.IsValid() || !sidebarField.CanSet() || sidebarField.IsZero() {
		return
	}

	sidebar, ok := sidebarField.Interface().(types.SidebarConfig)
	if !ok {
		return
	}

	// Filter apps
	filtered := make([]types.SidebarApp, 0, len(sidebar.Apps))
	for _, app := range sidebar.Apps {
		if hasAnyPermission(app.Permission, perms) {
			filtered = append(filtered, app)
		}
	}
	sidebar.Apps = filtered

	// Filter app groups (accordion display mode)
	filteredGroups := make([]types.SidebarAppGroup, 0, len(sidebar.AppGroups))
	for _, group := range sidebar.AppGroups {
		groupApps := make([]types.SidebarApp, 0, len(group.Apps))
		for _, app := range group.Apps {
			if hasAnyPermission(app.Permission, perms) {
				groupApps = append(groupApps, app)
			}
		}
		if len(groupApps) > 0 {
			group.Apps = groupApps
			filteredGroups = append(filteredGroups, group)
		}
	}
	sidebar.AppGroups = filteredGroups

	// Filter items within sections
	filteredSections := make([]types.SidebarSection, 0, len(sidebar.Sections))
	for _, section := range sidebar.Sections {
		filteredItems := make([]types.SidebarItem, 0, len(section.Items))
		for _, item := range section.Items {
			if hasAnyPermission(item.Permission, perms) {
				filteredItems = append(filteredItems, item)
			}
		}
		if len(filteredItems) > 0 {
			section.Items = filteredItems
			filteredSections = append(filteredSections, section)
		}
	}
	sidebar.Sections = filteredSections

	sidebarField.Set(reflect.ValueOf(sidebar))
}

// InjectWorkspaceData populates CurrentWorkspace, AvailableWorkspaces, and
// SwitchWorkspaceURL on the Sidebar field of the page data. Must be called
// after InjectPageData (which builds Sidebar).
func (p *Pipeline) InjectWorkspaceData(ctx context.Context, data any) {
	if p.WorkspaceLoader == nil || !p.WorkspaceLoader.IsEnabled() {
		return
	}

	v := reflect.ValueOf(data)
	if v.Kind() == reflect.Ptr {
		v = v.Elem()
	}
	if v.Kind() != reflect.Struct {
		return
	}

	sidebarField := v.FieldByName("Sidebar")
	if !sidebarField.IsValid() || !sidebarField.CanSet() || sidebarField.IsZero() {
		return
	}

	sidebar, ok := sidebarField.Interface().(types.SidebarConfig)
	if !ok {
		return
	}

	available, current := p.WorkspaceLoader.LoadWorkspaces(ctx)
	sidebar.AvailableWorkspaces = available
	sidebar.CurrentWorkspace = current
	sidebarField.Set(reflect.ValueOf(sidebar))
}

// InjectUserData populates Sidebar.CurrentUser from the UserLoader. Must be
// called after InjectPageData (which builds Sidebar). Mirrors InjectWorkspaceData
// in shape — only difference is the source loader.
func (p *Pipeline) InjectUserData(ctx context.Context, data any) {
	if p.UserLoader == nil || !p.UserLoader.IsEnabled() {
		return
	}

	v := reflect.ValueOf(data)
	if v.Kind() == reflect.Ptr {
		v = v.Elem()
	}
	if v.Kind() != reflect.Struct {
		return
	}

	sidebarField := v.FieldByName("Sidebar")
	if !sidebarField.IsValid() || !sidebarField.CanSet() || sidebarField.IsZero() {
		return
	}

	sidebar, ok := sidebarField.Interface().(types.SidebarConfig)
	if !ok {
		return
	}

	user := p.UserLoader.LoadCurrentUser(ctx)
	if user.UserID == "" {
		return
	}
	sidebar.CurrentUser = user
	sidebarField.Set(reflect.ValueOf(sidebar))
}

// InjectPostRotationBanner reads PostRotationBannerFromContext and populates
// PageData.PostRotationBanner via reflection. Safe to call on any page data
// struct; a no-op when the context has no banner data set or when the struct
// doesn't embed types.PageData.
func (p *Pipeline) InjectPostRotationBanner(ctx context.Context, data any) {
	bannerData := PostRotationBannerFromContext(ctx)
	if bannerData == nil {
		return
	}

	v := reflect.ValueOf(data)
	if v.Kind() == reflect.Ptr {
		v = v.Elem()
	}
	if v.Kind() != reflect.Struct {
		return
	}
	field := v.FieldByName("PostRotationBanner")
	if !field.IsValid() || !field.CanSet() {
		return
	}
	prevURL := ""
	if bannerData.PreviousSlug != "" {
		prevURL = "/w/" + bannerData.PreviousSlug + "/"
	}
	field.Set(reflect.ValueOf(types.PostRotationBannerData{
		Active:            true,
		TargetSlug:        bannerData.TargetSlug,
		PreviousSlug:      bannerData.PreviousSlug,
		PreviousURL:       prevURL,
		RecentActivityURL: "/me/recent-activity",
	}))
}

// selectSidebarBuilder returns the appropriate SidebarBuilder for the given
// request URL path.
//
// Dispatch logic (deny-by-default on unrecognised portal paths):
//  1. If a per-request sidebar builder is bound in ctx (Phase P8 workspace-
//     route rewrite), prefer it over boot-time builders.
//  2. If PortalSidebarBuilders is nil, return the staff builder (legacy path).
//  3. For paths under /portal/{kind}/, look up the builder in
//     PortalSidebarBuilders. If not found (unknown kind), return nil — the
//     caller must handle nil (no sidebar rendered, which is fail-closed UX).
//  4. For all other paths (/app/*, /action/*, /auth/*, etc.): return the
//     staff builder.
func (p *Pipeline) selectSidebarBuilder(ctx context.Context, path string) SidebarBuilder {
	if reqBuilder := RequestSidebarBuilderFromContext(ctx); reqBuilder != nil {
		return reqBuilder
	}
	if p.PortalSidebarBuilders == nil {
		return p.SidebarBuilder
	}
	for _, entry := range portalPrincipalPrefixes {
		if strings.HasPrefix(path, entry.prefix) {
			if b, ok := p.PortalSidebarBuilders[entry.principalType]; ok {
				return b
			}
			log.Printf("[sidebar-dispatch] no builder for portal path %s (principalType=%d)", path, entry.principalType)
			return nil
		}
	}
	return p.SidebarBuilder
}

// FilterAppGroupsByPermissions removes apps the user doesn't have permission to access.
// Items with an empty Permission field are always included.
// Groups with no remaining items after filtering are removed entirely.
//
// Fail CLOSED: nil perms denies every gated item (HasCode is nil-receiver-safe →
// false) while ungated items (Permission == "") still pass.
func FilterAppGroupsByPermissions(groups []types.AppGridGroup, perms *types.UserPermissions) []types.AppGridGroup {
	var filtered []types.AppGridGroup
	for _, group := range groups {
		var items []types.AppGridItem
		for _, item := range group.Items {
			if item.Permission == "" || perms.HasCode(item.Permission) {
				items = append(items, item)
			}
		}
		if len(items) > 0 {
			filtered = append(filtered, types.AppGridGroup{
				Title: group.Title,
				Items: items,
			})
		}
	}
	return filtered
}

// FilterAppsByPermissions filters the flat AllApps list by permissions.
// Items with an empty Permission field are always included.
//
// Fail CLOSED: nil perms denies every gated app (HasCode is nil-safe → false)
// while ungated items still pass.
func FilterAppsByPermissions(apps []types.AppGridItem, perms *types.UserPermissions) []types.AppGridItem {
	var filtered []types.AppGridItem
	for _, app := range apps {
		if app.Permission == "" || perms.HasCode(app.Permission) {
			filtered = append(filtered, app)
		}
	}
	return filtered
}
