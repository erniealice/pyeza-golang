package types

import "strconv"

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

	// Column tree (3 levels). Level1 = phase, Level2 = task, Level3 = criterion.
	// The template renders a 3-row <thead>: L1 colspans across L2, L2 colspans across L3.
	Columns []CellGridLevel1

	// Rows — one per client/entity.
	Rows []CellGridRow

	// Save config. The batch <form> POSTs the whole grid to SaveURL on Save.
	SaveURL  string // batch POST target (also the {{actionForm}} FormAction)
	SaveMode string // "batch" | "per_cell" (default: "batch")

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

// CellGridLevel1 is the top header level (e.g. a semester / job_template_phase).
type CellGridLevel1 struct {
	Key    string // maps to job_template_phase_id
	Label  string
	Level2 []CellGridLevel2
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
}

// CellGridCell is one cell in the grid (one client × one criterion).
type CellGridCell struct {
	// Addressing — needed by the batch-save handler
	OutcomeID  string // task_outcome.id; "" when no record exists yet
	JobTaskID  string // job_task.id — needed to create a new task_outcome
	CriteriaID string // outcome_criteria.id

	// Current value — always as string, the template coerces to the descriptor type
	Value string

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
}

// CellGridLabels holds user-visible strings for the grid.
type CellGridLabels struct {
	SaveButton     string // "Save grades"
	SavingButton   string // "Saving…"
	SavedBanner    string // "Grades saved."
	ErrorBanner    string // "Save failed — please try again."
	ReadOnlyMarker string // "(read only)"
	EmptyGrid      string // "No rows to display."
	ClientColumn   string // "Student" / "Client" (frozen header)
}
