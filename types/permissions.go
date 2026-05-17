package types

// UserPermissions holds the set of permission codes for the current user.
// Used by templates to conditionally show/hide UI elements.
type UserPermissions struct {
	codes map[string]bool
}

// NewUserPermissions creates a UserPermissions from a list of permission codes.
func NewUserPermissions(codes []string) *UserPermissions {
	m := make(map[string]bool, len(codes))
	for _, c := range codes {
		m[c] = true
	}
	return &UserPermissions{codes: m}
}

// NewEmptyUserPermissions returns a UserPermissions instance with no permission codes.
//
// Use this for legitimate "explicitly empty" cases:
//   - tests that want to verify deny-by-default behavior
//   - pre-login pages (login form, principal chooser) where no permissions apply
//   - the request context middleware (P4) when no permissions chain resolved
//
// IMPORTANT: After Phase P3, nil UserPermissions will return false for every check.
// Code paths that legitimately need "explicit zero" should use this factory instead
// of leaving the field nil.
func NewEmptyUserPermissions() *UserPermissions {
	return &UserPermissions{codes: map[string]bool{}}
}

// Can checks if the user has a permission for the given entity and action.
// Usage in templates: {{if .UserPermissions.Can "client" "create"}}
//
// Fail-closed: nil receiver returns false. Use NewEmptyUserPermissions() when
// you need an explicit "deny everything" value.
func (p *UserPermissions) Can(entity, action string) bool {
	return p != nil && p.codes[entity+":"+action]
}

// CanAny checks if the user has any of the given entity:action permissions.
// Fail-closed: nil receiver returns false.
func (p *UserPermissions) CanAny(perms ...string) bool {
	if p == nil {
		return false
	}
	for _, perm := range perms {
		if p.codes[perm] {
			return true
		}
	}
	return false
}

// HasCode checks if the user has a specific permission code (e.g. "reports:view").
// Fail-closed: nil receiver returns false.
func (p *UserPermissions) HasCode(code string) bool {
	return p != nil && p.codes[code]
}
