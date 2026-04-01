package pyeza

import "embed"

//go:embed icons/*.html
//go:embed partials/*.html
//go:embed components/*.html
//go:embed components/calendar/*.html
//go:embed components/table/*.html
//go:embed templates/blocks/*.html
var SharedFS embed.FS
