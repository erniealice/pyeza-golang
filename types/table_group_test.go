package types

import (
	"strings"
	"testing"
)

func rowWithID(id string) TableRow { return TableRow{ID: id} }

func titles(groups []TableRowGroup) []string {
	out := make([]string, len(groups))
	for i, g := range groups {
		out[i] = g.Title
	}
	return out
}

func rowIDs(g TableRowGroup) []string {
	out := make([]string, len(g.Rows))
	for i, r := range g.Rows {
		out[i] = r.ID
	}
	return out
}

// TestGroupRowsByValue_LeadingOrderLeads: listed values lead in list order
// (case-insensitive), regardless of value-alpha; unlisted values follow
// ascending; the no-value band is last.
func TestGroupRowsByValue_LeadingOrderLeads(t *testing.T) {
	rows := []TableRow{
		rowWithID("a"), // female
		rowWithID("b"), // Male
		rowWithID("c"), // (none)
		rowWithID("d"), // nonbinary (unlisted)
		rowWithID("e"), // Male
	}
	// "Male" is one raw bucket; GroupValueOrder "male" matches it case-insensitively.
	vals := map[string]string{"a": "female", "b": "Male", "d": "nonbinary", "e": "Male"}
	groups := GroupRowsByValue(rows, vals, GroupRowsByValueOptions{
		LeadingOrder: []string{"male", "female"},
		GroupID:      func(v string) string { return "sg-band-" + v },
	})

	// Male (listed 0, case-insensitive) → female (listed 1) → nonbinary
	// (unlisted, asc) → no-value.
	got := titles(groups)
	want := []string{"Male", "female", "nonbinary", "—"}
	if len(got) != len(want) {
		t.Fatalf("bands = %v, want %v", got, want)
	}
	for i := range want {
		if got[i] != want[i] {
			t.Errorf("band[%d] = %q, want %q (full=%v)", i, got[i], want[i], got)
		}
	}
}

// TestGroupRowsByValue_Buckets: rows land in the correct band and keep their
// incoming order within a band (stable partition).
func TestGroupRowsByValue_Buckets(t *testing.T) {
	rows := []TableRow{rowWithID("b"), rowWithID("e"), rowWithID("a")}
	vals := map[string]string{"a": "female", "b": "male", "e": "male"}
	groups := GroupRowsByValue(rows, vals, GroupRowsByValueOptions{
		LeadingOrder: []string{"male", "female"},
		GroupID:      func(v string) string { return "sg-band-" + v },
	})
	if len(groups) != 2 {
		t.Fatalf("want 2 bands, got %d (%v)", len(groups), titles(groups))
	}
	if got := rowIDs(groups[0]); len(got) != 2 || got[0] != "b" || got[1] != "e" {
		t.Errorf("male band rows = %v, want [b e] (incoming order preserved)", got)
	}
	if got := rowIDs(groups[1]); len(got) != 1 || got[0] != "a" {
		t.Errorf("female band rows = %v, want [a]", got)
	}
}

// TestGroupRowsByValue_IDsAndTestid: band ID and DataAttrs["testid"] both come
// from GroupID; NoValueTitle overrides the default; empty value still gets an ID.
func TestGroupRowsByValue_IDsAndTestid(t *testing.T) {
	rows := []TableRow{rowWithID("x"), rowWithID("y")}
	vals := map[string]string{"x": "male"} // y has no value
	groups := GroupRowsByValue(rows, vals, GroupRowsByValueOptions{
		LeadingOrder: []string{"male"},
		GroupID: func(v string) string {
			if v == "" {
				return "rc-band-none"
			}
			return "rc-band-" + v
		},
		NoValueTitle: "Unassigned",
	})
	if len(groups) != 2 {
		t.Fatalf("want 2 bands, got %d", len(groups))
	}
	if groups[0].ID != "rc-band-male" || groups[0].DataAttrs["testid"] != "rc-band-male" {
		t.Errorf("male band ID/testid = %q/%q, want rc-band-male both", groups[0].ID, groups[0].DataAttrs["testid"])
	}
	if groups[1].Title != "Unassigned" {
		t.Errorf("no-value title = %q, want Unassigned", groups[1].Title)
	}
	if groups[1].ID != "rc-band-none" || groups[1].DataAttrs["testid"] != "rc-band-none" {
		t.Errorf("no-value band ID/testid = %q/%q, want rc-band-none both", groups[1].ID, groups[1].DataAttrs["testid"])
	}
}

// TestGroupRowsByValue_UnlistedAscending: with no LeadingOrder, bands sort
// purely ascending (case-insensitive), no-value last.
func TestGroupRowsByValue_UnlistedAscending(t *testing.T) {
	rows := []TableRow{rowWithID("1"), rowWithID("2"), rowWithID("3"), rowWithID("4")}
	vals := map[string]string{"1": "Charlie", "2": "alpha", "3": "Bravo"} // 4 no value
	groups := GroupRowsByValue(rows, vals, GroupRowsByValueOptions{
		GroupID: func(v string) string { return "b-" + v },
	})
	got := titles(groups)
	want := []string{"alpha", "Bravo", "Charlie", "—"}
	// Exact-length fatal FIRST: guards against extra/missing bands before the
	// index loop (a bare `i >= len(got)` short-circuit would silently pass extra
	// bands and can index a missing element in its own error message).
	if len(got) != len(want) {
		t.Fatalf("bands = %v, want %v", got, want)
	}
	for i := range want {
		if got[i] != want[i] {
			t.Errorf("band[%d] = %q, want %q (full=%v)", i, got[i], want[i], got)
		}
	}
}

// TestGroupRowsByValue_DuplicateIDSuffix: two raw buckets that slug to the same
// GroupID stay separate bands (no case-folding), and the later duplicate's ID +
// testid get a -2 suffix so band IDs never collide.
func TestGroupRowsByValue_DuplicateIDSuffix(t *testing.T) {
	rows := []TableRow{rowWithID("a"), rowWithID("b")}
	vals := map[string]string{"a": "Male", "b": "male"} // both slug to the same id
	groups := GroupRowsByValue(rows, vals, GroupRowsByValueOptions{
		GroupID: func(v string) string { return "sg-band-" + strings.ToLower(v) },
	})
	if len(groups) != 2 {
		t.Fatalf("want 2 bands (raw buckets stay separate), got %d (%v)", len(groups), titles(groups))
	}
	if groups[0].ID != "sg-band-male" || groups[0].DataAttrs["testid"] != "sg-band-male" {
		t.Errorf("band[0] ID/testid = %q/%q, want sg-band-male", groups[0].ID, groups[0].DataAttrs["testid"])
	}
	if groups[1].ID != "sg-band-male-2" || groups[1].DataAttrs["testid"] != "sg-band-male-2" {
		t.Errorf("band[1] ID/testid = %q/%q, want sg-band-male-2 (dup suffixed)", groups[1].ID, groups[1].DataAttrs["testid"])
	}
	if groups[0].Title != "Male" || groups[1].Title != "male" {
		t.Errorf("titles = %q/%q, want Male/male (raw preserved, not case-folded)", groups[0].Title, groups[1].Title)
	}
}
