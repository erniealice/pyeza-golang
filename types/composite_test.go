package types

import (
	"strings"
	"testing"
)

func TestBuildCompositeCell_EncodesHref(t *testing.T) {
	// A category id with query-hostile characters must be URL-query-encoded
	// (url.Values.Encode), never string-concatenated.
	cell := BuildCompositeCell(CompositeCellParams{
		Count:      5,
		BasePath:   "/report-cards/section/sec-1",
		QueryKey:   "jc",
		SectionID:  "sec-1",
		CategoryID: "a b/c&d",
	})
	if cell.Composite == nil {
		t.Fatal("Composite payload must be non-nil")
	}
	want := "/report-cards/section/sec-1?jc=a+b%2Fc%26d"
	if cell.Composite.EyeHref != want {
		t.Errorf("EyeHref = %q, want %q", cell.Composite.EyeHref, want)
	}
}

func TestBuildCompositeCell_PreservesExistingQuery(t *testing.T) {
	// A pre-existing query param on the base path survives; jc is added, not
	// clobbered.
	cell := BuildCompositeCell(CompositeCellParams{
		Count:      2,
		BasePath:   "/report-cards/section/sec-1?ps=2024",
		QueryKey:   "jc",
		SectionID:  "sec-1",
		CategoryID: "cat-1",
	})
	href := cell.Composite.EyeHref
	if !strings.Contains(href, "ps=2024") || !strings.Contains(href, "jc=cat-1") {
		t.Errorf("EyeHref must keep ps and add jc; got %q", href)
	}
}

func TestBuildCompositeCell_DefaultQueryKey(t *testing.T) {
	cell := BuildCompositeCell(CompositeCellParams{
		Count:      1,
		BasePath:   "/x",
		SectionID:  "s",
		CategoryID: "c",
		// QueryKey omitted → defaults to "jc".
	})
	if got := cell.Composite.EyeHref; got != "/x?jc=c" {
		t.Errorf("default query key must be jc; got %q", got)
	}
}

func TestBuildCompositeCell_CollisionProofTestID(t *testing.T) {
	// The test ID uses the FULL section + category ids (not a truncated short()).
	cell := BuildCompositeCell(CompositeCellParams{
		Count:      1,
		BasePath:   "/x",
		SectionID:  "sec-abcdef12",
		CategoryID: "cat-99887766",
	})
	if got := cell.Composite.EyeTestID; got != "rc-eye-sec-abcdef12-cat-99887766" {
		t.Errorf("EyeTestID = %q, want rc-eye-sec-abcdef12-cat-99887766", got)
	}
}

func TestBuildCompositeCell_AccessibleNameNamesBoth(t *testing.T) {
	cell := BuildCompositeCell(CompositeCellParams{
		Count:        1,
		BasePath:     "/x",
		SectionID:    "s",
		CategoryID:   "c",
		SectionName:  "Grade 5 Diamond",
		CategoryName: "Core",
	})
	name := cell.Composite.EyeName
	if !strings.Contains(name, "Core") || !strings.Contains(name, "Grade 5 Diamond") {
		t.Errorf("default accessible name must contain both category and section; got %q", name)
	}
}

func TestBuildCompositeCell_ExplicitAccessibleNameVerbatim(t *testing.T) {
	cell := BuildCompositeCell(CompositeCellParams{
		Count:          1,
		BasePath:       "/x",
		SectionID:      "s",
		CategoryID:     "c",
		AccessibleName: "View Core report cards for Grade 5 Diamond",
	})
	if cell.Composite.EyeName != "View Core report cards for Grade 5 Diamond" {
		t.Errorf("explicit AccessibleName must be used verbatim; got %q", cell.Composite.EyeName)
	}
}

func TestBuildCompositeCell_Fallback_NoCategory(t *testing.T) {
	// Empty category id → no eye (the unknown/foreign/inactive/NULL fallback).
	cell := BuildCompositeCell(CompositeCellParams{
		Count:      4,
		BasePath:   "/report-cards/section/sec-1",
		SectionID:  "sec-1",
		CategoryID: "",
	})
	if cell.Type != "composite" {
		t.Errorf("Type = %q, want composite", cell.Type)
	}
	if cell.Value != "4" {
		t.Errorf("Value (CSV/sort scalar) = %q, want 4", cell.Value)
	}
	if cell.Composite == nil {
		t.Fatal("Composite payload must still exist to carry the count")
	}
	if cell.Composite.EyeHref != "" || cell.Composite.EyeTestID != "" || cell.Composite.EyeName != "" {
		t.Errorf("fallback must leave the eye fields empty; got %+v", cell.Composite)
	}
	if cell.Composite.Count != 4 {
		t.Errorf("fallback Count = %d, want 4", cell.Composite.Count)
	}
}

func TestBuildCompositeCell_Fallback_NoBasePath(t *testing.T) {
	cell := BuildCompositeCell(CompositeCellParams{
		Count:      0,
		BasePath:   "",
		SectionID:  "sec-1",
		CategoryID: "cat-1",
	})
	if cell.Composite.EyeHref != "" {
		t.Errorf("no base path → no eye href; got %q", cell.Composite.EyeHref)
	}
}

func TestCompositeCell_CSV(t *testing.T) {
	cell := BuildCompositeCell(CompositeCellParams{
		Count: 12, BasePath: "/x", SectionID: "s", CategoryID: "c",
	})
	if got := CellCSV(cell); got != "12" {
		t.Errorf("CellCSV(composite) = %q, want 12 (the count scalar, never blank)", got)
	}
}

func TestCompositeCell_CSV_ExplicitOverride(t *testing.T) {
	cell := BuildCompositeCell(CompositeCellParams{Count: 12, BasePath: "/x", SectionID: "s", CategoryID: "c"})
	cell.CSVValue = "4 published; 8 pending"
	if got := CellCSV(cell); got != "4 published; 8 pending" {
		t.Errorf("CSVValue override must win; got %q", got)
	}
}

func TestComposite_DeriveSortKind(t *testing.T) {
	if got := DeriveSortKind("composite"); got != "number" {
		t.Errorf("composite sorts by its count scalar; DeriveSortKind = %q, want number", got)
	}
}

func TestComposite_DeriveFilterType(t *testing.T) {
	if got := DeriveFilterType("composite", false); got != FilterTypeNumericRange {
		t.Errorf("composite filters on its count scalar; DeriveFilterType = %v, want %v", got, FilterTypeNumericRange)
	}
}
