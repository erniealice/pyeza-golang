# Pyeza Table — Sort + Select-All Overhaul — Design Plan

**Date:** 2026-05-01
**Branch:** `dev/20260501-table-sort-and-select-all`
**Status:** Draft
**App/Package:** `packages/pyeza-golang` (with sweep into ~37 list pages across `entydad-golang`, `centymo-golang`, `fycha-golang`, `fayna-golang`, `cyta-golang`, plus `service-admin`)

---

## Overview

Two related table problems:

1. **Sort is broken or invisible.** Even when a list view sets `Sortable: true` and emits a `ServerPagination.SortColumn`, the user sees no direction icon and the first header click rarely flips correctly. Three independent bugs (CSS selector, server-render class plumbing, JS direction detection) compound. Plus consumers must opt into sort per-column — most don't, so most columns aren't sortable at all.
2. **Select-all UX is upside-down.** The header `<th>` checkbox already correctly selects only the current page. The bulk toolbar's `[data-action="select-all"]` button is *hidden* during partial selection, then morphs into a confusingly-labeled "Select all 847" only after every page row is checked. Users want the button always-present with a clear label, then a second-stage label for cross-page selection.

This plan ships a focused fix in five committable phases: sort bugs → default-on sortable → per-type sort semantics → column-selector lock → select-all button mode machine.

---

## Motivation

Sort and select-all are foundational table affordances. Every list page in the monorepo (~115 templates calling `table-card`, ~127 Go files building `TableConfig`) inherits the current behavior. The CSS bug means *no* server-sorted column ever shows a direction arrow — across the entire product. The first-click direction bug means even users who realize a column is sortable get a no-op flip on their first attempt. Together these silently degrade trust in every list page.

Select-all has the same blast radius. Today, even on tables with bulk actions, users must check the header box, then *also* hunt for a faintly-relabeled "Select all 847" button to operate cross-page. Shifting to an always-visible, mode-aware button removes the discovery problem.

---

## Architecture

### Sort state machine (after this plan)

```
                      ┌──────────────────────────────┐
                      │  Server render: ?sort=name   │
                      │  &dir=asc                    │
                      └──────────────┬───────────────┘
                                     │
                                     ▼
                  <th class="sortable active sort-asc"
                      data-sort="name"
                      data-sort-direction="asc"
                      data-sort-kind="text"
                      aria-sort="ascending">
                    <button class="sort-btn">Name</button>
                    <span class="sort-indicator">
                      <span class="sort-asc active"><svg…/></span>   ← actually visible now
                      <span class="sort-desc"><svg…/></span>
                    </span>
                  </th>
                                     │
                       click ────────┤
                                     ▼
                JS reads data-sort-direction → flips to "desc"
                JS swaps th class sort-asc → sort-desc
                JS calls TableServer.executeServerRequest(...)
```

### Select-all button mode machine (after this plan)

```
selectedIds = ∅   ─────►  hidden  (no bulk mode active)

selectedIds size < pageRows  ─────►  data-mode="page"
                                     "Select All items in this page"

selectedIds == pageRows AND
  serverPaginated AND
  totalRows > pageRows AND
  !allResultsSelected            ─────►  data-mode="all-pages"
                                         "Select all 847 across all pages"

allResultsSelected                ─────►  data-mode="clear"
                                          "Clear selection"

selectedIds == pageRows AND
  (!serverPaginated OR
   totalRows <= pageRows)         ─────►  hidden
```

### Per-cell-type sort semantics

Auto-derive `SortKind` from the first cell type in the column when the consumer doesn't override:

| TableCell.Type                                     | SortKind | Initial dir | Asc label    | Desc label   |
|----------------------------------------------------|----------|-------------|--------------|--------------|
| `text`, `name`, `link`, `email`, `phone`, `html`   | `text`   | `asc`       | A → Z        | Z → A        |
| `number`, `money`                                  | `number` | `desc`      | Low → High   | High → Low   |
| `datetime`, `author`                               | `date`   | `desc`      | Oldest → Newest | Newest → Oldest |
| `badge`, `select`                                  | `enum`   | `asc`       | Grouped      | Grouped (reverse) |
| `chips`, `single-person`, `multi-person`           | `text`   | `asc`       | A → Z        | Z → A        |

User-confirmed defaults: `number`/`money` → `desc` (largest first), `datetime`/`author` → `desc` (newest first).

---

## Implementation Steps

Five phases. Each is independently committable. Phases 1–4 land in the `pyeza-golang` submodule; phase 5 also lives in pyeza. The submodule pointer bump in the parent `ichizen-golang` repo is the **final step** after all phases land in pyeza.

### Phase 1 — Sort bug fixes (CSS selector, server-render classes, JS direction)

Three small, surgical fixes. Land first because subsequent phases depend on the corrected baseline behavior.

- **`packages/pyeza-golang/web/styles/components/table.css:772-786`** — extend the override selectors so they target the SVG inside the inner span, not the span itself:
  ```css
  .data-table th.sort-asc  .sort-indicator .sort-asc  svg { display: block; }
  .data-table th.sort-desc .sort-indicator .sort-desc svg { display: block; }
  ```
- **`packages/pyeza-golang/web/templates/components/table/table.html:147-198`** — both header branches (column-sub-header for grouped, standard for ungrouped). When `$isActive`, append `sort-{{$activeDirection}}` to the `<th>` class list (today only `sortable active` are added). Also keep emitting `data-sort-direction` (already present at line 153 / 184) so JS can read it.
- **`packages/pyeza-golang/web/js/table/table-sort.js:92-102`** — change first-click direction detection. New rule:
  1. If `th.dataset.sortDirection` is `asc`, flip to `desc`.
  2. Else if `th.dataset.sortDirection` is `desc`, flip to `asc`.
  3. Else (no current sort), pick the **kind-appropriate default** from `th.dataset.sortKind` (added in Phase 3; for now default to `asc` if missing).

**Files:** 3 modified, 0 created.

### Phase 2 — Default-on Sortable (NoSort opt-out)

Inverts the default so every column with a `Key` is sortable unless explicitly opted out. Checkbox + actions columns are rendered by separate `<th>` blocks outside the `range .Columns` loop and are naturally excluded.

- **`packages/pyeza-golang/types/table.go`**
  - Add `NoSort bool` to `TableColumn` (line 36-49). Doc comment: *"When true, this column is not sortable. Default false (sortable). Use for derived columns where ORDER BY has no meaning, e.g., computed fields without a stable backing column."*
  - **Remove `Sortable bool` field entirely** (user decision: drop deprecated field now). The same Phase 2 sweep that converts `Sortable: false` → `NoSort: true` also deletes every `Sortable: true` line, leaving no references behind.
  - `SortableKeys()` (line 546-554): rewrite as `if !c.NoSort && c.Key != ""`.
- **`packages/pyeza-golang/web/templates/components/table/table.html:153-160` and `:184-191`** — change `{{if .Sortable}}` checks to `{{if not .NoSort}}` in both grouped + ungrouped header branches.
- **`packages/pyeza-golang/web/templates/components/table/table-toolbar.html:123-137`** — change the sort dropdown's `{{range .Columns}} {{if .Sortable}}` to `{{if not .NoSort}}`.
- **Sweep ~37 list/page.go consumers** (find with `find packages -path "*/views/*/list/page.go" | xargs grep -l "Sortable:"`):
  - **Delete** every `Sortable: true` line (the field no longer exists; build would fail otherwise).
  - Convert `Sortable: false` → `NoSort: true`.
  - Also grep the broader codebase for any other readers of `col.Sortable` (e.g., view helpers, templates that use `{{.Sortable}}` outside the table component) and migrate them to `!col.NoSort`. Required to keep the build green now that the field is gone.
  - Lists where derived/computed columns currently have `Sortable: false`: `inventory.available`, `inventory.reorder_level`, `inventory.tracking_mode`, `inventory.sku`, `product.description`, `product.line`, etc. Verify each — some that were marked `Sortable: false` are actually backed by stable columns and could become sortable.
- **`packages/espyna-golang/contrib/http/params.go::ParseTableParams`** callers — switch `allowedSortColumns` arg from hand-written slices (e.g., `priceScheduleAllowedSortCols = []string{"date_created", "date_modified", "name", "status"}`) to call-site-derived `types.SortableKeys(cols)`. Net effect: sort whitelist grows automatically as columns are added; columns marked `NoSort: true` stay excluded. **Defer** the call-site sweep if it bloats the diff — leave the existing slices as a safety net for now and migrate in a follow-up.

**Files:** 2 pyeza files modified, ~37 consumer page.go files modified, 0 created.

### Phase 3 — Per-cell-type sort semantics + lyngua-driven dropdown labels

- **`packages/pyeza-golang/types/table.go`**
  - Add `SortKind string` to `TableColumn`. Allowed values: `"text"`, `"number"`, `"date"`, `"enum"`. Empty = auto-derive from first cell type in column.
  - Add `DeriveSortKind(col TableColumn, rows []TableRow) string` helper (or run inside `ApplyColumnStyles`) — looks at `rows[0].Cells[colIndex].Type` and maps via the table in §Architecture. Result memoized onto `TableColumn.SortKind` post-derivation so the template doesn't re-walk rows.
  - Extend `TableLabels` (line 239-272) with eight new fields:
    ```go
    SortAscText     string  // "A → Z"
    SortDescText    string  // "Z → A"
    SortAscNumber   string  // "Low → High"
    SortDescNumber  string  // "High → Low"
    SortAscDate     string  // "Oldest → Newest"
    SortDescDate    string  // "Newest → Oldest"
    SortAscEnum     string  // "Grouped"        — confirmed labels for now; revisit if usage shows ambiguity
    SortDescEnum    string  // "Grouped (reverse)"
    ```
- **`packages/pyeza-golang/web/templates/components/table/table.html`** — emit `data-sort-kind="{{.SortKind}}"` on each sortable `<th>` in both header branches.
- **`packages/pyeza-golang/web/templates/components/table/table-toolbar.html:123-137`** — extend the sort dropdown row to render kind-appropriate labels. Replace the bare arrow buttons with two labeled options:
  ```html
  <div class="sort-option" data-sort="{{.Key}}" data-sort-kind="{{.SortKind}}">
      <span class="sort-option-label">{{.Label}}</span>
      <div class="sort-option-direction">
          <button type="button" class="sort-dir-btn" data-direction="asc" aria-label="...">
              {{template "icon-arrow-up" $}}
              <span class="sort-dir-label">{{ascLabel $.Labels .SortKind}}</span>
          </button>
          <button type="button" class="sort-dir-btn" data-direction="desc" aria-label="...">
              {{template "icon-arrow-down" $}}
              <span class="sort-dir-label">{{descLabel $.Labels .SortKind}}</span>
          </button>
      </div>
  </div>
  ```
  Add small template funcs `ascLabel` / `descLabel` registered via `pyeza.RegisterTemplateFuncs` (or a local funcmap inside the renderer). They map `(labels, kind)` → the right `SortAsc{Kind}` / `SortDesc{Kind}` field.
- **`packages/pyeza-golang/web/js/table/table-sort.js`** — Phase 1's direction-detection rule (3): consult `th.dataset.sortKind` and pick `asc` for `text`/`enum`, `desc` for `number`/`date`. Also propagate `data-sort-kind` from `<th>` into the request as `?kind=` (optional — server may ignore; useful for analytics).
- **Lyngua keys** — add to `packages/lyngua/translations/en/common/common.json` (under existing `table.` namespace) under a `table` namespace (or wherever pyeza's TableLabels are sourced — verify path during implementation; likely `packages/lyngua/translations/en/general/pyeza.json` based on how `TableLabels` flow into views). Eight new keys matching the Go field names.
- **`packages/pyeza-golang/web/styles/components/table.css`** — small style for `.sort-dir-label` (e.g., `font-size: 0.75rem; margin-left: 0.25rem; color: var(--text-muted)`).

**Files:** ~5 pyeza files modified, 1-2 lyngua JSON files modified, 0 created.

### Phase 4 — Column selector aware of active sort

- **`packages/pyeza-golang/web/templates/components/table/table-toolbar.html:144-159`** — the columns dropdown:
  - Add `data-sort-active-column="{{if .ServerPagination}}{{.ServerPagination.SortColumn}}{{end}}"` to `<div class="toolbar-dropdown-menu columns-menu">`.
  - For the `<input type="checkbox">` at line 153, branch: when `$col.Key` matches the active sort column, emit `disabled` and add a hint sibling:
    ```html
    {{$isActiveSort := false}}
    {{if $.ServerPagination}}{{if eq $.ServerPagination.SortColumn $col.Key}}{{$isActiveSort = true}}{{end}}{{end}}
    <label class="column-toggle{{if $isActiveSort}} column-toggle-locked{{end}}">
        <input type="checkbox" checked
               data-column="{{$col.Key}}"
               data-index="{{$index}}"
               {{if $isActiveSort}}disabled{{end}}>
        <span>{{$col.Label}}</span>
        {{if $isActiveSort}}
        <small class="column-toggle-hint">{{$.Labels.ColumnSortLockedHint}}</small>
        {{end}}
    </label>
    ```
- **`packages/pyeza-golang/types/table.go::TableLabels`** — add `ColumnSortLockedHint string`.
- **Lyngua key** — `table.columnSortLockedHint` (in `common.json`, root `table` namespace) = `"Change the sort column before hiding this one."`
- **`packages/pyeza-golang/web/js/table/table-columns.js`** — early-return on disabled checkboxes (defensive; the `disabled` attribute already prevents change events but be explicit). When sort changes (listen for the same `executeServerRequest` callback that swaps the table partial), re-evaluate the lock by reading the freshly-swapped `data-sort-active-column` attribute and toggling `disabled`.
- **`packages/pyeza-golang/web/styles/components/table.css`** — small style:
  ```css
  .column-toggle-locked { opacity: 0.6; cursor: not-allowed; }
  .column-toggle-locked input { cursor: not-allowed; }
  .column-toggle-hint { display: block; font-size: 0.75rem; color: var(--text-muted); margin-top: 0.125rem; padding-left: 1.5rem; }
  ```

**Files:** 4 pyeza files modified, 1 lyngua JSON modified, 0 created.

### Phase 5 — Select-all button mode machine

- **`packages/pyeza-golang/web/templates/components/table/table-toolbar.html` `table-bulk-toolbar`** (lines 9-44) — add the select-all button always-present (don't gate on a server flag):
  ```html
  <button type="button"
          class="bulk-select-all-btn"
          data-action="select-all"
          data-mode="page"
          aria-live="polite">
      {{.Labels.BulkSelectAllPage}}
  </button>
  ```
  Today there's already a `bulk-select-all-btn` at line 19 — replace with the data-mode-aware version. Initial label = `BulkSelectAllPage`. JS rewrites label and `data-mode` based on state.
- **`packages/pyeza-golang/types/table.go::TableLabels`** — add three fields:
  ```go
  BulkSelectAllPage         string  // "Select All items in this page"
  BulkSelectAllAcrossPages  string  // "Select all {N} across all pages"
  BulkClearSelection        string  // "Clear selection"
  ```
- **Lyngua keys** — three new keys under the existing pyeza table namespace. Use `{N}` placeholder for the cross-pages label (the user-confirmed exact wording is *"Select all {N} across all pages"*). Note: existing pyeza patterns use `{{count}}` for bulk-confirm messages — `{N}` is the user's chosen convention here for the user-facing select-all label and JS does a literal `.replace('{N}', totalRows)`.
- **`packages/pyeza-golang/web/js/table/table-selection.js:285-313`** — replace the select-all button branch in `updateBulkSelectionUI` with a mode resolver:
  ```js
  function resolveSelectAllMode(card, allChecked, totalRows, pageRows, allResultsSelected, isServerPaginated) {
      if (allResultsSelected) return 'clear';
      if (!allChecked) return 'page';
      // allChecked is true here
      if (isServerPaginated && totalRows > pageRows) return 'all-pages';
      return 'hidden';
  }

  function applySelectAllMode(btn, mode, totalRows, labels) {
      switch (mode) {
          case 'hidden':
              btn.style.display = 'none';
              btn.dataset.mode = '';
              return;
          case 'page':
              btn.textContent = labels.bulkSelectAllPage;
              btn.dataset.mode = 'page';
              btn.style.display = '';
              return;
          case 'all-pages':
              btn.textContent = labels.bulkSelectAllAcrossPages.replace('{N}', totalRows);
              btn.dataset.mode = 'all-pages';
              btn.style.display = '';
              return;
          case 'clear':
              btn.textContent = labels.bulkClearSelection;
              btn.dataset.mode = 'clear';
              btn.style.display = '';
              return;
      }
  }
  ```
  Labels reach the JS via a small `data-labels-json` attribute on the bulk toolbar (or inline a `<script type="application/json">` block — pick whichever the codebase already does for `filterColumnsJSON`). The latter is already in use at `table-toolbar.html:96-98`, so reuse the pattern: `<script type="application/json" id="{{.ID}}-bulk-labels">{...}</script>`.
- **Click handler dispatch** — `selectAllBtnHandler` (lines 141-167) becomes:
  ```js
  switch (btn.dataset.mode) {
      case 'page':
          // existing behavior: check all visible row checkboxes
          break;
      case 'all-pages':
          // existing behavior: enter allResultsSelected, fetchAllResultIds
          break;
      case 'clear':
          clearAllSelections(table, card, state.selectedIds, selectedCountEl, selectAllCheckbox);
          break;
  }
  ```
- **Cross-page invalidation on sort/filter change: not needed.** Verified `packages/pyeza-golang/web/styles/components/table.css:2394-2396` — `.table-card[data-bulk-mode="true"] .table-toolbar { display: none }` hides the entire regular toolbar (sort dropdown, columns dropdown, filters, search) while bulk mode is active. Sort/filter changes are not reachable through the UI while a cross-page selection is held, so no invalidation logic is required. Skipping the `table-server.js` edit.

**Files:** ~3 pyeza files modified, 1 lyngua JSON modified, 0 created.

### Phase 6 — Submodule pointer bump (final step)

After phases 1-5 land in `packages/pyeza-golang` (its own repo), update the parent monorepo:

```bash
cd packages/pyeza-golang && git log -1 --format=%H
cd ../.. && git add packages/pyeza-golang && git commit -m "20260501: bump pyeza submodule (table sort fixes + select-all overhaul)"
```

Then in `apps/service-admin`, restart the dev server so the templates re-copy from the updated module cache, and run the manual smoke checklist (Acceptance Criteria below).

---

## File References

| File | Change | Phase |
|------|--------|-------|
| `packages/pyeza-golang/web/styles/components/table.css` | Fix `.sort-indicator svg` override; add `.sort-dir-label`, `.column-toggle-locked`, `.column-toggle-hint` styles | 1, 3, 4 |
| `packages/pyeza-golang/web/templates/components/table/table.html` | Append `sort-{dir}` to `<th>` on server render; emit `data-sort-kind`; switch `Sortable` → `not NoSort` | 1, 2, 3 |
| `packages/pyeza-golang/web/templates/components/table/table-toolbar.html` | `Sortable` → `not NoSort` in sort dropdown; kind-aware labels; columns dropdown lock + hint; bulk select-all button data-mode | 2, 3, 4, 5 |
| `packages/pyeza-golang/web/js/table/table-sort.js` | Read `data-sort-direction` for first-click flip; consult `data-sort-kind` for default direction | 1, 3 |
| `packages/pyeza-golang/web/js/table/table-columns.js` | No-op disabled checkbox clicks; re-evaluate lock on swap | 4 |
| `packages/pyeza-golang/web/js/table/table-selection.js` | Replace `updateBulkSelectionUI` select-all branch with mode resolver; click handler switch on `data-mode` | 5 |
| ~~`packages/pyeza-golang/web/js/table/table-server.js`~~ | ~~Invalidate `allResultsSelected` when sort/filter/search changes~~ — **dropped**: bulk mode hides the regular toolbar so the change is unreachable through the UI | 5 |
| `packages/pyeza-golang/types/table.go` | Add `NoSort bool`, `SortKind string`, **delete `Sortable bool`**; extend `TableLabels` with sort kind labels + `ColumnSortLockedHint` + 3 bulk labels; rewrite `SortableKeys()`; add `DeriveSortKind` helper | 2, 3, 4, 5 |
| `packages/lyngua/translations/en/common/common.json` (under existing `table.` namespace) (or matching path) | New keys: 8 sort-kind labels, `columnSortLockedHint`, 3 bulk labels | 3, 4, 5 |
| ~37 × `packages/{centymo,entydad,fycha,fayna,cyta,...}/views/*/list/page.go` | Drop `Sortable: true`, convert `Sortable: false` → `NoSort: true` | 2 |
| `packages/espyna-golang/contrib/http/params.go` callers (deferred) | Switch hand-written `allowedSortColumns` to `types.SortableKeys(cols)` | 2 (deferred) |

---

## Context & Sub-Agent Strategy

**Estimated files to read:** ~15 (mostly already read in conversation)
**Estimated files to modify:** ~50 (8 pyeza + 1-2 lyngua + ~37 consumer page.go + 1 espyna deferred)
**Estimated context usage:** Medium (40-60 files), but most consumer edits are mechanical 1-2 line changes.

**Per-phase budget:**
- Phase 1: Low. 3 files, surgical edits.
- Phase 2: Medium. 2 pyeza files + sweep of 37 list pages. Mechanical sweep — could delegate to an Explore + Edit sub-agent that reports a diff, then I review.
- Phase 3: Low–Medium. 5 pyeza files, 1-2 lyngua JSON files. New template funcs need careful registration.
- Phase 4: Low. 4 pyeza files, 1 lyngua JSON.
- Phase 5: Medium. 3 pyeza files (template + 2 JS) + lyngua. The mode machine is the most subtle piece — needs careful state tracing through the existing `tableState` Map.

**Sub-agent strategy:**
- **Phase 2 sweep: confirmed delegated** to one `Explore`+`Edit` sub-agent (general-purpose, sonnet). Agent prompt:
  1. Read `packages/pyeza-golang/types/table.go` and confirm `Sortable bool` is gone, `NoSort bool` is the new field.
  2. Run `grep -rn "Sortable:" packages apps` and `grep -rn "\.Sortable" packages apps` for the full reader list.
  3. For each `list/page.go`: delete `Sortable: true` lines outright; rewrite `Sortable: false` → `NoSort: true`.
  4. For any other readers (templates, helpers): rewrite `.Sortable` access to `(not .NoSort)` (templates) or `!col.NoSort` (Go).
  5. Report back with a unified diff and a per-file count summary; do NOT commit. I review and apply.
- All other phases: single-session, no sub-agents.

---

## Risk & Dependencies

| Risk | Impact | Mitigation |
|------|--------|------------|
| Deleting `Sortable bool` field breaks builds if any non-list code (view helpers, custom templates) reads `col.Sortable` | Medium — build error | Phase 2 sweep includes a global `grep -rn "\.Sortable" packages apps` to find every reader; migrate each to `!col.NoSort` before the field is deleted. Compile-fail is the safety net — no silent regressions. |
| `ParseTableParams` `allowedSortColumns` slices become stale as columns are added | Low — sort silently falls back to default | Defer the call-site sweep; document it as follow-up. Existing slices act as a safety net. |
| Cross-page selection invalidation on sort change surprises users mid-action | Low — destructive but recoverable | Console log + future toast notification (out of scope this pass). Add to Open Questions. |
| Lyngua label keys mis-namespaced and don't reach `TableLabels` | Medium — labels render empty | Verify the existing label flow (`pyeza.json` namespace → Go struct field) by reading one current key (e.g., `Labels.SelectAll`) end-to-end before adding new ones. |
| Template func registration for `ascLabel` / `descLabel` unfamiliar | Low — wrong location bricks all templates | Use existing `dict` pattern for ad-hoc lookups instead: `{{index .Labels (printf "SortAsc%s" .SortKind)}}` — reflection-based, no func reg needed. |

**Dependencies:**
- Phase 1 must land before Phase 3 (Phase 3 extends Phase 1's JS direction logic with `data-sort-kind`).
- Phase 2 must land before Phase 4 (column selector lock assumes `NoSort`-aware sortable column iteration).
- Phase 5 is independent of Phases 1-4 (different code paths). Can land in parallel.
- Phase 6 (submodule bump) is last.

---

## Acceptance Criteria

Manual smoke in `service-admin` against any list page with `ServerPagination` enabled (recommended: `price_schedule`, `client`, or `inventory`):

- [ ] **Sort icons visible.** Visit a list page with a default sort (e.g., `?sort=name&dir=asc`). The Name column header shows an up arrow in `--accent-terracotta`.
- [ ] **First click flips correctly.** Click the Name column header. Direction flips to desc, down arrow shows, URL becomes `?sort=name&dir=desc`, table reloads sorted descending.
- [ ] **Second column sortable.** Click any other column header (e.g., Date Created). Sort indicator moves to that column, previous column's indicator clears.
- [ ] **All non-checkbox/actions columns are sortable** by default. Verify by hovering — every header except select-all and actions shows a hand cursor.
- [ ] **Per-type dropdown labels.** Open the Sort toolbar dropdown. Text columns show "A → Z" / "Z → A"; money columns show "Low → High" / "High → Low"; date columns show "Oldest → Newest" / "Newest → Oldest".
- [ ] **Column selector lock.** Open the Columns toolbar dropdown. The currently-sorted column's checkbox is disabled and has the hint text below it: *"Change the sort column before hiding this one."* Clicking it does nothing.
- [ ] **Column lock follows sort.** Change sort to a different column. Re-open Columns dropdown — lock has moved to the new column.
- [ ] **Select-all (page mode).** Open a list page with bulk actions enabled (e.g., `client` list). Click any row's checkbox. Bulk toolbar appears with button labeled *"Select All items in this page"*.
- [ ] **Select-all (all-pages mode).** Click that button. All visible page rows check, button relabels to *"Select all 847 across all pages"* (where 847 = total). Click button again. Counter jumps to total, rows on subsequent pages reflect selection on navigation.
- [ ] **Clear selection.** Once cross-page selected, button label is *"Clear selection"*. Clicking it clears every row check and exits bulk mode.
- [ ] **Cross-page invalidation.** With cross-page selected, change sort or filter. Selection clears (console log present).
- [ ] **Build passes.** `go build ./...` from monorepo root, no type errors.
- [ ] **No hardcoded English in templates.** Grep `packages/pyeza-golang/web/templates/components/table/` for the literal strings *"Select all"*, *"Sort"*, *"A →"*, etc.; all should come from `.Labels.*`.

---

## Design Decisions

### Why `NoSort bool` instead of inverting `Sortable bool` to `*bool`?

A `*bool` (nil-distinguishable) field would let us silently change the default without touching call sites. But:
1. Pointer-bool fields are rare in this codebase and read awkwardly at call sites.
2. `NoSort: true` reads more semantically at the call site than `Sortable: &false`.
3. The sweep across 37 files is mechanical and safe — and forces every list-page author to consciously reaffirm which columns shouldn't sort.

### Why auto-derive `SortKind` from cell type instead of always requiring an explicit value?

Most columns have one cell type per row, so the derivation is unambiguous and consumer-friction-free. The override exists for edge cases (e.g., a `text` cell that holds a numeric string and should sort numerically — like an invoice number).

### Why a single button with `data-mode` instead of two/three separate buttons?

The user explicitly asked for "Select All" to keep showing, then "switch" to all-pages. A single morphing button with `aria-live="polite"` is the simplest model — fewer DOM elements, fewer event listeners, clearer mental model ("this is the selection-expanding button"). The `data-mode` attribute is also a stable testid for E2E.

### Why invalidate cross-page selection silently on sort/filter change?

Confirm dialogs would fire on every facet change, becoming noise. The invalidation is recoverable (re-click "Select all 847"). A toast notification is the right future enhancement but is out of scope for this pass.

---

## Open Questions

All resolved 2026-05-01:

1. ~~**Default direction for `number` and `money` cells.**~~ **Resolved: `desc` (largest first).**
2. ~~**Default direction for `datetime` and `author` cells.**~~ **Resolved: `desc` (newest first).**
3. ~~**`Sortable bool` deprecation horizon.**~~ **Resolved: drop now.** Phase 2 sweep deletes the field outright; build-fail catches every stale reader.
4. ~~**Cross-page invalidation UX.**~~ **Resolved: not needed.** Bulk mode hides the regular toolbar (sort, filter, columns, search) via CSS, so the change is unreachable through the UI while a cross-page selection is held.

---

## How to Resume

To continue this work in a fresh session:

1. Read this `plan.md` and the [progress.md](./progress.md).
2. Check `git status` in the parent monorepo and `cd packages/pyeza-golang && git status` for uncommitted work in the submodule.
3. Resume from the first incomplete phase in `progress.md`.
4. Phases 1, 2, 5 are independent and can land in any order. Phase 3 depends on Phase 1; Phase 4 depends on Phase 2.
5. Final step: bump the pyeza submodule pointer in the parent repo (Phase 6).

**Cross-references:**
- Wiki: [HTMX UI Patterns](../../../../../docs/wiki/articles/htmx-ui-patterns.md) §"Tables", §"Bulk Actions" — current state docs that should be updated post-merge.
- Wiki: [Label Guide](../../../../../docs/wiki/articles/label-guide.md) — for the lyngua key path.
- No `flow.md` (no new entities or branching state — UI plumbing).
- No `verticals.md` (applies uniformly to every business type's list pages).
