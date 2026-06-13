package render

import "context"

// ── Nonce ────────────────────────────────────────────────────────────────────

// nonceCtxKey is the typed, unexported context key for the per-request CSP
// nonce. Empty-struct keys are collision-free.
type nonceCtxKey struct{}

// NonceContextKey is the exported singleton instance used by both the
// SecurityHeaders middleware (writer) and the render pipeline (reader).
var NonceContextKey nonceCtxKey

// WithNonce stores the per-request CSP nonce in ctx. Called by SecurityHeaders
// immediately after minting the nonce.
func WithNonce(ctx context.Context, nonce string) context.Context {
	return context.WithValue(ctx, NonceContextKey, nonce)
}

// NonceFromContext reads the per-request CSP nonce set by WithNonce. Returns ""
// when no nonce was set (e.g. requests that never passed through
// SecurityHeaders, such as unit tests).
func NonceFromContext(ctx context.Context) string {
	v, _ := ctx.Value(NonceContextKey).(string)
	return v
}

// ── Post-Rotation Banner ─────────────────────────────────────────────────────

// bannerCtxKey is the typed context key for PostRotationBannerData.
// Unexported type prevents collisions with any string keys set elsewhere.
type bannerCtxKey struct{}

// BannerContextKey is the exported singleton instance used by both the
// workspace_path middleware (writer) and the render pipeline (reader).
var BannerContextKey bannerCtxKey

// PostRotationBannerData is the value stored under BannerContextKey when a
// URL-driven workspace rotation occurs on a request. The render pipeline reads
// this and populates types.PageData.PostRotationBanner so the app-shell
// template can render the dismissable banner.
//
// PreviousSlug is best-effort: it is derived from the workspace_path
// middleware's in-process slug cache (reverse scan) so it is available without
// a second DB round-trip. When the previous workspace_id is not yet in the
// cache (e.g. first request after server restart), PreviousSlug will be empty
// and the "Switch back" link is omitted in the template.
type PostRotationBannerData struct {
	// TargetSlug is the slug of the workspace the user just rotated INTO.
	TargetSlug string
	// PreviousSlug is the slug of the workspace the user just rotated FROM.
	// Empty when the previous workspace_id is not in the slug cache.
	PreviousSlug string
}

// WithPostRotationBanner stores banner data in ctx.
// Called by the workspace_path middleware immediately after a successful
// URL-driven rotation.
func WithPostRotationBanner(ctx context.Context, data *PostRotationBannerData) context.Context {
	return context.WithValue(ctx, BannerContextKey, data)
}

// PostRotationBannerFromContext retrieves the banner data set by
// WithPostRotationBanner. Returns nil when no rotation occurred on this request.
func PostRotationBannerFromContext(ctx context.Context) *PostRotationBannerData {
	if v, ok := ctx.Value(BannerContextKey).(*PostRotationBannerData); ok {
		return v
	}
	return nil
}

// ── Per-Request Route Map ────────────────────────────────────────────────────

// routeMapCtxKey carries a workspace-prefixed route map for the current request.
// When present, the renderer's {{route}} and {{routeWith}} template functions
// prefer this map over the boot-time routeMap so that links rendered inside
// /w/{slug}/* pages carry the workspace prefix.
type routeMapCtxKey struct{}

// WithRouteMap stores a per-request route map in ctx. Called by the workspace
// route rewriter (composition layer) to install a workspace-prefixed copy of
// the boot-time route map.
func WithRouteMap(ctx context.Context, m map[string]string) context.Context {
	if m == nil {
		return ctx
	}
	return context.WithValue(ctx, routeMapCtxKey{}, m)
}

// RouteMapFromContext returns the per-request route map stored by WithRouteMap,
// or nil when no override is present (non-workspace requests).
func RouteMapFromContext(ctx context.Context) map[string]string {
	if ctx == nil {
		return nil
	}
	m, _ := ctx.Value(routeMapCtxKey{}).(map[string]string)
	return m
}

// ── Per-Request Sidebar Builder ───────────────────────────────────────────────

// requestSidebarBuilderCtxKey carries a workspace-rewritten SidebarBuilder
// closure bound by the workspace-route rewriter (Phase P8). When present,
// Pipeline.selectSidebarBuilder prefers it over the boot-time staff/portal
// builders so the sidebar renders /w/{slug}/* URLs for requests that came
// through the /w/{ws}/* mux. Absent on /app/* legacy requests.
type requestSidebarBuilderCtxKey struct{}

// WithRequestSidebarBuilder binds a per-request SidebarBuilder closure into
// ctx. Used by composition's WorkspaceRouteRewriter to install a workspace-
// prefixed builder built from RouteResult.WithWorkspace's output.
func WithRequestSidebarBuilder(ctx context.Context, fn SidebarBuilder) context.Context {
	if fn == nil {
		return ctx
	}
	return context.WithValue(ctx, requestSidebarBuilderCtxKey{}, fn)
}

// RequestSidebarBuilderFromContext returns the per-request SidebarBuilder
// bound by WithRequestSidebarBuilder, or nil when none is bound.
func RequestSidebarBuilderFromContext(ctx context.Context) SidebarBuilder {
	if ctx == nil {
		return nil
	}
	if v, ok := ctx.Value(requestSidebarBuilderCtxKey{}).(SidebarBuilder); ok {
		return v
	}
	return nil
}
