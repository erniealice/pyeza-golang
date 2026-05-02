package pyeza

import (
	"bytes"
	"fmt"
	"html/template"
	"io/fs"
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
	templates        *template.Template
	templateFuncs    template.FuncMap
	templatePatterns []string
	templateFS       []fs.FS
	parseOnce        sync.Once
	parseErr         error
	routeMap         map[string]string // route key → URL pattern (populated before first render)
}

// NewHTMLRenderer creates a new HTMLRenderer.
// templatePatterns: list of glob patterns for app-specific templates
// The pyeza package will automatically locate its own templates.
func NewHTMLRenderer(templatePatterns []string) *HTMLRenderer {
	r := &HTMLRenderer{templatePatterns: templatePatterns}
	r.templateFuncs = r.buildFuncMap()
	return r
}

// NewHTMLRendererFromFS creates a renderer that loads templates from embedded or virtual filesystems.
// Pass pyeza.SharedFS first (icons, partials, components, blocks), then view-domain FS instances.
// For dev hot-reload, pass os.DirFS() instances instead of embed.FS.
func NewHTMLRendererFromFS(filesystems ...fs.FS) *HTMLRenderer {
	r := &HTMLRenderer{templateFS: filesystems}
	r.templateFuncs = r.buildFuncMap()
	return r
}

// WithFuncs adds custom template functions to the renderer
func (r *HTMLRenderer) WithFuncs(funcs template.FuncMap) *HTMLRenderer {
	r.templateFuncs = funcs
	return r
}

// SetRouteMap sets the route lookup map used by the "route" and "routeWith"
// template functions. Must be called before the first template render.
// The map keys are dot-separated route names (e.g., "product.list"),
// and values are URL patterns with chi-style {param} placeholders.
func (r *HTMLRenderer) SetRouteMap(m map[string]string) {
	r.routeMap = m
}

// getSharedComponentsDir returns the path to the shared pyeza package directory
func (r *HTMLRenderer) getSharedComponentsDir() string {
	// Get the file path of this source file
	_, filename, _, ok := runtime.Caller(0)
	if !ok {
		log.Printf("Warning: Could not determine source file location")
	}

	// The pyeza package directory is the directory containing this source file
	componentsDir := filepath.Dir(filename)

	// Verify it exists
	if info, err := os.Stat(componentsDir); err == nil && info.IsDir() {
		return componentsDir
	}

	log.Printf("Warning: pyeza package directory not found at: %s", componentsDir)

	// Fallback: use environment variable if set
	if envDir := os.Getenv("SHARED_COMPONENTS_DIR"); envDir != "" {
		return envDir
	}

	return componentsDir
}

// initFromFS parses templates from fs.FS instances instead of glob patterns.
func (r *HTMLRenderer) initFromFS() error {
	r.templates = template.New("").Funcs(r.templateFuncs)

	for _, fsys := range r.templateFS {
		err := fs.WalkDir(fsys, ".", func(path string, d fs.DirEntry, err error) error {
			if err != nil {
				return err
			}
			if d.IsDir() || !strings.HasSuffix(path, ".html") {
				return nil
			}
			content, readErr := fs.ReadFile(fsys, path)
			if readErr != nil {
				return readErr
			}
			var parseErr error
			r.templates, parseErr = r.templates.Parse(string(content))
			if parseErr != nil {
				return fmt.Errorf("parsing %s: %w", path, parseErr)
			}
			return nil
		})
		if err != nil {
			return err
		}
	}
	return nil
}

// Init parses all templates from the templates directory
func (r *HTMLRenderer) Init() error {
	r.parseOnce.Do(func() {
		if len(r.templateFS) > 0 {
			r.parseErr = r.initFromFS()
			return
		}

		// Get shared pyeza package directory
		sharedDir := r.getSharedComponentsDir()

		// Create template with custom functions
		r.templates = template.New("").Funcs(r.templateFuncs)

		// Build patterns: shared components first, then app-specific templates
		tmplRoot := filepath.Join(sharedDir, "web", "templates")
		patterns := []string{
			filepath.Join(tmplRoot, "icons", "*.html"),
			filepath.Join(tmplRoot, "partials", "*.html"),
			filepath.Join(tmplRoot, "components", "*.html"),
			filepath.Join(tmplRoot, "components", "calendar", "*.html"),
			filepath.Join(tmplRoot, "components", "table", "*.html"),
			filepath.Join(tmplRoot, "components", "charts", "*.html"),
			filepath.Join(tmplRoot, "blocks", "*.html"),
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

// Render renders a template with the given data and writes it to the response writer.
// WARNING: Writes directly to w — if template execution fails midway, partial HTML
// is already committed. Use RenderBuffered for fallback chains where you need
// atomic (all-or-nothing) rendering.
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

// RenderBuffered renders a template to an internal buffer first. If execution
// succeeds, the buffer is flushed to w. If it fails, nothing is written —
// making it safe to use in fallback chains (try content, then partial, then full).
func (r *HTMLRenderer) RenderBuffered(w http.ResponseWriter, templateName string, data interface{}) error {
	if r.templates == nil {
		if err := r.Init(); err != nil {
			return err
		}
	}

	tmpl := r.templates.Lookup(templateName)
	if tmpl == nil {
		return fmt.Errorf("template not found: %s", templateName)
	}

	var buf bytes.Buffer
	if err := tmpl.Execute(&buf, data); err != nil {
		return err
	}

	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	_, err := buf.WriteTo(w)
	return err
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
