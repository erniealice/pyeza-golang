package view

import (
	"context"

	"github.com/erniealice/pyeza-golang/types"
)

type permissionsKey struct{}

// WithUserPermissions stores UserPermissions in the context.
func WithUserPermissions(ctx context.Context, perms *types.UserPermissions) context.Context {
	return context.WithValue(ctx, permissionsKey{}, perms)
}

// GetUserPermissions retrieves UserPermissions from the context.
// Returns nil if not set (nil permissions = no restrictions in dev mode).
func GetUserPermissions(ctx context.Context) *types.UserPermissions {
	perms, _ := ctx.Value(permissionsKey{}).(*types.UserPermissions)
	return perms
}
