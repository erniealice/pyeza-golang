package pyeza

import (
	"bytes"
	"encoding/json/v2"
	"fmt"
	"html/template"
	"log"
	"net/url"
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
		// addf/subf are float-typed counterparts to add/sub. Used for SVG
		// coordinate math in chart templates where mul/div already returns
		// float64 and chained add/sub would otherwise need int args.
		"min": func(a, b int) int {
			if a < b {
				return a
			}
			return b
		},
		"max": func(a, b int) int {
			if a > b {
				return a
			}
			return b
		},
		"addf": func(a, b any) float64 {
			return toFloat64(a) + toFloat64(b)
		},
		"subf": func(a, b any) float64 {
			return toFloat64(a) - toFloat64(b)
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
		// quoteJSON JSON-encodes a string value and returns it as template.JS so
		// it can be embedded inside a <script type="application/json"> block without
		// double-escaping. The result includes the surrounding double-quotes.
		// Usage: {{quoteJSON .Labels.BulkSelectAllPage}} → "Select All items in this page"
		"quoteJSON": func(s string) template.JS {
			b, err := json.Marshal(s)
			if err != nil {
				return template.JS(`""`)
			}
			return template.JS(b)
		},
		// csvCell returns the canonical CSV-export string for a TableCell, used
		// by table.html to emit data-csv on each <td>. Keeps client-side export
		// consistent regardless of how the cell renders visually.
		"csvCell": types.CellCSV,
		// filterPanelLabelsJSON serializes the subset of TableLabels needed by
		// the filter widget JS into an inert JSON block. Read by table-filters.js
		// via readPanelLabels() — keeps every label (operator names, date presets,
		// tri-state, placeholders) translation-driven instead of hardcoded.
		"filterPanelLabelsJSON": func(labels any) template.JS {
			tl, ok := labels.(types.TableLabels)
			if !ok {
				return template.JS("{}")
			}
			m := map[string]string{
				"filterOpContains":        tl.FilterOpContains,
				"filterOpEquals":          tl.FilterOpEquals,
				"filterOpStartsWith":      tl.FilterOpStartsWith,
				"filterOpEndsWith":        tl.FilterOpEndsWith,
				"filterOpNotEquals":       tl.FilterOpNotEquals,
				"filterOpBetween":         tl.FilterOpBetween,
				"filterOpEq":              tl.FilterOpEq,
				"filterOpNeq":             tl.FilterOpNeq,
				"filterOpGt":              tl.FilterOpGt,
				"filterOpGte":             tl.FilterOpGte,
				"filterOpLt":              tl.FilterOpLt,
				"filterOpLte":             tl.FilterOpLte,
				"filterOpOn":              tl.FilterOpOn,
				"filterOpBefore":          tl.FilterOpBefore,
				"filterOpAfter":           tl.FilterOpAfter,
				"filterOpIn":              tl.FilterOpIn,
				"filterOpNotIn":           tl.FilterOpNotIn,
				"filterPresetToday":       tl.FilterPresetToday,
				"filterPreset7d":          tl.FilterPreset7d,
				"filterPreset30d":         tl.FilterPreset30d,
				"filterPresetMonth":       tl.FilterPresetMonth,
				"filterPresetCustom":      tl.FilterPresetCustom,
				"filterAny":               tl.FilterAny,
				"filterYes":               tl.FilterYes,
				"filterNo":                tl.FilterNo,
				"filterSearchPlaceholder": tl.FilterSearchPlaceholder,
				"filterMinPlaceholder":    tl.FilterMinPlaceholder,
				"filterMaxPlaceholder":    tl.FilterMaxPlaceholder,
			}
			b, _ := json.Marshal(m)
			if b == nil {
				return template.JS("{}")
			}
			return template.JS(b)
		},
		// filterColumnsJSON serializes filterable columns as a JSON array for use
		// in inert <script type="application/json"> blocks in table templates.
		//
		// Phase 8b: default-on — emit every column with a non-empty Key unless NoFilter is set.
		// The 8b sweep removed all consumer Filterable: true lines and pre-set NoFilter: true
		// on derived/joined/Phase-7.4-risky columns. Phase 9 deleted the legacy `Filterable bool`
		// field from TableColumn and added view-layer filter validation via FilterableKeys.
		//
		// Each entry: key, label, type (legacy alias), filterType (Phase 8 widget kind),
		// defaultOperator, and optionally options (for list/status filters).
		// Returns template.JS to prevent double-escaping.
		// Usage: {{filterColumnsJSON .Columns}}
		"filterColumnsJSON": func(columns any) template.JS {
			cols, ok := columns.([]types.TableColumn)
			if !ok {
				return template.JS("[]")
			}
			filterable := make([]map[string]any, 0)
			for _, c := range cols {
				if c.Key == "" {
					continue
				}
				if !c.IsFilterable() {
					continue
				}
				ft := c.FilterType
				if ft == "" {
					ft = types.FilterTypeString
				}
				entry := map[string]any{
					"key":             c.Key,
					"label":           c.Label,
					"type":            string(ft),
					"filterType":      string(ft),
					"defaultOperator": defaultOperatorFor(ft),
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

	// actionForm renders the signed hidden-input pair that the
	// action_workspace_guard middleware requires on every unsafe (POST/PUT/
	// PATCH/DELETE) /action/* request. Usage in templates:
	//
	//	<form hx-post="{{.FormAction}}" ...>
	//	    {{actionForm .FormAction .WorkspaceID}}
	//	    ...
	//	</form>
	//
	// The first arg is the same URL the form posts to (it is bound into the
	// HMAC so a signature for /action/clients/delete cannot be lifted into
	// /action/clients/add). The second arg is the current session's
	// workspace_id, populated on every render by the ViewAdapter into
	// PageData.WorkspaceID.
	//
	// Safe-mode returns (empty HTML) when:
	//   - no signer is wired (dev boots without SECURITY_WORKSPACEFORM_HMAC_KEY) — the
	//     guard is also disabled in that case so the missing fields don't
	//     break anything.
	//   - workspaceID is empty (e.g. pre-workspace auth pages) — the guard
	//     exempts /action/auth/* and pre-binding requests, so an empty render
	//     is also correct here.
	//   - signing errors (extremely rare; rand source failure) — empty render
	//     plus an error log; the form will then fail closed at the guard
	//     with the standard "please reload" 409.
	base["actionForm"] = func(actionPath, workspaceID string) template.HTML {
		if r.wsFormSigner == nil || workspaceID == "" || actionPath == "" {
			return template.HTML("")
		}
		sig, err := r.wsFormSigner.SignFields(workspaceID, actionPath)
		if err != nil {
			log.Printf("actionForm: SignFields failed (path=%q): %v", actionPath, err)
			return template.HTML("")
		}
		// Use template.HTMLEscapeString on values: workspaceID is a UUID and
		// sig is base64url, but defensive escaping protects against future
		// shape changes (e.g. if workspaceID ever held arbitrary input).
		return template.HTML(fmt.Sprintf(
			`<input type="hidden" name="_workspace_id" value="%s"><input type="hidden" name="_workspace_id_sig" value="%s">`,
			template.HTMLEscapeString(workspaceID),
			template.HTMLEscapeString(sig),
		))
	}

	// rowActionTokens signs every distinct POST-ing action path present in a
	// TableConfig — both per-row actions (delete/deactivate/…) and bulk-action
	// endpoints — and returns a JSON object mapping action path ->
	// _workspace_id_sig value. Usage on the table-card container:
	//
	//	<div class="table-card" data-ws-id="{{.WorkspaceID}}"
	//	     data-action-tokens="{{rowActionTokens .}}">
	//
	// Row-action buttons POST via a raw fetch (table-actions.js / dialog.js) and
	// bulk actions POST via bulk-action.js, not an HTMX <form>, so the
	// {{actionForm}} hidden inputs never reach them and the action_workspace_guard
	// rejects the POST (409). Instead the table-card carries this map; the JS
	// derives the POST path from the action URL, looks up the signature, and
	// appends _workspace_id / _workspace_id_sig to the request body.
	//
	// The guard verifies over r.URL.Path, so each map key is an action's full
	// path (NOT a coalesced base path): id-in-query row actions (the row id rides
	// as ?id=) share ONE signature across every row because their path is
	// identical, while id-in-path actions get one signature per distinct path.
	// Disabled actions are skipped — they never POST.
	//
	// Returns "{}" in safe mode (no signer wired, or no workspace bound) — the
	// guard is disabled in exactly those cases, so an empty map is correct and
	// matches the {{actionForm}} safe-mode behavior above.
	base["rowActionTokens"] = func(cfg types.TableConfig) string {
		if r.wsFormSigner == nil || cfg.WorkspaceID == "" {
			return "{}"
		}
		// POST-ing row actions — mirrors the raw-fetch handlers in
		// table-actions.js / dialog.js. Drawer-open (edit/clone), navigations
		// (view/details/manage), and download (GET) are deliberately excluded:
		// they never POST to /action/*.
		posting := map[string]bool{
			"delete": true, "deactivate": true, "activate": true, "undo": true,
			"complete": true, "cancel": true, "reclassify": true, "send-email": true,
		}
		tokens := map[string]string{}
		signPath := func(rawURL string) {
			if rawURL == "" {
				return
			}
			p := rawURL
			if u, err := url.Parse(rawURL); err == nil {
				p = u.Path
			} else if i := strings.IndexByte(rawURL, '?'); i >= 0 {
				p = rawURL[:i]
			}
			if p == "" {
				return
			}
			if _, done := tokens[p]; done {
				return
			}
			sig, err := r.wsFormSigner.SignFields(cfg.WorkspaceID, p)
			if err != nil {
				log.Printf("rowActionTokens: SignFields failed (path=%q): %v", p, err)
				return
			}
			tokens[p] = sig
		}
		walk := func(rows []types.TableRow) {
			for _, row := range rows {
				for _, a := range row.Actions {
					// Skip Disabled actions — the view renders them inert (no POST
					// is ever issued), so signing their path is dead weight and
					// would publish a token for a path the user can't reach.
					if a.Disabled {
						continue
					}
					if posting[a.Action] {
						signPath(a.URL)
					}
				}
			}
		}
		walk(cfg.Rows)
		for _, g := range cfg.Groups {
			walk(g.Rows)
		}
		// Bulk-action endpoints POST via bulk-action.js (raw fetch) and hit the
		// same action_workspace_guard on their own distinct path, so sign each
		// enabled bulk endpoint too. Skips Disabled bulk actions (rendered inert).
		if cfg.BulkActions != nil && cfg.BulkActions.Enabled {
			for _, ba := range cfg.BulkActions.Actions {
				if ba.Disabled {
					continue
				}
				signPath(ba.Endpoint)
			}
		}
		b, err := json.Marshal(tokens)
		if err != nil {
			return "{}"
		}
		return string(b)
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
	// gridSlot pairs a CellGridConfig with a column's opaque Actions payload for
	// CellGridConfig.L1ActionsTemplate. Needed because the slot's dot must carry
	// BOTH — the payload the consumer defined, and the config where the
	// render-time-injected Nonce / WorkspaceID live (a signed {{actionForm}} in
	// the slot needs the latter). See types.CellGridSlot.
	base["gridSlot"] = func(grid, actions any) types.CellGridSlot {
		return types.CellGridSlot{Grid: grid, Actions: actions}
	}

	base["renderContent"] = func(name string, data any) template.HTML {
		if name == "" {
			// Diagnostic: empty name should never happen for content partials.
			log.Printf("renderContent: empty template name; data type=%T", data)
			return template.HTML("")
		}
		t := r.templates.Lookup(name)
		if t == nil {
			// Diagnostic: print which template was missing and the data type, so the
			// next request immediately reveals the cause of the "Page content not
			// available" fallback.
			log.Printf("renderContent: template %q NOT REGISTERED (data type=%T)", name, data)
			if isDecorativeTemplate(name) {
				return template.HTML("")
			}
			return template.HTML(`<div class="page-content"><p>Page content not available</p></div>`)
		}
		var buf bytes.Buffer
		if err := t.Execute(&buf, data); err != nil {
			// Diagnostic: full error chain + data type so the failing template /
			// field surfaces in the server log without needing a stack walk.
			log.Printf("renderContent: Execute(%q) FAILED: %v (data type=%T)", name, err, data)
			return template.HTML(`<div class="page-content"><p>Page content not available</p></div>`)
		}
		return template.HTML(buf.String())
	}

	return base
}

// isDecorativeTemplate reports whether a renderContent name addresses a purely
// decorative glyph rather than a page body.
//
// renderContent is used for two very different jobs: rendering a page's content
// partial, and rendering a named icon into a small aria-hidden slot inside a
// component (auth principal cards, logo marks, cell affordances). The
// "Page content not available" miss-fallback is right for the first and
// actively harmful for the second — an unknown icon name injected a page-level
// <div class="page-content"><p>Page content not available</p></div> INSIDE a
// <button>, which is how the select-workspace-role staff card came to announce
// itself as "Page content not available …" and steered operators onto the wrong
// principal binding. A missing decoration must degrade to no decoration.
//
// The miss is still logged either way, so the drift stays diagnosable.
func isDecorativeTemplate(name string) bool {
	return strings.HasPrefix(name, "icon-")
}

// defaultOperatorFor returns the JS operator string used when the filter widget renders.
// Mirrors the default-operator decisions in plan §Locked decisions row 2.
func defaultOperatorFor(ft types.FilterColumnType) string {
	switch ft {
	case types.FilterTypeNumericRange, types.FilterTypeNumeric, types.FilterTypeMoney:
		return "between"
	case types.FilterTypeDateRange, types.FilterTypeDate:
		return "between"
	case types.FilterTypeList, types.FilterTypeListLabel, types.FilterTypeStatus:
		return "in"
	case types.FilterTypeBoolean, types.FilterTypeToggle:
		return "" // boolean has no operator concept (value is the assertion)
	default:
		return "contains"
	}
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
