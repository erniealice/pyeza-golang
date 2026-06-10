package pyeza

import "github.com/erniealice/pyeza-golang/types"

// MapTableLabels and MapBulkConfig are the canonical mappers from the
// framework CommonLabels into the flat table/bulk widget label shapes.
// Promoted to pyeza from the centymo/entydad/fycha view packages, which
// each carried a byte-identical copy (Wave P, 2026-06-10).

func MapTableLabels(common CommonLabels) types.TableLabels {
	return types.TableLabels{
		Search:                   common.Table.Search,
		SearchPlaceholder:        common.Table.SearchPlaceholder,
		Filters:                  common.Table.Filters,
		FilterConditions:         common.Table.FilterConditions,
		ClearAll:                 common.Table.ClearAll,
		AddCondition:             common.Table.AddCondition,
		Clear:                    common.Table.Clear,
		ApplyFilters:             common.Table.ApplyFilters,
		Sort:                     common.Table.Sort,
		Columns:                  common.Table.Columns,
		Export:                   common.Table.Export,
		DensityLabel:             common.Table.Density.Title,
		DensityDense:             common.Table.Density.Dense,
		DensityDefault:           common.Table.Density.Default,
		DensityComfortable:       common.Table.Density.Comfortable,
		DensityCompact:           common.Table.Density.Compact,
		EntriesPerPage:           common.Table.EntriesLabel,
		Show:                     common.Table.Show,
		Entries:                  common.Table.Entries,
		Showing:                  common.Table.Showing,
		To:                       common.Table.To,
		Of:                       common.Table.Of,
		EntriesLabel:             common.Table.EntriesLabel,
		SelectAll:                common.Table.SelectAll,
		BulkSelectAllPage:        common.Table.BulkSelectAllPage,
		BulkSelectAllAcrossPages: common.Table.BulkSelectAllAcrossPages,
		BulkClearSelection:       common.Table.BulkClearSelection,
		ColumnSortLockedHint:     common.Table.ColumnSortLockedHint,
		SortAscText:              common.Table.SortAscText,
		SortDescText:             common.Table.SortDescText,
		SortAscNumber:            common.Table.SortAscNumber,
		SortDescNumber:           common.Table.SortDescNumber,
		SortAscDate:              common.Table.SortAscDate,
		SortDescDate:             common.Table.SortDescDate,
		SortAscEnum:              common.Table.SortAscEnum,
		SortDescEnum:             common.Table.SortDescEnum,
		FilterOpContains:         common.Table.FilterOpContains,
		FilterOpEquals:           common.Table.FilterOpEquals,
		FilterOpStartsWith:       common.Table.FilterOpStartsWith,
		FilterOpEndsWith:         common.Table.FilterOpEndsWith,
		FilterOpNotEquals:        common.Table.FilterOpNotEquals,
		FilterOpBetween:          common.Table.FilterOpBetween,
		FilterOpEq:               common.Table.FilterOpEq,
		FilterOpNeq:              common.Table.FilterOpNeq,
		FilterOpGt:               common.Table.FilterOpGt,
		FilterOpGte:              common.Table.FilterOpGte,
		FilterOpLt:               common.Table.FilterOpLt,
		FilterOpLte:              common.Table.FilterOpLte,
		FilterOpOn:               common.Table.FilterOpOn,
		FilterOpBefore:           common.Table.FilterOpBefore,
		FilterOpAfter:            common.Table.FilterOpAfter,
		FilterOpIn:               common.Table.FilterOpIn,
		FilterOpNotIn:            common.Table.FilterOpNotIn,
		FilterPresetToday:        common.Table.FilterPresetToday,
		FilterPreset7d:           common.Table.FilterPreset7d,
		FilterPreset30d:          common.Table.FilterPreset30d,
		FilterPresetMonth:        common.Table.FilterPresetMonth,
		FilterPresetCustom:       common.Table.FilterPresetCustom,
		FilterAny:                common.Table.FilterAny,
		FilterYes:                common.Table.FilterYes,
		FilterNo:                 common.Table.FilterNo,
		FilterSearchPlaceholder:  common.Table.FilterSearchPlaceholder,
		FilterMinPlaceholder:     common.Table.FilterMinPlaceholder,
		FilterMaxPlaceholder:     common.Table.FilterMaxPlaceholder,
		Actions:                  common.Table.Actions,
		Prev:                     common.Pagination.Prev,
		Next:                     common.Pagination.Next,
	}
}

func MapBulkConfig(common CommonLabels) types.BulkActionsConfig {
	return types.BulkActionsConfig{
		Enabled:        true,
		SelectAllLabel: common.Bulk.SelectAll,
		SelectedLabel:  common.Bulk.Selected,
		CancelLabel:    common.Bulk.ClearSelection,
	}
}
