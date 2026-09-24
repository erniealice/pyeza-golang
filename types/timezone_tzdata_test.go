package types

import (
	"testing"
	"time"
)

// The default zone must resolve to +08:00 (the embedded time/tzdata covers
// images without system zoneinfo; see the go list -deps check in the plan).
func TestLoadLocationOrDefaultResolvesWithoutSystemZoneinfo(t *testing.T) {
	t.Setenv("ZONEINFO", t.TempDir())
	loc := LoadLocationOrDefault("")
	if loc.String() != DefaultTimezone {
		t.Fatalf("LoadLocationOrDefault(\"\") = %q, want %q", loc, DefaultTimezone)
	}
	if _, off := time.Now().In(loc).Zone(); off != 8*3600 {
		t.Fatalf("offset = %d, want +08:00", off)
	}
}
