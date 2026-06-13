package compose

import (
	"errors"
	"fmt"
	"io/fs"
	"sort"
	"strings"

	pyeza "github.com/erniealice/pyeza-golang"
	"github.com/erniealice/pyeza-golang/route"
	"github.com/erniealice/pyeza-golang/types"
	"github.com/erniealice/pyeza-golang/view"
)

// OverlayFunc applies a lyngua-shaped JSON overlay into target in place,
// returning nil when the binding's file is absent (LoadPathIfExists
// semantics) and an error only on parse/decode failure.
//
// The engine takes this as an injected dependency rather than importing
// lyngua directly, which keeps the compose package free of monorepo deps
// (pyeza must import only pyeza-internal + stdlib). The app supplies a
// closure over its lyngua TranslationProvider:
//
//	eng.Overlay = func(b compose.JSONBinding, target any) error {
//	    return provider.LoadPathIfExists("en", cfg.BusinessType, b.File, b.Key, target)
//	}
//
// When Overlay is nil the engine skips overlays entirely (descriptors keep
// their pre-filled defaults) — useful for tests and for apps with no tier
// overrides.
type OverlayFunc func(binding JSONBinding, target any) error

// Engine is the assembly line. It is configured once per app and assembles a
// curated unit list into a Result.
type Engine struct {
	// BusinessType is the configured tier; surfaced to Mount closures via
	// MountContext.BusinessType.
	BusinessType string

	// Common / Table are the shared label sets handed to every Mount.
	Common pyeza.CommonLabels
	Table  types.TableLabels

	// Overlay applies JSON route/label overrides in place. May be nil (no
	// overlay). See OverlayFunc.
	Overlay OverlayFunc

	// Validate, when true, runs pyeza.ValidateLabels for every unit with a
	// LabelName and collects the warnings into Result.LabelWarnings. Warnings
	// are advisory — they do NOT fail the boot (matching today's behaviour).
	Validate bool
}

// LabelEntry records a unit's label payload for ValidateLabels reporting and
// for downstream label-bundle consumers.
type LabelEntry struct {
	Key    string // mount key
	Name   string // LabelName, e.g. "JobLabels"
	Labels any    // pointer to the (post-overlay) labels struct
}

// Result is the engine's derived output — the artifacts the app splices into
// its renderer / route map / sidebar.
type Result struct {
	// RouteMap is the merged, post-override, prefix-namespaced route table:
	// dot-notation key -> path. Feeds renderer.SetRouteMap / template {{route}}.
	RouteMap map[string]string

	// Labels lists every unit's label payload in mount order, for
	// ValidateLabels reporting and label-bundle assembly.
	Labels []LabelEntry

	// LabelWarnings aggregates pyeza.ValidateLabels output across all units
	// (only populated when Engine.Validate is true). Advisory, non-fatal.
	LabelWarnings []string

	// Nav maps mount key -> the unit's resolved NavContrib. The sidebar
	// declaration (Phase 1) pulls items from here by key (NavOf / PickNav).
	// Every NavItem.Route in here is guaranteed to resolve against RouteMap
	// (phase-3 fail-closed check), so a sidebar href can never dangle.
	Nav map[string]NavContrib

	// Templates collects every mounted unit's TemplatesFS (nil entries
	// dropped) for pyeza.NewHTMLRendererFromFS.
	Templates []fs.FS

	// keys preserves mount order for deterministic iteration.
	keys []string
}

// ResolveNavHref resolves a NavItem to its final href against the merged,
// post-override RouteMap. It applies the mount's RouteKeyPrefix-namespaced
// route key, substitutes Params (chi {name} style via route.ResolveURL), and
// appends Query. Returns ("", false) when the route key is absent — the
// caller (sidebar resolver) treats that as a fail-closed boot error.
func (res *Result) ResolveNavHref(prefix string, item NavItem) (string, bool) {
	key := item.Route
	if prefix != "" {
		key = prefix + trimBaseSegment(item.Route)
	}
	pattern, ok := res.RouteMap[key]
	if !ok {
		return "", false
	}
	href := pattern
	if len(item.Params) > 0 {
		pairs := make([]string, 0, len(item.Params)*2)
		// Deterministic order so ResolveURL output is stable.
		names := make([]string, 0, len(item.Params))
		for n := range item.Params {
			names = append(names, n)
		}
		sort.Strings(names)
		for _, n := range names {
			pairs = append(pairs, n, item.Params[n])
		}
		href = route.ResolveURL(href, pairs...)
	}
	if item.Query != "" {
		href += item.Query
	}
	return href, true
}

// Assemble runs the three-phase assembly. It is fail-closed: any duplicate
// mount key, route-key collision, overlay parse error, or dangling nav
// reference is returned as an error and NO partial Result escapes — the app
// is expected to refuse boot.
//
//	Phase 1 — resolve: per unit, overlay RouteJSON into Routes and LabelJSON
//	          into Labels in place; merge the prefix-namespaced RouteMap into
//	          Result.RouteMap (collision => boot error); record labels +
//	          optional ValidateLabels warnings; collect TemplatesFS.
//	Phase 2 — mount: call unit.Mount(mc) in list order, with a MountContext
//	          whose cross-unit table sees ALL resolved units (so phase-2
//	          closures read final post-overlay sibling values).
//	Phase 3 — fail-closed checks: every NavItem.Route must resolve against the
//	          final RouteMap (duplicate keys already caught in phase 1).
func (e *Engine) Assemble(units []Unit, registrar view.RouteRegistrar) (*Result, error) {
	res := &Result{
		RouteMap: make(map[string]string),
		Nav:      make(map[string]NavContrib),
	}

	// Stable working copies so we can take stable pointers for the cross-unit
	// table and the Mount closures.
	resolved := make([]*Unit, len(units))
	byKey := make(map[string]*Unit, len(units))
	for i := range units {
		u := units[i] // copy
		resolved[i] = &u
	}

	// --- Phase 1: resolve -------------------------------------------------
	for _, u := range resolved {
		if u.Key == "" {
			return nil, errors.New("compose: unit with empty Key (mount-id required)")
		}
		if _, dup := byKey[u.Key]; dup {
			return nil, fmt.Errorf("compose: duplicate mount key %q (each mount needs a unique id)", u.Key)
		}
		byKey[u.Key] = u
		res.keys = append(res.keys, u.Key)

		// Overlay route + label JSON in place (before reading RouteMap).
		if e.Overlay != nil {
			if u.Routes != nil && u.RouteJSON.File != "" {
				if err := e.Overlay(u.RouteJSON, u.Routes); err != nil {
					return nil, fmt.Errorf("compose: unit %q route overlay (%s#%s): %w",
						u.Key, u.RouteJSON.File, u.RouteJSON.Key, err)
				}
			}
			if u.Labels != nil && u.LabelJSON.File != "" {
				if err := e.Overlay(u.LabelJSON, u.Labels); err != nil {
					return nil, fmt.Errorf("compose: unit %q label overlay (%s#%s): %w",
						u.Key, u.LabelJSON.File, u.LabelJSON.Key, err)
				}
			}
		}

		// Merge prefix-namespaced route map; collision is fail-closed.
		for k, v := range u.resolvedRouteMap() {
			if existing, clash := res.RouteMap[k]; clash && existing != v {
				return nil, fmt.Errorf(
					"compose: route key collision %q: unit %q wants %q but it is already %q "+
						"(give one mount a distinct RouteKeyPrefix)",
					k, u.Key, v, existing)
			}
			res.RouteMap[k] = v
		}

		// Labels bookkeeping + optional validation.
		if u.Labels != nil {
			res.Labels = append(res.Labels, LabelEntry{Key: u.Key, Name: u.LabelName, Labels: u.Labels})
			if e.Validate && u.LabelName != "" {
				res.LabelWarnings = append(res.LabelWarnings, pyeza.ValidateLabels(u.LabelName, u.Labels)...)
			}
		}

		// Nav contribution (resolved hrefs validated in phase 3).
		res.Nav[u.Key] = u.Nav

		// Template FS collection.
		if u.Templates != nil {
			res.Templates = append(res.Templates, u.Templates)
		}
	}

	// --- Phase 2: mount ---------------------------------------------------
	mc := &MountContext{
		Routes:       registrar,
		Common:       e.Common,
		Table:        e.Table,
		BusinessType: e.BusinessType,
		units:        byKey,
	}
	for _, u := range resolved {
		if u.Mount == nil {
			continue
		}
		if err := u.Mount(mc); err != nil {
			return nil, fmt.Errorf("compose: unit %q mount: %w", u.Key, err)
		}
	}

	// --- Phase 3: fail-closed nav resolution ------------------------------
	var navErrs []string
	for _, u := range resolved {
		for _, item := range u.Nav.Items {
			if item.Route == "" {
				continue // a header-only / static item carries no route
			}
			if _, ok := res.ResolveNavHref(u.RouteKeyPrefix, item); !ok {
				key := item.Route
				if u.RouteKeyPrefix != "" {
					key = u.RouteKeyPrefix + trimBaseSegment(item.Route)
				}
				navErrs = append(navErrs, fmt.Sprintf(
					"unit %q nav item %q references route key %q which is not in the route table",
					u.Key, item.Key, key))
			}
		}
	}
	if len(navErrs) > 0 {
		sort.Strings(navErrs)
		return nil, fmt.Errorf("compose: %d unresolvable nav reference(s) (fail-closed):\n  - %s",
			len(navErrs), strings.Join(navErrs, "\n  - "))
	}

	return res, nil
}
