package view

import (
	"fmt"
	"net/http"
)

// HTMXSuccess returns a header-only response that signals the sheet to close
// and the table to refresh. The ViewAdapter handles header-only responses
// (no template, just headers + status code).
//
// Canonical home for the HTMX response protocol. The view-provider packages
// (centymo, entydad, fayna, fycha) previously each carried an identical copy
// of this helper; they now call view.HTMXSuccess directly. The emitted
// HX-Trigger / HX-Error-Message headers are read by pyeza's own sheet.js, so
// the helper belongs with the framework that owns the contract.
func HTMXSuccess(tableID string) ViewResult {
	return ViewResult{
		StatusCode: http.StatusOK,
		Headers: map[string]string{
			"HX-Trigger": fmt.Sprintf(`{"formSuccess":true,"refreshTable":"%s"}`, tableID),
		},
	}
}

// HTMXError returns a header-only response that signals a form error.
// The sheet.js handleResponse reads HX-Error-Message on non-2xx responses.
func HTMXError(message string) ViewResult {
	return ViewResult{
		StatusCode: http.StatusUnprocessableEntity,
		Headers: map[string]string{
			"HX-Error-Message": message,
		},
	}
}
