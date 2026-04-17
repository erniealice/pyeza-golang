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

// MoneyCell is a convenience constructor that creates a TableCell of type "money".
// The raw amount (in centavos if centMode is true) is formatted and stored in Value;
// the Currency field is set for template rendering.
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
// Useful when the amount comes from a database as a string.
func ParseMoneyAmount(s string) (float64, error) {
	return strconv.ParseFloat(s, 64)
}
