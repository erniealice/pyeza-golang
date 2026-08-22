package pyeza

import (
	"encoding/json/v2"
	"fmt"
	"html/template"
	"strings"
	"testing"

	"github.com/erniealice/pyeza-golang/types"
)

func TestGetDefaultFuncMap_Add(t *testing.T) {
	fm := getDefaultFuncMap()
	addFn := fm["add"].(func(int, int) int)

	tests := []struct {
		name string
		a, b int
		want int
	}{
		{name: "positive", a: 3, b: 5, want: 8},
		{name: "zero", a: 0, b: 0, want: 0},
		{name: "negative", a: -3, b: 5, want: 2},
		{name: "both negative", a: -3, b: -5, want: -8},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := addFn(tt.a, tt.b)
			if got != tt.want {
				t.Errorf("add(%d, %d) = %d, want %d", tt.a, tt.b, got, tt.want)
			}
		})
	}
}

func TestGetDefaultFuncMap_Sub(t *testing.T) {
	fm := getDefaultFuncMap()
	subFn := fm["sub"].(func(int, int) int)

	tests := []struct {
		name string
		a, b int
		want int
	}{
		{name: "positive", a: 10, b: 3, want: 7},
		{name: "negative result", a: 3, b: 10, want: -7},
		{name: "zero", a: 5, b: 5, want: 0},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := subFn(tt.a, tt.b)
			if got != tt.want {
				t.Errorf("sub(%d, %d) = %d, want %d", tt.a, tt.b, got, tt.want)
			}
		})
	}
}

func TestGetDefaultFuncMap_Mul(t *testing.T) {
	fm := getDefaultFuncMap()
	mulFn := fm["mul"].(func(any, any) float64)

	tests := []struct {
		name string
		a, b any
		want float64
	}{
		{name: "int * int", a: 3, b: 4, want: 12},
		{name: "float * float", a: 2.5, b: 4.0, want: 10},
		{name: "int * float", a: 3, b: 2.5, want: 7.5},
		{name: "zero", a: 100, b: 0, want: 0},
		{name: "negative", a: -3, b: 4, want: -12},
		{name: "int64", a: int64(5), b: int64(3), want: 15},
		{name: "float32", a: float32(2.0), b: float32(3.0), want: 6},
		{name: "unsupported type returns 0", a: "abc", b: 3, want: 0},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := mulFn(tt.a, tt.b)
			if got != tt.want {
				t.Errorf("mul(%v, %v) = %v, want %v", tt.a, tt.b, got, tt.want)
			}
		})
	}
}

func TestGetDefaultFuncMap_Div(t *testing.T) {
	fm := getDefaultFuncMap()
	divFn := fm["div"].(func(any, any) float64)

	tests := []struct {
		name string
		a, b any
		want float64
	}{
		{name: "int / int", a: 10, b: 2, want: 5},
		{name: "float / float", a: 7.5, b: 2.5, want: 3},
		{name: "divide by zero returns 0", a: 10, b: 0, want: 0},
		{name: "zero / nonzero", a: 0, b: 5, want: 0},
		{name: "int64", a: int64(100), b: int64(4), want: 25},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := divFn(tt.a, tt.b)
			if got != tt.want {
				t.Errorf("div(%v, %v) = %v, want %v", tt.a, tt.b, got, tt.want)
			}
		})
	}
}

func TestGetDefaultFuncMap_Until(t *testing.T) {
	fm := getDefaultFuncMap()
	untilFn := fm["until"].(func(int) []int)

	tests := []struct {
		name  string
		count int
		want  []int
	}{
		{name: "five", count: 5, want: []int{0, 1, 2, 3, 4}},
		{name: "one", count: 1, want: []int{0}},
		{name: "zero", count: 0, want: []int{}},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := untilFn(tt.count)
			if len(got) != len(tt.want) {
				t.Errorf("until(%d) length = %d, want %d", tt.count, len(got), len(tt.want))
				return
			}
			for i, v := range got {
				if v != tt.want[i] {
					t.Errorf("until(%d)[%d] = %d, want %d", tt.count, i, v, tt.want[i])
				}
			}
		})
	}
}

func TestGetDefaultFuncMap_Loop(t *testing.T) {
	fm := getDefaultFuncMap()
	loopFn := fm["loop"].(func(int) []int)

	got := loopFn(3)
	want := []int{0, 1, 2}
	if len(got) != len(want) {
		t.Fatalf("loop(3) length = %d, want %d", len(got), len(want))
	}
	for i, v := range got {
		if v != want[i] {
			t.Errorf("loop(3)[%d] = %d, want %d", i, v, want[i])
		}
	}
}

func TestGetDefaultFuncMap_Dict(t *testing.T) {
	fm := getDefaultFuncMap()
	dictFn := fm["dict"].(func(...any) map[string]any)

	t.Run("basic key-value pairs", func(t *testing.T) {
		result := dictFn("Name", "Alice", "Age", 30)
		if result["Name"] != "Alice" {
			t.Errorf("dict Name = %v, want Alice", result["Name"])
		}
		if result["Age"] != 30 {
			t.Errorf("dict Age = %v, want 30", result["Age"])
		}
	})

	t.Run("odd number of args returns nil", func(t *testing.T) {
		result := dictFn("Key1", "Value1", "Key2")
		if result != nil {
			t.Errorf("dict with odd args should return nil, got %v", result)
		}
	})

	t.Run("empty args returns empty map", func(t *testing.T) {
		result := dictFn()
		if result == nil {
			t.Error("dict with no args should return empty map, got nil")
		}
		if len(result) != 0 {
			t.Errorf("dict with no args should return empty map, got %d entries", len(result))
		}
	})

	t.Run("non-string key is skipped", func(t *testing.T) {
		result := dictFn(123, "value")
		if len(result) != 0 {
			t.Errorf("dict with non-string key should skip entry, got %d entries", len(result))
		}
	})
}

func TestGetDefaultFuncMap_List(t *testing.T) {
	fm := getDefaultFuncMap()
	listFn := fm["list"].(func(...any) []any)

	t.Run("multiple values", func(t *testing.T) {
		result := listFn("a", "b", "c")
		if len(result) != 3 {
			t.Fatalf("list length = %d, want 3", len(result))
		}
		if result[0] != "a" || result[1] != "b" || result[2] != "c" {
			t.Errorf("list = %v, want [a b c]", result)
		}
	})

	t.Run("empty args", func(t *testing.T) {
		result := listFn()
		if len(result) != 0 {
			t.Errorf("list() length = %d, want 0", len(result))
		}
	})

	t.Run("mixed types", func(t *testing.T) {
		result := listFn("hello", 42, true)
		if len(result) != 3 {
			t.Fatalf("list length = %d, want 3", len(result))
		}
	})
}

func TestGetDefaultFuncMap_Slugify(t *testing.T) {
	fm := getDefaultFuncMap()
	slugifyFn := fm["slugify"].(func(any) string)

	tests := []struct {
		name  string
		input any
		want  string
	}{
		{name: "simple text", input: "Hello World", want: "hello-world"},
		{name: "ampersand", input: "Sales & Marketing", want: "sales-and-marketing"},
		{name: "slashes", input: "Income/Expense", want: "income-expense"},
		{name: "underscores", input: "my_variable_name", want: "my-variable-name"},
		{name: "dots", input: "file.name.ext", want: "file-name-ext"},
		{name: "parentheses", input: "Item (Special)", want: "item-special"},
		{name: "brackets", input: "Array[0]", want: "array-0"},
		{name: "quotes removed", input: "it's a test", want: "its-a-test"},
		{name: "multiple spaces collapsed", input: "too   many   spaces", want: "too-many-spaces"},
		{name: "empty string", input: "", want: ""},
		{name: "whitespace only", input: "   ", want: ""},
		{name: "mixed special chars", input: "A & B / C: D; E", want: "a-and-b-c-d-e"},
		{name: "numeric input", input: 42, want: "42"},
		{name: "colons and semicolons", input: "key: value; other", want: "key-value-other"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := slugifyFn(tt.input)
			if got != tt.want {
				t.Errorf("slugify(%v) = %q, want %q", tt.input, got, tt.want)
			}
		})
	}
}

func TestGetDefaultFuncMap_T(t *testing.T) {
	fm := getDefaultFuncMap()
	tFn := fm["t"].(func(any, string) string)

	messages := map[string]string{
		"buttons.save":   "Save",
		"buttons.cancel": "Cancel",
	}

	t.Run("found key", func(t *testing.T) {
		got := tFn(messages, "buttons.save")
		if got != "Save" {
			t.Errorf("t(messages, 'buttons.save') = %q, want %q", got, "Save")
		}
	})

	t.Run("missing key falls back", func(t *testing.T) {
		got := tFn(messages, "buttons.delete")
		if got != "buttons.delete" {
			t.Errorf("t(messages, 'buttons.delete') = %q, want %q", got, "buttons.delete")
		}
	})

	t.Run("nil messages falls back", func(t *testing.T) {
		got := tFn(nil, "buttons.save")
		if got != "buttons.save" {
			t.Errorf("t(nil, 'buttons.save') = %q, want %q", got, "buttons.save")
		}
	})

	t.Run("wrong type falls back", func(t *testing.T) {
		got := tFn("not-a-map", "key")
		if got != "key" {
			t.Errorf("t(wrong-type, 'key') = %q, want %q", got, "key")
		}
	})
}

func TestGetDefaultFuncMap_FilterColumnsJSON(t *testing.T) {
	fm := getDefaultFuncMap()
	filterFn := fm["filterColumnsJSON"].(func(any) template.JS)

	t.Run("wrong type returns empty array", func(t *testing.T) {
		got := filterFn("not-columns")
		if string(got) != "[]" {
			t.Errorf("filterColumnsJSON(wrong type) = %q, want %q", got, "[]")
		}
	})
}

func TestGetDefaultFuncMap_Div_EdgeCases(t *testing.T) {
	fm := getDefaultFuncMap()
	divFn := fm["div"].(func(any, any) float64)

	tests := []struct {
		name string
		a, b any
		want float64
	}{
		{name: "int64 divide by zero", a: int64(100), b: int64(0), want: 0},
		{name: "float32 divide by zero", a: float32(100), b: float32(0), want: 0},
		{name: "float64 divide by zero", a: 100.0, b: 0.0, want: 0},
		{name: "string / int returns 0", a: "abc", b: 5, want: 0},
		{name: "int / string returns 0", a: 5, b: "abc", want: 0},
		{name: "nil / int returns 0", a: nil, b: 5, want: 0},
		{name: "int / nil is div by 0", a: 5, b: nil, want: 0},
		{name: "nil / nil is div by 0", a: nil, b: nil, want: 0},
		{name: "bool / int returns 0", a: true, b: 5, want: 0},
		{name: "negative / negative", a: -10, b: -2, want: 5},
		{name: "negative / positive", a: -10, b: 2, want: -5},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := divFn(tt.a, tt.b)
			if got != tt.want {
				t.Errorf("div(%v, %v) = %v, want %v", tt.a, tt.b, got, tt.want)
			}
		})
	}
}

func TestGetDefaultFuncMap_Slugify_EdgeCases(t *testing.T) {
	fm := getDefaultFuncMap()
	slugifyFn := fm["slugify"].(func(any) string)

	tests := []struct {
		name  string
		input any
		want  string
	}{
		{name: "unicode characters", input: "café résumé", want: "café-résumé"},
		{name: "only special characters not in replacer", input: "!@#$%^*+=~`|?<>", want: "!@#$%^*+=~`|?<>"},
		{name: "only separators", input: "&/\\_-.,;:", want: "and"},
		{name: "nil input becomes <nil>", input: nil, want: "<nil>"},
		{name: "boolean input", input: true, want: "true"},
		{name: "float input dot replaced", input: 3.14, want: "3-14"},
		{name: "negative number dash replaced", input: -42, want: "42"},
		{name: "consecutive separators", input: "a&&&&b", want: "a-and-and-and-and-b"},
		{name: "tab and newline", input: "hello\tworld\nfoo", want: "hello-world-foo"},
		{name: "very long repeated string", input: "a a a a a a a a a a a a a a a", want: "a-a-a-a-a-a-a-a-a-a-a-a-a-a-a"},
		{name: "leading and trailing separators", input: "/hello/", want: "hello"},
		{name: "mixed case preserved as lower", input: "CamelCaseTest", want: "camelcasetest"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := slugifyFn(tt.input)
			if got != tt.want {
				t.Errorf("slugify(%v) = %q, want %q", tt.input, got, tt.want)
			}
		})
	}
}

func TestGetDefaultFuncMap_Dict_EdgeCases(t *testing.T) {
	fm := getDefaultFuncMap()
	dictFn := fm["dict"].(func(...any) map[string]any)

	t.Run("large number of args", func(t *testing.T) {
		args := make([]any, 200)
		for i := 0; i < 200; i += 2 {
			args[i] = fmt.Sprintf("key%d", i/2)
			args[i+1] = i / 2
		}
		result := dictFn(args...)
		if len(result) != 100 {
			t.Errorf("dict with 100 pairs returned %d entries, want 100", len(result))
		}
	})

	t.Run("duplicate keys last wins", func(t *testing.T) {
		result := dictFn("key", "first", "key", "second")
		if result["key"] != "second" {
			t.Errorf("dict duplicate key = %v, want %q", result["key"], "second")
		}
	})

	t.Run("nil value", func(t *testing.T) {
		result := dictFn("key", nil)
		if result["key"] != nil {
			t.Errorf("dict nil value = %v, want nil", result["key"])
		}
	})
}

func TestGetDefaultFuncMap_Until_Negative(t *testing.T) {
	fm := getDefaultFuncMap()
	untilFn := fm["until"].(func(int) []int)

	// Negative count will panic with make([]int, negative)
	// This test documents that until with 0 returns empty
	got := untilFn(0)
	if len(got) != 0 {
		t.Errorf("until(0) length = %d, want 0", len(got))
	}
}

func TestGetDefaultFuncMap_Mul_EdgeCases(t *testing.T) {
	fm := getDefaultFuncMap()
	mulFn := fm["mul"].(func(any, any) float64)

	tests := []struct {
		name string
		a, b any
		want float64
	}{
		{name: "nil * int", a: nil, b: 5, want: 0},
		{name: "int * nil", a: 5, b: nil, want: 0},
		{name: "bool * int", a: true, b: 5, want: 0},
		{name: "string * string", a: "3", b: "4", want: 0},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := mulFn(tt.a, tt.b)
			if got != tt.want {
				t.Errorf("mul(%v, %v) = %v, want %v", tt.a, tt.b, got, tt.want)
			}
		})
	}
}

// stubWorkspaceFormSigner is a deterministic test double for WorkspaceFormSigner.
// SignFields returns "sig-for-{workspaceID}-on-{actionPath}" so tests can assert
// the exact wiring without re-implementing HMAC.
type stubWorkspaceFormSigner struct {
	err error
}

func (s *stubWorkspaceFormSigner) SignFields(workspaceID, actionPath string) (string, error) {
	if s.err != nil {
		return "", s.err
	}
	return fmt.Sprintf("sig-for-%s-on-%s", workspaceID, actionPath), nil
}

func TestActionForm_RendersBothHiddenFields(t *testing.T) {
	r := NewHTMLRenderer(nil)
	r.SetWorkspaceFormSigner(&stubWorkspaceFormSigner{})

	tmpl := template.Must(template.New("t").Funcs(r.templateFuncs).Parse(
		`<form>{{actionForm "/action/client/edit/abc-123" "ws-uuid-42"}}</form>`,
	))

	var buf strings.Builder
	if err := tmpl.Execute(&buf, nil); err != nil {
		t.Fatalf("template execute failed: %v", err)
	}
	out := buf.String()

	if !strings.Contains(out, `name="_workspace_id"`) {
		t.Errorf("actionForm output missing _workspace_id field; got %q", out)
	}
	if !strings.Contains(out, `name="_workspace_id_sig"`) {
		t.Errorf("actionForm output missing _workspace_id_sig field; got %q", out)
	}
	if !strings.Contains(out, `value="ws-uuid-42"`) {
		t.Errorf("actionForm output missing workspaceID value; got %q", out)
	}
	if !strings.Contains(out, `value="sig-for-ws-uuid-42-on-/action/client/edit/abc-123"`) {
		t.Errorf("actionForm output missing signature value derived from action path + workspaceID; got %q", out)
	}
	if !strings.Contains(out, `type="hidden"`) {
		t.Errorf("actionForm output missing hidden input type; got %q", out)
	}
}

func TestActionForm_EmptyWhenSignerNil(t *testing.T) {
	r := NewHTMLRenderer(nil)
	// Note: SetWorkspaceFormSigner NOT called — simulates dev boot without HMAC env.

	tmpl := template.Must(template.New("t").Funcs(r.templateFuncs).Parse(
		`<form>{{actionForm "/action/client/edit/abc" "ws-1"}}</form>`,
	))

	var buf strings.Builder
	if err := tmpl.Execute(&buf, nil); err != nil {
		t.Fatalf("template execute failed: %v", err)
	}
	if got := buf.String(); got != `<form></form>` {
		t.Errorf("actionForm should render empty when signer is nil; got %q", got)
	}
}

func TestActionForm_EmptyWhenWorkspaceIDEmpty(t *testing.T) {
	r := NewHTMLRenderer(nil)
	r.SetWorkspaceFormSigner(&stubWorkspaceFormSigner{})

	tmpl := template.Must(template.New("t").Funcs(r.templateFuncs).Parse(
		`<form>{{actionForm "/action/foo" ""}}</form>`,
	))

	var buf strings.Builder
	if err := tmpl.Execute(&buf, nil); err != nil {
		t.Fatalf("template execute failed: %v", err)
	}
	if got := buf.String(); got != `<form></form>` {
		t.Errorf("actionForm should render empty when workspaceID is empty; got %q", got)
	}
}

func TestActionForm_EmptyOnSignError(t *testing.T) {
	r := NewHTMLRenderer(nil)
	r.SetWorkspaceFormSigner(&stubWorkspaceFormSigner{err: fmt.Errorf("rand source dead")})

	tmpl := template.Must(template.New("t").Funcs(r.templateFuncs).Parse(
		`<form>{{actionForm "/action/foo" "ws-1"}}</form>`,
	))

	var buf strings.Builder
	if err := tmpl.Execute(&buf, nil); err != nil {
		t.Fatalf("template execute failed: %v", err)
	}
	if got := buf.String(); got != `<form></form>` {
		t.Errorf("actionForm should render empty on signer error; got %q", got)
	}
}

// TestRowActionTokens_SignsEnabledSkipsDisabledIncludesBulk locks in the FIX-2/
// FIX-5 contract: rowActionTokens signs enabled POST-ing row actions AND enabled
// bulk-action endpoints, keys them by their query-stripped path, and skips both
// Disabled actions and non-POST-ing (drawer/nav) actions.
func TestRowActionTokens_SignsEnabledSkipsDisabledIncludesBulk(t *testing.T) {
	r := NewHTMLRenderer(nil)
	r.SetWorkspaceFormSigner(&stubWorkspaceFormSigner{})

	fn, ok := r.templateFuncs["rowActionTokens"].(func(types.TableConfig) string)
	if !ok {
		t.Fatalf("rowActionTokens func not registered with expected signature")
	}

	cfg := types.TableConfig{
		WorkspaceID: "ws-9",
		Rows: []types.TableRow{{
			ID: "row-1",
			Actions: []types.TableAction{
				{Action: "delete", URL: "/action/client/delete?id=row-1"},
				{Action: "deactivate", URL: "/action/client/deactivate?id=row-1", Disabled: true},
				{Action: "edit", URL: "/action/client/edit?id=row-1"}, // non-POST → skipped
			},
		}},
		BulkActions: &types.BulkActionsConfig{
			Enabled: true,
			Actions: []types.BulkAction{
				{Key: "bulk-delete", Endpoint: "/action/client/bulk-delete"},
				{Key: "bulk-archive", Endpoint: "/action/client/bulk-archive", Disabled: true},
			},
		},
	}

	var tokens map[string]string
	if err := json.Unmarshal([]byte(fn(cfg)), &tokens); err != nil {
		t.Fatalf("rowActionTokens returned invalid JSON: %v", err)
	}

	if got := tokens["/action/client/delete"]; got != "sig-for-ws-9-on-/action/client/delete" {
		t.Errorf("enabled delete row action should be signed under its query-stripped path; got %q", got)
	}
	if got := tokens["/action/client/bulk-delete"]; got != "sig-for-ws-9-on-/action/client/bulk-delete" {
		t.Errorf("enabled bulk endpoint should be signed; got %q", got)
	}
	if _, present := tokens["/action/client/deactivate"]; present {
		t.Errorf("Disabled row action must not be signed")
	}
	if _, present := tokens["/action/client/bulk-archive"]; present {
		t.Errorf("Disabled bulk endpoint must not be signed")
	}
	if _, present := tokens["/action/client/edit"]; present {
		t.Errorf("non-POST edit action must not be signed")
	}
}

// TestRowActionTokens_SafeModeNoWorkspace confirms the safe-mode escape hatch:
// no workspace bound → "{}" (the action_workspace_guard is disabled in that case).
func TestRowActionTokens_SafeModeNoWorkspace(t *testing.T) {
	r := NewHTMLRenderer(nil)
	r.SetWorkspaceFormSigner(&stubWorkspaceFormSigner{})
	fn := r.templateFuncs["rowActionTokens"].(func(types.TableConfig) string)

	cfg := types.TableConfig{
		Rows: []types.TableRow{{ID: "1", Actions: []types.TableAction{
			{Action: "delete", URL: "/action/x/delete"},
		}}},
	}
	if got := fn(cfg); got != "{}" {
		t.Errorf("expected {} in safe mode (no workspace bound); got %q", got)
	}
}

func TestToFloat64(t *testing.T) {
	tests := []struct {
		name  string
		input any
		want  float64
	}{
		{name: "int", input: 42, want: 42},
		{name: "int64", input: int64(100), want: 100},
		{name: "float64", input: 3.14, want: 3.14},
		{name: "float32", input: float32(2.5), want: 2.5},
		{name: "string returns 0", input: "hello", want: 0},
		{name: "nil returns 0", input: nil, want: 0},
		{name: "bool returns 0", input: true, want: 0},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := toFloat64(tt.input)
			if got != tt.want {
				t.Errorf("toFloat64(%v) = %v, want %v", tt.input, got, tt.want)
			}
		})
	}
}
