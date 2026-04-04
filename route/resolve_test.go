package route

import "testing"

func TestResolveURL(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name    string
		pattern string
		pairs   []string
		want    string
	}{
		{
			name:    "single placeholder",
			pattern: "/app/products/detail/{id}/variants/table",
			pairs:   []string{"id", "42"},
			want:    "/app/products/detail/42/variants/table",
		},
		{
			name:    "multiple placeholders",
			pattern: "/app/products/detail/{id}/variants/{variantId}",
			pairs:   []string{"id", "10", "variantId", "20"},
			want:    "/app/products/detail/10/variants/20",
		},
		{
			name:    "no pairs returns pattern unchanged",
			pattern: "/app/products/list",
			pairs:   nil,
			want:    "/app/products/list",
		},
		{
			name:    "no placeholders in pattern",
			pattern: "/app/products/list",
			pairs:   []string{"id", "42"},
			want:    "/app/products/list",
		},
		{
			name:    "placeholder not found in pattern",
			pattern: "/app/products/{id}",
			pairs:   []string{"nonexistent", "42"},
			want:    "/app/products/{id}",
		},
		{
			name:    "empty replacement value",
			pattern: "/app/products/{id}",
			pairs:   []string{"id", ""},
			want:    "/app/products/",
		},
		{
			name:    "UUID as value",
			pattern: "/app/users/{userId}/roles/{roleId}",
			pairs:   []string{"userId", "550e8400-e29b-41d4-a716-446655440000", "roleId", "7"},
			want:    "/app/users/550e8400-e29b-41d4-a716-446655440000/roles/7",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()
			got := ResolveURL(tt.pattern, tt.pairs...)
			if got != tt.want {
				t.Errorf("ResolveURL(%q, %v) = %q, want %q", tt.pattern, tt.pairs, got, tt.want)
			}
		})
	}
}

func TestResolveURL_OddPairsPanics(t *testing.T) {
	t.Parallel()

	defer func() {
		if r := recover(); r == nil {
			t.Error("ResolveURL with odd number of pairs should panic")
		}
	}()

	ResolveURL("/app/{id}", "id")
}
