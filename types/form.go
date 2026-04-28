package types

// RadioOption is the canonical option shape for the form-radio-group component
// (components/form-radio.html). Mirrors SelectOption's role for selects, but
// adds a Description slot that surfaces as a muted secondary line below the
// option's primary label.
//
// Templates access these fields via struct-field syntax (e.g. `{{.Value}}`),
// so every consumer that feeds form-radio-group should pass either a slice
// of RadioOption or any struct that exposes the same field set. Go's
// html/template errors hard — not silently — when a referenced field is
// missing, so prefer this typed shape over ad-hoc maps.
//
// Consumer:
//   - form-radio-group.html (Options): Value, Label, Description, Disabled
type RadioOption struct {
	Value       string // Radio option value attribute
	Label       string // Visible primary label
	Description string // Optional secondary line shown below Label in muted text
	Disabled    bool   // Whether this option is disabled (renders disabled + aria-disabled)
}
