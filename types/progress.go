package types

// ProgressData holds the parameters for the "pyeza-progress" primitive.
//
// The primitive renders a native <progress> element wrapped in a styled track.
// BEM class root: pyeza-progress.
//
// Color is a token suffix that maps to existing accent / status tokens via the
// pyeza-progress--{color} BEM modifier (e.g. "success", "warning", "danger",
// "primary"). Pass the empty string for the default neutral fill.
//
// Usage (template):
//
//	{{template "pyeza-progress" (dict
//	    "Value"          .UsedVisits
//	    "Max"            .TotalVisits
//	    "Label"          .Labels.VisitsUsed
//	    "Color"          "success"
//	    "ShowValueLabel" true
//	    "TestID"         "subscription-entitlement-meter")}}
type ProgressData struct {
	// Value is the current progress value. Clamped client-side to [0, Max].
	Value int
	// Max is the upper bound. Defaults to 100 when zero.
	Max int
	// Label is an optional caption rendered above the progress track
	// (typically the metric name, e.g. "Visits used").
	Label string
	// Color is the BEM modifier suffix that selects the fill colour. One of
	// "primary" | "success" | "warning" | "danger" | "info" | "" (default).
	// Maps to existing --accent-* and --status-* tokens — no new tokens.
	Color string
	// ShowValueLabel toggles the trailing "Value / Max" caption.
	ShowValueLabel bool
	// Modifiers are additional BEM modifier suffixes (e.g. "compact", "inline").
	Modifiers []string
	// TestID populates data-testid on the outer container for E2E selection.
	TestID string
}
