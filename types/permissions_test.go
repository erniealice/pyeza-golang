package types

import "testing"

func TestNewUserPermissions(t *testing.T) {
	t.Parallel()

	perms := NewUserPermissions([]string{"client:create", "client:read", "user:list"})

	if perms == nil {
		t.Fatal("NewUserPermissions returned nil")
	}
}

func TestUserPermissions_Can(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name   string
		codes  []string
		entity string
		action string
		want   bool
	}{
		{
			name:   "has permission",
			codes:  []string{"client:create", "client:read"},
			entity: "client",
			action: "create",
			want:   true,
		},
		{
			name:   "lacks permission",
			codes:  []string{"client:read"},
			entity: "client",
			action: "create",
			want:   false,
		},
		{
			name:   "empty codes",
			codes:  []string{},
			entity: "client",
			action: "create",
			want:   false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()
			perms := NewUserPermissions(tt.codes)
			got := perms.Can(tt.entity, tt.action)
			if got != tt.want {
				t.Errorf("Can(%q, %q) = %v, want %v", tt.entity, tt.action, got, tt.want)
			}
		})
	}
}

func TestUserPermissions_Can_NilPermissions(t *testing.T) {
	t.Parallel()

	var perms *UserPermissions
	// Fail-closed: nil permissions = deny everything.
	if perms.Can("anything", "goes") {
		t.Error("nil UserPermissions.Can should return false (fail-closed)")
	}
}

func TestUserPermissions_CanAny(t *testing.T) {
	t.Parallel()

	perms := NewUserPermissions([]string{"client:read", "user:list"})

	if !perms.CanAny("client:read", "admin:manage") {
		t.Error("CanAny should return true when at least one permission matches")
	}
	if perms.CanAny("admin:manage", "reports:view") {
		t.Error("CanAny should return false when no permissions match")
	}
}

func TestUserPermissions_CanAny_NilPermissions(t *testing.T) {
	t.Parallel()

	var perms *UserPermissions
	// Fail-closed: nil permissions = deny everything.
	if perms.CanAny("anything") {
		t.Error("nil UserPermissions.CanAny should return false (fail-closed)")
	}
}

func TestUserPermissions_CanAny_EmptyArgs(t *testing.T) {
	t.Parallel()

	perms := NewUserPermissions([]string{"client:read"})
	if perms.CanAny() {
		t.Error("CanAny with no args should return false")
	}
}

func TestUserPermissions_HasCode(t *testing.T) {
	t.Parallel()

	perms := NewUserPermissions([]string{"reports:view", "user:list"})

	if !perms.HasCode("reports:view") {
		t.Error("HasCode should return true for existing code")
	}
	if perms.HasCode("admin:manage") {
		t.Error("HasCode should return false for missing code")
	}
}

func TestUserPermissions_HasCode_NilPermissions(t *testing.T) {
	t.Parallel()

	var perms *UserPermissions
	// Fail-closed: nil permissions = deny everything.
	if perms.HasCode("anything") {
		t.Error("nil UserPermissions.HasCode should return false (fail-closed)")
	}
}

func TestUserPermissions_Can_EmptyEntityAndAction(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name   string
		codes  []string
		entity string
		action string
		want   bool
	}{
		{
			name:   "empty entity and action matches colon-only code",
			codes:  []string{":"},
			entity: "",
			action: "",
			want:   true,
		},
		{
			name:   "empty entity and action does not match real codes",
			codes:  []string{"client:read"},
			entity: "",
			action: "",
			want:   false,
		},
		{
			name:   "empty entity with real action",
			codes:  []string{":create"},
			entity: "",
			action: "create",
			want:   true,
		},
		{
			name:   "real entity with empty action",
			codes:  []string{"client:"},
			entity: "client",
			action: "",
			want:   true,
		},
	}

	for _, tt := range tests {
		tt := tt
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()
			perms := NewUserPermissions(tt.codes)
			got := perms.Can(tt.entity, tt.action)
			if got != tt.want {
				t.Errorf("Can(%q, %q) = %v, want %v", tt.entity, tt.action, got, tt.want)
			}
		})
	}
}

func TestUserPermissions_Can_SpecialCharacters(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name   string
		codes  []string
		entity string
		action string
		want   bool
	}{
		{
			name:   "entity with spaces",
			codes:  []string{"my entity:my action"},
			entity: "my entity",
			action: "my action",
			want:   true,
		},
		{
			name:   "entity with unicode",
			codes:  []string{"クライアント:読む"},
			entity: "クライアント",
			action: "読む",
			want:   true,
		},
		{
			name:   "entity with colons creates ambiguity",
			codes:  []string{"a:b:c"},
			entity: "a",
			action: "b:c",
			want:   true, // "a" + ":" + "b:c" == "a:b:c"
		},
		{
			name:   "SQL injection string in entity",
			codes:  []string{"'; DROP TABLE--:read"},
			entity: "'; DROP TABLE--",
			action: "read",
			want:   true,
		},
	}

	for _, tt := range tests {
		tt := tt
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()
			perms := NewUserPermissions(tt.codes)
			got := perms.Can(tt.entity, tt.action)
			if got != tt.want {
				t.Errorf("Can(%q, %q) = %v, want %v", tt.entity, tt.action, got, tt.want)
			}
		})
	}
}

func TestNewUserPermissions_DuplicateEntries(t *testing.T) {
	t.Parallel()

	// Duplicate codes should not cause issues; map just overwrites
	perms := NewUserPermissions([]string{"client:read", "client:read", "client:read"})

	if !perms.HasCode("client:read") {
		t.Error("HasCode should return true for duplicated code")
	}

	// Confirm the map only has one entry
	count := 0
	for range perms.codes {
		count++
	}
	if count != 1 {
		t.Errorf("expected 1 unique code in map, got %d", count)
	}
}

func TestUserPermissions_HasCode_EmptyCode(t *testing.T) {
	t.Parallel()

	perms := NewUserPermissions([]string{"client:read"})
	if perms.HasCode("") {
		t.Error("HasCode(\"\") should return false when empty string not in codes")
	}

	permsWithEmpty := NewUserPermissions([]string{"", "client:read"})
	if !permsWithEmpty.HasCode("") {
		t.Error("HasCode(\"\") should return true when empty string was added")
	}
}

func TestUserPermissions_CanAny_SpecialCharacters(t *testing.T) {
	t.Parallel()

	perms := NewUserPermissions([]string{"a:b:c", ""})

	if !perms.CanAny("a:b:c") {
		t.Error("CanAny should match code with multiple colons")
	}
	if !perms.CanAny("") {
		t.Error("CanAny should match empty string when it was added as a code")
	}
	if perms.CanAny("a:b") {
		t.Error("CanAny should not partially match 'a:b' against 'a:b:c'")
	}
}

func TestNewUserPermissions_NilSlice(t *testing.T) {
	t.Parallel()

	perms := NewUserPermissions(nil)
	if perms == nil {
		t.Fatal("NewUserPermissions(nil) returned nil")
	}
	if perms.Can("client", "read") {
		t.Error("Can should return false with nil input codes")
	}
}

// TestNewEmptyUserPermissions_Can verifies that an explicitly empty UserPermissions
// returns false for Can. The factory always returns false on missing codes because
// the internal map is empty, not nil.
func TestNewEmptyUserPermissions_Can(t *testing.T) {
	t.Parallel()

	p := NewEmptyUserPermissions()
	if p == nil {
		t.Fatal("NewEmptyUserPermissions returned nil")
	}
	if p.Can("anything", "anything") {
		t.Error("expected Can to return false on empty UserPermissions")
	}
}

// TestNewEmptyUserPermissions_CanAny verifies that CanAny returns false on an
// explicitly empty UserPermissions.
func TestNewEmptyUserPermissions_CanAny(t *testing.T) {
	t.Parallel()

	p := NewEmptyUserPermissions()
	if p.CanAny("x", "y") {
		t.Error("expected CanAny to return false on empty UserPermissions")
	}
}

// TestNewEmptyUserPermissions_HasCode verifies that HasCode returns false on an
// explicitly empty UserPermissions.
func TestNewEmptyUserPermissions_HasCode(t *testing.T) {
	t.Parallel()

	p := NewEmptyUserPermissions()
	if p.HasCode("x") {
		t.Error("expected HasCode to return false on empty UserPermissions")
	}
}

// TestNilUserPermissions_FailClosed asserts that a nil *UserPermissions returns
// false for Can (fail-closed semantics, post-P3).
//
// History: this test was originally named TestNilUserPermissions_FailOpen and
// asserted the pre-P3 fail-open behavior. P3 flipped Can/CanAny/HasCode defaults
// from "nil = allow" to "nil = deny"; the test was renamed and the assertion
// inverted in lockstep with the type change.
func TestNilUserPermissions_FailClosed(t *testing.T) {
	t.Parallel()

	var p *UserPermissions
	if p.Can("x", "y") {
		t.Error("expected nil UserPermissions.Can to return false (fail-closed, post-P3 behavior)")
	}
}
