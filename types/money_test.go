package types

import (
	"testing"
)

func Test_formatMoney(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name          string
		amount        float64
		currency      string
		centMode      bool
		wantFormatted string
		wantCurrency  string
	}{
		{
			name:          "centMode PHP 50000.00",
			amount:        5000000,
			currency:      "PHP",
			centMode:      true,
			wantFormatted: "50,000.00",
			wantCurrency:  "PHP",
		},
		{
			name:          "centMode zero",
			amount:        0,
			currency:      "USD",
			centMode:      true,
			wantFormatted: "0.00",
			wantCurrency:  "USD",
		},
		{
			name:          "centMode small amount (1 centavo)",
			amount:        1,
			currency:      "PHP",
			centMode:      true,
			wantFormatted: "0.01",
			wantCurrency:  "PHP",
		},
		{
			name:          "centMode exact dollar",
			amount:        10000,
			currency:      "USD",
			centMode:      true,
			wantFormatted: "100.00",
			wantCurrency:  "USD",
		},
		{
			name:          "non-centMode normal amount",
			amount:        50000.00,
			currency:      "PHP",
			centMode:      false,
			wantFormatted: "50,000.00",
			wantCurrency:  "PHP",
		},
		{
			name:          "non-centMode with decimal",
			amount:        1234.56,
			currency:      "EUR",
			centMode:      false,
			wantFormatted: "1,234.56",
			wantCurrency:  "EUR",
		},
		{
			name:          "negative amount centMode",
			amount:        -5000000,
			currency:      "PHP",
			centMode:      true,
			wantFormatted: "-50,000.00",
			wantCurrency:  "PHP",
		},
		{
			name:          "negative amount non-centMode",
			amount:        -1234.56,
			currency:      "USD",
			centMode:      false,
			wantFormatted: "-1,234.56",
			wantCurrency:  "USD",
		},
		{
			name:          "large amount",
			amount:        123456789012,
			currency:      "JPY",
			centMode:      true,
			wantFormatted: "1,234,567,890.12",
			wantCurrency:  "JPY",
		},
		{
			name:          "small amount below 1000 no commas",
			amount:        999.99,
			currency:      "USD",
			centMode:      false,
			wantFormatted: "999.99",
			wantCurrency:  "USD",
		},
	}

	for _, tc := range tests {
		tc := tc
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			gotFormatted, gotCurrency := formatMoney(tc.amount, tc.currency, tc.centMode)
			if gotFormatted != tc.wantFormatted {
				t.Errorf("FormatMoney(%v, %q, %v) formatted = %q, want %q",
					tc.amount, tc.currency, tc.centMode, gotFormatted, tc.wantFormatted)
			}
			if gotCurrency != tc.wantCurrency {
				t.Errorf("FormatMoney(%v, %q, %v) currency = %q, want %q",
					tc.amount, tc.currency, tc.centMode, gotCurrency, tc.wantCurrency)
			}
		})
	}
}

func TestMoneyCell(t *testing.T) {
	t.Parallel()

	cell := MoneyCell(5000000, "PHP", true)

	if cell.Type != "money" {
		t.Errorf("MoneyCell type = %q, want %q", cell.Type, "money")
	}
	if cell.Value != "50,000.00" {
		t.Errorf("MoneyCell value = %q, want %q", cell.Value, "50,000.00")
	}
	if cell.Currency != "PHP" {
		t.Errorf("MoneyCell currency = %q, want %q", cell.Currency, "PHP")
	}
	if cell.Align != "right" {
		t.Errorf("MoneyCell align = %q, want %q", cell.Align, "right")
	}
}

func TestParseMoneyAmount(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name    string
		input   string
		want    float64
		wantErr bool
	}{
		{name: "integer string", input: "1000", want: 1000.0},
		{name: "decimal string", input: "1234.56", want: 1234.56},
		{name: "zero", input: "0", want: 0},
		{name: "negative", input: "-500.25", want: -500.25},
		{name: "invalid string", input: "abc", wantErr: true},
		{name: "empty string", input: "", wantErr: true},
	}

	for _, tc := range tests {
		tc := tc
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			got, err := ParseMoneyAmount(tc.input)
			if tc.wantErr {
				if err == nil {
					t.Errorf("ParseMoneyAmount(%q) expected error, got nil", tc.input)
				}
				return
			}
			if err != nil {
				t.Fatalf("ParseMoneyAmount(%q) unexpected error: %v", tc.input, err)
			}
			if got != tc.want {
				t.Errorf("ParseMoneyAmount(%q) = %v, want %v", tc.input, got, tc.want)
			}
		})
	}
}

func Test_formatMoney_BoundaryValues(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name          string
		amount        float64
		currency      string
		centMode      bool
		wantFormatted string
		wantCurrency  string
	}{
		{
			name:         "max int64 non-centMode",
			amount:       float64(9223372036854775807),
			currency:     "USD",
			centMode:     false,
			wantCurrency: "USD",
		},
		{
			name:         "min int64 non-centMode",
			amount:       float64(-9223372036854775808),
			currency:     "USD",
			centMode:     false,
			wantCurrency: "USD",
		},
		{
			name:         "max int64 centMode",
			amount:       float64(9223372036854775807),
			currency:     "PHP",
			centMode:     true,
			wantCurrency: "PHP",
		},
		{
			name:          "very small positive centMode",
			amount:        0.5,
			currency:      "USD",
			centMode:      true,
			wantFormatted: "0.01",
			wantCurrency:  "USD",
		},
		{
			name:          "empty currency",
			amount:        1000,
			currency:      "",
			centMode:      false,
			wantFormatted: "1,000.00",
			wantCurrency:  "",
		},
	}

	for _, tc := range tests {
		tc := tc
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			gotFormatted, gotCurrency := formatMoney(tc.amount, tc.currency, tc.centMode)
			// For max/min int64, just verify it doesn't panic and returns a non-empty string
			if gotFormatted == "" {
				t.Errorf("FormatMoney(%v, %q, %v) returned empty formatted string",
					tc.amount, tc.currency, tc.centMode)
			}
			if tc.wantFormatted != "" && gotFormatted != tc.wantFormatted {
				t.Errorf("FormatMoney(%v, %q, %v) formatted = %q, want %q",
					tc.amount, tc.currency, tc.centMode, gotFormatted, tc.wantFormatted)
			}
			if gotCurrency != tc.wantCurrency {
				t.Errorf("FormatMoney(%v, %q, %v) currency = %q, want %q",
					tc.amount, tc.currency, tc.centMode, gotCurrency, tc.wantCurrency)
			}
		})
	}
}

func TestParseMoneyAmount_EdgeCases(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name    string
		input   string
		want    float64
		wantErr bool
	}{
		{name: "negative zero", input: "-0", want: 0},
		{name: "scientific notation", input: "1e10", want: 1e10},
		{name: "negative scientific notation", input: "-1e10", want: -1e10},
		{name: "comma-formatted number", input: "1,234.56", wantErr: true},
		{name: "leading whitespace", input: " 100", wantErr: true},
		{name: "trailing whitespace", input: "100 ", wantErr: true},
		{name: "both whitespace", input: " 100 ", wantErr: true},
		{name: "leading zeros", input: "00100", want: 100},
		{name: "leading zeros decimal", input: "007.50", want: 7.50},
		{name: "just a dot", input: ".", wantErr: true},
		{name: "double dot", input: "1.2.3", wantErr: true},
		{name: "dollar sign", input: "$100", wantErr: true},
		{name: "multiple negatives", input: "--100", wantErr: true},
		{name: "plus sign", input: "+100", want: 100},
		{name: "very long decimal", input: "0.123456789012345678901234567890", want: 0.12345678901234568},
	}

	for _, tc := range tests {
		tc := tc
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			got, err := ParseMoneyAmount(tc.input)
			if tc.wantErr {
				if err == nil {
					t.Errorf("ParseMoneyAmount(%q) expected error, got %v", tc.input, got)
				}
				return
			}
			if err != nil {
				t.Fatalf("ParseMoneyAmount(%q) unexpected error: %v", tc.input, err)
			}
			if got != tc.want {
				t.Errorf("ParseMoneyAmount(%q) = %v, want %v", tc.input, got, tc.want)
			}
		})
	}
}

// TestParseMoneyAmount_NaNInf documents that ParseMoneyAmount (strconv.ParseFloat)
// accepts "NaN" and "Inf" strings without error. Callers must validate if needed.
func TestParseMoneyAmount_NaNInf(t *testing.T) {
	t.Parallel()

	nanCases := []string{"NaN"}
	for _, s := range nanCases {
		got, err := ParseMoneyAmount(s)
		if err != nil {
			t.Errorf("ParseMoneyAmount(%q) returned error: %v", s, err)
		}
		if got == got { // NaN != NaN
			t.Errorf("ParseMoneyAmount(%q) = %v, expected NaN", s, got)
		}
	}

	infCases := []struct {
		input    string
		positive bool
	}{
		{"Inf", true},
		{"+Inf", true},
		{"-Inf", false},
	}
	for _, tc := range infCases {
		got, err := ParseMoneyAmount(tc.input)
		if err != nil {
			t.Errorf("ParseMoneyAmount(%q) returned error: %v", tc.input, err)
		}
		if tc.positive && got <= 0 {
			t.Errorf("ParseMoneyAmount(%q) = %v, expected +Inf", tc.input, got)
		}
		if !tc.positive && got >= 0 {
			t.Errorf("ParseMoneyAmount(%q) = %v, expected -Inf", tc.input, got)
		}
	}
}

func TestParseCentavos(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name    string
		input   string
		want    int64
		wantErr bool
	}{
		{name: "two decimal places", input: "1234.56", want: 123456},
		{name: "integer only", input: "1234", want: 123400},
		{name: "one decimal place", input: "1234.5", want: 123450},
		{name: "negative two decimals", input: "-12.34", want: -1234},
		{name: "negative integer", input: "-12", want: -1200},
		{name: "whitespace trimmed", input: " 100 ", want: 10000},
		{name: "zero", input: "0", want: 0},
		{name: "zero point ninety-nine", input: "0.99", want: 99},
		{name: "three decimals errors", input: "1234.567", wantErr: true},
		{name: "empty string errors", input: "", wantErr: true},
		{name: "whitespace only errors", input: "   ", wantErr: true},
		{name: "non-numeric errors", input: "abc", wantErr: true},
		{name: "multiple dots errors", input: "1.2.3", wantErr: true},
		{name: "comma-formatted errors", input: "1,234.56", wantErr: true},
	}

	for _, tc := range tests {
		tc := tc
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			got, err := ParseCentavos(tc.input)
			if tc.wantErr {
				if err == nil {
					t.Errorf("ParseCentavos(%q) expected error, got %d", tc.input, got)
				}
				return
			}
			if err != nil {
				t.Fatalf("ParseCentavos(%q) unexpected error: %v", tc.input, err)
			}
			if got != tc.want {
				t.Errorf("ParseCentavos(%q) = %d, want %d", tc.input, got, tc.want)
			}
		})
	}
}

func TestFormatMoney(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name     string
		centavos int64
		currency string
		want     string
	}{
		{name: "PHP fifty thousand", centavos: 5_000_000, currency: "PHP", want: "PHP 50,000.00"},
		{name: "USD one hundred", centavos: 10_000, currency: "USD", want: "USD 100.00"},
		{name: "JPY one billion", centavos: 100_000_000_000, currency: "JPY", want: "JPY 1,000,000,000.00"},
		{name: "zero PHP", centavos: 0, currency: "PHP", want: "PHP 0.00"},
		{name: "one centavo", centavos: 1, currency: "PHP", want: "PHP 0.01"},
		{name: "negative PHP", centavos: -123_456, currency: "PHP", want: "PHP -1,234.56"},
		{name: "empty currency", centavos: 5_000_000, currency: "", want: "50,000.00"},
		{name: "empty currency negative", centavos: -5_000_000, currency: "", want: "-50,000.00"},
		{name: "EUR with decimals", centavos: 99, currency: "EUR", want: "EUR 0.99"},
	}

	for _, tc := range tests {
		tc := tc
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			got := FormatMoney(tc.centavos, tc.currency)
			if got != tc.want {
				t.Errorf("FormatMoney(%d, %q) = %q, want %q", tc.centavos, tc.currency, got, tc.want)
			}
		})
	}
}

func TestFormatMoneyCompact(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name     string
		centavos int64
		currency string
		want     string
	}{
		// Mid-range thresholds (centavos = pesos * 100).
		{name: "PHP exactly 1M pesos", centavos: 100_000_000, currency: "PHP", want: "PHP 1.0M"},
		{name: "PHP 1.2M pesos", centavos: 120_000_000, currency: "PHP", want: "PHP 1.2M"},
		{name: "PHP 4.86M pesos rounds up", centavos: 486_000_000, currency: "PHP", want: "PHP 4.9M"},
		{name: "PHP exactly 100k pesos", centavos: 10_000_000, currency: "PHP", want: "PHP 100K"},
		{name: "PHP 750k pesos", centavos: 75_000_000, currency: "PHP", want: "PHP 750K"},
		{name: "PHP just under 100k pesos", centavos: 9_999_999, currency: "PHP", want: "PHP 100.0K"},
		{name: "PHP exactly 1k pesos", centavos: 100_000, currency: "PHP", want: "PHP 1.0K"},
		{name: "PHP 1.5k pesos", centavos: 150_000, currency: "PHP", want: "PHP 1.5K"},
		{name: "PHP 999 pesos no separator", centavos: 99_900, currency: "PHP", want: "PHP 999"},
		{name: "PHP 1 peso", centavos: 100, currency: "PHP", want: "PHP 1"},
		{name: "PHP zero", centavos: 0, currency: "PHP", want: "PHP 0"},
		// Negatives keep their sign before the number.
		{name: "PHP negative 1.2M pesos", centavos: -120_000_000, currency: "PHP", want: "PHP -1.2M"},
		{name: "PHP negative 750k pesos", centavos: -75_000_000, currency: "PHP", want: "PHP -750K"},
		{name: "PHP negative 1.5k pesos", centavos: -150_000, currency: "PHP", want: "PHP -1.5K"},
		{name: "PHP negative 500 pesos", centavos: -50_000, currency: "PHP", want: "PHP -500"},
		// Empty currency drops the prefix.
		{name: "empty currency 1.2M", centavos: 120_000_000, currency: "", want: "1.2M"},
		{name: "empty currency 999", centavos: 99_900, currency: "", want: "999"},
		// Multi-currency.
		{name: "USD 1.2M", centavos: 120_000_000, currency: "USD", want: "USD 1.2M"},
	}

	for _, tc := range tests {
		tc := tc
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			got := FormatMoneyCompact(tc.centavos, tc.currency)
			if got != tc.want {
				t.Errorf("FormatMoneyCompact(%d, %q) = %q, want %q", tc.centavos, tc.currency, got, tc.want)
			}
		})
	}
}

func TestAddCommas(t *testing.T) {
	t.Parallel()

	tests := []struct {
		input string
		want  string
	}{
		{"0", "0"},
		{"1", "1"},
		{"12", "12"},
		{"123", "123"},
		{"1234", "1,234"},
		{"12345", "12,345"},
		{"123456", "123,456"},
		{"1234567", "1,234,567"},
		{"12345678", "12,345,678"},
		{"123456789", "123,456,789"},
		{"1000000000", "1,000,000,000"},
	}

	for _, tc := range tests {
		tc := tc
		t.Run(tc.input, func(t *testing.T) {
			t.Parallel()
			got := addCommas(tc.input)
			if got != tc.want {
				t.Errorf("addCommas(%q) = %q, want %q", tc.input, got, tc.want)
			}
		})
	}
}
