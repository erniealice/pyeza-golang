package view

import (
	"context"
	"net/http"
	"testing"
)

func TestViewFunc_ImplementsView(t *testing.T) {
	t.Parallel()

	var v View = ViewFunc(func(ctx context.Context, viewCtx *ViewContext) ViewResult {
		return OK("test.html", nil)
	})

	result := v.Handle(context.Background(), &ViewContext{})
	if result.Template != "test.html" {
		t.Errorf("Template = %q, want %q", result.Template, "test.html")
	}
	if result.StatusCode != http.StatusOK {
		t.Errorf("StatusCode = %d, want %d", result.StatusCode, http.StatusOK)
	}
}

func TestOK(t *testing.T) {
	t.Parallel()

	data := map[string]string{"key": "value"}
	result := OK("page.html", data)

	if result.Template != "page.html" {
		t.Errorf("Template = %q, want %q", result.Template, "page.html")
	}
	if result.StatusCode != http.StatusOK {
		t.Errorf("StatusCode = %d, want %d", result.StatusCode, http.StatusOK)
	}
	if result.Data == nil {
		t.Error("Data should not be nil")
	}
}

func TestRedirect(t *testing.T) {
	t.Parallel()

	result := Redirect("/app/dashboard")

	if result.Redirect != "/app/dashboard" {
		t.Errorf("Redirect = %q, want %q", result.Redirect, "/app/dashboard")
	}
	if result.StatusCode != http.StatusSeeOther {
		t.Errorf("StatusCode = %d, want %d", result.StatusCode, http.StatusSeeOther)
	}
}

func TestError(t *testing.T) {
	t.Parallel()

	err := http.ErrServerClosed
	result := Error(err)

	if result.Error != err {
		t.Errorf("Error = %v, want %v", result.Error, err)
	}
	if result.StatusCode != http.StatusInternalServerError {
		t.Errorf("StatusCode = %d, want %d", result.StatusCode, http.StatusInternalServerError)
	}
}

func TestViewContext_T_Found(t *testing.T) {
	t.Parallel()

	vc := &ViewContext{
		Messages: map[string]string{
			"client.title": "Client Management",
		},
	}

	got := vc.T("client.title")
	if got != "Client Management" {
		t.Errorf("T(%q) = %q, want %q", "client.title", got, "Client Management")
	}
}

func TestViewContext_T_NotFound(t *testing.T) {
	t.Parallel()

	vc := &ViewContext{
		Messages: map[string]string{},
	}

	got := vc.T("missing.key")
	if got != "missing.key" {
		t.Errorf("T(%q) = %q, want key echoed back", "missing.key", got)
	}
}

func TestViewContext_T_NilMessages(t *testing.T) {
	t.Parallel()

	vc := &ViewContext{}

	got := vc.T("any.key")
	if got != "any.key" {
		t.Errorf("T(%q) with nil Messages = %q, want key echoed back", "any.key", got)
	}
}
