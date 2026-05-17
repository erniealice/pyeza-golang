package view

import (
	"context"
	"net/http"
)

// View interface defines the contract for presentation-layer views.
// Consumer apps import this interface and use ViewFunc to create inline views.
type View interface {
	Handle(ctx context.Context, viewCtx *ViewContext) ViewResult
}

// ViewFunc is a function adapter for the View interface.
type ViewFunc func(ctx context.Context, viewCtx *ViewContext) ViewResult

// Handle implements the View interface for ViewFunc.
func (f ViewFunc) Handle(ctx context.Context, viewCtx *ViewContext) ViewResult {
	return f(ctx, viewCtx)
}

// ViewContext holds common context data extracted from the HTTP request.
type ViewContext struct {
	Request      *http.Request
	Lang         string
	CurrentPath  string
	IsHTMX       bool
	PathParams   map[string]string
	QueryParams  map[string]string
	CacheVersion string
	Messages     map[string]string // flat i18n messages (dot-notation keys)
	BusinessType string            // "retail", "service", "professional" — set by ViewAdapter from app config
	Translations any               // *lyngua/golang/v1.TranslationProvider — typed as any to avoid import cycle
}

// T returns the translation for the given dot-notation key.
// Falls back to the key itself if not found.
func (vc *ViewContext) T(key string) string {
	if vc.Messages != nil {
		if msg, ok := vc.Messages[key]; ok {
			return msg
		}
	}
	return key
}

// ViewResult is returned by views to the infrastructure layer.
type ViewResult struct {
	Template   string
	Data       any
	Redirect   string
	Flash      *FlashMessage
	Error      error
	StatusCode int
	Headers    map[string]string
}

// FlashMessage represents a one-time notification message.
type FlashMessage struct {
	Type    string
	Message string
}

// OK creates a successful ViewResult with template and data.
func OK(template string, data any) ViewResult {
	return ViewResult{
		Template:   template,
		Data:       data,
		StatusCode: http.StatusOK,
	}
}

// Redirect creates a redirect ViewResult.
func Redirect(url string) ViewResult {
	return ViewResult{
		Redirect:   url,
		StatusCode: http.StatusSeeOther,
	}
}

// Error creates an error ViewResult.
func Error(err error) ViewResult {
	return ViewResult{
		Error:      err,
		StatusCode: http.StatusInternalServerError,
	}
}

// ForbiddenPageData is the template data shape for the shared "forbidden"
// page. Carries the missing permission code so the AWS-style tooltip pattern
// ("Missing permission: plan:create") can render. CommonLabels is populated
// by the ViewAdapter via reflection on render — views just call
// view.Forbidden(perm); they do not construct this struct directly.
type ForbiddenPageData struct {
	CacheVersion    string
	Title           string
	ContentTemplate string
	CurrentPath     string
	HeaderIcon      string
	HeaderTitle     string
	HeaderSubtitle  string
	CommonLabels    any
	Messages        map[string]string
	// Perm carries the entity:action code that was missing, e.g., "plan:create".
	// Rendered inside the "Missing permission: %s" tooltip / page body.
	Perm string
}

// Forbidden creates a 403 ViewResult that renders the shared "forbidden"
// template (see packages/pyeza-golang/web/templates/blocks/forbidden.html).
// `perm` is the entity:action code that the user is missing, e.g.,
// "plan:create" — it is interpolated into the page body so users know what
// to request from their workspace admin (AWS-style messaging).
//
// Pyeza stays dumb: the helper does not import any business-logic packages
// or label types. Callers (view-layer page controllers) hand in only a
// string; the renderer injects CommonLabels via reflection.
func Forbidden(perm string) ViewResult {
	return ViewResult{
		Template: "forbidden",
		Data: &ForbiddenPageData{
			Title:           "Forbidden",
			ContentTemplate: "forbidden-content",
			HeaderIcon:      "icon-lock",
			HeaderTitle:     "Forbidden",
			Perm:            perm,
		},
		StatusCode: http.StatusForbidden,
	}
}

// RouteRegistrar is the interface consumer apps must satisfy
// to register view routes.
type RouteRegistrar interface {
	GET(path string, view View, middlewares ...string)
	POST(path string, view View, middlewares ...string)
}
