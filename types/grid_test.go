package types

import (
	"bytes"
	"html/template"
	"strings"
	"testing"
)

func renderGridPart(t *testing.T, name string, grid *CellGridConfig) string {
	t.Helper()
	funcs := template.FuncMap{
		"add": func(a, b int) int { return a + b },
		"dict": func(values ...any) map[string]any {
			m := make(map[string]any)
			for i := 0; i+1 < len(values); i += 2 {
				m[values[i].(string)] = values[i+1]
			}
			return m
		},
		"gridSlot":      func(grid, actions any) any { return actions },
		"renderContent": func(string, any) template.HTML { return "" },
	}
	tmpl, err := template.New("grid").Funcs(funcs).ParseFiles(
		"../web/templates/components/grid/cell-grid-head.html",
		"../web/templates/components/grid/cell-grid-body.html",
		"../web/templates/components/grid/cell-grid-cell.html",
	)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := tmpl.Parse(`{{define "icon-message-square"}}{{end}}`); err != nil {
		t.Fatal(err)
	}
	var out bytes.Buffer
	if err := tmpl.ExecuteTemplate(&out, name, grid); err != nil {
		t.Fatal(err)
	}
	return out.String()
}

func gridForCriterionTest() *CellGridConfig {
	return &CellGridConfig{
		Columns: []CellGridLevel1{{Level2: []CellGridLevel2{{Level3: []CellGridLevel3{{ColumnKey: "criterion", Label: "Objective A:\nKnowing"}}}}}},
		Rows:    []CellGridRow{{ID: "client", Cells: map[string]CellGridCell{"criterion": {}}}},
	}
}

func TestCellGridCriteriaWidthClass(t *testing.T) {
	grid := gridForCriterionTest()
	for _, width := range []string{"8", "10", "12", "14", "16"} {
		grid.CriteriaWidth = width
		class := "lf-cell-grid__crit--w" + width
		for _, part := range []string{"cell-grid-head", "cell-grid-body"} {
			if got := renderGridPart(t, part, grid); !strings.Contains(got, class) {
				t.Errorf("%s width %s lacks class", part, width)
			}
		}
	}
	for _, width := range []string{"", "9", "12rem", `12" onclick="x`} {
		grid.CriteriaWidth = width
		if grid.CriteriaWidthClass() != "" {
			t.Errorf("width %q was accepted", width)
		}
		if got := renderGridPart(t, "cell-grid-head", grid) + renderGridPart(t, "cell-grid-body", grid); strings.Contains(got, "lf-cell-grid__crit--w") {
			t.Errorf("width %q rendered a class", width)
		}
	}
}

func TestCellGridHeadPreLineWhenBreakOn(t *testing.T) {
	grid := gridForCriterionTest()
	if got := renderGridPart(t, "cell-grid-head", grid); strings.Contains(got, "lf-cell-grid__crit--preline") {
		t.Fatal("zero-value grid enabled pre-line")
	}
	grid.HeadPreLine = true
	grid.Columns[0].Level2[0].Level3[0].Label = "Objective A:\n<script>"
	if got := renderGridPart(t, "cell-grid-head", grid); !strings.Contains(got, "lf-cell-grid__crit--preline") || !strings.Contains(got, "&lt;script&gt;") || strings.Contains(got, "<script>") {
		t.Fatal("pre-line header class or escaped label missing")
	}
}
