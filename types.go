package pyeza

import "github.com/erniealice/pyeza-golang/types"

// Re-export all types for backwards compatibility

// PageData holds base data passed to all page templates
type PageData = types.PageData

// Table types
type TableColumn = types.TableColumn
type ColumnGroup = types.ColumnGroup
type SelectOption = types.SelectOption
type TableCell = types.TableCell
type TableAction = types.TableAction
type TableRow = types.TableRow
type TableRowGroup = types.TableRowGroup
type TableEmptyState = types.TableEmptyState
type TableLabels = types.TableLabels
type PrimaryAction = types.PrimaryAction
type ImportAction = types.ImportAction
type BulkAction = types.BulkAction
type BulkActionsConfig = types.BulkActionsConfig
type TableConfig = types.TableConfig
type ServerPagination = types.ServerPagination
type PageNumber = types.PageNumber

// Chip types
type ChipData = types.ChipData

// Helper functions
var ApplyColumnStyles = types.ApplyColumnStyles
var ApplyTableSettings = types.ApplyTableSettings
var BuildChipCell = types.BuildChipCell
var BuildChipCellFromLabels = types.BuildChipCellFromLabels
