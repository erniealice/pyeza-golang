# UI Config System — Design Plan

**Date:** 2026-02-01
**Branch:** `dev/20260129-package-ui`
**Status:** In Progress

---

## Overview

Introduce two new configurable design axes — **radius** and **border weight** — to the existing UI design token system. These compose orthogonally with the existing `data-density`, `data-theme`, and `data-font` axes, giving each app full control over visual style via HTML data attributes.

```html
<html
  data-theme="corporate-steel"   <!-- colors & shadows -->
  data-density="compact"          <!-- sizing scale via root font-size -->
  data-font="default"             <!-- font family -->
  data-radius="default"           <!-- NEW: corner rounding scale -->
  data-border="default"           <!-- NEW: border weight -->
>
```

---

## Motivation

The current system already handles density (via rem-scaled root font-size) and color (via theme CSS variables). However:

- **Border radius values are scattered** — ~79 hardcoded `border-radius` declarations across 16+ component files use raw values (`0.5rem`, `12px`, `100px`) instead of the `--radius-*` tokens defined in `layout.css`.
- **Radius is aesthetic, not structural** — a corporate dashboard wants sharp corners; a consumer app wants rounded ones. This preference is independent of density or color theme.
- **Border weight has no config** — `--border-width` exists but is always `1px`. Some designs benefit from borderless (shadow-driven) or heavy-border styles.

---

## Architecture

### Axis: `data-radius`

Controls the `--radius-sm`, `--radius-md`, `--radius-lg`, `--radius-xl` CSS custom properties. Functional shapes (`--radius-full: 9999px`, `--radius-round: 50%`) stay fixed.

| Preset | `--radius-sm` | `--radius-md` | `--radius-lg` | `--radius-xl` | Character |
|--------|---------------|---------------|---------------|---------------|-----------|
| `none` | 0 | 0 | 0.125rem (2px) | 0.25rem (4px) | Sharp / corporate |
| `sm` | 0.1875rem (3px) | 0.375rem (6px) | 0.5rem (8px) | 0.75rem (12px) | Subtle rounding |
| `default` | 0.375rem (6px) | 0.625rem (10px) | 1rem (16px) | 1.5rem (24px) | Current look |
| `lg` | 0.5rem (8px) | 0.875rem (14px) | 1.25rem (20px) | 2rem (32px) | Soft / friendly |
| `full` | 9999px | 9999px | 9999px | 9999px | Pill everything |

### Axis: `data-border`

Controls `--border-width`, `--border-width-thick`, `--border-width-focus`.

| Preset | `--border-width` | `--border-width-thick` | `--border-width-focus` | Character |
|--------|-------------------|------------------------|------------------------|-----------|
| `none` | 0 | 1px | 2px | Borderless / shadow depth |
| `default` | 1px | 2px | 2px | Current look |
| `heavy` | 2px | 3px | 3px | Strong definition |

---

## Implementation Steps

### Phase 1: Token Infrastructure (`layout.css`)
- Add `data-radius` selector blocks with all five presets
- Add `data-border` selector blocks with all three presets
- Separate functional shapes (`--radius-full`, `--radius-round`) into a fixed `:root` block
- Add section header documentation with usage examples

### Phase 2: Hardcoded Radius Migration (Component Files)
Audit and replace all hardcoded `border-radius` values with `var(--radius-*)` references.

**Mapping rules:**

| Raw value | Token |
|-----------|-------|
| 0.25rem, 0.375rem, 0.5rem (4-8px) | `var(--radius-sm)` |
| 0.5625rem, 0.625rem, 0.6875rem, 0.75rem, 0.875rem (9-14px) | `var(--radius-md)` |
| 1rem, 1.125rem, 12px (16-18px) | `var(--radius-lg)` |
| 1.5rem, 20px (24px) | `var(--radius-xl)` |
| 100px, 6.25rem, 9999px | `var(--radius-full)` |
| 50% | `var(--radius-round)` |

**Skip:** Scrollbar radii (4px), tiny decorative indicators (0.0625rem, 0.125rem), and values already using `var()`.

**Files requiring changes (16):**

| File | Hardcoded count | Priority |
|------|----------------|----------|
| chip.css | ~12 | High |
| table.css | ~10 | High |
| tabs.css | ~10 | High |
| sheet.css | ~7 | High |
| button.css | ~4 | High |
| card.css | ~4 | High |
| stat-card.css | ~5 | High |
| badge.css | ~4 | Medium |
| help-pane.css | ~6 | Medium |
| multi-select.css | ~5 | Medium |
| empty-state.css | ~2 | Medium |
| notes-journal.css | ~1 | Low |
| password.css | ~1 | Low |
| toggle.css | ~1 | Low |
| loading-indicator.css | ~1 | Low |
| carousel.css | ~1 | Low |

### Phase 3: App Integration
- Update `app-shell.html` `<html>` tag to include `data-radius` and `data-border` defaults
- Future: expose config in app settings UI

### Phase 4: Documentation
- Create `packages/ui/README.md` documenting the full config system
- Create plan + progress docs in `packages/ui/docs/plan/`

---

## Design Principles

1. **Orthogonal axes** — each config only touches its own variables; no specificity conflicts
2. **Zero-refactor for themes** — theme CSS files only set color/shadow variables; radius/border are independent
3. **Functional shapes stay fixed** — `--radius-full` (pill) and `--radius-round` (circle) are structural, not aesthetic
4. **Partial radii preserved** — values like `var(--radius-md) var(--radius-md) 0 0` maintain directional rounding
5. **Rem-based tokens** — radius tokens scale with density since they are rem-based (intentional: dense + round corners look proportional)

---

## Files Modified

| File | Change |
|------|--------|
| `packages/ui/styles/layout.css` | Add `data-radius` and `data-border` config blocks |
| `packages/ui/styles/button.css` | Replace hardcoded radii with tokens |
| `packages/ui/styles/card.css` | Replace hardcoded radii with tokens |
| `packages/ui/styles/chip.css` | Replace hardcoded radii with tokens |
| `packages/ui/styles/tabs.css` | Replace hardcoded radii with tokens |
| `packages/ui/styles/sheet.css` | Replace hardcoded radii with tokens |
| `packages/ui/styles/badge.css` | Replace hardcoded radii with tokens |
| `packages/ui/styles/stat-card.css` | Replace hardcoded radii with tokens |
| `packages/ui/styles/table.css` | Replace hardcoded radii with tokens |
| `packages/ui/styles/help-pane.css` | Replace hardcoded radii with tokens |
| `packages/ui/styles/multi-select.css` | Replace hardcoded radii with tokens |
| `packages/ui/styles/empty-state.css` | Replace hardcoded radii with tokens |
| `packages/ui/styles/notes-journal.css` | Replace hardcoded radii with tokens |
| `packages/ui/styles/password.css` | Replace hardcoded radii with tokens |
| `packages/ui/styles/toggle.css` | Replace hardcoded radii with tokens |
| `packages/ui/styles/loading-indicator.css` | Replace hardcoded radii with tokens |
| `packages/ui/styles/carousel.css` | Replace hardcoded radii with tokens |
| `apps/recruiter/templates/layout/app-shell.html` | Add data attributes |
| `packages/ui/README.md` | Full config documentation |
