package render

import (
	"reflect"
	"strings"
)

// nav_rewrite.go — per-request rewriting of NAVIGATIONAL URLs carried on page
// data.
//
// WHY THIS EXISTS
// ---------------
// Two different lanes build URLs in this stack, and before this file only ONE
// of them was rewritten per request:
//
//	PREFIXED LANE — a URL written in a TEMPLATE as {{route "x"}} / {{routeWith}}
//	  reads the per-request route map installed by the composition layer's
//	  RouteRewriter (WithRouteMap, above), so it carries /w/{slug}. The sidebar
//	  is likewise rebuilt through NavResolver.WithWorkspace.
//
//	BARE LANE (the defect) — a URL computed in GO VIEW CODE from the Routes
//	  struct captured at compose Mount time (e.g. route.ResolveURL(deps.Detail‐
//	  URL, "id", x) → types.TableRow.Href / types.TableAction.Href). Those are
//	  boot-time constants; nothing in the request path ever touched them, so a
//	  row action could never carry the workspace prefix. Following one left the
//	  /w/{slug} lane entirely, which forces WorkspacePath to re-resolve the
//	  workspace from the SESSION, rotating it and reissuing ws_csrf.
//
// RewriteNavURLs closes the bare lane for the whole CLASS, not one href: it
// walks the page-data graph once per render and applies the caller's rewrite
// function to every string field whose NAME is in navURLFields.
//
// The rewrite function supplied by espyna is consumer.PrependWorkspaceSlug,
// which is idempotent and pass-through for /action/, /auth/, /me/, /assets/,
// /static/, /healthz, /w/ and any non-leading-slash string — so a second pass
// over an already-prefixed value, or over a field that turns out not to hold a
// path, is a no-op.

// isNavURLField reports whether a struct field NAME denotes a URL.
//
// A NAME RULE, not a hand-maintained list of fields. An allowlist was the first
// cut and it under-fixed immediately: it caught types.TableRow.Href and
// types.PageData.HeaderBreadcrumbURL but missed page-local fields like the
// outcome-matrix view's ScopeMineURL / ScopeAllURL, which are just as
// navigational. Enumerating every domain package's page-local URL field inside
// pyeza would also drag vertical vocabulary into a generic package and go stale
// the day someone adds a view.
//
// So: any exported string field named `Href`, or whose name ends in `Href` or
// `URL`, is a candidate. Safety does NOT come from the name set — it comes from
// the rewrite function, which is pass-through for /action/, /auth/, /me/,
// /assets/, /static/, /healthz, /w/ and anything that is not a leading-slash
// path, and idempotent besides. HTMX/POST targets (SaveURL, RefreshURL,
// ActionURL, LogoutActionURL) all live under /action/* and are therefore
// untouched by construction, not by exclusion.
//
// The one class the name rule genuinely must not touch is MEDIA: an avatar or
// image src is not navigation and may point at a storage path that is neither
// a workspace route nor in the pass-through list. Those are excluded by suffix.
func isNavURLField(name string) bool {
	switch {
	case strings.HasSuffix(name, "ImageURL"),
		strings.HasSuffix(name, "AvatarURL"),
		strings.HasSuffix(name, "IconURL"),
		strings.HasSuffix(name, "PhotoURL"),
		strings.HasSuffix(name, "ThumbnailURL"),
		strings.HasSuffix(name, "MediaURL"):
		return false
	}
	return name == "Href" || strings.HasSuffix(name, "Href") || strings.HasSuffix(name, "URL")
}

// navRewriteMaxDepth bounds the reflective walk. Page-data graphs are shallow
// (page → table → rows → cells/actions); 12 is comfortably past the deepest
// real shape and guarantees termination on any self-referential pointer graph.
const navRewriteMaxDepth = 12

// RewriteNavURLs applies fn to every navigational URL field reachable from
// data. A no-op when fn is nil or data is not a settable struct — which is the
// case for every non-workspace (/app/*, /auth/*) request, so the cost outside
// the /w/{slug} lane is one nil check.
func (p *Pipeline) RewriteNavURLs(data any, fn func(string) string) {
	if fn == nil || data == nil {
		return
	}
	v := reflect.ValueOf(data)
	if v.Kind() == reflect.Ptr {
		if v.IsNil() {
			return
		}
		v = v.Elem()
	}
	if v.Kind() != reflect.Struct {
		return
	}
	rewriteNavURLs(v, fn, 0)
}

// rewriteNavURLs is the reflective walk behind RewriteNavURLs.
//
// It descends through pointers, interfaces, slices and arrays, and into struct
// fields (named AND embedded — a row's Href lives inside TableConfig.Rows, well
// past the anonymous-embedding reach of injectTableConfigContext, so this walk
// is deliberately deeper than that one).
//
// MAP VALUES ARE NOT REWRITTEN. Map values obtained via MapIndex are not
// addressable, and the maps that exist on this graph (TableRow.DataAttrs,
// TableConfig.ActionTokens) hold display data and signed tokens, not
// navigation. The walk descends into a map value only when it is a pointer or
// interface, where the pointee IS addressable.
func rewriteNavURLs(v reflect.Value, fn func(string) string, depth int) {
	if depth > navRewriteMaxDepth || !v.IsValid() {
		return
	}

	switch v.Kind() {
	case reflect.Ptr, reflect.Interface:
		if v.IsNil() {
			return
		}
		rewriteNavURLs(v.Elem(), fn, depth+1)

	case reflect.Slice, reflect.Array:
		// Skip byte slices and other scalar element types outright.
		if k := v.Type().Elem().Kind(); k != reflect.Struct && k != reflect.Ptr &&
			k != reflect.Interface && k != reflect.Slice && k != reflect.Array {
			return
		}
		for i := 0; i < v.Len(); i++ {
			rewriteNavURLs(v.Index(i), fn, depth+1)
		}

	case reflect.Map:
		if k := v.Type().Elem().Kind(); k != reflect.Ptr && k != reflect.Interface {
			return
		}
		for _, key := range v.MapKeys() {
			rewriteNavURLs(v.MapIndex(key), fn, depth+1)
		}

	case reflect.Struct:
		t := v.Type()
		for i := 0; i < v.NumField(); i++ {
			sf := t.Field(i)
			if sf.PkgPath != "" {
				continue // unexported — reflection cannot read or set it
			}
			f := v.Field(i)
			if f.Kind() == reflect.String {
				if !isNavURLField(sf.Name) || !f.CanSet() {
					continue
				}
				s := f.String()
				if s == "" {
					continue
				}
				if rewritten := fn(s); rewritten != s {
					f.SetString(rewritten)
				}
				continue
			}
			rewriteNavURLs(f, fn, depth+1)
		}
	}
}
