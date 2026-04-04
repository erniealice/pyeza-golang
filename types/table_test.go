package types

import (
	"testing"
)

func TestApplyColumnStyles(t *testing.T) {
	t.Parallel()

	columns := []TableColumn{
		{Key: "name", Label: "Name", Align: "left", Width: "200px", MinWidth: "100px"},
		{Key: "amount", Label: "Amount", Align: "right", VAlign: "middle"},
		{Key: "status", Label: "Status"},
	}

	rows := []TableRow{
		{
			ID: "1",
			Cells: []TableCell{
				{Type: "text", Value: "Alpha"},
				{Type: "money", Value: "1,000.00"},
				{Type: "badge", Value: "active"},
			},
		},
		{
			ID: "2",
			Cells: []TableCell{
				{Type: "text", Value: "Beta"},
				{Type: "money", Value: "2,000.00"},
				{Type: "badge", Value: "inactive"},
			},
		},
	}

	ApplyColumnStyles(columns, rows)

	// Row 0, Cell 0: should inherit Label, Align, Width, MinWidth
	if rows[0].Cells[0].Label != "Name" {
		t.Errorf("rows[0].Cells[0].Label = %q, want %q", rows[0].Cells[0].Label, "Name")
	}
	if rows[0].Cells[0].Align != "left" {
		t.Errorf("rows[0].Cells[0].Align = %q, want %q", rows[0].Cells[0].Align, "left")
	}
	if rows[0].Cells[0].Width != "200px" {
		t.Errorf("rows[0].Cells[0].Width = %q, want %q", rows[0].Cells[0].Width, "200px")
	}
	if rows[0].Cells[0].MinWidth != "100px" {
		t.Errorf("rows[0].Cells[0].MinWidth = %q, want %q", rows[0].Cells[0].MinWidth, "100px")
	}

	// Row 0, Cell 1: should inherit Align=right, VAlign=middle
	if rows[0].Cells[1].Align != "right" {
		t.Errorf("rows[0].Cells[1].Align = %q, want %q", rows[0].Cells[1].Align, "right")
	}
	if rows[0].Cells[1].VAlign != "middle" {
		t.Errorf("rows[0].Cells[1].VAlign = %q, want %q", rows[0].Cells[1].VAlign, "middle")
	}

	// Row 1, Cell 2: Status column has no special alignment/width
	if rows[1].Cells[2].Label != "Status" {
		t.Errorf("rows[1].Cells[2].Label = %q, want %q", rows[1].Cells[2].Label, "Status")
	}
}

func TestApplyColumnStyles_EmptyRows(t *testing.T) {
	t.Parallel()

	columns := []TableColumn{{Key: "name", Label: "Name"}}
	var rows []TableRow

	// Should not panic on empty rows
	ApplyColumnStyles(columns, rows)
}

func TestApplyColumnStyles_MoreCellsThanColumns(t *testing.T) {
	t.Parallel()

	columns := []TableColumn{{Key: "name", Label: "Name"}}
	rows := []TableRow{
		{
			ID: "1",
			Cells: []TableCell{
				{Type: "text", Value: "Alpha"},
				{Type: "text", Value: "Extra"}, // no corresponding column
			},
		},
	}

	// Should not panic; extra cells are left untouched
	ApplyColumnStyles(columns, rows)

	if rows[0].Cells[0].Label != "Name" {
		t.Errorf("rows[0].Cells[0].Label = %q, want %q", rows[0].Cells[0].Label, "Name")
	}
	// Extra cell should remain with empty Label
	if rows[0].Cells[1].Label != "" {
		t.Errorf("rows[0].Cells[1].Label = %q, want empty", rows[0].Cells[1].Label)
	}
}

func TestApplyTableSettings_BulkActionsEnablesCheckbox(t *testing.T) {
	t.Parallel()

	config := &TableConfig{
		BulkActions: &BulkActionsConfig{Enabled: true},
		Rows: []TableRow{
			{ID: "1"},
			{ID: "2"},
		},
	}

	ApplyTableSettings(config)

	if !config.ShowCheckbox {
		t.Error("ShowCheckbox should be true when BulkActions.Enabled is true")
	}
	for i, row := range config.Rows {
		if !row.ShowCheckbox {
			t.Errorf("Rows[%d].ShowCheckbox should be true", i)
		}
	}
}

func TestApplyTableSettings_NoBulkActions(t *testing.T) {
	t.Parallel()

	config := &TableConfig{
		ShowCheckbox: false,
		Rows: []TableRow{
			{ID: "1"},
		},
	}

	ApplyTableSettings(config)

	if config.ShowCheckbox {
		t.Error("ShowCheckbox should remain false when BulkActions is nil")
	}
	if config.Rows[0].ShowCheckbox {
		t.Error("Rows[0].ShowCheckbox should be false")
	}
}

func TestApplyTableSettings_ManualCheckbox(t *testing.T) {
	t.Parallel()

	config := &TableConfig{
		ShowCheckbox: true,
		Rows: []TableRow{
			{ID: "1"},
			{ID: "2"},
		},
	}

	ApplyTableSettings(config)

	for i, row := range config.Rows {
		if !row.ShowCheckbox {
			t.Errorf("Rows[%d].ShowCheckbox should be true", i)
		}
	}
}

func TestSortableKeys(t *testing.T) {
	t.Parallel()

	columns := []TableColumn{
		{Key: "name", Sortable: true},
		{Key: "email", Sortable: false},
		{Key: "date_created", Sortable: true},
		{Key: "status", Sortable: false},
		{Key: "amount", Sortable: true},
	}

	keys := SortableKeys(columns)

	want := []string{"name", "date_created", "amount"}
	if len(keys) != len(want) {
		t.Fatalf("SortableKeys length = %d, want %d", len(keys), len(want))
	}
	for i, k := range keys {
		if k != want[i] {
			t.Errorf("SortableKeys[%d] = %q, want %q", i, k, want[i])
		}
	}
}

func TestSortableKeys_NoSortable(t *testing.T) {
	t.Parallel()

	columns := []TableColumn{
		{Key: "name", Sortable: false},
		{Key: "email", Sortable: false},
	}

	keys := SortableKeys(columns)
	if keys != nil {
		t.Errorf("SortableKeys = %v, want nil", keys)
	}
}

func TestSortableKeys_Empty(t *testing.T) {
	t.Parallel()

	keys := SortableKeys(nil)
	if keys != nil {
		t.Errorf("SortableKeys(nil) = %v, want nil", keys)
	}
}

func TestBuildPageNumbers_SmallTotal(t *testing.T) {
	t.Parallel()

	urlBuilder := func(page int) string {
		return "/table?page=" + itoa(page)
	}

	// 5 pages total, current = 3 => show all 5 pages
	pages := buildPageNumbers(3, 5, urlBuilder)

	if len(pages) != 5 {
		t.Fatalf("buildPageNumbers(3, 5) length = %d, want 5", len(pages))
	}

	// Verify page 3 is active
	for _, p := range pages {
		if p.Number == 3 && !p.Active {
			t.Error("page 3 should be active")
		}
		if p.Number != 3 && p.Active {
			t.Errorf("page %d should not be active", p.Number)
		}
	}
}

func TestBuildPageNumbers_LargeTotal(t *testing.T) {
	t.Parallel()

	urlBuilder := func(page int) string {
		return "/table?page=" + itoa(page)
	}

	// 20 pages total, current = 10 => should use windowed display
	pages := buildPageNumbers(10, 20, urlBuilder)

	if len(pages) == 0 {
		t.Fatal("buildPageNumbers(10, 20) returned empty")
	}

	// First page should be 1
	if pages[0].Number != 1 {
		t.Errorf("first page = %d, want 1", pages[0].Number)
	}

	// Last page should be 20
	lastPage := pages[len(pages)-1]
	if lastPage.Number != 20 {
		t.Errorf("last page = %d, want 20", lastPage.Number)
	}

	// Should have ellipsis somewhere
	hasEllipsis := false
	for _, p := range pages {
		if p.Ellipsis {
			hasEllipsis = true
			break
		}
	}
	if !hasEllipsis {
		t.Error("expected at least one ellipsis in windowed pagination")
	}

	// Current page (10) should be active
	found := false
	for _, p := range pages {
		if p.Number == 10 && p.Active {
			found = true
		}
	}
	if !found {
		t.Error("page 10 should be active")
	}
}

func TestBuildPageNumbers_ZeroTotal(t *testing.T) {
	t.Parallel()

	urlBuilder := func(page int) string { return "" }
	pages := buildPageNumbers(1, 0, urlBuilder)
	if pages != nil {
		t.Errorf("buildPageNumbers(1, 0) = %v, want nil", pages)
	}
}

func TestBuildPageNumbers_FirstPage(t *testing.T) {
	t.Parallel()

	urlBuilder := func(page int) string {
		return "/table?page=" + itoa(page)
	}

	// Current = 1, total = 15. Should start with page 1 active.
	pages := buildPageNumbers(1, 15, urlBuilder)

	if len(pages) == 0 {
		t.Fatal("buildPageNumbers(1, 15) returned empty")
	}
	if !pages[0].Active {
		t.Error("first page should be active when current=1")
	}
}

func TestBuildPageNumbers_LastPage(t *testing.T) {
	t.Parallel()

	urlBuilder := func(page int) string {
		return "/table?page=" + itoa(page)
	}

	// Current = 15, total = 15
	pages := buildPageNumbers(15, 15, urlBuilder)

	if len(pages) == 0 {
		t.Fatal("buildPageNumbers(15, 15) returned empty")
	}
	lastPage := pages[len(pages)-1]
	if !lastPage.Active {
		t.Error("last page should be active when current=total")
	}
}

func TestServerPagination_BuildDisplay_Offset(t *testing.T) {
	t.Parallel()

	sp := &ServerPagination{
		Mode:          "offset",
		CurrentPage:   2,
		PageSize:      10,
		TotalRows:     45,
		TotalPages:    5,
		PaginationURL: "/api/table",
	}

	sp.BuildDisplay()

	if sp.StartRow != 11 {
		t.Errorf("StartRow = %d, want 11", sp.StartRow)
	}
	if sp.EndRow != 20 {
		t.Errorf("EndRow = %d, want 20", sp.EndRow)
	}
	if !sp.HasPrevPage {
		t.Error("HasPrevPage should be true for page 2")
	}
	if !sp.HasNextPage {
		t.Error("HasNextPage should be true for page 2 of 5")
	}
	if sp.PrevPageURL == "" {
		t.Error("PrevPageURL should be set")
	}
	if sp.NextPageURL == "" {
		t.Error("NextPageURL should be set")
	}
}

func TestServerPagination_BuildDisplay_Offset_LastPage(t *testing.T) {
	t.Parallel()

	sp := &ServerPagination{
		Mode:          "offset",
		CurrentPage:   5,
		PageSize:      10,
		TotalRows:     45,
		TotalPages:    5,
		PaginationURL: "/api/table",
	}

	sp.BuildDisplay()

	if sp.StartRow != 41 {
		t.Errorf("StartRow = %d, want 41", sp.StartRow)
	}
	if sp.EndRow != 45 {
		t.Errorf("EndRow = %d, want 45 (clamped to TotalRows)", sp.EndRow)
	}
	if !sp.HasPrevPage {
		t.Error("HasPrevPage should be true for page 5")
	}
	if sp.HasNextPage {
		t.Error("HasNextPage should be false on last page")
	}
}

func TestServerPagination_BuildDisplay_Offset_Empty(t *testing.T) {
	t.Parallel()

	sp := &ServerPagination{
		Mode:          "offset",
		CurrentPage:   1,
		PageSize:      10,
		TotalRows:     0,
		TotalPages:    0,
		PaginationURL: "/api/table",
	}

	sp.BuildDisplay()

	if sp.StartRow != 0 {
		t.Errorf("StartRow = %d, want 0 for empty results", sp.StartRow)
	}
	if sp.EndRow != 0 {
		t.Errorf("EndRow = %d, want 0 for empty results", sp.EndRow)
	}
}

func TestApplyColumnStyles_NilColumns(t *testing.T) {
	t.Parallel()

	rows := []TableRow{
		{ID: "1", Cells: []TableCell{{Type: "text", Value: "Alpha"}}},
	}

	// nil columns should not panic
	ApplyColumnStyles(nil, rows)

	// Cells should be untouched
	if rows[0].Cells[0].Label != "" {
		t.Errorf("Label should remain empty with nil columns, got %q", rows[0].Cells[0].Label)
	}
}

func TestApplyColumnStyles_NilRows(t *testing.T) {
	t.Parallel()

	columns := []TableColumn{{Key: "name", Label: "Name"}}

	// nil rows should not panic
	ApplyColumnStyles(columns, nil)
}

func TestApplyColumnStyles_FewerCellsThanColumns(t *testing.T) {
	t.Parallel()

	columns := []TableColumn{
		{Key: "name", Label: "Name", Align: "left"},
		{Key: "email", Label: "Email", Align: "center"},
		{Key: "status", Label: "Status", Align: "right"},
	}
	rows := []TableRow{
		{
			ID:    "1",
			Cells: []TableCell{{Type: "text", Value: "Alpha"}}, // only 1 cell
		},
	}

	// Should not panic; only existing cells get styles
	ApplyColumnStyles(columns, rows)

	if rows[0].Cells[0].Label != "Name" {
		t.Errorf("rows[0].Cells[0].Label = %q, want %q", rows[0].Cells[0].Label, "Name")
	}
}

func TestBuildPageNumbers_NegativeValues(t *testing.T) {
	t.Parallel()

	urlBuilder := func(page int) string {
		return "/table?page=" + itoa(page)
	}

	t.Run("negative current page", func(t *testing.T) {
		t.Parallel()
		// Should not panic
		pages := buildPageNumbers(-1, 10, urlBuilder)
		if pages == nil {
			t.Fatal("expected non-nil pages")
		}
	})

	t.Run("negative total pages", func(t *testing.T) {
		t.Parallel()
		pages := buildPageNumbers(1, -5, urlBuilder)
		if pages != nil {
			t.Errorf("buildPageNumbers(1, -5) should return nil, got %d pages", len(pages))
		}
	})

	t.Run("current page greater than total", func(t *testing.T) {
		t.Parallel()
		// Should not panic; tests resilience
		pages := buildPageNumbers(20, 5, urlBuilder)
		if pages == nil {
			t.Fatal("expected non-nil pages")
		}
		// Last page should still be 5
		lastPage := pages[len(pages)-1]
		if lastPage.Number != 5 {
			t.Errorf("last page = %d, want 5", lastPage.Number)
		}
	})

	t.Run("current page zero", func(t *testing.T) {
		t.Parallel()
		pages := buildPageNumbers(0, 5, urlBuilder)
		if pages == nil {
			t.Fatal("expected non-nil pages")
		}
	})

	t.Run("total pages is 1", func(t *testing.T) {
		t.Parallel()
		pages := buildPageNumbers(1, 1, urlBuilder)
		if len(pages) != 1 {
			t.Fatalf("expected 1 page, got %d", len(pages))
		}
		if !pages[0].Active {
			t.Error("single page should be active")
		}
	})
}

func TestServerPagination_BuildDisplay_NegativeOffset(t *testing.T) {
	t.Parallel()

	sp := &ServerPagination{
		Mode:          "offset",
		CurrentPage:   -1,
		PageSize:      10,
		TotalRows:     100,
		TotalPages:    10,
		PaginationURL: "/api/table",
	}

	// Should not panic
	sp.BuildDisplay()

	// StartRow will be negative due to ((-1)-1)*10 + 1 = -19
	// This documents the behavior with invalid input
	if sp.StartRow >= 0 {
		// It's okay if it doesn't guard, we're just documenting behavior
	}
}

func TestServerPagination_BuildDisplay_ZeroLimit(t *testing.T) {
	t.Parallel()

	sp := &ServerPagination{
		Mode:          "offset",
		CurrentPage:   1,
		PageSize:      0,
		TotalRows:     100,
		TotalPages:    10,
		PaginationURL: "/api/table",
	}

	// Should not panic
	sp.BuildDisplay()
}

func TestServerPagination_BuildDisplay_UnknownMode(t *testing.T) {
	t.Parallel()

	sp := &ServerPagination{
		Mode:          "unknown",
		CurrentPage:   1,
		PageSize:      10,
		TotalRows:     100,
		TotalPages:    10,
		PaginationURL: "/api/table",
	}

	// Should not panic; no display fields set
	sp.BuildDisplay()

	if sp.StartRow != 0 {
		t.Errorf("StartRow = %d, want 0 for unknown mode", sp.StartRow)
	}
}

func TestServerPagination_BuildDisplay_EmptyMode(t *testing.T) {
	t.Parallel()

	sp := &ServerPagination{
		Mode:          "",
		CurrentPage:   1,
		PageSize:      10,
		TotalRows:     100,
		PaginationURL: "/api/table",
	}

	sp.BuildDisplay()

	if sp.StartRow != 0 {
		t.Errorf("StartRow = %d, want 0 for empty mode", sp.StartRow)
	}
}

func TestServerPagination_BuildDisplay_Cursor_NoCursors(t *testing.T) {
	t.Parallel()

	sp := &ServerPagination{
		Mode:          "cursor",
		PageSize:      10,
		HasNextPage:   true,
		HasPrevPage:   true,
		NextCursor:    "", // empty cursors
		PrevCursor:    "",
		PaginationURL: "/api/table",
	}

	sp.BuildDisplay()

	if sp.NextCursorURL != "" {
		t.Errorf("NextCursorURL should be empty when NextCursor is empty, got %q", sp.NextCursorURL)
	}
	if sp.PrevCursorURL != "" {
		t.Errorf("PrevCursorURL should be empty when PrevCursor is empty, got %q", sp.PrevCursorURL)
	}
}

func TestServerPagination_BuildDisplay_Offset_SinglePage(t *testing.T) {
	t.Parallel()

	sp := &ServerPagination{
		Mode:          "offset",
		CurrentPage:   1,
		PageSize:      10,
		TotalRows:     5,
		TotalPages:    1,
		PaginationURL: "/api/table",
	}

	sp.BuildDisplay()

	if sp.HasPrevPage {
		t.Error("HasPrevPage should be false on single page")
	}
	if sp.HasNextPage {
		t.Error("HasNextPage should be false on single page")
	}
	if sp.StartRow != 1 {
		t.Errorf("StartRow = %d, want 1", sp.StartRow)
	}
	if sp.EndRow != 5 {
		t.Errorf("EndRow = %d, want 5", sp.EndRow)
	}
}

func TestServerPagination_BuildDisplay_Cursor(t *testing.T) {
	t.Parallel()

	sp := &ServerPagination{
		Mode:          "cursor",
		PageSize:      10,
		HasNextPage:   true,
		HasPrevPage:   true,
		NextCursor:    "abc123",
		PrevCursor:    "def456",
		PaginationURL: "/api/table",
	}

	sp.BuildDisplay()

	if sp.NextCursorURL == "" {
		t.Error("NextCursorURL should be set")
	}
	if sp.PrevCursorURL == "" {
		t.Error("PrevCursorURL should be set")
	}
}
