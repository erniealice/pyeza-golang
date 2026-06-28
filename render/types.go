// Package render provides the framework-agnostic render pipeline for pyeza
// views: sidebar injection, permission filtering, nonce/banner/session data
// injection, and theme defaults. It has zero net/http dependencies.
package render

import (
	"context"
	"html/template"

	"github.com/erniealice/pyeza-golang/types"
)

// IconRenderer is a function that renders an icon template name to HTML.
type IconRenderer func(name string) template.HTML

// SidebarBuilder creates a SidebarConfig for the given active navigation state.
// Returns any to avoid coupling the render pipeline to a concrete sidebar type.
type SidebarBuilder func(activeNav, activeSubNav string) any

// BottomNavBuilder creates bottom navigation tabs, the all-apps grid for mobile,
// and grouped app data for the bottom sheet.
// Returns (bottomNavTabs, allApps, appGroups) as slices injected into PageData via reflection.
type BottomNavBuilder func(activeNav string) ([]types.BottomNavTab, []types.AppGridItem, []types.AppGridGroup)

// PrincipalType mirrors the proto enum values for
// `domain.entity.v1.PrincipalType`. Re-declared here so the render pipeline
// does not import the proto enum or espyna's consumer package — the render
// pipeline is framework-agnostic and must not depend on espyna.
//
// Source of truth:
//
//	packages/esqyma/proto/v1/domain/entity/principal_type/principal_type.proto
type PrincipalType int

const (
	PrincipalTypeUnspecified      PrincipalType = 0
	PrincipalTypeOperatorOwner    PrincipalType = 1
	PrincipalTypeOperatorStaff    PrincipalType = 2
	PrincipalTypeClient           PrincipalType = 3
	PrincipalTypeClientDelegate   PrincipalType = 4
	PrincipalTypeSupplier         PrincipalType = 5
	PrincipalTypeSupplierDelegate PrincipalType = 6
	PrincipalTypeStaff            PrincipalType = 7
)

// String returns the canonical lowercase token for a principal type. The
// token is used in route URLs (`/portal/{kind}/`) and in `data-testid`
// attributes (`select-workspace-role-{kind}`). Keep these stable.
func (t PrincipalType) String() string {
	switch t {
	case PrincipalTypeOperatorOwner:
		return "operator_owner"
	case PrincipalTypeOperatorStaff:
		return "operator_staff"
	case PrincipalTypeClient:
		return "client"
	case PrincipalTypeClientDelegate:
		return "client_delegate"
	case PrincipalTypeSupplier:
		return "supplier"
	case PrincipalTypeSupplierDelegate:
		return "supplier_delegate"
	case PrincipalTypeStaff:
		return "staff"
	default:
		return "unspecified"
	}
}

// HomeRoute returns the post-login home route for a given principal type.
// All principal types land on /me/inbox.
func (t PrincipalType) HomeRoute() string {
	switch t {
	case PrincipalTypeOperatorOwner, PrincipalTypeOperatorStaff,
		PrincipalTypeClient, PrincipalTypeSupplier,
		PrincipalTypeClientDelegate, PrincipalTypeSupplierDelegate,
		PrincipalTypeStaff:
		return "/me/inbox"
	default:
		return "/auth/no-access"
	}
}

// PermissionBindingHint is the full binding identification surfaced from
// the session row for the active request — used by the permission loader
// to scope RBAC resolution. Mirrors the four session columns
// (principal_type, principal_id, acting_as_client_id,
// acting_as_supplier_id) that uniquely identify the grant row currently
// in force.
type PermissionBindingHint struct {
	Kind               PrincipalType
	BindingID          string
	ActingAsClientID   string
	ActingAsSupplierID string
}

// Empty reports whether the hint carries no usable information at all
// (no session row, or session columns null). Callers treat this as the
// fail-closed sentinel — authenticated workspace requests with an Empty
// hint must NOT pass it through to the loader as a union request.
func (h PermissionBindingHint) Empty() bool {
	return h.Kind == PrincipalTypeUnspecified && h.BindingID == ""
}

// WorkspaceRouteRewriter is the per-request hook invoked by the view adapter
// to install a workspace-rewritten RouteResult into the request context. The
// composition layer wires this with a closure that:
//
//  1. Reads the URL-workspace slug and the optional acting_as_client_id from ctx.
//  2. Calls boot-time RouteResult.WithWorkspace(slug) to produce a per-request
//     copy whose URL fields are prepended with /w/{slug}.
//  3. Binds the rewritten RouteResult into ctx so the downstream sidebar dispatch
//     layer can rebuild the sidebar with workspace-prefixed URLs.
//
// When no URL workspace is present in ctx (e.g. /app/* legacy path, /auth/*,
// /me/*, static assets), the hook MUST return ctx unchanged.
//
// nil-safe: the pipeline only invokes a non-nil rewriter.
type WorkspaceRouteRewriter func(ctx context.Context) context.Context
