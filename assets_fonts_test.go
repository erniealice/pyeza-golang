package pyeza

import (
	"io/fs"
	"strings"
	"testing"
)

// TestSharedFSIncludesFonts confirms the //go:embed all:web directive captures the
// self-hosted woff2 binaries and the fonts.css stylesheet (Plan-8 W4 / Q-CSP-1).
// If the embed pattern ever stops covering web/assets/fonts, this fails the build's tests.
func TestSharedFSIncludesFonts(t *testing.T) {
	// fonts.css must be embedded.
	if _, err := SharedFS.ReadFile("web/assets/css/fonts.css"); err != nil {
		t.Fatalf("fonts.css not found in SharedFS embed: %v", err)
	}

	// At least one woff2 per expected family must be embedded.
	var woff2Count int
	err := fs.WalkDir(SharedFS, "web/assets/fonts", func(path string, d fs.DirEntry, err error) error {
		if err != nil {
			return err
		}
		if !d.IsDir() && strings.HasSuffix(path, ".woff2") {
			woff2Count++
		}
		return nil
	})
	if err != nil {
		t.Fatalf("failed walking embedded web/assets/fonts: %v", err)
	}
	if woff2Count == 0 {
		t.Fatal("no .woff2 files embedded under web/assets/fonts")
	}

	// Each of the 6 self-hosted families must have at least one embedded face.
	families := []string{
		"barlow-condensed", "bricolage-grotesque", "figtree",
		"jetbrains-mono", "nunito", "playfair-display",
	}
	entries, err := fs.ReadDir(SharedFS, "web/assets/fonts")
	if err != nil {
		t.Fatalf("failed reading embedded web/assets/fonts: %v", err)
	}
	for _, fam := range families {
		found := false
		for _, e := range entries {
			if strings.HasPrefix(e.Name(), fam+"-") && strings.HasSuffix(e.Name(), ".woff2") {
				found = true
				break
			}
		}
		if !found {
			t.Errorf("no embedded woff2 face for font family %q", fam)
		}
	}

	// The stylesheet must reference local /assets/fonts paths and contain no Google CDN refs.
	cssBytes, err := SharedFS.ReadFile("web/assets/css/fonts.css")
	if err != nil {
		t.Fatalf("re-read fonts.css failed: %v", err)
	}
	css := string(cssBytes)
	if !strings.Contains(css, "/assets/fonts/") {
		t.Error("fonts.css does not reference local /assets/fonts/ URLs")
	}
	if strings.Contains(css, "gstatic") || strings.Contains(css, "googleapis") {
		t.Error("fonts.css still references a Google CDN (gstatic/googleapis)")
	}
}
