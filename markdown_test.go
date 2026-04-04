package pyeza

import (
	"strings"
	"testing"
)

func TestRenderMarkdown_BasicParagraph(t *testing.T) {
	t.Parallel()

	html, err := RenderMarkdown([]byte("Hello, world!"))
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !strings.Contains(string(html), "Hello, world!") {
		t.Errorf("expected output to contain 'Hello, world!', got: %s", html)
	}
	if !strings.Contains(string(html), "<p>") {
		t.Errorf("expected output to contain <p> tag, got: %s", html)
	}
}

func TestRenderMarkdown_Heading(t *testing.T) {
	t.Parallel()

	html, err := RenderMarkdown([]byte("# Title\n\nSome content."))
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !strings.Contains(string(html), "<h1") {
		t.Errorf("expected <h1> tag, got: %s", html)
	}
	if !strings.Contains(string(html), "Title") {
		t.Errorf("expected 'Title' in output, got: %s", html)
	}
}

func TestRenderMarkdown_Bold(t *testing.T) {
	t.Parallel()

	html, err := RenderMarkdown([]byte("This is **bold** text."))
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !strings.Contains(string(html), "<strong>bold</strong>") {
		t.Errorf("expected <strong>bold</strong>, got: %s", html)
	}
}

func TestRenderMarkdown_List(t *testing.T) {
	t.Parallel()

	html, err := RenderMarkdown([]byte("- Item 1\n- Item 2\n- Item 3"))
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !strings.Contains(string(html), "<ul>") {
		t.Errorf("expected <ul> tag, got: %s", html)
	}
	if !strings.Contains(string(html), "<li>") {
		t.Errorf("expected <li> tags, got: %s", html)
	}
}

func TestRenderMarkdown_EmptyInput(t *testing.T) {
	t.Parallel()

	html, err := RenderMarkdown([]byte(""))
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if string(html) != "" {
		t.Errorf("expected empty output for empty input, got: %q", html)
	}
}

func TestRenderMarkdown_GFMTable(t *testing.T) {
	t.Parallel()

	md := "| A | B |\n|---|---|\n| 1 | 2 |"
	html, err := RenderMarkdown([]byte(md))
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !strings.Contains(string(html), "<table>") {
		t.Errorf("expected GFM table rendering with <table> tag, got: %s", html)
	}
}

func TestRenderMarkdown_CodeBlock(t *testing.T) {
	t.Parallel()

	md := "```go\nfunc main() {}\n```"
	html, err := RenderMarkdown([]byte(md))
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !strings.Contains(string(html), "<code") {
		t.Errorf("expected <code> tag for code block, got: %s", html)
	}
}

func TestRenderMarkdown_Link(t *testing.T) {
	t.Parallel()

	html, err := RenderMarkdown([]byte("[Click here](https://example.com)"))
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !strings.Contains(string(html), "https://example.com") {
		t.Errorf("expected link href, got: %s", html)
	}
	if !strings.Contains(string(html), "Click here") {
		t.Errorf("expected link text, got: %s", html)
	}
}
