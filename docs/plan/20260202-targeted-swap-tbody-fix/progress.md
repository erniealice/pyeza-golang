# Targeted Swap tbody Fix — Progress Log

**Plan:** [plan.md](./plan.md)
**Started:** 2026-02-02
**Completed:** 2026-02-02
**Branch:** `dev/20260129-package-ui`

---

## Phase 1: Verify innerHTML Fix — FAILED

- [x] Restart Go server to pick up updated JS (`table-server.js` line 213: `innerHTML` swap)
- [x] Navigate to `http://localhost:8100/app/clients/list/active`
- [x] Click "Next »" — **FAILED**: footer updated to "26 to 50" but rows stayed on page 1 data
- **Root cause:** `doc.querySelector('tbody')` returns the auto-generated tbody, but its `innerHTML` is empty — the DOMParser discards `<tr>` children when `<tbody>` is at body level

**Result: Phase 1 failed → moved to Phase 2**

---

## Phase 2: Table Carrier Wrapper — COMPLETE ✅

- [x] Modify `packages/ui/_components/table.html` `table-body-partial` template: wrap `<tbody>` in `<table id="{{.ID}}-swap-carrier" style="display:none">`
- [x] Update `packages/ui/assets/js/table/table-server.js`: use `getElementById` for tbody (removed `querySelector` fallback — no longer needed)
- [x] Restart server and re-run all verification steps
- [x] Verify DOMParser finds tbody, footer, AND meta by `getElementById`

### Verification Results (Playwright MCP)

| Test | Result |
|------|--------|
| Next » (page 1 → 2) | ✅ Rows changed: "!test demo" → "Arnel Company Test 2" |
| « Prev (page 2 → 1) | ✅ Rows reverted: "Arnel Company Test 2" → "!test demo" |
| Page 10 (last page jump) | ✅ Shows "Wall Company"..."Zedbra", footer "226 to 233 of 233" |
| Next » disabled on last page | ✅ Correctly disabled |
| « Prev disabled on page 1 | ✅ Correctly disabled |
| Console errors | ✅ Zero errors |
| Duplicate footers | ✅ None — single footer instance |
| Toolbar blink | ✅ Toolbar NOT re-rendered (refs unchanged) |
| URL updates | ✅ `?page=2`, `?page=10` via `history.replaceState` |
| Console logs | ✅ `[TableServer] Targeted swap via fetch` + `Targeted swap complete` |

### Not yet tested (manual testing recommended)

- [ ] Search input — verify results update AND input retains focus
- [ ] Entries selector change — verify row count changes
- [ ] Row actions (view, edit, delete) still work after swap
- [ ] Full page load with `?page=2` in URL still works

---

## Summary

- **Phases complete:** 2 / 2 (Phase 1 failed, Phase 2 succeeded)
- **Files modified:** 2
  - `packages/ui/_components/table.html:791-806` — wrapped `<tbody>` in `<table>` carrier
  - `packages/ui/assets/js/table/table-server.js:204-213` — simplified to `getElementById` only

---

## Skipped / Deferred (update as you work)

| Item | Reason |
|------|--------|
| Search/entries/row-action testing | Needs manual verification or extended Playwright session |

---

## Key Learning

The HTML5 spec (section 12.2.6.4 "in body" insertion mode) treats `<tbody>` outside `<table>` as a parse error and **ignores the entire tag including attributes**. The fix is to always provide table context in the server response by wrapping `<tbody>` in a `<table>` carrier element. This ensures DOMParser preserves the `id` attribute, allowing `getElementById` to work directly.
