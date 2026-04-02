package types

import (
	"strconv"
	"strings"
)

// ChipData holds label for a single chip in table cell display
type ChipData struct {
	Label string
	Color string // hex color code e.g. "#3B82F6"
}

// BuildChipCellFromChips creates a chips-type TableCell from a slice of ChipData.
// Shows up to maxVisible chips; the rest become overflow count.
// ChipTooltip contains all labels joined by ", ".
func BuildChipCellFromChips(chips []ChipData, maxVisible int) TableCell {
	if len(chips) == 0 {
		return TableCell{Type: "chips"}
	}

	var labels []string
	for _, c := range chips {
		labels = append(labels, c.Label)
	}

	var visible []ChipData
	var overflow int
	if len(chips) <= maxVisible {
		visible = chips
	} else {
		visible = chips[:maxVisible]
		overflow = len(chips) - maxVisible
	}

	return TableCell{
		Type:         "chips",
		Chips:        visible,
		ChipOverflow: overflow,
		ChipTooltip:  strings.Join(labels, ", "),
	}
}

// BuildChipCellFromLabels creates a chips-type TableCell from a slice of label
// strings. Shows up to maxVisible chips; the rest become "+N more".
// ChipTooltip contains all labels joined by ", ".
func BuildChipCellFromLabels(labels []string, maxVisible int) TableCell {
	if len(labels) == 0 {
		return TableCell{Type: "chips"}
	}

	var chips []ChipData
	var overflow int
	if len(labels) <= maxVisible {
		for _, label := range labels {
			chips = append(chips, ChipData{Label: label})
		}
	} else {
		for _, label := range labels[:maxVisible] {
			chips = append(chips, ChipData{Label: label})
		}
		overflow = len(labels) - maxVisible
	}

	return TableCell{
		Type:         "chips",
		Chips:        chips,
		ChipOverflow: overflow,
		ChipTooltip:  strings.Join(labels, ", "),
	}
}

// BuildChipCell creates a chips-type TableCell from comma-separated IDs
// and a name map. Shows up to maxVisible chips; the rest become "+N more".
// Trims whitespace around IDs (handles "1, 2, 3" and "1,2,3").
// ChipTooltip contains all resolved names joined by ", ".
func BuildChipCell(commaSeparatedIDs string, nameMap map[int64]string, maxVisible int) TableCell {
	if commaSeparatedIDs == "" {
		return TableCell{Type: "chips"}
	}

	// Parse IDs with whitespace trimming
	idStrs := strings.Split(commaSeparatedIDs, ",")
	var names []string
	for _, idStr := range idStrs {
		idStr = strings.TrimSpace(idStr)
		if idStr == "" {
			continue
		}
		id, err := strconv.ParseInt(idStr, 10, 64)
		if err != nil {
			continue
		}
		if name, ok := nameMap[id]; ok {
			names = append(names, name)
		}
	}

	if len(names) == 0 {
		return TableCell{Type: "chips"}
	}

	// Build chips and overflow
	var chips []ChipData
	var overflow int
	if len(names) <= maxVisible {
		for _, name := range names {
			chips = append(chips, ChipData{Label: name})
		}
	} else {
		for _, name := range names[:maxVisible] {
			chips = append(chips, ChipData{Label: name})
		}
		overflow = len(names) - maxVisible
	}

	return TableCell{
		Type:         "chips",
		Chips:        chips,
		ChipOverflow: overflow,
		ChipTooltip:  strings.Join(names, ", "),
	}
}
