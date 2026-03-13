package pyeza

import "embed"

//go:embed icons/*.html
//go:embed partials/*.html
//go:embed components/*.html
//go:embed templates/*.html
//go:embed templates/blocks/*.html
var SharedFS embed.FS
