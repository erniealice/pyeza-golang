package types

import (
	"testing"
	"time"
)

func TestFormatDateTime(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name  string
		input string
		to    string
		from  []string
		want  string
	}{
		{
			name:  "RFC3339 to readable date",
			input: "2026-03-23T14:30:00Z",
			to:    DateReadable,
			want:  "Mar 23, 2026",
		},
		{
			name:  "RFC3339 to date only",
			input: "2026-03-23T14:30:00Z",
			to:    DateOnly,
			want:  "2026-03-23",
		},
		{
			name:  "RFC3339 to full datetime",
			input: "2026-03-23T14:30:00Z",
			to:    DateTimeFull,
			want:  "Mar 23, 2026 2:30 PM",
		},
		{
			name:  "RFC3339 to time only",
			input: "2026-03-23T14:30:00Z",
			to:    TimeOnly,
			want:  "2:30 PM",
		},
		{
			name:  "RFC3339 to short date",
			input: "2026-03-23T14:30:00Z",
			to:    DateShort,
			want:  "03/23/2026",
		},
		{
			name:  "custom from format",
			input: "2026-03-23",
			to:    DateReadable,
			from:  []string{"2006-01-02"},
			want:  "Mar 23, 2026",
		},
		{
			name:  "empty input returns empty",
			input: "",
			to:    DateReadable,
			want:  "",
		},
		{
			name:  "invalid input returns original",
			input: "not-a-date",
			to:    DateReadable,
			want:  "not-a-date",
		},
		{
			name:  "invalid custom from falls back to RFC3339",
			input: "2026-03-23T14:30:00Z",
			to:    DateOnly,
			from:  []string{"bad-format"},
			want:  "2026-03-23",
		},
		{
			name:  "RFC3339 with timezone offset",
			input: "2026-03-23T14:30:00+08:00",
			to:    DateOnly,
			want:  "2026-03-23",
		},
	}

	for _, tc := range tests {
		tc := tc
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			got := FormatDateTime(tc.input, tc.to, tc.from...)
			if got != tc.want {
				t.Errorf("FormatDateTime(%q, %q, %v) = %q, want %q",
					tc.input, tc.to, tc.from, got, tc.want)
			}
		})
	}
}

func TestDateTimeCell(t *testing.T) {
	t.Parallel()

	cell := DateTimeCell("2026-03-23T14:30:00Z", DateReadable)

	if cell.Type != "datetime" {
		t.Errorf("Type = %q, want %q", cell.Type, "datetime")
	}
	if cell.Value != "Mar 23, 2026" {
		t.Errorf("Value = %q, want %q", cell.Value, "Mar 23, 2026")
	}
}

func TestDateTimeCell_WithCustomFrom(t *testing.T) {
	t.Parallel()

	cell := DateTimeCell("2026-03-23", DateTimeFull, "2006-01-02")

	if cell.Type != "datetime" {
		t.Errorf("Type = %q, want %q", cell.Type, "datetime")
	}
	// Parse "2026-03-23" as date-only, formatted to DateTimeFull should show midnight
	expected := "Mar 23, 2026 12:00 AM"
	if cell.Value != expected {
		t.Errorf("Value = %q, want %q", cell.Value, expected)
	}
}

func TestFormatDateTime_EdgeCases(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name  string
		input string
		to    string
		from  []string
		want  string
	}{
		{
			name:  "SQL injection in format string treated as literal",
			input: "2026-03-23T14:30:00Z",
			to:    "'; DROP TABLE users; --",
			want:  "'; DROP TABLE users; --", // Go format just uses it as a pattern
		},
		{
			name:  "very long format string",
			input: "2026-03-23T14:30:00Z",
			to:    "2006-01-02 2006-01-02 2006-01-02 2006-01-02 2006-01-02 2006-01-02 2006-01-02 2006-01-02 2006-01-02 2006-01-02",
			want:  "2026-03-23 2026-03-23 2026-03-23 2026-03-23 2026-03-23 2026-03-23 2026-03-23 2026-03-23 2026-03-23 2026-03-23",
		},
		{
			name:  "partial RFC3339 missing timezone returns original",
			input: "2026-03-23T14:30:00",
			to:    DateOnly,
			want:  "2026-03-23T14:30:00", // fails RFC3339 parse, returns input
		},
		{
			name:  "date only without time returns original",
			input: "2026-03-23",
			to:    DateReadable,
			want:  "2026-03-23", // fails RFC3339 parse, returns input
		},
		{
			name:  "empty to format",
			input: "2026-03-23T14:30:00Z",
			to:    "",
			want:  "", // Go time.Format("") returns ""
		},
		{
			name:  "whitespace-only input",
			input: "   ",
			to:    DateReadable,
			want:  "   ", // non-empty string fails parse, returns input
		},
		{
			name:  "null literal string",
			input: "null",
			to:    DateReadable,
			want:  "null",
		},
		{
			name:  "unix timestamp string returns original",
			input: "1679580600",
			to:    DateReadable,
			want:  "1679580600",
		},
		{
			name:  "ISO format with milliseconds",
			input: "2026-03-23T14:30:00.123Z",
			to:    DateOnly,
			want:  "2026-03-23", // RFC3339 handles nanosecond precision
		},
		{
			name:  "empty from format uses RFC3339",
			input: "2026-03-23T14:30:00Z",
			to:    DateOnly,
			from:  []string{""},
			want:  "2026-03-23",
		},
		{
			name:  "multiple from formats uses only first",
			input: "2026-03-23",
			to:    DateReadable,
			from:  []string{"2006-01-02", "01/02/2006"},
			want:  "Mar 23, 2026",
		},
		{
			name:  "format with HTML tags treated as literal",
			input: "2026-03-23T14:30:00Z",
			to:    "<script>alert('xss')</script>",
			want:  "<script>alert('xss')</script>",
		},
	}

	for _, tc := range tests {
		tc := tc
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			got := FormatDateTime(tc.input, tc.to, tc.from...)
			if got != tc.want {
				t.Errorf("FormatDateTime(%q, %q, %v) = %q, want %q",
					tc.input, tc.to, tc.from, got, tc.want)
			}
		})
	}
}

func TestDateTimeCell_EdgeCases(t *testing.T) {
	t.Parallel()

	t.Run("empty input", func(t *testing.T) {
		t.Parallel()
		cell := DateTimeCell("", DateReadable)
		if cell.Type != "datetime" {
			t.Errorf("Type = %q, want %q", cell.Type, "datetime")
		}
		if cell.Value != "" {
			t.Errorf("Value = %q, want empty", cell.Value)
		}
	})

	t.Run("invalid input", func(t *testing.T) {
		t.Parallel()
		cell := DateTimeCell("garbage", DateReadable)
		if cell.Value != "garbage" {
			t.Errorf("Value = %q, want %q", cell.Value, "garbage")
		}
	})
}

func TestDateFormatConstants(t *testing.T) {
	t.Parallel()

	// Verify format constants produce expected results with a known time
	ref := time.Date(2026, 3, 23, 14, 30, 0, 0, time.UTC)

	tests := []struct {
		name   string
		format string
		want   string
	}{
		{"DateOnly", DateOnly, "2026-03-23"},
		{"DateReadable", DateReadable, "Mar 23, 2026"},
		{"DateTimeFull", DateTimeFull, "Mar 23, 2026 2:30 PM"},
		{"TimeOnly", TimeOnly, "2:30 PM"},
		{"DateShort", DateShort, "03/23/2026"},
		{"DateTimeISO", DateTimeISO, "2026-03-23 14:30"},
	}

	for _, tc := range tests {
		tc := tc
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			got := ref.Format(tc.format)
			if got != tc.want {
				t.Errorf("Format(%q) = %q, want %q", tc.format, got, tc.want)
			}
		})
	}
}
