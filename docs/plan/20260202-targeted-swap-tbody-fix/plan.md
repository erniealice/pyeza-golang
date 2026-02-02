# Targeted Swap tbody Fix — Design Plan

**Date:** 2026-02-02
**Branch:** `dev/20260129-package-ui` (current branch)
**Status:** In Progress
**App/Package:** ui + recruiter (cross-cutting)

---

## Overview

Fix the targeted table swap so that **pagination button clicks update the actual row data**,
not just the footer. The targeted swap (fetch + DOMParser) correctly replaces the footer and
metadata, but silently fails to replace the tbody rows due to HTML5 parser context rules.

---

## Motivation

The targeted swap optimization was introduced to eliminate the full-page blink during
server-side pagination by replacing only `<tbody>` + footer instead of the entire
`.table-card`. The footer and metadata update correctly, but the row content stays on
page 1 data regardless of which page is selected.

**Current symptom:**
- `http://localhost:8100/app/clients/list/active` — works (full page load)
- `http://localhost:8100/app/clients/list/active?page=2` — works (full page load with URL)
- Clicking pagination buttons — footer says "26 to 50" but rows still show page 1 data

---

## Root Cause Analysis

### Bug chain (3 layers deep)

**Layer 1: HTMX innerHTML parsing (original approach — failed)**

HTMX's `htmx.ajax()` parses responses by setting `innerHTML` on a temporary `<div>`.
When the response starts with `<tbody>`, the browser auto-wraps it in `<table>`, which
mangles the sibling OOB `<div>` elements. Result: duplicate footers, broken OOB swaps.

**Layer 2: DOMParser `replaceWith` (first fix — failed)**

Switched to `fetch()` + `DOMParser.parseFromString(html, 'text/html')`. DOMParser creates
a full document, but `<tbody>` at the document body level is still an **HTML5 parse error**.
The parser ignores the `<tbody>` start tag (including all attributes like `id`). The `<tr>`
children trigger auto-creation of `<table><tbody>`, but the auto-generated `<tbody>` has
**no id attribute**. So `doc.getElementById('clientsTable-body')` returns `null`, and
`replaceWith` silently skips.

**Layer 3: querySelector fallback + innerHTML (second fix — current state, untested)**

Added `doc.querySelector('tbody')` as fallback and switched from `replaceWith` to
`innerHTML` swap. This should work because:
- `querySelector('tbody')` finds the auto-generated tbody (which has the correct rows)
- `innerHTML` preserves the live element's id attribute
- Only the row content inside is replaced

**Status:** The fix is in the file but may not have been tested with a server restart.

### Why DOMParser strips `<tbody>` attributes

Per the HTML5 parsing spec (section 12.2.6.4 "in body" insertion mode):
1. `<tbody>` encountered → parse error → **token is ignored** (tag + all attributes lost)
2. `<tr>` encountered → parse error → auto-insert `<table>` + `<tbody>` → process `<tr>`
3. The auto-generated `<tbody>` has no attributes (no id, no class, nothing)
4. `<div>` elements after `</tbody>` are valid in body context → parsed normally with IDs

This is why `getElementById` fails for tbody but succeeds for footer and meta divs.

---

## Implementation Steps

### Phase 1: Verify the innerHTML fix

The `innerHTML` fix is already in the codebase. Verify it works:

1. Restart the Go server to pick up the updated JS
2. Navigate to `http://localhost:8100/app/clients/list/active`
3. Click "Next »" — verify rows change AND footer changes
4. Check console for `[TableServer] Targeted swap via fetch` + `Targeted swap complete`
5. Test: page numbers, prev, next, search, entries selector change

**If it works:** done. Skip Phase 2.

### Phase 2: Alternative fix if innerHTML approach fails

If `doc.querySelector('tbody')` returns null or the innerHTML is empty, the auto-generated
tbody might not contain the expected rows. In that case, use **string-based extraction**
instead of DOMParser:

**Option A: Wrap server response in a `<table>` context**

Modify the Go template `table-body-partial` to wrap the tbody in a `<table>`:
```html
<table id="{{.ID}}-swap-carrier" style="display:none">
<tbody id="{{.ID}}-body">
    ...rows...
</tbody>
</table>
<div id="{{.ID}}-footer" hx-swap-oob="outerHTML">...</div>
<div id="{{.ID}}-meta" hx-swap-oob="outerHTML" hidden>...</div>
```

Then in JS, DOMParser will parse the `<tbody>` correctly (it's inside a `<table>`):
```javascript
var newBody = doc.getElementById(baseId + '-body'); // Now works!
```

**Option B: Use `createContextualFragment` with a table context**

Instead of DOMParser, create a temporary `<table>` element and parse in table context:
```javascript
var tempTable = document.createElement('table');
tempTable.innerHTML = html.match(/<tbody[\s\S]*?<\/tbody>/)[0];
var newBody = tempTable.querySelector('tbody');
```

**Recommended: Option A** — it's the most robust because DOMParser gets the correct
context from the HTML itself and all three elements (tbody, footer, meta) are found by ID.

---

## File References

| File | Change | Phase |
|------|--------|-------|
| `packages/ui/assets/js/table/table-server.js:210-213` | innerHTML fix already applied — verify it works | 1 |
| `packages/ui/_components/table.html:790-823` | Wrap tbody in `<table>` carrier (only if Phase 1 fails) | 2 |
| `packages/ui/assets/js/table/table-server.js:210` | Update to use `getElementById` on wrapped tbody (only if Phase 1 fails) | 2 |

---

## Context & Sub-Agent Strategy

**Estimated files to read:** ~5
**Estimated files to modify:** 1-2
**Estimated context usage:** Low (<10 files)

No sub-agents needed. This is a focused 1-2 file fix.

---

## Risk & Dependencies

| Risk | Impact | Mitigation |
|------|--------|------------|
| `querySelector('tbody')` returns null | Medium — rows still won't update | Fall through to Phase 2 (wrap in `<table>` carrier) |
| Wrapping tbody in `<table>` carrier breaks footer/meta OOB | Low — DOMParser handles mixed table+div content | Test with Playwright after change |
| `innerHTML` swap loses event listeners on row elements | Low — row listeners are delegated from card | Verify row actions (view, edit, delete) still work |

---

## Acceptance Criteria

- [ ] Clicking "Next »" updates rows to page 2 data
- [ ] Clicking "« Prev" updates rows back to page 1 data
- [ ] Page number buttons update rows correctly
- [ ] Search input retains focus during debounced search
- [ ] Search results show filtered rows (not stale data)
- [ ] Entries selector change updates rows
- [ ] Footer shows correct "Showing X to Y of Z" after every interaction
- [ ] Browser URL updates correctly via `history.replaceState()`
- [ ] No console errors
- [ ] No duplicate footers in the DOM
- [ ] Full page load with `?page=2` in URL still works
- [ ] Row actions (view, edit, delete) still work after targeted swap
- [ ] Toolbar is NOT re-rendered during pagination (no blink)
- [ ] Build passes

---

## Design Decisions

### Why innerHTML instead of replaceWith?

`replaceWith` replaces the entire element, which means the new element must have the
correct `id` attribute. Since DOMParser strips the id from `<tbody>`, the replacement
element has no id, breaking subsequent lookups. `innerHTML` preserves the existing element
(with its id) and only replaces the child content.

### Why querySelector('tbody') as fallback?

When DOMParser ignores the `<tbody>` tag, the `<tr>` children trigger auto-creation of
`<table><tbody>`. The auto-generated tbody has no id but is findable by tag name via
`querySelector('tbody')`. This is a reliable fallback because the parsed document will
only have one tbody (from our response content).

### Why Option A (table carrier) over Option B (regex extraction)?

Option A lets the HTML parser do its job correctly by providing the right context.
Option B relies on regex to extract HTML fragments, which is fragile and error-prone.
Option A also means `getElementById` works for all three elements (tbody, footer, meta)
without any fallbacks.
