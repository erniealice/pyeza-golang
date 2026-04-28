package types

import "time"

// Common display format constants
const (
	DateOnly     = "2006-01-02"           // ISO date
	DateReadable = "Jan 02, 2006"         // Human-friendly date
	DateTimeFull = "Jan 02, 2006 3:04 PM" // Date + time
	TimeOnly     = "3:04 PM"              // Time only
	DateShort    = "01/02/2006"           // Short numeric
	DateTimeISO  = "2006-01-02 15:04"     // ISO datetime without seconds
)

// FormatDateTime converts a date string from one format to another.
// `to` is the desired output format (Go reference time layout).
// `from` is variadic — defaults to time.RFC3339 if omitted.
// Returns the original string unchanged if parsing fails (graceful degradation).
func FormatDateTime(input string, to string, from ...string) string {
	if input == "" {
		return ""
	}

	fromFormat := time.RFC3339
	if len(from) > 0 && from[0] != "" {
		fromFormat = from[0]
	}

	parsed, err := time.Parse(fromFormat, input)
	if err != nil {
		// Try RFC3339 as fallback even if custom `from` was provided
		if fromFormat != time.RFC3339 {
			parsed, err = time.Parse(time.RFC3339, input)
		}
		if err != nil {
			return input // Return original if all parsing fails
		}
	}

	return parsed.Format(to)
}

// DateTimeCell creates a TableCell of type "datetime" with the formatted value.
// Parses RFC3339 input and formats to the specified display format.
// `from` is variadic — defaults to time.RFC3339.
func DateTimeCell(input string, to string, from ...string) TableCell {
	return TableCell{
		Type:  "datetime",
		Value: FormatDateTime(input, to, from...),
	}
}

// DateTimeCellSplit creates a TableCell of type "datetime" with explicit date
// and time portions. The template renders these stacked — date on top, time in
// a smaller muted font below — matching the visual treatment of person/email
// cells. Pass an empty `time` to fall back to single-line rendering with
// `date` as the .Value.
func DateTimeCellSplit(date, time string) TableCell {
	if time == "" {
		return TableCell{Type: "datetime", Value: date}
	}
	return TableCell{
		Type:     "datetime",
		Value:    date + " " + time, // legacy consumers reading .Value see the inline form
		DateText: date,
		TimeText: time,
	}
}
