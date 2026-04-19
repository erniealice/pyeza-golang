package pyeza

import "fmt"

// FormatDuration returns a display string such as "3 months" or "1 month".
// value is the count; unit is the canonical plural stem stored in the DB
// ("days", "weeks", "months", "years"). Unknown stems fall back to
// "<value> <unit>" unmodified.
func FormatDuration(value int32, unit string, labels DurationUnitLabels) string {
	singular := value == 1
	switch unit {
	case "days":
		if singular {
			return fmt.Sprintf("%d %s", value, labels.DaySingular)
		}
		return fmt.Sprintf("%d %s", value, labels.DayPlural)
	case "weeks":
		if singular {
			return fmt.Sprintf("%d %s", value, labels.WeekSingular)
		}
		return fmt.Sprintf("%d %s", value, labels.WeekPlural)
	case "months":
		if singular {
			return fmt.Sprintf("%d %s", value, labels.MonthSingular)
		}
		return fmt.Sprintf("%d %s", value, labels.MonthPlural)
	case "years":
		if singular {
			return fmt.Sprintf("%d %s", value, labels.YearSingular)
		}
		return fmt.Sprintf("%d %s", value, labels.YearPlural)
	}
	return fmt.Sprintf("%d %s", value, unit)
}
