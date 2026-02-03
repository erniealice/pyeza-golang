package pyeza

import "html/template"

// templates holds the shared template instance set by the renderer
var templates *template.Template

// SetTemplates sets the shared template instance.
// Called by HTMLRenderer after parsing to share templates with legacy handlers.
func SetTemplates(t *template.Template) {
	templates = t
}

// GetTemplate returns a parsed template by name.
// Used by legacy domain handlers that haven't been migrated to dependency injection.
func GetTemplate(name string) *template.Template {
	if templates == nil {
		return nil
	}
	return templates.Lookup(name)
}

// NewPageData creates a new PageData with cache version.
// The configFunc should return the cache version from the app config.
func NewPageData(title, path, activeNav string, configFunc func() string) PageData {
	return PageData{
		CacheVersion: configFunc(),
		Title:        title,
		CurrentPath:  path,
		ActiveNav:    activeNav,
	}
}
