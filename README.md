# @github.com/erniealice/pyeza-golang

Shared design system for Leapfor applications. Provides CSS component styles, design tokens, and theme support.

## Quick Start

Add data attributes to your `<html>` element to configure the UI:

```html
<html lang="en"
  data-theme="warm-cream"
  data-density="compact"
  data-font="default"
  data-radius="default"
  data-border="default"
>
```

## Configuration Axes

The design system is controlled by five independent, orthogonal axes. Each axis only affects its own set of CSS custom properties — they compose freely with no conflicts.

### Theme (`data-theme`)

Controls colors, shadows, and visual tone.

| Value | Description |
|-------|-------------|
| `warm-cream` | Warm neutral tones (default) |
| `corporate-steel` | Cool professional blues/grays |
| `forest-night` | Dark green theme |
| `ocean-deep` | Deep blue theme |
| `paper-ink` | High contrast black/white |
| `peach-fizz` | Soft peach tones |
| `sunset-glow` | Warm orange/gold |
| `minimal-light` | Clean minimal design |

### Density (`data-density`)

Controls the root font-size, which scales ALL rem-based dimensions (spacing, sizing, radii, icons) proportionally.

| Value | Root font-size | Scale |
|-------|---------------|-------|
| `dense` | 12.8px | 80% |
| `compact` | 14.4px | 90% |
| `default` | 16px | 100% |
| `comfortable` | 17.6px | 110% |

### Font (`data-font`)

Controls the font family stack.

| Value | Body Font | Display Font |
|-------|-----------|-------------|
| `default` | Figtree | Playfair Display |
| `modern` | Inter | Inter |
| `classic` | Georgia | Playfair Display |

### Radius (`data-radius`) — NEW

Controls the border-radius scale independently of density. Functional shapes (`--radius-full: 9999px` for pills, `--radius-round: 50%` for circles) stay fixed.

| Value | `--radius-sm` | `--radius-md` | `--radius-lg` | `--radius-xl` | Character |
|-------|---------------|---------------|---------------|---------------|-----------|
| `none` | 0 | 0 | 0.125rem | 0.25rem | Sharp / corporate |
| `sm` | 0.1875rem | 0.375rem | 0.5rem | 0.75rem | Subtle rounding |
| `default` | 0.375rem | 0.625rem | 1rem | 1.5rem | Standard |
| `lg` | 0.5rem | 0.875rem | 1.25rem | 2rem | Soft / friendly |
| `full` | 9999px | 9999px | 9999px | 9999px | Pill everything |

### Border (`data-border`) — NEW

Controls border weight across all components.

| Value | `--border-width` | `--border-width-thick` | `--border-width-focus` | Character |
|-------|-------------------|------------------------|------------------------|-----------|
| `none` | 0 | 1px | 2px | Borderless (shadow depth) |
| `default` | 1px | 2px | 2px | Standard |
| `heavy` | 2px | 3px | 3px | Strong definition |

## CSS Custom Properties

### Radius Tokens

Use these in component styles — never hardcode radius values:

| Token | Default | Usage |
|-------|---------|-------|
| `--radius-sm` | 0.375rem (6px) | Badges, small controls, checkboxes |
| `--radius-md` | 0.625rem (10px) | Buttons, inputs, chips, dropdowns |
| `--radius-lg` | 1rem (16px) | Cards, dialogs, panels, tables |
| `--radius-xl` | 1.5rem (24px) | Large containers, hero sections |
| `--radius-full` | 9999px | Pill shapes (always fixed) |
| `--radius-round` | 50% | Circles, avatars (always fixed) |

### Border Tokens

| Token | Default | Usage |
|-------|---------|-------|
| `--border-width` | 1px | Standard borders |
| `--border-width-thick` | 2px | Emphasis, active states |
| `--border-width-focus` | 2px | Focus indicators |

### Color Tokens

| Token | Usage |
|-------|-------|
| `--accent-primary` | Primary brand color |
| `--accent-terracotta` | Interactive elements, CTAs |
| `--accent-sage` | Success, positive states |
| `--accent-navy` | Info, secondary actions |
| `--accent-amber` | Warnings, attention |
| `--accent-plum` | Special, featured items |
| `--text-primary` | Main text |
| `--text-secondary` | Supporting text |
| `--text-muted` | Disabled/hint text |
| `--bg-card` | Card backgrounds |
| `--bg-base` | Page background |
| `--border` | Default borders |

### Transition Tokens

| Token | Value | Usage |
|-------|-------|-------|
| `--transition-fast` | 0.15s ease | Hover states, small interactions |
| `--transition-base` | 0.25s ease | Standard animations |
| `--transition-slow` | 0.4s ease | Page transitions, panels |

## Component Files

| File | Components |
|------|-----------|
| `alert.css` | Alert banners |
| `avatar.css` | User avatars |
| `badge.css` | Status badges, count badges, nav badges |
| `button.css` | Buttons (primary, secondary, ghost, action) |
| `card.css` | Cards (integration, quick-link, calc-type) |
| `carousel.css` | Carousel/slider |
| `chip.css` | Chips, WIC chips, table chips |
| `dialog.css` | Modal dialogs |
| `dropdown.css` | Dropdown menus |
| `empty-state.css` | Empty state illustrations |
| `form.css` | Form inputs, selects, textareas |
| `help-pane.css` | Help sidebar panel |
| `loading-indicator.css` | Loading spinners |
| `multi-select.css` | Multi-select dropdowns |
| `notes-journal.css` | Notes/journal entries |
| `pagination.css` | Pagination controls |
| `password.css` | Password strength indicator |
| `popover.css` | Popover tooltips |
| `sheet.css` | Slide-in panels (form, notification) |
| `skeleton.css` | Loading skeletons |
| `spinner.css` | Spinner animations |
| `stat-card.css` | Stat cards, mini stats |
| `table.css` | Data tables with toolbar |
| `tabs.css` | Tab variants (pill, underline, sticky) |
| `toast.css` | Toast notifications |
| `toggle.css` | Toggle switches |
| `typography.css` | Text styles, headings |

## File Structure

```
packages/ui/
  styles/
    layout.css          # Design tokens (radius, border, transitions, z-index)
    main-base.css       # Density, fonts, scrollbar, base resets
    themes/
      warm-cream.css
      corporate-steel.css
      forest-night.css
      ocean-deep.css
      paper-ink.css
      peach-fizz.css
      sunset-glow.css
      minimal-light.css
    [component].css     # Component-specific styles
  docs/
    plan/               # Implementation plans
```

## Writing New Components

When creating new component styles:

1. **Use radius tokens** — never hardcode `border-radius` values
   - Small elements (badges, checkboxes): `var(--radius-sm)`
   - Standard elements (buttons, inputs): `var(--radius-md)`
   - Large containers (cards, panels): `var(--radius-lg)`
   - Pills: `var(--radius-full)` — always fixed
   - Circles: `var(--radius-round)` — always fixed

2. **Use border tokens** — `var(--border-width)` instead of `1px`

3. **Use rem units** — so dimensions scale with density

4. **Use transition tokens** — `var(--transition-fast)` instead of `0.2s ease`

5. **Use color tokens** — never hardcode hex/rgb colors
