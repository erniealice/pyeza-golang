package types

import (
	"context"
	"testing"
	"time"
)

func TestLoadLocationOrDefault(t *testing.T) {
	cases := []struct {
		name, input, want string
	}{
		{"valid", "Asia/Tokyo", "Asia/Tokyo"},
		{"empty falls to default", "", "Asia/Manila"},
		{"invalid falls to default", "Not/A/Zone", "Asia/Manila"},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			got := LoadLocationOrDefault(c.input)
			if got.String() != c.want {
				t.Fatalf("LoadLocationOrDefault(%q) = %s; want %s", c.input, got, c.want)
			}
		})
	}
}

func TestFormatInTZ(t *testing.T) {
	manila, _ := time.LoadLocation("Asia/Manila")
	utc := time.Date(2026, 4, 17, 1, 0, 0, 0, time.UTC)
	got := FormatInTZ(utc, manila, DateTimeReadable)
	if got != "Apr 17, 2026 9:00 AM" {
		t.Fatalf("FormatInTZ = %q; want Apr 17, 2026 9:00 AM", got)
	}
	if FormatInTZ(time.Time{}, manila, DateTimeReadable) != "" {
		t.Fatalf("zero time should format to empty string")
	}
}

func TestParseInTZ(t *testing.T) {
	manila, _ := time.LoadLocation("Asia/Manila")
	got, err := ParseInTZ("2026-04-17 09:00", "2006-01-02 15:04", manila)
	if err != nil {
		t.Fatal(err)
	}
	want := time.Date(2026, 4, 17, 9, 0, 0, 0, manila)
	if !got.Equal(want) {
		t.Fatalf("got %v; want %v", got, want)
	}
	gotEmpty, err := ParseInTZ("", "2006-01-02", manila)
	if err != nil {
		t.Fatal(err)
	}
	if !gotEmpty.IsZero() {
		t.Fatalf("empty input should yield zero time")
	}
}

func TestContextRoundTrip(t *testing.T) {
	tokyo, _ := time.LoadLocation("Asia/Tokyo")
	ctx := WithLocation(context.Background(), tokyo)
	got := LocationFromContext(ctx)
	if got.String() != "Asia/Tokyo" {
		t.Fatalf("got %s; want Asia/Tokyo", got)
	}
	// Empty ctx should fall back to default.
	bare := LocationFromContext(context.Background())
	if bare.String() != "Asia/Manila" {
		t.Fatalf("default fallback = %s; want Asia/Manila", bare)
	}
}
