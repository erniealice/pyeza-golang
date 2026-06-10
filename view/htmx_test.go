package view

import (
	"net/http"
	"testing"
)

func TestHTMXSuccess(t *testing.T) {
	tests := []struct {
		name             string
		tableID          string
		wantStatus       int
		wantTriggerValue string
	}{
		{
			name:             "orders table",
			tableID:          "orders-table",
			wantStatus:       http.StatusOK,
			wantTriggerValue: `{"formSuccess":true,"refreshTable":"orders-table"}`,
		},
		{
			name:             "products table",
			tableID:          "products-table",
			wantStatus:       http.StatusOK,
			wantTriggerValue: `{"formSuccess":true,"refreshTable":"products-table"}`,
		},
		{
			name:             "empty table ID",
			tableID:          "",
			wantStatus:       http.StatusOK,
			wantTriggerValue: `{"formSuccess":true,"refreshTable":""}`,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := HTMXSuccess(tt.tableID)

			if result.StatusCode != tt.wantStatus {
				t.Errorf("StatusCode = %d, want %d", result.StatusCode, tt.wantStatus)
			}

			trigger, ok := result.Headers["HX-Trigger"]
			if !ok {
				t.Fatal("missing HX-Trigger header")
			}
			if trigger != tt.wantTriggerValue {
				t.Errorf("HX-Trigger = %q, want %q", trigger, tt.wantTriggerValue)
			}
		})
	}
}

func TestHTMXError(t *testing.T) {
	tests := []struct {
		name       string
		message    string
		wantStatus int
	}{
		{
			name:       "validation error",
			message:    "Name is required",
			wantStatus: http.StatusUnprocessableEntity,
		},
		{
			name:       "empty message",
			message:    "",
			wantStatus: http.StatusUnprocessableEntity,
		},
		{
			name:       "long message",
			message:    "The quantity entered exceeds available stock for this product at the selected location.",
			wantStatus: http.StatusUnprocessableEntity,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := HTMXError(tt.message)

			if result.StatusCode != tt.wantStatus {
				t.Errorf("StatusCode = %d, want %d", result.StatusCode, tt.wantStatus)
			}

			errMsg, ok := result.Headers["HX-Error-Message"]
			if !ok {
				t.Fatal("missing HX-Error-Message header")
			}
			if errMsg != tt.message {
				t.Errorf("HX-Error-Message = %q, want %q", errMsg, tt.message)
			}
		})
	}
}
