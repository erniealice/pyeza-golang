package render

import (
	"context"

	"github.com/erniealice/pyeza-golang/types"
)

// PermissionLoader loads permission codes for a user scoped to a workspace
// and a specific session binding.
//
// The bindingKind + bindingID hint restricts the underlying RBAC query to the
// SINGLE selected binding row from the session, closing the silent
// privilege-elevation hole where a user holding multiple bindings in one
// workspace would receive the UNION of permissions across every binding.
//
// Fail-closed posture: only the EXACT zero pair (UNSPECIFIED, "") plus empty
// acting-as values triggers the legacy union fall-back behaviour; partial /
// malformed hints return an empty permission set.
type PermissionLoader interface {
	GetUserPermissionCodes(
		ctx context.Context,
		userID string,
		workspaceID string,
		bindingKind PrincipalType,
		bindingID string,
		actingAsClientID, actingAsSupplierID string,
	) ([]string, error)
	IsEnabled() bool
}

// WorkspaceLoader loads workspace data for the current user.
// Called per-request to populate the sidebar workspace switcher.
type WorkspaceLoader interface {
	// LoadWorkspaces returns all workspaces and the current workspace for the user.
	// Returns (available, current). Returns nil slice + zero value when unavailable.
	LoadWorkspaces(ctx context.Context) (available []types.SidebarWorkspace, current types.SidebarWorkspace)
	IsEnabled() bool
}

// UserLoader loads the authenticated user's display data for the bottom-of-
// sidebar profile button + popover menu. Called per-request.
type UserLoader interface {
	LoadCurrentUser(ctx context.Context) types.SidebarCurrentUser
	IsEnabled() bool
}
