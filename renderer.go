package pyeza

import (
	"bytes"
	"fmt"
	"html/template"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"sync"
)

// HTMLRenderer handles HTML template rendering with shared components
type HTMLRenderer struct {
	templates      *template.Template
	templateFuncs  template.FuncMap
	templatePatterns []string
	parseOnce      sync.Once
	parseErr       error
}

// NewHTMLRenderer creates a new HTMLRenderer.
// templatePatterns: list of glob patterns for app-specific templates
// The components package will automatically locate its own templates.
func NewHTMLRenderer(templatePatterns []string) *HTMLRenderer {
	r := &HTMLRenderer{templatePatterns: templatePatterns}
	r.templateFuncs = r.buildFuncMap()
	return r
}

// WithFuncs adds custom template functions to the renderer
func (r *HTMLRenderer) WithFuncs(funcs template.FuncMap) *HTMLRenderer {
	r.templateFuncs = funcs
	return r
}

// getDefaultFuncMap returns the default template functions
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
	}
}

// buildFuncMap returns the default FuncMap extended with renderer-aware functions.
// This method exists because renderContent needs a closure over r.templates,
// which is nil at parse time but populated before any template is rendered.
func (r *HTMLRenderer) buildFuncMap() template.FuncMap {
	base := getDefaultFuncMap()

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

// getSharedComponentsDir returns the path to the shared components directory
func (r *HTMLRenderer) getSharedComponentsDir() string {
	// Get the file path of this source file
	_, filename, _, ok := runtime.Caller(0)
	if !ok {
		log.Printf("Warning: Could not determine source file location")
	}

	// The components directory is the directory containing this source file
	componentsDir := filepath.Dir(filename)

	// Verify it exists
	if info, err := os.Stat(componentsDir); err == nil && info.IsDir() {
		return componentsDir
	}

	log.Printf("Warning: Components directory not found at: %s", componentsDir)

	// Fallback: use environment variable if set
	if envDir := os.Getenv("SHARED_COMPONENTS_DIR"); envDir != "" {
		return envDir
	}

	return componentsDir
}

// Init parses all templates from the templates directory
func (r *HTMLRenderer) Init() error {
	r.parseOnce.Do(func() {
		// Get shared components directory
		sharedDir := r.getSharedComponentsDir()

		// Create template with custom functions
		r.templates = template.New("").Funcs(r.templateFuncs)

		// Build patterns: shared components first, then app-specific templates
		patterns := []string{
			filepath.Join(sharedDir, "icons", "*.html"),
			filepath.Join(sharedDir, "partials", "*.html"),
			filepath.Join(sharedDir, "components", "*.html"),
			filepath.Join(sharedDir, "templates", "blocks", "*.html"),
		}
		patterns = append(patterns, r.templatePatterns...)

		for _, pattern := range patterns {
			matches, err := filepath.Glob(pattern)
			if err != nil {
				r.parseErr = err
				return
			}

			if len(matches) == 0 {
				log.Printf("No templates found for pattern: %s", pattern)
				continue
			}

			r.templates, r.parseErr = r.templates.ParseGlob(pattern)
			if r.parseErr != nil {
				log.Printf("Failed to parse templates for pattern %s: %v", pattern, r.parseErr)
				return
			}

			log.Printf("Parsed %d templates from: %s", len(matches), pattern)
		}
	})
	return r.parseErr
}

// Render renders a template with the given data and writes it to the response writer
func (r *HTMLRenderer) Render(w http.ResponseWriter, templateName string, data interface{}) error {
	if r.templates == nil {
		if err := r.Init(); err != nil {
			return err
		}
	}

	tmpl := r.templates.Lookup(templateName)
	if tmpl == nil {
		return fmt.Errorf("template not found: %s", templateName)
	}

	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	return tmpl.Execute(w, data)
}

// GetTemplate returns a parsed template by name
func (r *HTMLRenderer) GetTemplate(name string) *template.Template {
	if r.templates == nil {
		return nil
	}
	return r.templates.Lookup(name)
}

// GetTemplates returns the underlying template.Template for advanced usage
func (r *HTMLRenderer) GetTemplates() *template.Template {
	if r.templates == nil {
		_ = r.Init()
	}
	return r.templates
}

// RenderIcon renders an icon template and returns it as HTML
// iconName is the template name (e.g., "icon-user-check", "icon-award")
func (r *HTMLRenderer) RenderIcon(iconName string) template.HTML {
	if r.templates == nil {
		_ = r.Init()
	}

	tmpl := r.templates.Lookup(iconName)
	if tmpl == nil {
		log.Printf("Warning: Icon template not found: %s", iconName)
		return template.HTML("")
	}

	var buf strings.Builder
	if err := tmpl.Execute(&buf, nil); err != nil {
		log.Printf("Error rendering icon %s: %v", iconName, err)
		return template.HTML("")
	}

	return template.HTML(buf.String())
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
