package types

import "testing"

func TestPageData_T_Found(t *testing.T) {
	t.Parallel()

	pd := PageData{
		Messages: map[string]string{
			"client.page.title": "Clients",
			"user.page.title":   "Users",
		},
	}

	got := pd.T("client.page.title")
	if got != "Clients" {
		t.Errorf("T(%q) = %q, want %q", "client.page.title", got, "Clients")
	}
}

func TestPageData_T_NotFound(t *testing.T) {
	t.Parallel()

	pd := PageData{
		Messages: map[string]string{
			"known.key": "value",
		},
	}

	got := pd.T("unknown.key")
	if got != "unknown.key" {
		t.Errorf("T(%q) = %q, want key echoed back", "unknown.key", got)
	}
}

func TestPageData_T_NilMessages(t *testing.T) {
	t.Parallel()

	pd := PageData{}

	got := pd.T("any.key")
	if got != "any.key" {
		t.Errorf("T(%q) with nil Messages = %q, want key echoed back", "any.key", got)
	}
}
