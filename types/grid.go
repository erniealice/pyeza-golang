package types

import (
	"html/template"
	"strconv"
)

// grid.go — CellGridConfig: a spreadsheet-style bulk-edit grid block.
//
// This is a purpose-built sibling to TableConfig (table.go). Where TableConfig
// models a paginated/sortable/filterable list surface, CellGridConfig models a
// dense spreadsheet: rows = entities (e.g. clients/students), columns = a
// 3-level header hierarchy (phase → task → criterion), cells = inline-editable
// typed inputs enforced by outcome_criteria. A frozen first column and sticky
// header rows keep the row-label and column-headers visible while the operator
// scrolls a wide/tall grid.
//
// The component templates live at web/templates/components/grid/cell-grid-*.html
// and are rendered via {{template "cell-grid-card" .Grid}} — the dot-context is
// narrowed to the *CellGridConfig value, so anything the templates need
// (Nonce, WorkspaceID) must be a field on this struct, not reachable via the
// outer PageData. See render/pipeline.go's Nonce injector (extended with a
// parallel "Grid" branch mirroring the "Table" branch) and the fayna view
// handler (which copies the injected PageData.WorkspaceID into Grid.WorkspaceID).

// CellGridConfig is the top-level config for a spreadsheet-style bulk-edit grid.
// Rows = entities (e.g. clients). Columns = a 3-level hierarchy.
// Cells are inline-editable, typed by criteria_type. A frozen first column
// and sticky header rows are controlled by the Freeze fields.
type CellGridConfig struct {
	ID        string
	Caption   string // accessible caption for screen readers
	CardClass string // extra CSS class on the outer .cell-grid-card

	// Freeze config — CSS position:sticky applied by the component template.
	FreezeFirstCol   bool // true → client-name column gets sticky left
	FreezeHeaderRows int  // 0, 1, 2, or 3 — how many header rows stay sticky on vertical scroll

	// L1ActionsTemplate names a CONSUMER-DEFINED template rendered at the far
	// end of every Level1 header cell whose Actions payload is non-nil. Empty →
	// nothing renders and the header is unchanged.
	//
	// Why a template NAME rather than a template.HTML string, unlike
	// RowHeadHTML: controls in this slot are typically POST forms, and a signed
	// form needs {{actionForm}}, which is a RENDERER func (it holds the
	// workspace form signer). A consumer's view layer cannot produce that
	// markup ahead of time — it must be emitted during render. So pyeza renders
	// the named template and stays ignorant of what is in it.
	//
	// The template receives CellGridLevel1.Actions as its dot, NOT the grid
	// config, so the consumer owns that payload's shape entirely. Anything the
	// slot needs (workspace id for {{actionForm}}, labels, confirm strings) goes
	// on that payload.
	L1ActionsTemplate string

	// RowHeadHTML is a caller-supplied fragment for the frozen corner header
	// cell (the one above the row labels). EMPTY → the cell renders exactly
	// Labels.ClientColumn, byte-for-byte as before, so existing consumers are
	// unaffected.
	//
	// It exists so a consumer can stack a caption plus summary badges there
	// ("Student" / "29 students" / "11 male, 15 female, 3 not assigned")
	// WITHOUT this generic component learning what a student or a gender is.
	// pyeza stays dumb: it renders the fragment and knows nothing about it.
	// Same shape as accordion's TitleHTML, dashboard's Custom, PageData's
	// HeaderIconHTML and TableCell.HTML.
	//
	// ESCAPING IS THE CALLER'S JOB, and it is not optional. template.HTML
	// bypasses Go's contextual escaping, and the natural content here includes
	// WORKSPACE-CONTROLLED data (attribute values such as a gender label), not
	// just integers. Build it with html/template so the data values are escaped
	// — never with string concatenation. TableCell.Composite deliberately went
	// the other way (typed fields, never template.HTML) for exactly this reason;
	// choose that route instead if a consumer cannot guarantee escaping.
	RowHeadHTML template.HTML

	// Column tree (3 levels). Level1 = phase, Level2 = task, Level3 = criterion.
	// The template renders a 3-row <thead>: L1 colspans across L2, L2 colspans across L3.
	Columns []CellGridLevel1

	// Rows — one per client/entity.
	Rows []CellGridRow

	// Save config. The batch <form> POSTs the whole grid to SaveURL on Save.
	SaveURL  string // batch POST target (also the {{actionForm}} FormAction)
	SaveMode string // "batch" | "per_cell" | "cell" (default: "batch")

	// AutoSave turns on the W2 edit-mode client: keyboard grid-nav + focusout
	// micro-batch auto-save (a ~150ms-coalesced single-flight POST of ONLY the
	// dirty cells to SaveURL, with a hidden save_mode=cell). The manual batch
	// Save button is retained as the a11y/retry fallback. When false the grid
	// renders and behaves exactly as before (manual whole-grid batch only), so
	// existing callers stay valid — this field is purely additive.
	//
	// Populated by the fayna outcome_matrix view (W2 server half) once the
	// matching per-cell response handler lands; every field below that the
	// client needs is likewise additive and zero-valued for legacy callers.
	AutoSave bool

	// ResultEvent is the HX-Trigger event name the AutoSave client listens for
	// (the per-cell ack event). Empty → the "omcell-result" default (see
	// ResultEventName). Rendered as data-result-event on the form; the server
	// half emits `HX-Trigger: {"<ResultEvent>": {cells:[…]}}`.
	ResultEvent string

	// Hidden form context — round-tripped to the batch-save handler so it can
	// scope the write without re-deriving it from the URL alone.
	JobTemplateID string // rendered as hidden input job_template_id
	Scope         string // rendered as hidden input scope ("mine" | "all")

	// SaveDisabled gates the Save button (Layer-1 permission gate: absent
	// task_outcome:create → the whole grid is view-only).
	SaveDisabled bool

	// Labels
	Labels CellGridLabels

	// CacheVersion is the asset cache-buster (?v=) for the self-included
	// grid-scripts partial. The dot-context is narrowed to this struct inside
	// cell-grid-card, so the outer PageData.CacheVersion is not reachable — the
	// view handler copies it in (viewCtx.CacheVersion).
	CacheVersion string

	// Nonce is the per-request CSP nonce for the inline <script> the grid card
	// emits. Populated by the render pipeline's reflection injector via the
	// "Grid" branch (parallel to TableConfig's "Table" branch) — see
	// render/pipeline.go InjectPageData.
	Nonce string

	// WorkspaceID is required by {{actionForm}} (action_workspace_guard) on the
	// batch-save POST. Because the dot-context is narrowed to this struct inside
	// cell-grid-card, the outer PageData.WorkspaceID is not reachable — the view
	// handler must copy it in explicitly.
	WorkspaceID string
}

// ResultEventName returns the HX-Trigger event name the AutoSave client binds
// to for per-cell acks, defaulting to "omcell-result" when ResultEvent is
// unset (html/template cannot default a field inline). The JS reads this from
// the form's data-result-event attribute; keep the two in sync.
func (c CellGridConfig) ResultEventName() string {
	if c.ResultEvent == "" {
		return "omcell-result"
	}
	return c.ResultEvent
}

// LeafColumnCount returns the number of Level3 leaf columns across the whole
// column tree. The group-band row's cell spans this many columns plus the
// frozen row-head column.
func (c CellGridConfig) LeafColumnCount() int {
	n := 0
	for _, l1 := range c.Columns {
		for _, l2 := range l1.Level2 {
			n += len(l2.Level3)
		}
	}
	return n
}

// BandColSpan is the colspan for a group-band row: every leaf column plus the
// frozen row-head column. Exposed as a method because html/template cannot do
// arithmetic without a registered func.
func (c CellGridConfig) BandColSpan() int {
	return c.LeafColumnCount() + 1
}

// CellGridLevel1 is the top header level (e.g. a semester / job_template_phase).
// CellGridSlot is the dot handed to CellGridConfig.L1ActionsTemplate. It pairs
// the column's opaque Actions payload with the grid config, because a slot
// rendering a signed form needs Grid.WorkspaceID for {{actionForm}} — and that
// field is populated at RENDER time by the pipeline's reflection pass, which
// deliberately does not descend into slices or named sub-structs (see
// render/pipeline.go injectTableConfigContext). A consumer therefore cannot
// stamp the workspace id onto its own payload when it builds the grid; it has
// to read it off the config during render. Build with the `gridSlot` func.
type CellGridSlot struct {
	Grid    any // the *CellGridConfig — Nonce / WorkspaceID live here
	Actions any // the column's consumer-defined payload
}

type CellGridLevel1 struct {
	Key    string // maps to job_template_phase_id
	Label  string
	Level2 []CellGridLevel2

	// LabelHTML is a caller-supplied fragment replacing Label in the L1 header
	// cell. EMPTY → the cell renders Label, unchanged. Lets a consumer put a
	// title plus a state badge in the header without this component learning
	// what that state means. Same escaping contract as
	// CellGridConfig.RowHeadHTML — read it before using this.
	LabelHTML template.HTML

	// Actions is an OPAQUE payload handed to CellGridConfig.L1ActionsTemplate
	// as its dot when that template renders at the far end of this header cell.
	// nil → no slot renders for this column. pyeza never inspects it; only the
	// consumer's own template knows its shape.
	Actions any
}

// CellGridLevel2 is the mid header level (e.g. an assessment / job_template_task).
type CellGridLevel2 struct {
	Key    string // maps to job_template_task_id
	Label  string
	Level3 []CellGridLevel3
}

// CellGridLevel3 is the leaf column (criterion). Each leaf maps to one cell per row.
type CellGridLevel3 struct {
	// ColumnKey is the cell address key: "{job_template_task_id}:{outcome_criteria_id}".
	// Used as map key in CellGridRow.Cells and as HTML name suffix.
	ColumnKey string
	Label     string
	CellInput CellInputDescriptor // enforced by outcome_criteria
	FrozenCol bool                // this specific column is also frozen (rare)
}

// CellInputDescriptor describes how a single cell renders and validates its input.
// Driven directly by outcome_criteria fields.
type CellInputDescriptor struct {
	// Type maps to outcome_criteria.criteria_type.
	// Allowed values: "numeric", "pass_fail", "categorical", "text", "multi_check"
	Type string

	// Numeric enforcement (Type = "numeric")
	Min      *float64 // outcome_criteria.min_score
	Max      *float64 // outcome_criteria.max_score
	Step     *float64 // outcome_criteria.score_increment (nil → any)
	Decimals int      // outcome_criteria.decimal_places
	Unit     string   // outcome_criteria.unit (suffix label)

	// Pass/fail labels (Type = "pass_fail")
	PassLabel string // outcome_criteria.pass_label
	FailLabel string // outcome_criteria.fail_label

	// Categorical / multi_check options (Type = "categorical" | "multi_check").
	// Uses the canonical types.SelectOption verbatim — never a redefinition —
	// so component templates that dereference .Description / .Disabled don't
	// hard-fail at Execute() time (see SelectOption doc in table.go).
	Options []SelectOption // derived from outcome_criteria.allowed_determinations

	// Text enforcement (Type = "text")
	MaxLength *int   // outcome_criteria.max_text_length
	Prompt    string // outcome_criteria.text_prompt (rendered as placeholder)
}

// MinAttr / MaxAttr / StepAttr / MaxLengthAttr return the HTML-attribute-ready
// string form of the pointer-typed enforcement fields, or "" when the pointer is
// nil (so the template can conditionally emit the attribute).
//
// These exist because html/template (via fmt) prints a *float64 / *int as its
// hex address, not the pointed-to value — so the templates must NOT interpolate
// the pointer fields directly. Calling these methods keeps the type shape exactly
// per view-scope §2 (pointers preserved) while giving the template a printable,
// nil-safe, zero-valid ("0" is a valid, truthy attribute) string.
func (d CellInputDescriptor) MinAttr() string  { return floatAttr(d.Min) }
func (d CellInputDescriptor) MaxAttr() string  { return floatAttr(d.Max) }
func (d CellInputDescriptor) StepAttr() string { return floatAttr(d.Step) }

// MaxLengthAttr returns the maxlength attribute value, or "" when unset.
func (d CellInputDescriptor) MaxLengthAttr() string {
	if d.MaxLength == nil {
		return ""
	}
	return strconv.Itoa(*d.MaxLength)
}

// floatAttr formats a *float64 as a trimmed decimal string ("" when nil).
func floatAttr(p *float64) string {
	if p == nil {
		return ""
	}
	return strconv.FormatFloat(*p, 'f', -1, 64)
}

// CellGridRow is one row (one client/entity) in the grid.
type CellGridRow struct {
	ID        string                  // entity ID (client_id)
	Label     string                  // display name; falls back to short(ID) when empty
	Cells     map[string]CellGridCell // ColumnKey → cell
	DataAttrs map[string]string
	// TestID for the row wrapper (convention: "om-row-{short_client_id}").
	TestID string
	// Description is an optional secondary line rendered under Label in the
	// frozen row-head (e.g. an entity attribute value the view surfaces).
	Description string
	// GroupLabel, when non-empty, emits a full-width band row ABOVE this row
	// (this row starts a new group). Row ordering is the view's concern — the
	// component only renders a band where the view marked one.
	GroupLabel string
}

// CellGridCell is one cell in the grid (one client × one criterion).
type CellGridCell struct {
	// Addressing — needed by the batch-save handler
	OutcomeID  string // task_outcome.id; "" when no record exists yet
	JobTaskID  string // job_task.id — needed to create a new task_outcome
	CriteriaID string // outcome_criteria.id

	// Current value — always as string, the template coerces to the descriptor type
	Value string

	// TextValue holds an optional descriptor recorded ALONGSIDE the primary
	// Value — e.g. task_outcome.text_value coexisting with
	// task_outcome.numeric_value (an IB-MYP grade descriptor stored next to
	// a numeric score). Populated by the view ONLY when a numeric value took
	// priority for Value and a text descriptor was also recorded — a
	// genuinely text-typed criterion never sets this (there TextValue IS
	// already Value; no duplication). Rendered by the component as a small
	// secondary line under Value, non-editable display only (S7:
	// docs/plan/20260710-staff-class-list/s7pre-data-parity.md gap 5 —
	// "text ratings/text_value invisible: no UI slot for descriptors").
	TextValue string

	// Editable is false when the underlying job_task does not exist yet (job not
	// spawned) — the cell renders as "—" and is not editable. Distinct from
	// ReadOnly (which is a permission/ownership gate on an editable cell).
	Editable bool

	// Read-only gate: true when the cell was recorded by a different staff member.
	// Renders as a disabled input with CSS class .cell-grid-cell--ro.
	ReadOnly        bool
	ReadOnlyTooltip string // e.g. "Recorded by another grader — read only"

	// TestID for Playwright E2E selectors.
	// Convention: "om-cell-{short_client_id}-{column_key_slug}"
	// (read-only cells use "om-cell-ro-{short_client_id}-{column_key_slug}").
	TestID string

	// --- W2 edit-mode addressing (AutoSave only; additive, zero-valued for
	// legacy callers so the manual-batch grid is unaffected) ---------------

	// RowIndex / ColIndex are the cell's zero-based logical coordinates used by
	// the keyboard grid-nav (Enter/Arrow same-column, Left/Right cell-nav).
	// RowIndex counts data rows only (group-band rows do not advance it);
	// ColIndex counts Level3 leaf columns left-to-right. Both are plain ints —
	// no *Attr() accessor is needed (html/template prints ints directly; the
	// pointer-print gotcha only bites *float64/*int on CellInputDescriptor).
	RowIndex int
	ColIndex int

	// SavedValue is the last server-acknowledged baseline for this cell,
	// rendered as data-saved-value. The client compares the live input value
	// against it on focusout (dirty-check) and reverts to it on Escape; on a
	// successful save the client updates the DOM baseline to the server's
	// canonical returned value. For a fresh (unsaved) cell this is "".
	SavedValue string

	// InputID is a stable, unique id for the cell's <input>/<select> (rendered
	// as the id attribute), used as aria-describedby's antecedent and as the
	// focus target for keyboard nav. StatusID is the id of the per-cell
	// visually-hidden aria-live status region the input points at via
	// aria-describedby (announces queued/saving/saved/error to screen readers).
	InputID  string
	StatusID string

	// --- Per-cell narrative affordance (additive, zero-valued for legacy
	// callers) ------------------------------------------------------------
	//
	// A recorded cell (an outcome exists) may carry a free-text narrative the
	// operator views/edits behind a message-glyph icon → drawer. The component
	// stays VERTICAL-NEUTRAL: it renders a pre-composed aria-label / sheet-title
	// string handed down by the view; it never sees "student"/"criterion".

	// NarrativeURL is the GET target for the drawer (already carrying its
	// ?outcome_id=… query). EMPTY suppresses the icon entirely — the view leaves
	// it unset for a cell with no recorded outcome (nothing to annotate). The
	// component gates the whole affordance on {{if .NarrativeURL}}.
	NarrativeURL string

	// HasNarrative drives the icon's two visual states: filled glyph (a narrative
	// is recorded) vs outline glyph (none yet). Presentational only — the state is
	// ALSO carried in NarrativeAria for assistive tech (the glyph fill is invisible
	// to a screen reader).
	HasNarrative bool

	// NarrativeAria is the fully-composed accessible name for the icon button
	// (names the entity, the column, and the has/empty/read-only state). Composed
	// in the view from its labels + resolved names so the generic component never
	// embeds vertical vocabulary.
	NarrativeAria string

	// NarrativeTitle is the pre-composed drawer/sheet heading (e.g. entity +
	// column) surfaced via data-lf-sheet-title on the trigger — the sheet shell
	// copies it into the dialog's labelled title on open.
	NarrativeTitle string

	// NarrativeBtnID is the stable id of the icon <button>, so a save round-trip
	// can refresh just this button out-of-band (hx-swap-oob) without a full-grid
	// reload.
	NarrativeBtnID string

	// NarrativeTestID is the Playwright selector for the icon button (convention:
	// "om-note-{short_entity_id}-{column_key_slug}"). The button also exposes the
	// state as data-has-narrative for state-aware assertions.
	NarrativeTestID string
}

// CellGridLabels holds user-visible strings for the grid. The json tags match
// the snake_case "grid" object keys in the lyngua translation files — without
// them the per-tier overrides silently fail to unmarshal and every consumer
// falls back to the compiled-in defaults.
type CellGridLabels struct {
	SaveButton     string `json:"save_button"`      // "Save grades"
	SavingButton   string `json:"saving_button"`    // "Saving…"
	SavedBanner    string `json:"saved_banner"`     // "Grades saved."
	ErrorBanner    string `json:"error_banner"`     // "Save failed — please try again."
	ReadOnlyMarker string `json:"read_only_marker"` // "(read only)"
	EmptyGrid      string `json:"empty_grid"`       // "No rows to display."
	ClientColumn   string `json:"client_column"`    // "Student" / "Client" (frozen header)

	// Row-count summary for a consumer building a RowHeadHTML stack. Separate
	// from ClientColumn on purpose: ClientColumn is ALSO the CSV header, so
	// overloading it would change every exported file's first column.
	// {count} is substituted by the consumer.
	ClientTotal string `json:"client_total"` // "{count} records" / "{count} students"
	// Names the ABSENCE of a grouping value ("not assigned"). The present
	// values are DATA (an attribute value's own label) and must never get label
	// keys — a workspace can rename or add one at any time, and the label layer
	// would have no key for it.
	BreakdownUnassigned string `json:"breakdown_unassigned"` // "not assigned"

	// --- W2 edit-mode (AutoSave) per-cell + notice strings. All JSON-tagged
	// so the lyngua per-tier overrides unmarshal into the "grid" object; empty
	// values fall back to the compiled-in defaults resolved by the JS
	// (data-cg-msg-* attributes on the form). Generic record/value vocabulary
	// only — vertical wording (Student/Grade) enters via lyngua, never here. ---

	CellSaving  string `json:"cell_saving"`  // "Saving…" (per-cell, screen-reader)
	CellSaved   string `json:"cell_saved"`   // "Saved."
	CellError   string `json:"cell_error"`   // "Not saved — will retry on next edit."
	RatingStale string `json:"rating_stale"` // "Saved — rating not yet recomputed."
	UnsavedWarn string `json:"unsaved_warn"` // beforeunload guard message
	RetryButton string `json:"retry_button"` // "Save now / Retry unsaved" (AutoSave mode)
}
