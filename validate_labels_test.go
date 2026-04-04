package pyeza

import (
	"strings"
	"testing"
)

func TestValidateLabels_AllFilled(t *testing.T) {
	t.Parallel()

	type TestLabels struct {
		Title   string
		Caption string
	}

	labels := TestLabels{Title: "Hello", Caption: "World"}
	warnings := ValidateLabels("Test", labels)

	if len(warnings) != 0 {
		t.Errorf("expected 0 warnings for fully populated struct, got %d: %v", len(warnings), warnings)
	}
}

func TestValidateLabels_MissingFields(t *testing.T) {
	t.Parallel()

	type TestLabels struct {
		Title   string
		Caption string
		Message string
	}

	labels := TestLabels{Title: "Hello", Caption: "", Message: ""}
	warnings := ValidateLabels("Test", labels)

	if len(warnings) != 2 {
		t.Fatalf("expected 2 warnings, got %d: %v", len(warnings), warnings)
	}

	// Verify warnings mention the missing fields
	captionFound := false
	messageFound := false
	for _, w := range warnings {
		if strings.Contains(w, "Caption") {
			captionFound = true
		}
		if strings.Contains(w, "Message") {
			messageFound = true
		}
	}
	if !captionFound {
		t.Error("expected warning for Caption field")
	}
	if !messageFound {
		t.Error("expected warning for Message field")
	}
}

func TestValidateLabels_NestedStruct(t *testing.T) {
	t.Parallel()

	type Inner struct {
		Heading string
		Body    string
	}
	type Outer struct {
		Title string
		Inner Inner
	}

	labels := Outer{Title: "Page", Inner: Inner{Heading: "Hello", Body: ""}}
	warnings := ValidateLabels("Outer", labels)

	if len(warnings) != 1 {
		t.Fatalf("expected 1 warning for nested empty field, got %d: %v", len(warnings), warnings)
	}
	if !strings.Contains(warnings[0], "Body") {
		t.Errorf("expected warning about Body, got %q", warnings[0])
	}
}

func TestValidateLabels_PointerStruct(t *testing.T) {
	t.Parallel()

	type Inner struct {
		Heading string
	}
	type Outer struct {
		Title string
		Inner *Inner
	}

	labels := Outer{Title: "Page", Inner: &Inner{Heading: ""}}
	warnings := ValidateLabels("Outer", &labels)

	if len(warnings) != 1 {
		t.Fatalf("expected 1 warning, got %d: %v", len(warnings), warnings)
	}
	if !strings.Contains(warnings[0], "Heading") {
		t.Errorf("expected warning about Heading, got %q", warnings[0])
	}
}

func TestValidateLabels_NilPointerStruct(t *testing.T) {
	t.Parallel()

	type Inner struct {
		Heading string
	}
	type Outer struct {
		Title string
		Inner *Inner
	}

	labels := Outer{Title: "Page", Inner: nil}
	warnings := ValidateLabels("Outer", labels)

	// nil pointer inner struct should not cause panic and should not warn
	if len(warnings) != 0 {
		t.Errorf("expected 0 warnings for nil pointer inner, got %d: %v", len(warnings), warnings)
	}
}

func TestValidateLabels_NonStructInput(t *testing.T) {
	t.Parallel()

	warnings := ValidateLabels("test", "not a struct")
	if len(warnings) != 0 {
		t.Errorf("expected 0 warnings for non-struct input, got %d", len(warnings))
	}
}

func TestValidateLabels_EmptyStruct(t *testing.T) {
	t.Parallel()

	type Empty struct{}
	warnings := ValidateLabels("test", Empty{})
	if len(warnings) != 0 {
		t.Errorf("expected 0 warnings for empty struct, got %d", len(warnings))
	}
}

func TestValidateLabels_NonStringFields(t *testing.T) {
	t.Parallel()

	type MixedLabels struct {
		Title    string
		Count    int
		Active   bool
		Amount   float64
		Subtitle string
	}

	labels := MixedLabels{Title: "Test", Count: 0, Active: false, Amount: 0.0, Subtitle: ""}
	warnings := ValidateLabels("Mixed", labels)

	// Only string fields should generate warnings (Subtitle is empty)
	if len(warnings) != 1 {
		t.Fatalf("expected 1 warning (only Subtitle), got %d: %v", len(warnings), warnings)
	}
	if !strings.Contains(warnings[0], "Subtitle") {
		t.Errorf("expected warning about Subtitle, got %q", warnings[0])
	}
}

func TestValidateLabels_UnexportedFields(t *testing.T) {
	t.Parallel()

	type labelsWithUnexported struct {
		Title   string
		hidden  string //nolint:unused // intentionally unexported for test
		Caption string
	}

	// Unexported string fields are still visited by reflect;
	// the walker should not panic and should still detect empty unexported fields
	labels := labelsWithUnexported{Title: "Hello", Caption: "World"}
	warnings := ValidateLabels("Test", labels)

	// "hidden" is empty and will be detected (reflect can read unexported string values)
	foundHidden := false
	for _, w := range warnings {
		if strings.Contains(w, "hidden") {
			foundHidden = true
		}
	}
	if !foundHidden {
		t.Errorf("expected warning for unexported 'hidden' field, got %v", warnings)
	}
}

func TestValidateLabels_AllNonStringFields(t *testing.T) {
	t.Parallel()

	type NumericOnly struct {
		Count  int
		Active bool
		Rate   float64
		Flags  uint8
	}

	labels := NumericOnly{Count: 0, Active: false, Rate: 0.0, Flags: 0}
	warnings := ValidateLabels("NumericOnly", labels)

	// No string fields => no warnings
	if len(warnings) != 0 {
		t.Errorf("expected 0 warnings for struct with no string fields, got %d: %v", len(warnings), warnings)
	}
}

func TestValidateLabels_NilInput(t *testing.T) {
	t.Parallel()

	warnings := ValidateLabels("test", nil)
	if len(warnings) != 0 {
		t.Errorf("expected 0 warnings for nil input, got %d", len(warnings))
	}
}

func TestValidateLabels_SliceField(t *testing.T) {
	t.Parallel()

	type WithSlice struct {
		Title string
		Tags  []string
	}

	labels := WithSlice{Title: "Hello", Tags: nil}
	warnings := ValidateLabels("Test", labels)

	// Slice fields should be ignored (not string, not struct)
	if len(warnings) != 0 {
		t.Errorf("expected 0 warnings, got %d: %v", len(warnings), warnings)
	}
}

func TestValidateLabels_MapField(t *testing.T) {
	t.Parallel()

	type WithMap struct {
		Title    string
		Metadata map[string]string
	}

	labels := WithMap{Title: "Hello", Metadata: nil}
	warnings := ValidateLabels("Test", labels)

	// Map fields should be ignored
	if len(warnings) != 0 {
		t.Errorf("expected 0 warnings, got %d: %v", len(warnings), warnings)
	}
}

func TestValidateLabels_DeeplyNested(t *testing.T) {
	t.Parallel()

	type Level3 struct {
		DeepField string
	}
	type Level2 struct {
		Mid   string
		Inner Level3
	}
	type Level1 struct {
		Top   string
		Inner Level2
	}

	labels := Level1{
		Top: "filled",
		Inner: Level2{
			Mid:   "",                    // empty
			Inner: Level3{DeepField: ""}, // empty
		},
	}
	warnings := ValidateLabels("Root", labels)

	if len(warnings) != 2 {
		t.Fatalf("expected 2 warnings for nested empty fields, got %d: %v", len(warnings), warnings)
	}

	midFound := false
	deepFound := false
	for _, w := range warnings {
		if strings.Contains(w, "Mid") {
			midFound = true
		}
		if strings.Contains(w, "DeepField") {
			deepFound = true
		}
	}
	if !midFound {
		t.Error("expected warning for Mid field")
	}
	if !deepFound {
		t.Error("expected warning for DeepField field")
	}
}

func TestValidateLabels_WhitespaceOnlyString(t *testing.T) {
	t.Parallel()

	type Labels struct {
		Title   string
		Caption string
	}

	// Whitespace-only strings are NOT empty per current implementation
	labels := Labels{Title: "Hello", Caption: "   "}
	warnings := ValidateLabels("Test", labels)

	if len(warnings) != 0 {
		t.Errorf("expected 0 warnings for whitespace-only string (not trimmed), got %d: %v",
			len(warnings), warnings)
	}
}
