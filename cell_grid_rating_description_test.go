package pyeza

import (
	"regexp"
	"strings"
	"testing"

	"github.com/erniealice/pyeza-golang/types"
)

func numericCol() types.CellGridLevel3 {
	return types.CellGridLevel3{
		ColumnKey: "task-1:criterion-1",
		CellInput: types.CellInputDescriptor{Type: "numeric"},
	}
}

// A numeric cell is just the number: no description preview region, no
// rating-mode attributes, no aria-describedby pointing at a missing region.
func TestCellGridNumericCellCarriesNoDescriptionPreview(t *testing.T) {
	out := renderNamed(t, "cell-grid-cell", map[string]any{
		"Cell": types.CellGridCell{
			OutcomeID: "outcome-1", Value: "4", Editable: true,
			InputID: "om-in-1", StatusID: "om-in-1-st", TestID: "om-cell-1-criterion",
		},
		"Col": numericCol(),
	})
	for _, banned := range []string{"data-rating", "cell-grid-rating-description", "om-in-1-rating"} {
		if strings.Contains(out, banned) {
			t.Errorf("numeric cell must stay clean, found %q:\n%s", banned, out)
		}
	}
	if !strings.Contains(out, `aria-describedby="om-in-1-st"`) {
		t.Errorf("status region link missing:\n%s", out)
	}
}

// An editable, not-yet-recorded cell renders the narrative icon DORMANT:
// hidden, no hx-get, carrying the drawer base URL and both accessible names so
// cell-grid.js can activate it from the save ack.
func TestCellGridDormantNarrativeIcon(t *testing.T) {
	out := renderNamed(t, "cell-grid-cell", map[string]any{
		"Cell": types.CellGridCell{
			JobTaskID: "jt-1", Editable: true, InputID: "om-in-3", TestID: "om-cell-3-criterion",
			NarrativeBaseURL:  "/action/grade-sheet/T1/narrative",
			NarrativeAria:     "Add narrative for A, B",
			NarrativeAriaAdd:  "Add narrative for A, B",
			NarrativeAriaEdit: "Edit narrative for A, B",
			NarrativeTitle:    "A — B",
			NarrativeBtnID:    "om-note-btn-3",
			NarrativeTestID:   "om-note-3",
		},
		"Col": numericCol(),
	})
	for _, want := range []string{
		"cell-grid-note-btn", `data-narrative-base="/action/grade-sheet/T1/narrative"`,
		`data-aria-add="Add narrative for A, B"`, `data-aria-edit="Edit narrative for A, B"`,
		`data-testid="om-note-3"`,
	} {
		if !strings.Contains(out, want) {
			t.Errorf("dormant icon missing %q:\n%s", want, out)
		}
	}
	if !regexp.MustCompile(`\shidden\s`).MatchString(out) {
		t.Errorf("dormant icon must carry the hidden attribute:\n%s", out)
	}
	if strings.Contains(out, "hx-get=") {
		t.Errorf("dormant icon must not carry a drawer URL:\n%s", out)
	}
}

// A recorded cell keeps the live icon (hx-get with its outcome id) and no hidden flag.
func TestCellGridRecordedNarrativeIconIsLive(t *testing.T) {
	out := renderNamed(t, "cell-grid-cell", map[string]any{
		"Cell": types.CellGridCell{
			OutcomeID: "outcome-1", Value: "4", Editable: true, InputID: "om-in-4", HasNarrative: true,
			NarrativeURL:     "/action/grade-sheet/T1/narrative?outcome_id=outcome-1",
			NarrativeBaseURL: "/action/grade-sheet/T1/narrative",
			NarrativeAria:    "Edit narrative for A, B", NarrativeBtnID: "om-note-btn-4", NarrativeTestID: "om-note-4",
		},
		"Col": numericCol(),
	})
	if !strings.Contains(out, `hx-get="/action/grade-sheet/T1/narrative?outcome_id=outcome-1"`) {
		t.Errorf("recorded icon must be live:\n%s", out)
	}
	if regexp.MustCompile(`\shidden\s`).MatchString(out) {
		t.Errorf("recorded icon must not carry the hidden attribute:\n%s", out)
	}
}
