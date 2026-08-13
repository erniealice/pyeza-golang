package pyeza

import (
	"bytes"
	"strings"
	"testing"

	"github.com/erniealice/pyeza-golang/types"
)

// renderNamed parses the full shared template tree from SharedFS and executes
// the named template with data, returning the rendered HTML. Mirrors how the
// apps load pyeza components (NewHTMLRendererFromFS(SharedFS)), so the render
// path under test is the real one.
func renderNamed(t *testing.T, name string, data any) string {
	t.Helper()
	r := NewHTMLRendererFromFS(SharedFS)
	if err := r.Init(); err != nil {
		t.Fatalf("Init shared templates: %v", err)
	}
	var buf bytes.Buffer
	if err := r.templates.ExecuteTemplate(&buf, name, data); err != nil {
		t.Fatalf("ExecuteTemplate %q: %v", name, err)
	}
	return buf.String()
}

// --- W-A7: PrimaryAction.Download on the toolbar Href branch ------------------

// TestPrimaryActionDownload_False_ByteIdenticalAnchor is the lock's explicit
// false-case regression gate: with Download=false the Href anchor must be
// byte-identical to the pre-change template — no download, no hx-boost.
func TestPrimaryActionDownload_False_ByteIdenticalAnchor(t *testing.T) {
	cfg := types.TableConfig{
		ID: "report-cards-student",
		PrimaryAction: &types.PrimaryAction{
			Label:  "Download PDF",
			Href:   "/report-cards/section/sec-1/client/c-1?format=pdf",
			TestID: "rc-download-pdf",
			// Download defaults false.
		},
	}
	out := renderNamed(t, "table-toolbar", cfg)

	// The exact anchor opening tag the pre-change template emitted for a Href +
	// TestID primary action, ending at `>` with no download / no hx-boost — a
	// byte-identity proof (the download attribute would appear between the testid
	// and `>`).
	wantAnchor := `<a href="/report-cards/section/sec-1/client/c-1?format=pdf" class="btn-primary toolbar-primary-action" data-testid="rc-download-pdf">`
	if !strings.Contains(out, wantAnchor) {
		t.Errorf("false-case anchor not byte-identical to today.\nwant substring: %s\ngot: %s", wantAnchor, out)
	}
	// The download attribute is emitted as ` download hx-boost="false"` — assert
	// neither the attribute nor hx-boost appears (the word "download" also lives
	// inside the testid/label, so match the attribute form, not the bare word).
	if strings.Contains(out, `" download`) {
		t.Errorf("Download=false must NOT emit the download attribute; got: %s", out)
	}
	if strings.Contains(out, "hx-boost") {
		t.Errorf("Download=false must NOT emit hx-boost; got: %s", out)
	}
}

// TestPrimaryActionDownload_True_EmitsBothAttrs proves Download=true emits both
// download and hx-boost="false" on the anchor, preserving the TestID.
func TestPrimaryActionDownload_True_EmitsBothAttrs(t *testing.T) {
	cfg := types.TableConfig{
		ID: "report-cards-student",
		PrimaryAction: &types.PrimaryAction{
			Label:    "Download PDF",
			Href:     "/report-cards/section/sec-1/client/c-1?format=pdf",
			TestID:   "rc-download-pdf",
			Download: true,
		},
	}
	out := renderNamed(t, "table-toolbar", cfg)

	if !strings.Contains(out, ` download`) {
		t.Errorf("Download=true must emit the download attribute; got: %s", out)
	}
	if !strings.Contains(out, `hx-boost="false"`) {
		t.Errorf("Download=true must emit hx-boost=\"false\" (body-boost opt-out); got: %s", out)
	}
	if !strings.Contains(out, `data-testid="rc-download-pdf"`) {
		t.Errorf("Download=true must preserve data-testid=rc-download-pdf; got: %s", out)
	}
	if !strings.Contains(out, `href="/report-cards/section/sec-1/client/c-1?format=pdf"`) {
		t.Errorf("Download=true must keep the href; got: %s", out)
	}
}

// TestPrimaryAction_ActionURL_Unaffected confirms the additive field does not
// touch the ActionURL (drawer) branch — the one live PrimaryAction consumer
// (template_settings) uses ActionURL, so it must render exactly as before.
func TestPrimaryAction_ActionURL_Unaffected(t *testing.T) {
	cfg := types.TableConfig{
		ID: "outcome-template-settings",
		PrimaryAction: &types.PrimaryAction{
			Label:     "Manage template",
			ActionURL: "/action/outcome/template-settings/x",
			TestID:    "ts-primary",
		},
	}
	out := renderNamed(t, "table-toolbar", cfg)

	if !strings.Contains(out, `hx-get="/action/outcome/template-settings/x"`) {
		t.Errorf("ActionURL branch must still render the hx-get drawer button; got: %s", out)
	}
	if strings.Contains(out, "download") || strings.Contains(out, `hx-boost="false"`) {
		t.Errorf("ActionURL branch must not gain download/hx-boost; got: %s", out)
	}
}

// --- Table row actions: HxGet + DrawerTitle contract -------------------------

func TestTableAction_HxGetDrawerRendersNativeButton(t *testing.T) {
	row := types.TableRow{
		ID: "row-1",
		Actions: []types.TableAction{
			{
				Type:        "edit",
				Label:       "Edit grade",
				Action:      "edit",
				HxGet:       "/grades/grade-1/edit",
				HxTarget:    "#sheetContent",
				HxSwap:      "innerHTML",
				DrawerTitle: "Edit grade",
			},
		},
	}
	outDesktop := renderNamed(t, "table-data-row", row)
	outMobile := renderNamed(t, "table-row-actions", map[string]any{
		"Actions": row.Actions,
		"RowID":   row.ID,
	})

	desktopNeedles := []string{
		`<button type="button" class="action-btn edit"`,
		`aria-label="Edit grade"`,
		`title="Edit grade"`,
		`hx-get="/grades/grade-1/edit"`,
		`hx-target="#sheetContent"`,
		`hx-swap="innerHTML"`,
		`hx-push-url="false"`,
		`data-lf-action="sheet-open"`,
		`data-lf-sheet-title="Edit grade"`,
		`aria-haspopup="dialog"`,
		`data-testid="edit-row-row-1"`,
	}
	for _, needle := range desktopNeedles {
		if !strings.Contains(outDesktop, needle) {
			t.Errorf("desktop HxGet action missing %q; got: %s", needle, outDesktop)
		}
	}
	if strings.Contains(outDesktop, `data-lf-onclick=`) {
		t.Errorf("desktop HxGet with DrawerTitle must not emit generic OnClick; got: %s", outDesktop)
	}
	if strings.Contains(outDesktop, "<a ") {
		t.Errorf("desktop HxGet drawer action must not render <a>; got: %s", outDesktop)
	}

	if !strings.Contains(outMobile, `<button type="button" class="action-btn edit"`) {
		t.Errorf("mobile HxGet action must render a native button; got: %s", outMobile)
	}
	if !strings.Contains(outMobile, `data-lf-action="sheet-open"`) {
		t.Errorf("mobile HxGet with DrawerTitle must emit sheet-open attribute; got: %s", outMobile)
	}
	if !strings.Contains(outMobile, `aria-haspopup="dialog"`) {
		t.Errorf("mobile HxGet with DrawerTitle must emit aria-haspopup=dialog; got: %s", outMobile)
	}
}

func TestTableAction_DisabledHxGetDrawerIsInert(t *testing.T) {
	row := types.TableRow{
		ID: "row-1",
		Actions: []types.TableAction{
			{
				Type:            "edit",
				Label:           "Edit grade",
				Action:          "edit",
				HxGet:           "/grades/grade-1/edit",
				DrawerTitle:     "Edit grade",
				Disabled:        true,
				DisabledTooltip: "Locked",
			},
		},
	}
	outDesktop := renderNamed(t, "table-data-row", row)
	outMobile := renderNamed(t, "table-row-actions", map[string]any{
		"Actions": row.Actions,
		"RowID":   row.ID,
	})

	for _, out := range []string{outDesktop, outMobile} {
		if !strings.Contains(out, `aria-disabled="true"`) {
			t.Errorf("disabled action must be inert with aria-disabled=true; got: %s", out)
		}
		if strings.Contains(out, `hx-get="/grades/grade-1/edit"`) {
			t.Errorf("disabled HxGet action must not retain hx-get; got: %s", out)
		}
		if strings.Contains(out, `data-lf-action="sheet-open"`) {
			t.Errorf("disabled HxGet action must not emit sheet-open action attr; got: %s", out)
		}
		if strings.Contains(out, `<button class="action-btn edit`) {
			t.Errorf("disabled HxGet desktop action must not use action-btn button; got: %s", out)
		}
	}
}

func TestTableAction_HxGetDrawerLegacyOnClick(t *testing.T) {
	row := types.TableRow{
		ID: "row-1",
		Actions: []types.TableAction{
			{
				Type:    "edit",
				Label:   "Edit grade",
				Action:  "edit",
				HxGet:   "/grades/grade-1/edit",
				OnClick: "lf.Sheet.open()",
			},
		},
	}
	out := renderNamed(t, "table-data-row", row)

	if !strings.Contains(out, `data-lf-onclick="lf.Sheet.open()"`) {
		t.Errorf("empty DrawerTitle must preserve generic onclick bridge; got: %s", out)
	}
	if strings.Contains(out, `data-lf-action="sheet-open"`) {
		t.Errorf("empty DrawerTitle must not emit sheet-open action attrs; got: %s", out)
	}
	if !strings.Contains(out, `hx-push-url="false"`) {
		t.Errorf("legacy HxGet branch must still keep push-url false; got: %s", out)
	}
}

// --- Typed composite cell -----------------------------------------------------

// TestCompositeCell_Render_ChipsCountEye covers the full composite render:
// count, per-status chips, and the eye deep-link, with a11y name, encoded href,
// collision-proof test ID, and a clean data-csv.
func TestCompositeCell_Render_ChipsCountEye(t *testing.T) {
	cell := types.BuildCompositeCell(types.CompositeCellParams{
		Count: 12,
		Chips: []types.CompositeStatusChip{
			{Label: "Published", Count: 4, Variant: "success"},
			{Label: "For review", Count: 4, Variant: "warning"},
		},
		BasePath:     "/report-cards/section/sec-1",
		QueryKey:     "jc",
		SectionID:    "sec-1",
		CategoryID:   "cat-1",
		SectionName:  "Grade 5 Diamond",
		CategoryName: "Core",
	})
	row := types.TableRow{ID: "row-1", Cells: []types.TableCell{cell}}
	out := renderNamed(t, "table-data-row", row)

	// Count.
	if !strings.Contains(out, `<span class="composite-count">12</span>`) {
		t.Errorf("composite count 12 missing; got: %s", out)
	}
	// Chips render as pyeza status tokens (not emoji), carrying count + label.
	if !strings.Contains(out, `<span class="status-badge success">4 Published</span>`) {
		t.Errorf("published status chip missing; got: %s", out)
	}
	if !strings.Contains(out, `<span class="status-badge warning">4 For review</span>`) {
		t.Errorf("for-review status chip missing; got: %s", out)
	}
	// Eye deep-link: encoded href, testid, focusable action-btn, icon-eye.
	if !strings.Contains(out, `href="/report-cards/section/sec-1?jc=cat-1"`) {
		t.Errorf("eye href (query-encoded) missing; got: %s", out)
	}
	if !strings.Contains(out, `data-testid="rc-eye-sec-1-cat-1"`) {
		t.Errorf("collision-proof eye test id missing; got: %s", out)
	}
	if !strings.Contains(out, `class="action-btn view"`) {
		t.Errorf("eye must be a focusable .action-btn (visible focus ring); got: %s", out)
	}
	// a11y name names category AND section (pyeza renders first cell as <td>, so
	// the section is not implicit in the link name).
	if !strings.Contains(out, `aria-label="Core`) || !strings.Contains(out, `Grade 5 Diamond"`) {
		t.Errorf("eye aria-label must name category AND section; got: %s", out)
	}
	// CSV export = the count scalar (not blank, not the whole cell text).
	if !strings.Contains(out, `data-csv="12"`) {
		t.Errorf("composite CSV must export the count; got: %s", out)
	}
}

// TestCompositeCell_Render_Fallback_NoEye covers the unknown/foreign/inactive/
// NULL-category fallback: no CategoryID ⇒ no eye link, just the bare count.
func TestCompositeCell_Render_Fallback_NoEye(t *testing.T) {
	cell := types.BuildCompositeCell(types.CompositeCellParams{
		Count:       3,
		BasePath:    "/report-cards/section/sec-1",
		SectionID:   "sec-1",
		CategoryID:  "", // unknown/foreign/NULL category
		SectionName: "Grade 5 Diamond",
	})
	row := types.TableRow{ID: "row-1", Cells: []types.TableCell{cell}}
	out := renderNamed(t, "table-data-row", row)

	if !strings.Contains(out, `<span class="composite-count">3</span>`) {
		t.Errorf("fallback must still render the count; got: %s", out)
	}
	if strings.Contains(out, "rc-eye-") {
		t.Errorf("fallback must NOT render an eye test id; got: %s", out)
	}
	if strings.Contains(out, `class="action-btn view"`) {
		t.Errorf("fallback must NOT render an eye link; got: %s", out)
	}
	if !strings.Contains(out, `data-csv="3"`) {
		t.Errorf("fallback CSV must still export the count; got: %s", out)
	}
}

// TestCompositeCell_Render_NoPayload_Regression proves the new dispatch branch is
// inert for non-composite cells: a plain number cell renders exactly as today,
// with no composite chrome leaking in.
func TestCompositeCell_Render_NoPayload_Regression(t *testing.T) {
	row := types.TableRow{ID: "row-1", Cells: []types.TableCell{
		{Type: "number", Value: "7"},
	}}
	out := renderNamed(t, "table-data-row", row)

	if !strings.Contains(out, `<span class="number-value">7</span>`) {
		t.Errorf("number cell must render unchanged; got: %s", out)
	}
	if !strings.Contains(out, `data-csv="7"`) {
		t.Errorf("number cell CSV must be unchanged; got: %s", out)
	}
	for _, leak := range []string{"composite-count", "table-cell-chips", "rc-eye-", "action-btn"} {
		if strings.Contains(out, leak) {
			t.Errorf("non-composite cell must not contain %q; got: %s", leak, out)
		}
	}
}
