package types

import "html/template"

// DashboardData is the input contract for the pyeza "dashboard" component block.
//
// Pass it to the block via:
//
//	{{template "dashboard" .Dashboard}}
//
// where .Dashboard is a DashboardData populated by the view layer.
type DashboardData struct {
	Title    string
	Subtitle string
	Icon     string

	QuickActions []QuickAction
	Stats        []StatCardData
	Widgets      []DashboardWidget

	Class      string
	RefreshURL string
}

// QuickAction is one button in a dashboard quick-actions row.
type QuickAction struct {
	Icon       string
	Label      string
	Href       string
	Variant    string // "primary" | "secondary" | "ghost" — defaults to secondary
	Permission string // when set, the row template hides the action if the user lacks it
	TestID     string
}

// StatCardData mirrors the existing stat-card component's dict input,
// re-typed so views can build a typed slice.
type StatCardData struct {
	Icon    string
	Value   string
	Label   string
	Trend   string
	TrendUp bool
	Color   string // "terracotta" | "sage" | "navy" | "amber"
	TestID  string
}

// DashboardWidget is one card slot in the widgets grid.
//
// .Type drives which sub-template renders inside the widget body:
//
//	"chart"      → chart-{Kind} (line|bar|pie|donut|area|sparkline)
//	"table"      → table-card  (Table must be set)
//	"list"       → activity-list (ListItems must be set)
//	"stat-group" → tiled stat-card cluster (StatGroup must be set)
//	"custom"     → Custom (raw template.HTML)
type DashboardWidget struct {
	ID       string
	Title    string
	Subtitle string
	Type     string

	ChartKind string     // when Type=chart
	ChartData *ChartData // when Type=chart

	Table any // when Type=table — usually pyeza/types.TableConfig

	ListItems []ActivityItem // when Type=list

	StatGroup []StatCardData // when Type=stat-group

	Custom template.HTML // when Type=custom

	HeaderActions []QuickAction
	Footer        template.HTML
	Span          int // grid column span: 1 (default), 2, or 3
	EmptyState    *EmptyStateData

	TestID string
}

// EmptyStateData is rendered when a widget has no rows / no series / no items.
type EmptyStateData struct {
	Icon  string
	Title string
	Desc  string
}

// ChartData is the normalized input shape for every chart-* component.
// Same data, different visualization — that's the swappability contract.
type ChartData struct {
	Labels   []string      // x-axis labels (line/bar/area) or slice labels (pie/donut)
	Series   []ChartSeries // 1+ series; multi-series rendered as overlay
	Stacked  bool          // bar/area only
	Donut    bool          // pie variant — center hole
	Currency string        // "PHP","USD" etc — when set, values are centavos and the chart divides ÷100 at render
	YMin     float64
	YMax     float64 // when 0, the chart auto-scales using AutoScale()
	XAxis    string
	YAxis    string
}

// ChartSeries is one named line/bar series.
type ChartSeries struct {
	Name   string
	Values []float64
	Color  string // token name: "terracotta"|"sage"|"navy"|"amber"|"plum"|"teal"; empty = auto
}

// AutoScale fills YMin/YMax from the series values if YMax is unset.
// Called by views before passing ChartData to the template.
func (c *ChartData) AutoScale() {
	if c == nil || len(c.Series) == 0 {
		return
	}
	if c.YMax != 0 {
		return
	}
	var max float64
	for _, s := range c.Series {
		for _, v := range s.Values {
			if v > max {
				max = v
			}
		}
	}
	if max == 0 {
		c.YMax = 1
		return
	}
	c.YMax = max * 1.1
}

// ActivityItem is one row in a list-type widget (recent-activity feed).
type ActivityItem struct {
	IconName    string
	IconVariant string // "client"|"award"|"integration"|"quote" — drives the bg color
	Title       string
	Description string
	Time        string
	Href        string
	TestID      string
}
