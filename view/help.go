package view

import (
	"html/template"

	"github.com/erniealice/pyeza-golang/types"
)

// helpLoader is the duck-typed interface that any KB/help provider must
// satisfy to participate in `LoadHelpInto`. lyngua's `*v1.TranslationProvider`
// satisfies this interface automatically via its `LoadHelpHTML` method, so
// pyeza-golang does NOT need to import lyngua.
//
// Keep the signature aligned with `lyngua.TranslationProvider.LoadHelpHTML`.
type helpLoader interface {
	LoadHelpHTML(locale, businessType, topic string) (template.HTML, bool)
}

// LoadHelpInto attempts to populate the help-pane fields on the supplied
// PageData by looking up a KB markdown file for the given `topic` via
// `viewCtx.Translations`. When a KB file is found, it sets:
//
//	pageData.HasHelp     = true
//	pageData.HelpContent = <rendered HTML>
//
// Otherwise it leaves PageData untouched. Safe to call unconditionally —
// missing KB files, nil translations, or a non-lyngua provider all degrade
// silently (the help icon simply does not render).
//
// This is the canonical way to enable the page-header help icon. Each page
// view should call it once after building PageData:
//
//	pageData := &PageData{ types.PageData{ ... } }
//	view.LoadHelpInto(viewCtx, &pageData.PageData, "product-detail")
//
// The topic string is the KB filename (without `.md`) under
// `packages/lyngua/translations/{locale}/{tier}/kb/`. The 3-tier cascade
// (common → general → businessType) is handled by lyngua.
func LoadHelpInto(viewCtx *ViewContext, pageData *types.PageData, topic string) {
	if viewCtx == nil || pageData == nil || viewCtx.Translations == nil {
		return
	}
	loader, ok := viewCtx.Translations.(helpLoader)
	if !ok {
		return
	}
	html, found := loader.LoadHelpHTML(viewCtx.Lang, viewCtx.BusinessType, topic)
	if !found {
		return
	}
	pageData.HasHelp = true
	pageData.HelpContent = html
}
