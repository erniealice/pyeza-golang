package types

import (
	"fmt"
	"math"
	"strconv"
	"strings"
)

// formatMoney formats a raw amount into a display-ready money string.
// If centMode is true, the amount is divided by 100 (e.g., 5000000 -> 50000.00).
// Returns the formatted number string (e.g., "50,000.00") and the currency code separately.
func formatMoney(amount float64, currency string, centMode bool) (formatted string, curr string) {
	if centMode {
		amount = amount / 100
	}

	negative := amount < 0
	if negative {
		amount = math.Abs(amount)
	}

	// Format with 2 decimal places
	raw := fmt.Sprintf("%.2f", amount)

	// Split into integer and decimal parts
	parts := strings.SplitN(raw, ".", 2)
	intPart := parts[0]
	decPart := parts[1]

	// Add comma separators to integer part
	intPart = addCommas(intPart)

	formatted = intPart + "." + decPart
	if negative {
		formatted = "-" + formatted
	}

	return formatted, currency
}

// FormatMoney returns a display-ready money string of the form
// "<currency> <amount>" — e.g. FormatMoney(5_000_000, "PHP") → "PHP 50,000.00".
//
// This is the canonical formatter for money values rendered outside the typed
// table component (drawer forms, dashboard headlines, recent-activity feeds,
// search-result labels, anywhere a Go-side string is needed). It mirrors the
// visual rendering of MoneyCell in table-cell-money.html — currency code as
// prefix — so table values and standalone strings stay consistent.
//
// Convention (binding): pass int64 centavos directly. Negative values are
// rendered with a leading "-" before the number ("PHP -1,234.56"). When
// currency is empty, the prefix and space are omitted ("1,234.56"). For
// compact display in chart axes / KPI tiles, use FormatMoneyCompact.
//
// DO NOT hardcode the peso glyph (₱) or any other currency symbol in callers.
// FormatMoney accepts the workspace's functional_currency at runtime; that
// is the source of truth for what the user sees.
func FormatMoney(centavos int64, currency string) string {
	formatted, _ := formatMoney(float64(centavos), currency, true)
	if currency == "" {
		return formatted
	}
	return currency + " " + formatted
}

// FormatMoneyCompact returns a short-form money string for chart tick labels
// and KPI tiles, e.g. FormatMoneyCompact(120_000_000, "PHP") → "PHP 1.2M".
//
// Thresholds (on absolute peso value):
//   - >= 1,000,000  → "1.2M"   (one decimal)
//   - >= 100,000    → "120K"   (zero decimals)
//   - >= 1,000      → "1.2K"   (one decimal)
//   - else          → "999"    (zero decimals, no separator)
//
// Negatives keep the "-" before the number ("PHP -1.2M"). Empty currency
// omits the prefix. Pair with FormatMoney for the long form on hover/detail.
func FormatMoneyCompact(centavos int64, currency string) string {
	pesos := float64(centavos) / 100
	abs := pesos
	if abs < 0 {
		abs = -abs
	}
	var num string
	switch {
	case abs >= 1_000_000:
		num = fmt.Sprintf("%.1fM", pesos/1_000_000)
	case abs >= 100_000:
		num = fmt.Sprintf("%.0fK", pesos/1_000)
	case abs >= 1_000:
		num = fmt.Sprintf("%.1fK", pesos/1_000)
	default:
		num = fmt.Sprintf("%.0f", pesos)
	}
	if currency == "" {
		return num
	}
	return currency + " " + num
}

// MoneyCell is a convenience constructor that creates a TableCell of type "money".
//
// Project convention (binding): the database stores centavos as int64, and Go
// variables that name a money field hold centavos. Every caller must pass the
// centavo value as float64(centavos) with centMode=true; MoneyCell divides by
// 100 internally for display.
//
//	types.MoneyCell(float64(asset.BookValue), "PHP", true)   // CORRECT
//
// Anti-patterns:
//   - centMode=false against a centavo value renders 100× too high.
//   - Pre-dividing by 100 AND centMode=true renders 100× too small.
//
// Use centMode=false ONLY for values genuinely already in pesos (rare; e.g.,
// user-typed display strings). For DB-sourced values: always centMode=true.
//
// For input parsing (string → centavos): use types.ParseCentavos, NOT
// strconv.ParseFloat or fmt.Sscanf — those introduce float drift.
func MoneyCell(amount float64, currency string, centMode bool) TableCell {
	formatted, curr := formatMoney(amount, currency, centMode)
	return TableCell{
		Type:     "money",
		Value:    formatted,
		Currency: curr,
		Align:    "right",
	}
}

// addCommas inserts thousand-separator commas into a numeric string.
// e.g., "50000" -> "50,000"
func addCommas(s string) string {
	n := len(s)
	if n <= 3 {
		return s
	}

	// Calculate how many digits before the first comma
	firstGroup := n % 3
	if firstGroup == 0 {
		firstGroup = 3
	}

	var b strings.Builder
	b.Grow(n + (n-1)/3)
	b.WriteString(s[:firstGroup])

	for i := firstGroup; i < n; i += 3 {
		b.WriteByte(',')
		b.WriteString(s[i : i+3])
	}

	return b.String()
}

// ParseMoneyAmount parses a string amount to float64.
//
// Deprecated: float-based money parsing introduces drift on the cent-precision
// boundary. New code MUST use ParseCentavos. This function is retained only
// for legacy display callers that genuinely need a float (rare) and is
// scheduled for removal once the last caller migrates.
func ParseMoneyAmount(s string) (float64, error) {
	return strconv.ParseFloat(s, 64)
}

// ParseCentavos parses a decimal-peso input string into int64 centavos.
//
// Rules:
//   - "1234.56"  → 123456
//   - "1234"     → 123400
//   - "1234.5"   → 123450  (right-padded fraction to 2 digits)
//   - "-12.34"   → -1234
//   - "  100  "  → 10000   (whitespace trimmed)
//   - more than 2 decimal places → error
//   - empty string after trimming → error
//   - non-numeric chars (other than leading "-" and a single ".") → error
//
// Implementation does NOT use float64. Splits on ".", parses two int64s,
// combines as whole*100 + signed-frac.
func ParseCentavos(s string) (int64, error) {
	s = strings.TrimSpace(s)
	if s == "" {
		return 0, fmt.Errorf("parseCentavos: empty input")
	}

	negative := false
	if s[0] == '-' {
		negative = true
		s = s[1:]
		if s == "" {
			return 0, fmt.Errorf("parseCentavos: no digits after minus sign")
		}
	}

	// Reject any character that is not a digit or a single dot.
	dotCount := 0
	for _, c := range s {
		if c == '.' {
			dotCount++
			if dotCount > 1 {
				return 0, fmt.Errorf("parseCentavos: multiple decimal points in %q", s)
			}
		} else if c < '0' || c > '9' {
			return 0, fmt.Errorf("parseCentavos: invalid character %q", c)
		}
	}

	// Split on "."
	parts := strings.SplitN(s, ".", 2)
	wholePart := parts[0]

	// Parse whole part (may be empty if input was e.g. ".5" — reject that)
	if wholePart == "" {
		return 0, fmt.Errorf("parseCentavos: no integer part in %q", s)
	}
	whole, err := strconv.ParseInt(wholePart, 10, 64)
	if err != nil {
		return 0, fmt.Errorf("parseCentavos: cannot parse whole part %q: %w", wholePart, err)
	}

	var frac int64
	if len(parts) == 2 {
		fracStr := parts[1]
		switch len(fracStr) {
		case 0:
			frac = 0
		case 1:
			// Right-pad to 2 digits: "5" → "50"
			d, err2 := strconv.ParseInt(fracStr, 10, 64)
			if err2 != nil {
				return 0, fmt.Errorf("parseCentavos: cannot parse fraction %q: %w", fracStr, err2)
			}
			frac = d * 10
		case 2:
			frac, err = strconv.ParseInt(fracStr, 10, 64)
			if err != nil {
				return 0, fmt.Errorf("parseCentavos: cannot parse fraction %q: %w", fracStr, err)
			}
		default:
			return 0, fmt.Errorf("parseCentavos: more than 2 decimal places in %q", s)
		}
	}

	result := whole*100 + frac
	if negative {
		result = -result
	}
	return result, nil
}
