package types

import "html/template"

// AccordionData holds the parameters for the "pyeza-accordion" primitive.
//
// The accordion uses native <details>/<summary> semantics — no JS toggle.
// BEM class root: pyeza-accordion.
//
// Usage (template):
//
//	{{template "pyeza-accordion" (dict
//	    "Title"         "Cycle 1 — May 2026"
//	    "OpenByDefault" true
//	    "Body"          .CycleBodyHTML
//	    "Modifiers"     (list "compact"))}}
type AccordionData struct {
	// Title is the visible header text rendered inside the <summary>.
	Title string
	// TitleHTML is an optional pre-rendered HTML title (e.g. status badge alongside text).
	// When set, takes precedence over Title.
	TitleHTML template.HTML
	// Meta is optional trailing-meta HTML rendered on the right of the header
	// (status badge, count, timestamp, etc.).
	Meta template.HTML
	// Body is the collapsible content rendered inside the <details> region.
	Body template.HTML
	// OpenByDefault renders the accordion expanded on first paint.
	OpenByDefault bool
	// BodyID is an optional id for the body region (useful for hx-target / aria links).
	BodyID string
	// TestID populates data-testid on the outer container for E2E selection.
	TestID string
	// DataAttrs are extra data-* attributes to render on the outer container
	// (keys are written verbatim — caller must use kebab-case).
	DataAttrs map[string]string
	// Modifiers are BEM modifier suffixes applied to the root class
	// (e.g. ["compact"] → "pyeza-accordion--compact").
	Modifiers []string
}
