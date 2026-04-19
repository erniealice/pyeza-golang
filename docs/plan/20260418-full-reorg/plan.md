# pyeza-golang Full Reorg Plan
**Date**: 2026-04-18
**Status**: Draft — inventory + planning only. No files moved yet.

---

## Section 1 — Target Layout

```
pyeza-golang/
  web/                              # Single root for all embedded static assets (replaces icons/ partials/ components/ templates/ styles/ assets/)
    templates/
      components/                   # Small reusable UI components: button, badge, dialog, form-group, tabs, etc.
        calendar/                   # Calendar sub-components (5 files)
        table/                      # Table sub-components (5 files)
      blocks/                       # Larger page patterns: sidebar01, attachment-tab, audit-history-tab, etc.
      partials/                     # Page-chrome: header, fonts, scripts, page-end, settings-modal, etc.
      icons/                        # 137 flat SVG icon files
    styles/
      base/                         # Design-token foundation: layout.css, main-base.css, typography.css
      components/                   # One CSS file per component (alert.css, badge.css, button.css, …)
      themes/                       # 15 theme files (warm-cream.css, ocean-deep.css, …)
    js/
      components/                   # Per-component JS: bottom-nav.js, dialog.js, sheet.js, etc.
      table/                        # 16-module table system (table-core.js, table.js, bulk-action.js, …)
  types/                            # Sub-package: PageData, TableConfig, TableRow, ChipData, money, datetime, permissions, sidebar
  view/                             # Sub-package: RouteRegistrar, view contracts, permissions
  route/                            # Sub-package: URL resolution helpers
  docs/                             # Docs and plans (unchanged)
  scripts/                          # Helper scripts (unchanged)
  (root .go files — same package pyeza, split by concern — see Section 4)
```

---

## Section 2 — File Move Mapping

### HTML Templates

| Current path | Target path | Notes |
|---|---|---|
| `components/alert.html` | `web/templates/components/alert.html` | |
| `components/auto-complete.html` | `web/templates/components/auto-complete.html` | |
| `components/avatar.html` | `web/templates/components/avatar.html` | |
| `components/badge.html` | `web/templates/components/badge.html` | |
| `components/bottom-nav.html` | `web/templates/components/bottom-nav.html` | |
| `components/button.html` | `web/templates/components/button.html` | |
| `components/card.html` | `web/templates/components/card.html` | |
| `components/chip.html` | `web/templates/components/chip.html` | |
| `components/dialog.html` | `web/templates/components/dialog.html` | |
| `components/dropdown.html` | `web/templates/components/dropdown.html` | |
| `components/empty-state.html` | `web/templates/components/empty-state.html` | |
| `components/file-dropzone.html` | `web/templates/components/file-dropzone.html` | |
| `components/form-drawer.html` | `web/templates/components/form-drawer.html` | |
| `components/form-group.html` | `web/templates/components/form-group.html` | |
| `components/help-pane-oob.html` | `web/templates/components/help-pane-oob.html` | |
| `components/help-pane.html` | `web/templates/components/help-pane.html` | |
| `components/multi-select.html` | `web/templates/components/multi-select.html` | |
| `components/pagination.html` | `web/templates/components/pagination.html` | |
| `components/popover.html` | `web/templates/components/popover.html` | |
| `components/sheet-form.html` | `web/templates/components/sheet-form.html` | |
| `components/sheet-notification.html` | `web/templates/components/sheet-notification.html` | |
| `components/sheet.html` | `web/templates/components/sheet.html` | |
| `components/skeleton.html` | `web/templates/components/skeleton.html` | |
| `components/spinner.html` | `web/templates/components/spinner.html` | |
| `components/stat-card.html` | `web/templates/components/stat-card.html` | |
| `components/tabs.html` | `web/templates/components/tabs.html` | |
| `components/toast.html` | `web/templates/components/toast.html` | |
| `components/toggle.html` | `web/templates/components/toggle.html` | |
| `components/calendar/calendar-day.html` | `web/templates/components/calendar/calendar-day.html` | |
| `components/calendar/calendar-event-chip.html` | `web/templates/components/calendar/calendar-event-chip.html` | |
| `components/calendar/calendar-header.html` | `web/templates/components/calendar/calendar-header.html` | |
| `components/calendar/calendar-month.html` | `web/templates/components/calendar/calendar-month.html` | |
| `components/calendar/calendar-week.html` | `web/templates/components/calendar/calendar-week.html` | |
| `components/table/table-actions.html` | `web/templates/components/table/table-actions.html` | |
| `components/table/table-cells.html` | `web/templates/components/table/table-cells.html` | |
| `components/table/table-footer-legacy.html` | `web/templates/components/table/table-footer-legacy.html` | |
| `components/table/table-footer.html` | `web/templates/components/table/table-footer.html` | |
| `components/table/table-toolbar.html` | `web/templates/components/table/table-toolbar.html` | |
| `components/table/table.html` | `web/templates/components/table/table.html` | |
| `partials/fonts.html` | `web/templates/partials/fonts.html` | |
| `partials/form-drawer-footer.html` | `web/templates/partials/form-drawer-footer.html` | |
| `partials/header-oob.html` | `web/templates/partials/header-oob.html` | |
| `partials/header.html` | `web/templates/partials/header.html` | |
| `partials/notification-drawer.html` | `web/templates/partials/notification-drawer.html` | |
| `partials/page-end.html` | `web/templates/partials/page-end.html` | |
| `partials/scripts.html` | `web/templates/partials/scripts.html` | |
| `partials/settings-modal.html` | `web/templates/partials/settings-modal.html` | |
| `partials/sheet-form-container.html` | `web/templates/partials/sheet-form-container.html` | |
| `partials/table-scripts.html` | `web/templates/partials/table-scripts.html` | |
| `partials/theme-switcher.html` | `web/templates/partials/theme-switcher.html` | |
| `templates/blocks/attachment-tab.html` | `web/templates/blocks/attachment-tab.html` | |
| `templates/blocks/attachment-upload-drawer-form.html` | `web/templates/blocks/attachment-upload-drawer-form.html` | |
| `templates/blocks/audit-history-tab.html` | `web/templates/blocks/audit-history-tab.html` | |
| `templates/blocks/mobile-app-grid.html` | `web/templates/blocks/mobile-app-grid.html` | |
| `templates/blocks/sidebar01.html` | `web/templates/blocks/sidebar01.html` | |
| `templates/blocks/template-list.html` | `web/templates/blocks/template-list.html` | |
| `templates/blocks/template-upload-drawer-form.html` | `web/templates/blocks/template-upload-drawer-form.html` | |
| `icons/alert-circle.html` | `web/templates/icons/alert-circle.html` | First of 137 icons |
| `icons/*.html` (137 total) | `web/templates/icons/*.html` | All 137 icon files move flat |

### CSS Files

| Current path | Target path | Notes |
|---|---|---|
| `styles/layout.css` | `web/styles/base/layout.css` | Design tokens: spacing, radius, z-index, transitions |
| `styles/main-base.css` | `web/styles/base/main-base.css` | Typography scale, density, font variants |
| `styles/typography.css` | `web/styles/base/typography.css` | Font-face declarations |
| `styles/alert.css` | `web/styles/components/alert.css` | |
| `styles/auto-complete.css` | `web/styles/components/auto-complete.css` | |
| `styles/avatar.css` | `web/styles/components/avatar.css` | |
| `styles/badge.css` | `web/styles/components/badge.css` | |
| `styles/bottom-nav.css` | `web/styles/components/bottom-nav.css` | |
| `styles/button.css` | `web/styles/components/button.css` | |
| `styles/calendar.css` | `web/styles/components/calendar.css` | |
| `styles/card.css` | `web/styles/components/card.css` | |
| `styles/carousel.css` | `web/styles/components/carousel.css` | |
| `styles/chip.css` | `web/styles/components/chip.css` | |
| `styles/coming-soon.css` | `web/styles/components/coming-soon.css` | |
| `styles/detail-layout.css` | `web/styles/components/detail-layout.css` | |
| `styles/dialog.css` | `web/styles/components/dialog.css` | |
| `styles/dropdown.css` | `web/styles/components/dropdown.css` | |
| `styles/empty-state.css` | `web/styles/components/empty-state.css` | |
| `styles/file-upload.css` | `web/styles/components/file-upload.css` | |
| `styles/form.css` | `web/styles/components/form.css` | |
| `styles/help-pane.css` | `web/styles/components/help-pane.css` | |
| `styles/image-upload.css` | `web/styles/components/image-upload.css` | |
| `styles/loading-indicator.css` | `web/styles/components/loading-indicator.css` | |
| `styles/multi-select.css` | `web/styles/components/multi-select.css` | |
| `styles/notes-journal.css` | `web/styles/components/notes-journal.css` | |
| `styles/pagination.css` | `web/styles/components/pagination.css` | |
| `styles/password.css` | `web/styles/components/password.css` | |
| `styles/popover.css` | `web/styles/components/popover.css` | |
| `styles/sheet.css` | `web/styles/components/sheet.css` | |
| `styles/sidebar.css` | `web/styles/components/sidebar.css` | |
| `styles/skeleton.css` | `web/styles/components/skeleton.css` | |
| `styles/spinner.css` | `web/styles/components/spinner.css` | |
| `styles/stat-card.css` | `web/styles/components/stat-card.css` | |
| `styles/table.css` | `web/styles/components/table.css` | |
| `styles/tabs.css` | `web/styles/components/tabs.css` | |
| `styles/toast.css` | `web/styles/components/toast.css` | |
| `styles/toggle.css` | `web/styles/components/toggle.css` | |
| `styles/class-list.txt` | `web/styles/components/class-list.txt` | Non-CSS reference, keep co-located |
| `styles/form-drawer.css.bak` | DELETE | Stale backup, not a real file |
| `styles/themes/brutalist-ink.css` | `web/styles/themes/brutalist-ink.css` | |
| `styles/themes/corporate-steel.css` | `web/styles/themes/corporate-steel.css` | |
| `styles/themes/forest-night.css` | `web/styles/themes/forest-night.css` | |
| `styles/themes/ichizen-default.css` | `web/styles/themes/ichizen-default.css` | |
| `styles/themes/ledger-mono.css` | `web/styles/themes/ledger-mono.css` | |
| `styles/themes/minimal-light.css` | `web/styles/themes/minimal-light.css` | |
| `styles/themes/modern-retail.css` | `web/styles/themes/modern-retail.css` | |
| `styles/themes/ocean-deep.css` | `web/styles/themes/ocean-deep.css` | |
| `styles/themes/paper-ink.css` | `web/styles/themes/paper-ink.css` | |
| `styles/themes/peach-fizz.css` | `web/styles/themes/peach-fizz.css` | |
| `styles/themes/salon-blush.css` | `web/styles/themes/salon-blush.css` | |
| `styles/themes/shadcn-neutral.css` | `web/styles/themes/shadcn-neutral.css` | |
| `styles/themes/soft-clay.css` | `web/styles/themes/soft-clay.css` | |
| `styles/themes/sunset-glow.css` | `web/styles/themes/sunset-glow.css` | |
| `styles/themes/warm-cream.css` | `web/styles/themes/warm-cream.css` | |

### JavaScript Files

| Current path | Target path | Notes |
|---|---|---|
| `assets/js/bottom-nav.js` | `web/js/components/bottom-nav.js` | |
| `assets/js/calendar.js` | `web/js/components/calendar.js` | |
| `assets/js/dialog.js` | `web/js/components/dialog.js` | |
| `assets/js/file-upload.js` | `web/js/components/file-upload.js` | |
| `assets/js/focus-trap.js` | `web/js/components/focus-trap.js` | |
| `assets/js/help-pane.js` | `web/js/components/help-pane.js` | |
| `assets/js/image-upload.js` | `web/js/components/image-upload.js` | |
| `assets/js/notification-drawer.js` | `web/js/components/notification-drawer.js` | Currently not in CopyStaticAssets list — verify |
| `assets/js/sheet.js` | `web/js/components/sheet.js` | |
| `assets/js/sidebar.js` | `web/js/components/sidebar.js` | |
| `assets/js/table/bulk-action.js` | `web/js/table/bulk-action.js` | |
| `assets/js/table/table-actions.js` | `web/js/table/table-actions.js` | |
| `assets/js/table/table-columns.js` | `web/js/table/table-columns.js` | |
| `assets/js/table/table-core.js` | `web/js/table/table-core.js` | |
| `assets/js/table/table-density.js` | `web/js/table/table-density.js` | |
| `assets/js/table/table-dialog.js` | `web/js/table/table-dialog.js` | |
| `assets/js/table/table-dropdowns.js` | `web/js/table/table-dropdowns.js` | |
| `assets/js/table/table-export.js` | `web/js/table/table-export.js` | |
| `assets/js/table/table-filters.js` | `web/js/table/table-filters.js` | |
| `assets/js/table/table-pagination.js` | `web/js/table/table-pagination.js` | |
| `assets/js/table/table-search.js` | `web/js/table/table-search.js` | |
| `assets/js/table/table-selection.js` | `web/js/table/table-selection.js` | |
| `assets/js/table/table-server.js` | `web/js/table/table-server.js` | |
| `assets/js/table/table-sort.js` | `web/js/table/table-sort.js` | |
| `assets/js/table/table.js` | `web/js/table/table.js` | |

### Go Files

| Current path | Target path | Notes |
|---|---|---|
| `embed.go` | `embed.go` (rewritten) | Glob updated to `all:web` or `web/**` — see Section 3 |
| `assets.go` | `assets.go` (updated paths) | `stylesSrcDir` changes from `styles/` → `web/styles/`; `assets/js/` → `web/js/`; see Section 4 |
| `renderer.go` | `renderer.go` (same package) | No path changes required; template names unchanged |
| `labels.go` | `labels.go` (same package) | No changes required |
| `app_context.go` | `app_context.go` (same package) | No changes required |
| `templates.go` | `templates.go` (same package) | No changes required |
| `types.go` | DELETE (see Section 5) | Shim removed; downstream imports updated to `pyeza/types` |
| `validate_labels.go` | `validate_labels.go` (same package) | No changes required |
| `markdown.go` | `markdown.go` (same package) | No changes required |
| `types/` | `types/` (unchanged) | Sub-package stays |
| `view/` | `view/` (unchanged) | Sub-package stays |
| `route/` | `route/` (unchanged) | Sub-package stays |

---

## Section 3 — Embed Spec Change

**Current `embed.go`:**
```go
package pyeza

import "embed"

//go:embed icons/*.html
//go:embed partials/*.html
//go:embed components/*.html
//go:embed components/calendar/*.html
//go:embed components/table/*.html
//go:embed templates/blocks/*.html
var SharedFS embed.FS
```

**Proposed `embed.go`:**
```go
package pyeza

import "embed"

//go:embed all:web
var SharedFS embed.FS
```

**Why `all:web` works:**
- The `all:` prefix (Go 1.16+) tells the embed toolchain to include ALL files in the directory tree, even those starting with `.` or `_`. Without `all:`, those are silently skipped.
- A single `//go:embed all:web` directive recursively embeds every file under `web/`, eliminating the current 5 brittle per-subdir globs.
- The `fs.WalkDir` in `renderer.go`'s `initFromFS()` already walks the FS recursively and filters by `.html` suffix — it does not rely on any directory naming convention. Moving files into `web/templates/` sub-folders works transparently.
- **No existing FS consumer code changes**: `pyeza.SharedFS` is still the same `embed.FS` variable. The only caller is `container.go:171 pyeza.SharedFS` — no change needed there.
- **CSS and JS are NOT in SharedFS** — they are copied at runtime via `CopyStylesWithTheme`/`CopyStaticAssets` using `runtime.Caller`. Those functions read from the filesystem (not embed), so their paths must be updated in `assets.go` (see Section 4).

---

## Section 4 — Go File Splits

The recommendation (see Section 5, Decision 1) is **same-package file splits** — no new sub-packages. The goal is to reduce per-file line counts from 300–480 to 100–200 without changing any import paths.

### `assets.go` (333 lines → 2 files)

| New file | Contents |
|---|---|
| `assets_styles.go` | `CopyStyles()`, `CopyStylesWithTheme()`, `generateMainCSS()`, `copyDirStyles()`, `copyFileAsset()`. Update `stylesSrcDir` to point at `web/styles/` instead of `styles/`. Update theme glob to `web/styles/themes/*.css`. Update `layout.css` and `main-base.css` paths to `web/styles/base/layout.css` and `web/styles/base/main-base.css`. |
| `assets_js.go` | `CopyStaticAssets()`, `copyDirAssets()`. Update all `srcRelPath` values: `"assets/js/table"` → `"web/js/table"`, `"assets/js/sheet.js"` → `"web/js/components/sheet.js"`, etc. (one line per mapping). |

### `renderer.go` (473 lines → 2 files)

No path changes needed; split is for readability only.

| New file | Contents |
|---|---|
| `renderer.go` | `HTMLRenderer` struct, `NewHTMLRenderer()`, `NewHTMLRendererFromFS()`, `WithFuncs()`, `SetRouteMap()`, `Init()`, `initFromFS()`, `getSharedComponentsDir()`, `Render()`, `RenderBuffered()`, `GetTemplate()`, `GetTemplates()`, `RenderIcon()`, `toFloat64()`. |
| `renderer_funcs.go` | `getDefaultFuncMap()`, `buildFuncMap()`. These are >200 lines of func map definitions and are logically distinct from the renderer lifecycle. |

### `labels.go` (483 lines → 2 files)

| New file | Contents |
|---|---|
| `labels.go` | `CommonLabels` (top-level struct and its ~10 embedded structs), `TabItem` struct. |
| `labels_types.go` | All remaining label-type structs: `SidebarLabels`, `AppSwitcherLabels`, `AppLabels`, `SidebarClientsLabels`, `SidebarRegulationsLabels`, `SidebarMarketplaceLabels`, `SidebarQuotesLabels`, `SidebarUsersLabels`, `SidebarReportsLabels`, `SidebarMainLabels`, `SidebarSupportLabels`, `UserMenuLabels`, `UserCardLabels`, `HeaderLabels`, `NotificationLabels`, `NotificationTabLabels`, `NotificationEmptyLabels`, `SettingsLabels`, `SettingsAccountLabels`, `SettingsBillingLabels`, `ThemeLabels`, `ThemeOptionLabels`, `ThemeDensityLabels`, `ThemeRadiusLabels`, `ThemeBorderLabels`, `FontOptionLabels`, `HelpPaneLabels`, `CommonTableLabels`, `TableColumnLabels`, `TableDensityLabels`, `PaginationLabels`, `ButtonLabels`, `ActionLabels`, `BulkLabels`, `StatusLabels`, `EmptyLabels`, `LoadingLabels`, `ErrorLabels`, `DropdownLabels`, `IntegrationLabels`, `CardLabels`, `AuditLabels`, `AuditActionLabels`, `AuditFieldTypeLabels`. |

### `app_context.go` (130 lines)

No split needed — 130 lines is well within the target. Keep as-is.

### `types.go` (shim)

Removed entirely per Decision 3 (see Section 5). The 36 type aliases and 4 var aliases all move to downstream imports (`pyeza/types`). This is the only downstream-impacting change in pyeza itself.

---

## Section 5 — Decisions

### Decision 1: Go Public API Stability

**Recommendation: Keep all symbols in package `pyeza` (root). Split files only within the same package.**

The types `CommonLabels`, `HTMLRenderer`, `PageData`, `AppContext`, `TableConfig`, etc. are referenced in 109+ files across 7 packages (centymo alone has 109 Go files importing pyeza). Moving any of these to new sub-packages would require updating every `pyeza.CommonLabels` reference to e.g. `pyezalabels.CommonLabels` — an enormous blast radius with zero functional benefit. Go's build tooling provides no mechanized rename across repos, and since each package is a git submodule, the change must be coordinated as an atomic landing across all 7 repos. Within-package file splits (all still `package pyeza`) produce zero import path changes by construction. The only caller that needs updating is anyone directly referencing `pyeza.PageData` vs `pyeza.TableConfig` — but because these are type aliases to `types.PageData` etc., even today they already resolve the same way.

### Decision 2: Template Name Stability

**Recommendation: Keep all template `{{define "..."}}` names exactly as they are. Do not rename.**

Template names (e.g. `"table-card"`, `"sidebar01"`, `"attachment-tab"`, `"header"`, `"page-end"`, `"icon-plus"`) are the strings used in Go code via `ContentTemplate: "sales-list-content"` and in HTML via `{{template "form-group" ...}}`. They are registered globally across ALL parsed templates at startup (one shared `*template.Template` namespace). The names are entirely independent of file paths — moving `components/button.html` to `web/templates/components/button.html` does not change the name defined inside the file. The `initFromFS()` walker in `renderer.go` reads file content and calls `r.templates.Parse(string(content))`; it doesn't derive template names from paths. Therefore: **zero template name string changes in any downstream package**.

### Decision 3: `types.go` Shim

**Recommendation: Remove `types.go`.**

The file is a 36-alias backwards-compat shim: `type PageData = types.PageData`, `type TableConfig = types.TableConfig`, etc. It exists because there was a half-done migration to the `types/` sub-package. Keeping it permanently creates a maintenance trap — it must stay in sync with `types/` forever. The correct end state is: callers that need `PageData` import `github.com/erniealice/pyeza-golang/types` directly. Grepping shows the actual usage: most domain packages **already** import `"github.com/erniealice/pyeza-golang/types"` directly alongside `pyeza "github.com/erniealice/pyeza-golang"`. The shim removal is the one change that **does** require downstream edits: files that use `pyeza.TableConfig`, `pyeza.PageData`, etc. via the root package alias must add/switch to the `types` import. This is a mechanical substitution that pair agents can do with a targeted grep+replace. Estimated impact: ~30–40 files.

### Decision 4: Embed Spec

**Recommendation: Use `//go:embed all:web` as a single-line replacement.**

The `all:` prefix (available since Go 1.16, included in this workspace's Go 1.25.1) causes the embed toolchain to include files in subdirectories even if they start with `.` or `_`. Without `all:`, files matching those patterns are excluded. Since pyeza's `web/` subtree has no dot-files or underscore-prefixed files, `//go:embed web` would technically also work — but `all:web` is more explicit and future-proof. The `initFromFS()` function walks the embedded FS with `fs.WalkDir` and parses only `.html` files — it does not depend on path structure. CSS and JS are served via `runtime.Caller`-based file copying (not embed), so they don't participate in `SharedFS` at all. The five original globs had one structural flaw: adding a new `components/` subdirectory (e.g. `components/form/`) would require adding a sixth glob line. `all:web` eliminates this entirely.

---

## Section 6 — Downstream Impact

### Research findings (greps run 2026-04-18)

**`pyeza.SharedFS` references:** Only `apps/service-admin/internal/composition/container.go:171`. No change needed — variable name and type unchanged.

**Template name strings in Go files:** Zero occurrences of `"components/`, `"partials/`, `"blocks/`, `"icons/` as template name strings in any Go file across packages or app. Template names in Go code are entity-scoped strings like `"sales-list-content"`, `"sidebar01"`, `"attachment-tab"` — none prefix with directory names. Confirmed: no downstream Go template-name-string changes.

**Go import sub-packages used:** All packages import from `github.com/erniealice/pyeza-golang` (root), `github.com/erniealice/pyeza-golang/types`, `github.com/erniealice/pyeza-golang/view`, `github.com/erniealice/pyeza-golang/route`. No other sub-packages. These sub-packages are not moving.

**CSS asset paths:** All references are to `/assets/css/pyeza/` (the runtime-copied destination). The source paths inside `assets.go` change, but served paths do not change. Downstream HTML templates reference `/assets/css/pyeza/button.css` etc. — unchanged.

**JS asset paths:** All references are to `/assets/js/pyeza/` (runtime-copied destination). Source paths inside `assets.go` change, but served paths are unchanged. Template references like `<script src="/assets/js/pyeza/sheet.js">` — unchanged.

---

### centymo-golang

**(a) Go imports:** If `types.go` shim is removed, files currently using `pyeza.TableConfig`, `pyeza.PageData`, `pyeza.TableRow`, etc. via the root alias must switch those specific symbols to `"github.com/erniealice/pyeza-golang/types"`. Files that already import both `pyeza` (root) and `pyeza/types` need only remove the root alias usage for those shim types. **Estimated files needing import edits: ~30 files** (centymo has 109 Go files importing pyeza; roughly 30 use root-level type aliases directly).

If `types.go` shim is NOT removed, no import changes.

**(b) Template name strings:** No changes. Template names in centymo Go files are entity-scoped (e.g. `"product-list-content"`, `"sales-drawer-form"`).

**(c) CSS references:** None. Centymo HTML templates reference `/assets/css/centymo/...` and `/assets/css/pyeza/...` (served paths, unchanged).

**(d) JS references:** `packages/centymo-golang/views/product/templates/variant-detail.html` references `/assets/js/pyeza/image-upload.js` — served path unchanged.

**(e) Icon references:** None direct — icons are invoked via `{{template "icon-plus" .}}` which is a template name (unchanged).

**(f) Rough file-edit count:** 0 if shim kept; ~30 if shim removed.

---

### hybra-golang

**(a) Go imports:** Imports `pyeza-golang/route`, `pyeza-golang/types`, `pyeza-golang/view` in 2 files (`views/template/handler.go`, `views/attachment/handler.go`). No root-level pyeza type aliases used. No changes required.

**(b) Template name strings:** None.

**(c) CSS references:** None.

**(d) JS references:** None.

**(e) Icon references:** None direct.

**(f) Rough file-edit count:** 0.

---

### fycha-golang

**(a) Go imports:** fycha has many files importing `pyeza` (root) + `pyeza/types` + `pyeza/view`. If shim is removed, files using `pyeza.TableConfig`, `pyeza.PageData`, etc. via root alias need those symbols redirected to `types`. **Estimated files needing import edits: ~15 files.**

If shim kept: 0 changes.

**(b) Template name strings:** None.

**(c) CSS references:** None (fycha has its own CSS under `/assets/css/fycha/`).

**(d) JS references:** `packages/fycha-golang/views/ledger/templates/account-templates.html` has `<script src="/assets/js/pyeza/dialog.js?v={{.CacheVersion}}">` — served path unchanged.

**(e) Icon references:** None direct.

**(f) Rough file-edit count:** 0 if shim kept; ~15 if shim removed.

---

### entydad-golang

**(a) Go imports:** entydad has 99 Go files, most importing multiple pyeza sub-packages plus the root alias. If shim is removed, root-alias usage of type symbols must switch to `types` import. **Estimated files needing import edits: ~20 files.**

If shim kept: 0 changes.

**(b) Template name strings:** None.

**(c) CSS references:** entydad HTML templates reference `/assets/css/pyeza/carousel.css` (login02, signup02, reset-password02 templates). Served path unchanged.

**(d) JS references:** None direct pyeza JS refs in entydad templates.

**(e) Icon references:** None direct.

**(f) Rough file-edit count:** 0 if shim kept; ~20 if shim removed. The 3 carousel.css HTML references: 0 changes (served path unchanged).

---

### cyta-golang

**(a) Go imports:** cyta is small (23 .go files). Imports root `pyeza` and sub-packages. If shim is removed, minimal impact. **Estimated files: ~3.**

**(b) Template name strings:** None.

**(c) CSS references:** `packages/cyta-golang/views/event/calendar/templates/calendar.html` references `/assets/css/pyeza/calendar.css` twice — served path unchanged.

**(d) JS references:** None.

**(e) Icon references:** None direct.

**(f) Rough file-edit count:** 0 if shim kept; ~3 if shim removed.

---

### fayna-golang

**(a) Go imports:** fayna (65 .go files). If shim is removed, ~5 files need import edits.

**(b) Template name strings:** None.

**(c) CSS references:** None identified.

**(d) JS references:** None identified.

**(e) Icon references:** None direct.

**(f) Rough file-edit count:** 0 if shim kept; ~5 if shim removed.

---

### service-admin (app)

**(a) Go imports:** `container.go` imports root `pyeza` package. `translations.go`, `sidebar.go`, `route_config.go`, `workspace_loader.go`, `view_adapter.go`, `permission_filter.go` import `pyeza/types` and `pyeza/view`. If shim is removed and root alias used for type symbols, ~3–5 files need edits.

**(b) Template name strings:** None in `.go` files. `container.go:171` passes `pyeza.SharedFS` — variable name unchanged.

**(c) CSS references:** `apps/service-admin/templates/layout/app-shell.html` has 6 pyeza CSS `<link>` tags (`/assets/css/pyeza/sidebar.css`, `typography.css`, `index.css`, `sheet.css`, `detail-layout.css`, `bottom-nav.css`) — all served paths unchanged.

**(d) JS references:** `apps/service-admin/templates/layout/app-shell.html` has 4 pyeza JS `<script>` tags (`/assets/js/pyeza/bottom-nav.js`, `focus-trap.js`, `dialog.js`, `file-upload.js`) — served paths unchanged.

**(e) Icon references:** None direct (icons invoked via template names).

**(f) Rough file-edit count:** 0 if shim kept; 3–5 if shim removed. The `assets.go` path updates in pyeza itself handle the source-path changes transparently.

---

### Summary Table

| Package | Shim kept (0-change) | Shim removed |
|---|---|---|
| centymo | 0 | ~30 files |
| hybra | 0 | 0 |
| fycha | 0 | ~15 files |
| entydad | 0 | ~20 files |
| cyta | 0 | ~3 files |
| fayna | 0 | ~5 files |
| service-admin | 0 | ~3–5 files |
| **Total** | **0** | **~76–78 files** |

> Note: All CSS/JS/icon HTML path references use runtime-served `/assets/css/pyeza/` and `/assets/js/pyeza/` paths that are independent of source layout. Zero HTML changes required from the file moves.

---

## Section 7 — Pair Agent Briefs

---

### Pair A: centymo-golang + hybra-golang

**Assignment:** Update centymo-golang and hybra-golang after pyeza-golang reorg is complete and its submodule pointer is bumped.

**Wiki articles to read first (in order):**
1. `/Users/cradle/Documents/GitHub/ichizen-golang/docs/wiki/articles/package-map.md`
2. `/Users/cradle/Documents/GitHub/ichizen-golang/docs/wiki/articles/dependency-flow.md`
3. `/Users/cradle/Documents/GitHub/ichizen-golang/docs/wiki/articles/template-guide.md`

**Context (do not re-grep for this):**
- pyeza `SharedFS` is the same embed.FS variable — no change to `container.go`.
- All template names (`"table-card"`, `"form-group"`, `"icon-plus"`, etc.) are unchanged.
- All served asset paths (`/assets/css/pyeza/*`, `/assets/js/pyeza/*`) are unchanged.
- The only possible Go change: if `types.go` shim was removed, then files using `pyeza.TableConfig`, `pyeza.PageData`, `pyeza.TableRow`, `pyeza.TableColumn`, `pyeza.TableCell`, `pyeza.TableAction`, `pyeza.TableRowGroup`, `pyeza.TableEmptyState`, `pyeza.TableLabels`, `pyeza.PrimaryAction`, `pyeza.ImportAction`, `pyeza.BulkAction`, `pyeza.BulkActionsConfig`, `pyeza.ServerPagination`, `pyeza.PageNumber`, `pyeza.ChipData`, `pyeza.SelectOption`, `pyeza.ColumnGroup` via the root alias must import `"github.com/erniealice/pyeza-golang/types"` instead.
- hybra-golang: only imports `pyeza-golang/route`, `pyeza-golang/types`, `pyeza-golang/view` — zero changes.
- centymo-golang: ~30 files may need import edits if shim removed.

**Verification greps to run:**
```
# Confirm no root-level pyeza type alias usage remains
Grep pattern: `pyeza\.(TableConfig|PageData|TableRow|TableColumn|TableCell|BulkAction|SelectOption|ChipData|ServerPagination)`
Path: packages/centymo-golang, packages/hybra-golang
```

**Substitution list (if shim removed):**
- `pyeza.TableConfig` → `types.TableConfig` (import `"github.com/erniealice/pyeza-golang/types"`)
- `pyeza.PageData` → `types.PageData`
- `pyeza.TableRow` → `types.TableRow`
- `pyeza.TableColumn` → `types.TableColumn`
- `pyeza.TableCell` → `types.TableCell`
- `pyeza.TableAction` → `types.TableAction`
- `pyeza.BulkAction` → `types.BulkAction`
- `pyeza.ChipData` → `types.ChipData`
- `pyeza.SelectOption` → `types.SelectOption`
- `pyeza.ApplyColumnStyles` → `types.ApplyColumnStyles`
- `pyeza.ApplyTableSettings` → `types.ApplyTableSettings`
- `pyeza.BuildChipCell` → `types.BuildChipCell`
- `pyeza.BuildChipCellFromLabels` → `types.BuildChipCellFromLabels`

**Build verification:**
```bash
cd /Users/cradle/Documents/GitHub/ichizen-golang/packages/centymo-golang
go mod tidy && go build ./...

cd /Users/cradle/Documents/GitHub/ichizen-golang/packages/hybra-golang
go mod tidy && go build ./...
```

**Report back in ≤150 words:** files edited, any import resolution surprises, build pass/fail status, whether any pyeza type alias usages were found that aren't in the substitution list above.

---

### Pair B: fycha-golang + entydad-golang

**Assignment:** Update fycha-golang and entydad-golang after pyeza-golang reorg is complete and its submodule pointer is bumped.

**Wiki articles to read first (in order):**
1. `/Users/cradle/Documents/GitHub/ichizen-golang/docs/wiki/articles/package-map.md`
2. `/Users/cradle/Documents/GitHub/ichizen-golang/docs/wiki/articles/label-guide.md`
3. `/Users/cradle/Documents/GitHub/ichizen-golang/docs/wiki/articles/template-guide.md`

**Context (do not re-grep for this):**
- All template names unchanged.
- All served asset paths unchanged: entydad HTML uses `/assets/css/pyeza/carousel.css` (login02, signup02, reset-password02 templates) — no edit needed. fycha ledger template uses `/assets/js/pyeza/dialog.js` — no edit needed.
- If `types.go` shim removed: files using root-level type aliases need import switch to `pyeza/types`.
- fycha: ~15 files estimated. entydad: ~20 files estimated.
- entydad `labels.go` imports both `pyeza` (root) and `pyeza/types` — check if it uses any shim aliases.

**Verification greps to run:**
```
# Check for root-alias type usage
Grep pattern: `pyeza\.(TableConfig|PageData|TableRow|TableColumn|TableCell|BulkAction|SelectOption|ChipData|ServerPagination|ApplyColumnStyles|ApplyTableSettings|BuildChipCell)`
Path: packages/fycha-golang, packages/entydad-golang

# Verify no pyeza/icons/ or pyeza/components/ path strings
Grep pattern: `pyeza/icons/|pyeza/components/`
Path: packages/fycha-golang, packages/entydad-golang
```

**Substitution list (if shim removed):** Same as Pair A substitution list.

**Build verification:**
```bash
cd /Users/cradle/Documents/GitHub/ichizen-golang/packages/fycha-golang
go mod tidy && go build ./...

cd /Users/cradle/Documents/GitHub/ichizen-golang/packages/entydad-golang
go mod tidy && go build ./...
```

**Report back in ≤150 words:** files edited, any unexpected usages, build pass/fail, whether entydad's `clienttag`/`suppliertag` modules had extra pyeza root-alias usage.

---

### Pair C: cyta-golang + fayna-golang

**Assignment:** Update cyta-golang and fayna-golang after pyeza-golang reorg is complete and its submodule pointer is bumped.

**Wiki articles to read first (in order):**
1. `/Users/cradle/Documents/GitHub/ichizen-golang/docs/wiki/articles/package-map.md`
2. `/Users/cradle/Documents/GitHub/ichizen-golang/docs/wiki/articles/dependency-flow.md`

**Context (do not re-grep for this):**
- cyta: ~23 Go files, small blast radius. Calendar template references `/assets/css/pyeza/calendar.css` twice — served path unchanged, no edit needed.
- fayna: ~65 Go files. No identified CSS/JS path references to pyeza in HTML templates.
- If `types.go` shim removed: cyta ~3 files, fayna ~5 files need import edits.
- All template names unchanged; no template name strings reference directory paths.

**Verification greps to run:**
```
# Root-alias type usage
Grep pattern: `pyeza\.(TableConfig|PageData|TableRow|TableColumn|TableCell|BulkAction|SelectOption|ChipData)`
Path: packages/cyta-golang, packages/fayna-golang

# Verify no pyeza HTML path strings that reference source layout
Grep pattern: `pyeza/components/|pyeza/partials/|pyeza/icons/`
Path: packages/cyta-golang, packages/fayna-golang
```

**Substitution list (if shim removed):** Same as Pair A substitution list.

**Build verification:**
```bash
cd /Users/cradle/Documents/GitHub/ichizen-golang/packages/cyta-golang
go mod tidy && go build ./...

cd /Users/cradle/Documents/GitHub/ichizen-golang/packages/fayna-golang
go mod tidy && go build ./...
```

**Report back in ≤150 words:** files edited, build pass/fail, any surprises in cyta's calendar view or fayna's job/activity views.

---

## Section 8 — Sequencing & Risks

### Execution Order

```
Phase 1 — pyeza-golang reorg (main session, this repo's working tree)
  1a. Create web/ directory tree
  1b. Move all files per Section 2 mapping
  1c. Update embed.go → single `all:web` directive
  1d. Update assets.go → new source paths (web/styles/, web/js/)
  1e. Split labels.go, renderer.go per Section 4
  1f. Delete types.go shim (or defer — see Risks)
  1g. go build ./... + go test ./... in pyeza-golang
  1h. Commit pyeza-golang
  1i. Update submodule pointer in ichizen-golang root repo (separate commit)

Phase 2 — Three pair agents in parallel (after Phase 1 submodule pointer is committed)
  Pair A: centymo + hybra
  Pair B: fycha + entydad
  Pair C: cyta + fayna
  All three run concurrently. Each must:
    - go mod tidy (picks up new pyeza pointer)
    - Apply import substitutions if shim was removed
    - go build ./... + go test ./...
    - Commit + bump their own submodule pointer in root repo

Phase 3 — service-admin update (main session, after pair agents done)
  3a. Update go.work / go.mod to point at new pyeza + all updated domain packages
  3b. Apply any remaining import edits in service-admin Go files
  3c. go build ./... + go test ./...
  3d. Run E2E smoke test (seed-rbac first per CLAUDE.md rule 5)
  3e. Commit service-admin

Phase 4 — Submodule pointer bumps (separate commits per CLAUDE.md rule 4)
  One commit per submodule in ichizen-golang root repo.
```

### Risks

**Risk 1 — `types.go` shim removal is the only breaking change.**
The reorg (file moves + embed change) is fully backwards-compatible from downstream's perspective. The shim removal is the only thing that breaks callers. **Recommendation: defer shim removal to a separate PR / second pass.** Sequence: ship reorg first (zero downstream changes), then ship shim removal (pair agents do the type migration in a follow-up). This decouples blast radius and keeps Phase 1 rollback easy.

**Risk 2 — `CopyStylesWithTheme` uses `runtime.Caller` to find source files.**
`runtime.Caller(0)` returns the path of `assets.go` at compile time. In the monorepo (local dev), this resolves to the actual source path, so moving `styles/` → `web/styles/` requires updating the hardcoded string in `assets.go`. If pyeza is consumed as an external package (go module proxy / vendor), the embedded paths must match what was compiled. Verify with `go build -v` that no path not-found warnings appear after the move.

**Risk 3 — `notification-drawer.js` is referenced in templates but NOT in `CopyStaticAssets`.**
`partials/notification-drawer.html` references `/assets/js/pyeza/notification-sheet.js` (not `notification-drawer.js`). The `CopyStaticAssets` function in `assets.go` does not include `notification-drawer.js` in its mapping list. This is a pre-existing issue, not introduced by the reorg — but it should be audited during Phase 1.

**Risk 4 — Template name global namespace collision.**
Moving files does not change template names. However, if any template file has a `{{define "..."}}` that happens to collide with a domain template name, the later-loaded FS silently wins. The reorg does not introduce new templates, so no new collision risk — but this is worth verifying during Phase 1 by checking `renderer.Init()` for parse errors.

**Risk 5 — `form-drawer.css.bak` is a stale backup.**
This file is in `styles/` and would move to `web/styles/components/` under the reorg. Recommend deleting it outright during Phase 1 cleanup.

**Risk 6 — pyeza is the dependency root (zero monorepo imports).**
This invariant is preserved: the reorg moves files within pyeza but adds no imports. `web/` is a directory of static assets, not a Go package. The `all:web` embed directive does not create a new importable package. Safe.

**Risk 7 — Pair agents run in parallel; service-admin update must wait for all.**
Service-admin composes ALL packages. If Pair A (centymo) finishes before Pair B (entydad), service-admin cannot build until all pairs are done. Phase 3 must be gated on all pair agents reporting build success.
