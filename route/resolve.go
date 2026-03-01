package route

import "strings"

// ResolveURL replaces named placeholders in a URL pattern with values.
// Placeholders use chi-style {name} syntax.
//
// Usage:
//
//	route.ResolveURL("/app/products/detail/{id}/variants/table", "id", productID)
//	route.ResolveURL("/app/products/detail/{id}/variants/{variantId}", "id", pid, "variantId", vid)
func ResolveURL(pattern string, pairs ...string) string {
	if len(pairs)%2 != 0 {
		panic("route.ResolveURL: odd number of pairs; must be key-value pairs")
	}

	if len(pairs) == 0 {
		return pattern
	}

	replacements := make([]string, 0, len(pairs))
	for i := 0; i < len(pairs); i += 2 {
		replacements = append(replacements, "{"+pairs[i]+"}", pairs[i+1])
	}

	return strings.NewReplacer(replacements...).Replace(pattern)
}
