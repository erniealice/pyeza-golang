package types

import (
	"testing"
)

func TestBuildChipCellFromChips_Empty(t *testing.T) {
	t.Parallel()

	cell := BuildChipCellFromChips(nil, 3)
	if cell.Type != "chips" {
		t.Errorf("Type = %q, want %q", cell.Type, "chips")
	}
	if len(cell.Chips) != 0 {
		t.Errorf("Chips length = %d, want 0", len(cell.Chips))
	}
}

func TestBuildChipCellFromChips_UnderMax(t *testing.T) {
	t.Parallel()

	chips := []ChipData{
		{Label: "Alpha", Color: "#FF0000"},
		{Label: "Beta", Color: "#00FF00"},
	}
	cell := BuildChipCellFromChips(chips, 5)

	if cell.Type != "chips" {
		t.Errorf("Type = %q, want %q", cell.Type, "chips")
	}
	if len(cell.Chips) != 2 {
		t.Fatalf("Chips length = %d, want 2", len(cell.Chips))
	}
	if cell.ChipOverflow != 0 {
		t.Errorf("ChipOverflow = %d, want 0", cell.ChipOverflow)
	}
	if cell.ChipTooltip != "Alpha, Beta" {
		t.Errorf("ChipTooltip = %q, want %q", cell.ChipTooltip, "Alpha, Beta")
	}
}

func TestBuildChipCellFromChips_OverMax(t *testing.T) {
	t.Parallel()

	chips := []ChipData{
		{Label: "A"},
		{Label: "B"},
		{Label: "C"},
		{Label: "D"},
		{Label: "E"},
	}
	cell := BuildChipCellFromChips(chips, 2)

	if len(cell.Chips) != 2 {
		t.Fatalf("Chips length = %d, want 2", len(cell.Chips))
	}
	if cell.ChipOverflow != 3 {
		t.Errorf("ChipOverflow = %d, want 3", cell.ChipOverflow)
	}
	if cell.ChipTooltip != "A, B, C, D, E" {
		t.Errorf("ChipTooltip = %q, want %q", cell.ChipTooltip, "A, B, C, D, E")
	}
}

func TestBuildChipCellFromLabels_Empty(t *testing.T) {
	t.Parallel()

	cell := BuildChipCellFromLabels(nil, 3)
	if cell.Type != "chips" {
		t.Errorf("Type = %q, want %q", cell.Type, "chips")
	}
	if len(cell.Chips) != 0 {
		t.Errorf("Chips length = %d, want 0", len(cell.Chips))
	}
}

func TestBuildChipCellFromLabels_UnderMax(t *testing.T) {
	t.Parallel()

	labels := []string{"Red", "Blue"}
	cell := BuildChipCellFromLabels(labels, 5)

	if len(cell.Chips) != 2 {
		t.Fatalf("Chips length = %d, want 2", len(cell.Chips))
	}
	if cell.Chips[0].Label != "Red" {
		t.Errorf("Chips[0].Label = %q, want %q", cell.Chips[0].Label, "Red")
	}
	if cell.ChipOverflow != 0 {
		t.Errorf("ChipOverflow = %d, want 0", cell.ChipOverflow)
	}
	if cell.ChipTooltip != "Red, Blue" {
		t.Errorf("ChipTooltip = %q, want %q", cell.ChipTooltip, "Red, Blue")
	}
}

func TestBuildChipCellFromLabels_OverMax(t *testing.T) {
	t.Parallel()

	labels := []string{"A", "B", "C", "D"}
	cell := BuildChipCellFromLabels(labels, 2)

	if len(cell.Chips) != 2 {
		t.Fatalf("Chips length = %d, want 2", len(cell.Chips))
	}
	if cell.ChipOverflow != 2 {
		t.Errorf("ChipOverflow = %d, want 2", cell.ChipOverflow)
	}
	if cell.ChipTooltip != "A, B, C, D" {
		t.Errorf("ChipTooltip = %q, want %q", cell.ChipTooltip, "A, B, C, D")
	}
}

func TestBuildChipCell_Empty(t *testing.T) {
	t.Parallel()

	cell := BuildChipCell("", nil, 3)
	if cell.Type != "chips" {
		t.Errorf("Type = %q, want %q", cell.Type, "chips")
	}
	if len(cell.Chips) != 0 {
		t.Errorf("Chips length = %d, want 0", len(cell.Chips))
	}
}

func TestBuildChipCell_WithNameMap(t *testing.T) {
	t.Parallel()

	nameMap := map[int64]string{
		1: "Engineering",
		2: "Marketing",
		3: "Sales",
		4: "Finance",
	}

	tests := []struct {
		name         string
		ids          string
		maxVisible   int
		wantCount    int
		wantOverflow int
		wantTooltip  string
	}{
		{
			name:         "all visible",
			ids:          "1,2",
			maxVisible:   5,
			wantCount:    2,
			wantOverflow: 0,
			wantTooltip:  "Engineering, Marketing",
		},
		{
			name:         "overflow",
			ids:          "1,2,3,4",
			maxVisible:   2,
			wantCount:    2,
			wantOverflow: 2,
			wantTooltip:  "Engineering, Marketing, Sales, Finance",
		},
		{
			name:         "with spaces",
			ids:          "1, 2, 3",
			maxVisible:   5,
			wantCount:    3,
			wantOverflow: 0,
			wantTooltip:  "Engineering, Marketing, Sales",
		},
		{
			name:         "unknown ID ignored",
			ids:          "1,99,2",
			maxVisible:   5,
			wantCount:    2,
			wantOverflow: 0,
			wantTooltip:  "Engineering, Marketing",
		},
		{
			name:         "all unknown IDs",
			ids:          "99,100",
			maxVisible:   5,
			wantCount:    0,
			wantOverflow: 0,
		},
	}

	for _, tc := range tests {
		tc := tc
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			cell := BuildChipCell(tc.ids, nameMap, tc.maxVisible)

			if cell.Type != "chips" {
				t.Errorf("Type = %q, want %q", cell.Type, "chips")
			}
			if len(cell.Chips) != tc.wantCount {
				t.Errorf("Chips length = %d, want %d", len(cell.Chips), tc.wantCount)
			}
			if cell.ChipOverflow != tc.wantOverflow {
				t.Errorf("ChipOverflow = %d, want %d", cell.ChipOverflow, tc.wantOverflow)
			}
			if tc.wantTooltip != "" && cell.ChipTooltip != tc.wantTooltip {
				t.Errorf("ChipTooltip = %q, want %q", cell.ChipTooltip, tc.wantTooltip)
			}
		})
	}
}

func TestBuildChipCell_InvalidIDs(t *testing.T) {
	t.Parallel()

	nameMap := map[int64]string{1: "Engineering"}

	// Non-numeric IDs should be silently skipped
	cell := BuildChipCell("abc,xyz", nameMap, 5)
	if cell.Type != "chips" {
		t.Errorf("Type = %q, want %q", cell.Type, "chips")
	}
	if len(cell.Chips) != 0 {
		t.Errorf("Chips length = %d, want 0", len(cell.Chips))
	}
}

func TestBuildChipCell_CommaOnlyString(t *testing.T) {
	t.Parallel()

	nameMap := map[int64]string{1: "Engineering"}

	tests := []struct {
		name      string
		ids       string
		wantChips int
	}{
		{name: "triple commas", ids: ",,,", wantChips: 0},
		{name: "single comma", ids: ",", wantChips: 0},
		{name: "commas with spaces", ids: " , , , ", wantChips: 0},
		{name: "trailing comma", ids: "1,", wantChips: 1},
		{name: "leading comma", ids: ",1", wantChips: 1},
		{name: "commas around valid", ids: ",1,", wantChips: 1},
	}

	for _, tc := range tests {
		tc := tc
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			cell := BuildChipCell(tc.ids, nameMap, 5)
			if cell.Type != "chips" {
				t.Errorf("Type = %q, want %q", cell.Type, "chips")
			}
			if len(cell.Chips) != tc.wantChips {
				t.Errorf("Chips length = %d, want %d", len(cell.Chips), tc.wantChips)
			}
		})
	}
}

func TestBuildChipCellFromChips_NilChips(t *testing.T) {
	t.Parallel()

	cell := BuildChipCellFromChips(nil, 5)
	if cell.Type != "chips" {
		t.Errorf("Type = %q, want %q", cell.Type, "chips")
	}
	if len(cell.Chips) != 0 {
		t.Errorf("Chips length = %d, want 0", len(cell.Chips))
	}
	if cell.ChipOverflow != 0 {
		t.Errorf("ChipOverflow = %d, want 0", cell.ChipOverflow)
	}
	if cell.ChipTooltip != "" {
		t.Errorf("ChipTooltip = %q, want empty", cell.ChipTooltip)
	}
}

func TestBuildChipCellFromChips_ZeroMaxVisible(t *testing.T) {
	t.Parallel()

	chips := []ChipData{
		{Label: "A"},
		{Label: "B"},
	}
	cell := BuildChipCellFromChips(chips, 0)

	if cell.Type != "chips" {
		t.Errorf("Type = %q, want %q", cell.Type, "chips")
	}
	// maxVisible=0 means all are overflow
	if len(cell.Chips) != 0 {
		t.Errorf("Chips length = %d, want 0", len(cell.Chips))
	}
	if cell.ChipOverflow != 2 {
		t.Errorf("ChipOverflow = %d, want 2", cell.ChipOverflow)
	}
	if cell.ChipTooltip != "A, B" {
		t.Errorf("ChipTooltip = %q, want %q", cell.ChipTooltip, "A, B")
	}
}

func TestBuildChipCellFromLabels_NilLabels(t *testing.T) {
	t.Parallel()

	cell := BuildChipCellFromLabels(nil, 5)
	if cell.Type != "chips" {
		t.Errorf("Type = %q, want %q", cell.Type, "chips")
	}
	if len(cell.Chips) != 0 {
		t.Errorf("Chips length = %d, want 0", len(cell.Chips))
	}
}

func TestBuildChipCellFromLabels_EmptyStrings(t *testing.T) {
	t.Parallel()

	labels := []string{"", "", ""}
	cell := BuildChipCellFromLabels(labels, 5)

	// Empty strings are still valid labels
	if len(cell.Chips) != 3 {
		t.Fatalf("Chips length = %d, want 3", len(cell.Chips))
	}
	if cell.ChipTooltip != ", , " {
		t.Errorf("ChipTooltip = %q, want %q", cell.ChipTooltip, ", , ")
	}
}

func TestBuildChipCell_NilNameMap(t *testing.T) {
	t.Parallel()

	// nil name map: all IDs fail lookup
	cell := BuildChipCell("1,2,3", nil, 5)
	if cell.Type != "chips" {
		t.Errorf("Type = %q, want %q", cell.Type, "chips")
	}
	if len(cell.Chips) != 0 {
		t.Errorf("Chips length = %d, want 0 with nil nameMap", len(cell.Chips))
	}
}

func TestBuildChipCell_NegativeMaxVisible_Panics(t *testing.T) {
	t.Parallel()

	nameMap := map[int64]string{1: "Engineering", 2: "Marketing"}

	defer func() {
		if r := recover(); r == nil {
			t.Error("expected panic with negative maxVisible, got none")
		}
	}()

	// Negative maxVisible causes slice bounds panic
	BuildChipCell("1,2", nameMap, -1)
}

func TestBuildChipCellFromChips_NegativeMaxVisible_Panics(t *testing.T) {
	t.Parallel()

	chips := []ChipData{{Label: "A"}, {Label: "B"}}

	defer func() {
		if r := recover(); r == nil {
			t.Error("expected panic with negative maxVisible, got none")
		}
	}()

	BuildChipCellFromChips(chips, -1)
}
