# UI Config System — Progress Log

**Plan:** [plan.md](./plan.md)
**Started:** 2026-02-01
**Completed:** 2026-02-01

---

## Phase 1: Token Infrastructure — COMPLETE

### `layout.css`
- [x] Added `data-radius` selector blocks (none / sm / default / lg / full)
- [x] Added `data-border` selector blocks (none / default / heavy)
- [x] Separated functional shapes (`--radius-full`, `--radius-round`) into fixed `:root`
- [x] Added section headers and documentation comments with usage examples
- [x] Preserved all existing tokens (transitions, z-index, easing)

---

## Phase 2: Hardcoded Radius Migration — COMPLETE

All 16 component files migrated. Zero hardcoded `border-radius` values remain (verified via grep).

### Batch 1 (manual edits)

| File | Edits | Details |
|------|-------|---------|
| **button.css** | 4 | `.action-btn` -> `--radius-sm`, `.btn-sm` -> `--radius-sm`, `.btn-lg` -> `--radius-md`, `.btn-action` -> `--radius-sm` |
| **card.css** | 4 | `.integration-logo` -> `--radius-md`, `.quick-link-icon` -> `--radius-md`, `.calc-type-card` -> `--radius-lg`, `.calc-type-icon` -> `--radius-md` |
| **chip.css** | 12 | `.chip` -> `--radius-sm`, `.chip-check` -> `--radius-sm`, `.chip.sm` -> `--radius-sm`, `.chip.lg` -> `--radius-md`, `.chip-group-badge` -> `--radius-sm`, `.chip-add-btn` -> `--radius-sm`, `.wic-badge` -> `--radius-sm`, `.wic-chip` -> `--radius-sm`, `.wic-check` -> `--radius-sm`, `.wic-add-btn` -> `--radius-sm`, `.table-chip` -> `--radius-sm`, `.table-cell-chips` -> `--radius-sm` |
| **tabs.css** | 10 | `.tabs` -> `--radius-md`, `.tab` -> `--radius-sm`, `.tab-badge` -> `--radius-md`, `.sub-tab` -> `--radius-sm`, `.client-tab-badge` -> `--radius-md`, `.help-tab` -> `--radius-full`, `.help-tab .count` -> `--radius-md`, `.category-tab` -> `--radius-sm`, `.category-tab .count` -> `--radius-md`, `.tabs @480px` -> `--radius-md` |
| **sheet.css** | 7 | `.sheet-tab` -> `--radius-sm`, `.sheet-mark-all` -> `--radius-sm`, `.sheet-card` -> `--radius-md`, `.sheet-card-icon` -> `--radius-md`, `.sheet-card-dismiss` -> `--radius-sm`, `.sheet-view-all` -> `--radius-md`, `.sheet-badge` -> `--radius-full` |
| **badge.css** | 4 | `.count-badge` -> `--radius-md`, `.count-badge-lg` -> `--radius-md`, `.tab-badge` -> `--radius-md`, `.alert-badge` -> `--radius-sm` |

### Batch 2 (agent — stat-card, table, help-pane)

| File | Edits | Details |
|------|-------|---------|
| **stat-card.css** | 5 | `.stat-icon` -> `--radius-md`, `.stat-trend` -> `--radius-full`, `.stat-mini` -> `--radius-md`, `.stat-mini-icon` -> `--radius-md`, `.connected-stats` -> `--radius-md` |
| **table.css** | ~10 | `.row-checkbox` -> `--radius-sm`, `.action-btn` -> `--radius-sm`, `.action-dropdown-btn` -> `--radius-sm`, `.action-dropdown-item` partial radii -> `--radius-md`, `.cell-badge` -> `--radius-sm`, `.code-badge` -> `--radius-sm`, density variants -> tokens |
| **help-pane.css** | ~6 | All hardcoded radii replaced with `--radius-sm` or `--radius-md` |

### Batch 3 (agent — 7 remaining files)

| File | Edits | Details |
|------|-------|---------|
| **multi-select.css** | ~5 | 0.375rem -> `--radius-sm`, 50% -> `--radius-round`, 0.25rem -> `--radius-sm` |
| **empty-state.css** | ~2 | 20px -> `--radius-xl`, 12px -> `--radius-md` |
| **notes-journal.css** | ~1 | 0.5rem -> `--radius-sm` |
| **password.css** | ~1 | 0.375rem -> `--radius-sm` |
| **toggle.css** | ~1 | 100px -> `--radius-full` |
| **loading-indicator.css** | ~1 | 50% -> `--radius-round` |
| **carousel.css** | ~1 | 50% -> `--radius-round` |

### Final Verification
- `grep -r 'border-radius:' --include='*.css' | grep -v 'var('` across all styles/ → **0 matches**
- All functional shapes (50%, 9999px) correctly use `--radius-round` or `--radius-full`

---

## Phase 3: App Integration — COMPLETE

- [x] Updated `app-shell.html` `<html>` tag:
  ```html
  <html lang="en" data-density="compact" data-radius="default" data-border="default">
  ```

---

## Phase 4: Documentation — COMPLETE

- [x] Created `packages/ui/README.md` (199 lines)
  - Documents all 5 config axes with preset tables
  - CSS custom property reference
  - Component file listing
  - File structure overview
  - Writing guidelines for new components

---

## Skipped Values (by design)

These hardcoded values were intentionally left as-is:

| Value | Reason |
|-------|--------|
| `4px` (scrollbar radii) | Browser scrollbar styling, not part of design system |
| `0.0625rem` (1px) | Tiny decorative detail in density preview lines |
| `0.125rem 0.125rem 0 0` | Tab underline indicator caps — decorative, not structural |
| `0.1875rem` (3px, scrollbar thumb) | Scrollbar styling |
