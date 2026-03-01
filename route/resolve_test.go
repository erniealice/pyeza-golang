package route

import "testing"

func TestResolveURL_SinglePlaceholder(t *testing.T) {
	got := ResolveURL("/app/products/detail/{id}", "id", "abc-123")
	want := "/app/products/detail/abc-123"
	if got != want {
		t.Errorf("ResolveURL single placeholder: got %q, want %q", got, want)
	}
}

func TestResolveURL_MultiplePlaceholders(t *testing.T) {
	got := ResolveURL("/app/products/detail/{id}/variants/{variantId}/edit", "id", "p1", "variantId", "v2")
	want := "/app/products/detail/p1/variants/v2/edit"
	if got != want {
		t.Errorf("ResolveURL multiple placeholders: got %q, want %q", got, want)
	}
}

func TestResolveURL_NoPlaceholders(t *testing.T) {
	got := ResolveURL("/app/products/list")
	want := "/app/products/list"
	if got != want {
		t.Errorf("ResolveURL no placeholders: got %q, want %q", got, want)
	}
}

func TestResolveURL_OddPairsPanics(t *testing.T) {
	defer func() {
		r := recover()
		if r == nil {
			t.Fatal("ResolveURL with odd pairs: expected panic, got none")
		}
		msg, ok := r.(string)
		if !ok {
			t.Fatalf("ResolveURL with odd pairs: expected string panic, got %T", r)
		}
		if msg != "route.ResolveURL: odd number of pairs; must be key-value pairs" {
			t.Errorf("ResolveURL with odd pairs: unexpected panic message: %q", msg)
		}
	}()
	ResolveURL("/app/products/detail/{id}", "id")
}
