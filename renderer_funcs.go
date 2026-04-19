package pyeza

import (
	"bytes"
	"encoding/json"
	"fmt"
	"html/template"
	"log"
	"strings"

	"github.com/erniealice/pyeza-golang/route"
	"github.com/erniealice/pyeza-golang/types"
)

// getDefaultFuncMap returns the default template functions (arithmetic, collection
// helpers, slugify, translation lookup, JSON serializers). These are renderer-
// independent and can be called without an *HTMLRenderer receiver.
func getDefaultFuncMap() template.FuncMap {
	return template.FuncMap{
		"add": func(a, b int) int {
			return a + b
		},
		"sub": func(a, b int) int {
			return a - b
		},
		"mul": func(a, b any) float64 {
			af := toFloat64(a)
			bf := toFloat64(b)
			return af * bf
		},
		"div": func(a, b any) float64 {
			af := toFloat64(a)
			bf := toFloat64(b)
			if bf == 0 {
				return 0
			}
			return af / bf
		},
		"until": func(count int) []int {
			// Sprig-compatible until function: generates [0, 1, ..., count-1]
			result := make([]int, count)
			for i := 0; i < count; i++ {
				result[i] = i
			}
			return result
		},
		"loop": func(n int) []int {
			result := make([]int, n)
			for i := range n {
				result[i] = i
			}
			return result
		},
		// dict creates a map from key-value pairs for passing to templates
		// Usage: {{template "component" dict "Key1" "value1" "Key2" "value2"}}
		"dict": func(values ...any) map[string]any {
			if len(values)%2 != 0 {
				return nil
			}
			dict := make(map[string]any, len(values)/2)
			for i := 0; i < len(values); i += 2 {
				key, ok := values[i].(string)
				if !ok {
					continue
				}
				dict[key] = values[i+1]
			}
			return dict
		},
		// list creates a slice from values for passing arrays to templates
		// Usage: {{template "tabs" dict "Items" (list item1 item2 item3)}}
		"list": func(values ...any) []any {
			return values
		},
		// slugify converts arbitrary label text into a stable kebab-case token
		// for ids, data-testid hooks, and similar non-user-facing attributes.
		"slugify": func(value any) string {
			raw := strings.TrimSpace(fmt.Sprint(value))
			if raw == "" {
				return ""
			}
			normalized := strings.ToLower(raw)
			normalized = strings.NewReplacer(
				"&", " and ",
				"/", " ",
				"\\", " ",
				"_", " ",
				"-", " ",
				".", " ",
				",", " ",
				":", " ",
				";", " ",
				"(", " ",
				")", " ",
				"[", " ",
				"]", " ",
				"{", " ",
				"}", " ",
				"'", "",
				"\"", "",
			).Replace(normalized)
			return strings.Join(strings.Fields(normalized), "-")
		},
		// t looks up a translation key from a Messages map.
		// Safe for sub-templates called via dict where .T() is unavailable.
		// Falls back to returning the key itself if not found.
		// Usage: {{t .Messages "buttons.save"}}
		"t": func(messages any, key string) string {
			if m, ok := messages.(map[string]string); ok {
				if v, found := m[key]; found {
					return v
				}
			}
			return key
		},
		// formatDuration formats a duration value + unit stem into a display string,
		// using the singular form when value == 1 and plural otherwise.
		// Usage: {{formatDuration .DurationValue .DurationUnit .CommonLabels.DurationUnit}}
		"formatDuration": func(value any, unit string, labels DurationUnitLabels) string {
			var v int32
			switch n := value.(type) {
			case int32:
				v = n
			case int64:
				v = int32(n)
			case int:
				v = int32(n)
			case float64:
				v = int32(n)
			}
			return FormatDuration(v, unit, labels)
		},
		// filterColumnsJSON serializes filterable columns as a JSON array for use
		// in inert <script type="application/json"> blocks in table templates.
		// Only columns with Filterable==true are included.
		// Each entry has: key, label, type, and optionally options (for FilterTypeStatus).
		// Returns template.JS to prevent double-escaping.
		// Usage: {{filterColumnsJSON .Columns}}
		"filterColumnsJSON": func(columns any) template.JS {
			cols, ok := columns.([]types.TableColumn)
			if !ok {
				return template.JS("[]")
			}
			filterable := make([]map[string]any, 0)
			for _, c := range cols {
				if !c.Filterable {
					continue
				}
				entry := map[string]any{
					"key":   c.Key,
					"label": c.Label,
					"type":  string(c.FilterType),
				}
				if len(c.FilterOptions) > 0 {
					opts := make([]map[string]string, len(c.FilterOptions))
					for i, o := range c.FilterOptions {
						opts[i] = map[string]string{"value": o.Value, "label": o.Label}
					}
					entry["options"] = opts
				}
				filterable = append(filterable, entry)
			}
			b, _ := json.Marshal(filterable)
			if b == nil {
				return template.JS("[]")
			}
			return template.JS(b)
		},
	}
}

// buildFuncMap returns the default FuncMap extended with renderer-aware functions.
// This method exists because renderContent needs a closure over r.templates,
// which is nil at parse time but populated before any template is rendered.
func (r *HTMLRenderer) buildFuncMap() template.FuncMap {
	base := getDefaultFuncMap()

	// route looks up a static URL by key from the route map.
	// Falls back to the key itself if not found.
	// Usage: {{route "product.list"}} → "/app/products/list/{status}"
	base["route"] = func(key string) string {
		if r.routeMap != nil {
			if url, ok := r.routeMap[key]; ok {
				return url
			}
		}
		return key
	}

	// routeWith looks up a parameterized URL by key and resolves {param} placeholders.
	// Pairs are key-value arguments: {{routeWith "product.edit" "id" .ID}}
	// Uses ...any (not ...string) because template expressions like
	// {{index .Item "id"}} return interface{}, not string.
	base["routeWith"] = func(key string, pairs ...any) string {
		pattern := key
		if r.routeMap != nil {
			if url, ok := r.routeMap[key]; ok {
				pattern = url
			}
		}
		if len(pairs) == 0 || len(pairs)%2 != 0 {
			return pattern
		}
		strPairs := make([]string, len(pairs))
		for i, p := range pairs {
			strPairs[i] = fmt.Sprintf("%v", p)
		}
		return route.ResolveURL(pattern, strPairs...)
	}

	// renderContent dynamically executes a named template and returns the result
	// as template.HTML. This is safe because the sub-template output is already
	// auto-escaped by html/template — the template.HTML wrapper prevents
	// double-escaping, not escaping.
	//
	// SECURITY: The name parameter must always be a compile-time constant set
	// in Go view code (e.g., ContentTemplate: "inventory-detail-content").
	// NEVER derive it from user input (URL params, headers, form values, cookies).
	// Doing so would allow template injection — an attacker could render
	// arbitrary templates or trigger server errors.
	base["renderContent"] = func(name string, data any) template.HTML {
		if name == "" {
			return template.HTML("")
		}
		t := r.templates.Lookup(name)
		if t == nil {
			return template.HTML(`<div class="page-content"><p>Page content not available</p></div>`)
		}
		var buf bytes.Buffer
		if err := t.Execute(&buf, data); err != nil {
			log.Printf("renderContent error for %s: %v", name, err)
			return template.HTML(`<div class="page-content"><p>Page content not available</p></div>`)
		}
		return template.HTML(buf.String())
	}

	return base
}

// toFloat64 converts various numeric types to float64
func toFloat64(v any) float64 {
	switch n := v.(type) {
	case int:
		return float64(n)
	case int64:
		return float64(n)
	case float64:
		return n
	case float32:
		return float64(n)
	default:
		return 0
	}
}
