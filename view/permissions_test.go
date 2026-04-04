package view

import (
	"context"
	"testing"

	"github.com/erniealice/pyeza-golang/types"
)

func TestWithUserPermissions_RoundTrip(t *testing.T) {
	t.Parallel()

	perms := types.NewUserPermissions([]string{"client:read", "user:list"})
	ctx := WithUserPermissions(context.Background(), perms)

	got := GetUserPermissions(ctx)
	if got == nil {
		t.Fatal("GetUserPermissions returned nil")
	}
	if !got.Can("client", "read") {
		t.Error("expected client:read permission")
	}
	if !got.HasCode("user:list") {
		t.Error("expected user:list permission")
	}
}

func TestGetUserPermissions_NotSet(t *testing.T) {
	t.Parallel()

	got := GetUserPermissions(context.Background())
	if got != nil {
		t.Errorf("GetUserPermissions on empty context should return nil, got %v", got)
	}
}
