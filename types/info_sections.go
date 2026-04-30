package types

import "html/template"

// InfoRow is a single label/value pair inside an InfoSection.
//
// Value carries pre-rendered HTML so callers may embed badges, links, or icons
// alongside plain text. Use the html/template.HTMLEscapeString helper at the
// caller site for untrusted strings.
type InfoRow struct {
	Label string
	Value template.HTML
}

// InfoSection is a single titled group of rows inside the info-sections primitive.
//
// Modifiers are BEM modifier suffixes applied to the section element
// (e.g. ["highlight", "muted"] → "pyeza-info-sections__section--highlight pyeza-info-sections__section--muted").
type InfoSection struct {
	Title     string
	Rows      []InfoRow
	Modifiers []string
	// CustomBody is an optional pre-rendered body that replaces the default
	// label/value <dl>. Use this when a section needs a non-list body
	// (paragraph, bullet list, etc.).
	CustomBody template.HTML
	// TestID populates data-testid on the section for E2E selection.
	TestID string
}

// InfoSectionsData holds the parameters for the "pyeza-info-sections" primitive.
//
// The primitive renders a stack of titled sections. Each section is a definition
// list (<dl>) by default; callers may replace the body via CustomBody.
//
// BEM class root: pyeza-info-sections.
//
// Usage (template):
//
//	{{template "pyeza-info-sections" (dict
//	    "Heading"  "Billing Summary"
//	    "Sections" .BillingSections
//	    "TestID"   "price-plan-billing-summary")}}
type InfoSectionsData struct {
	// Heading is the optional top-level heading rendered above all sections.
	Heading  string
	Sections []InfoSection
	// Modifiers are BEM modifier suffixes applied to the wrapper.
	Modifiers []string
	// TestID populates data-testid on the wrapper for E2E selection.
	TestID string
}
