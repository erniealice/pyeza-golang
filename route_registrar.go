package pyeza

import (
	"github.com/erniealice/pyeza-golang/view"
)

// RouteRegistrar is re-exported from the view sub-package so that domain blocks
// can reference pyeza.RouteRegistrar with a single import.
//
// Relocated here from app_context.go in the composition-layer relocation
// (2026-06-15): it is a pure pyeza/view re-export with NO AppContext dependency,
// so it stays in pyeza (keeping pyeza.RouteRegistrar resolvable for the domain
// block.go files, the app shell, and espyna's route_registry) while
// AppContext / AppOption / AppUIBundle move to espyna/consumer/app.
type RouteRegistrar = view.RouteRegistrar
