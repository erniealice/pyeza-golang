package types

import (
	"context"
	"time"

	"google.golang.org/protobuf/types/known/timestamppb"
)

// DefaultTimezone is the fallback used when no other zone is known. Single-region
// dev anchor per plan 20260425-date-time-fields. Pyeza intentionally does NOT
// know about users, workspaces, or schedules — those are policy decisions that
// belong with the caller (middleware, view, etc.).
const DefaultTimezone = "Asia/Manila"

// Display layouts paired with FormatInTZ.
const (
	DateTimeReadable = "Jan 02, 2006 3:04 PM"
	DateTimeWithTZ   = "Jan 02, 2006 3:04 PM MST"
	DateInputLayout  = "2006-01-02"
	TimeInputLayout  = "15:04"
)

// LoadLocationOrDefault returns the *time.Location for name, or the
// DefaultTimezone location, or time.UTC as a last resort. Empty / invalid
// names fall through. This is a pure stdlib wrapper — no policy.
func LoadLocationOrDefault(name string) *time.Location {
	if name != "" {
		if loc, err := time.LoadLocation(name); err == nil {
			return loc
		}
	}
	if loc, err := time.LoadLocation(DefaultTimezone); err == nil {
		return loc
	}
	return time.UTC
}

// FormatInTZ renders t in tz using the given layout. Zero-time → "".
// Nil tz falls back to UTC.
func FormatInTZ(t time.Time, tz *time.Location, layout string) string {
	if t.IsZero() {
		return ""
	}
	if tz == nil {
		tz = time.UTC
	}
	return t.In(tz).Format(layout)
}

// FormatTimestampInTZ is the nil-safe wrapper for *timestamppb.Timestamp.
// Use this for proto Timestamp fields — nil and the proto-zero (1970-01-01 UTC,
// produced by AsTime() on nil) both render as "". Otherwise delegates to
// FormatInTZ.
func FormatTimestampInTZ(ts *timestamppb.Timestamp, tz *time.Location, layout string) string {
	if ts == nil {
		return ""
	}
	t := ts.AsTime()
	if t.Unix() == 0 && t.Nanosecond() == 0 {
		return ""
	}
	return FormatInTZ(t, tz, layout)
}

// ParseInTZ parses a layout-formatted string as a wall-clock time in tz.
// Zero string → zero time, no error. Use this for form inputs where the user
// types "2026-04-17 09:00" and tz is the selected display timezone.
func ParseInTZ(input, layout string, tz *time.Location) (time.Time, error) {
	if input == "" {
		return time.Time{}, nil
	}
	if tz == nil {
		tz = time.UTC
	}
	return time.ParseInLocation(layout, input, tz)
}

type tzContextKey struct{}

// WithLocation stores tz on ctx under the shared timezone key. Used by callers
// (typically a request-scoped middleware) after they've decided which zone wins.
func WithLocation(ctx context.Context, tz *time.Location) context.Context {
	if tz == nil {
		return ctx
	}
	return context.WithValue(ctx, tzContextKey{}, tz)
}

// LocationFromContext returns the *time.Location previously stored via
// WithLocation. If absent, falls back to DefaultTimezone.
func LocationFromContext(ctx context.Context) *time.Location {
	if ctx != nil {
		if loc, ok := ctx.Value(tzContextKey{}).(*time.Location); ok && loc != nil {
			return loc
		}
	}
	return LoadLocationOrDefault("")
}

// CommonTimezones is the curated IANA name list shown by the timezone
// autocomplete. Pure data — picking which zones appear is a presentation
// concern, not a business rule.
var CommonTimezones = []string{
	"Asia/Manila",
	"Asia/Tokyo",
	"Asia/Singapore",
	"Asia/Hong_Kong",
	"Asia/Seoul",
	"Asia/Shanghai",
	"Asia/Bangkok",
	"Asia/Jakarta",
	"Asia/Kuala_Lumpur",
	"Asia/Dubai",
	"Asia/Kolkata",
	"Asia/Karachi",
	"UTC",
	"Europe/London",
	"Europe/Paris",
	"Europe/Berlin",
	"Europe/Madrid",
	"Europe/Rome",
	"Europe/Amsterdam",
	"Europe/Stockholm",
	"Europe/Zurich",
	"America/New_York",
	"America/Chicago",
	"America/Denver",
	"America/Los_Angeles",
	"America/Toronto",
	"America/Vancouver",
	"America/Mexico_City",
	"America/Sao_Paulo",
	"America/Buenos_Aires",
	"Pacific/Auckland",
	"Australia/Sydney",
	"Australia/Melbourne",
	"Australia/Perth",
}
