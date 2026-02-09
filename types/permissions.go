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

// Can checks if the user has a permission for the given entity and action.
// Usage in templates: {{if .UserPermissions.Can "client" "create"}}
func (p *UserPermissions) Can(entity, action string) bool {
	if p == nil {
		return true // nil = no restrictions (dev mode / not wired)
	}
	return p.codes[entity+":"+action]
}

// CanAny checks if the user has any of the given entity:action permissions.
func (p *UserPermissions) CanAny(perms ...string) bool {
	if p == nil {
		return true
	}
	for _, perm := range perms {
		if p.codes[perm] {
			return true
		}
	}
	return false
}

// HasCode checks if the user has a specific permission code (e.g. "reports:view").
func (p *UserPermissions) HasCode(code string) bool {
	if p == nil {
		return true
	}
	return p.codes[code]
}
