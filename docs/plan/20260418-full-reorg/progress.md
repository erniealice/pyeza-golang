# pyeza-golang Full Reorg — Progress
**Plan**: [plan.md](plan.md)
**Started**: 2026-04-18

---

## Phase 0 — Inventory & Planning
- [x] Read wiki articles (package-map, package-structure, template-guide, css-guide, dependency-flow, js-guide)
- [x] Read pyeza root Go files (embed.go, assets.go, renderer.go, labels.go, app_context.go, types.go, templates.go)
- [x] Enumerate all file directories (components/, partials/, templates/blocks/, icons/, styles/, assets/js/)
- [x] Run downstream greps (SharedFS, import paths, CSS/JS asset paths, template name strings)
- [x] Answer 4 open questions (Section 5)
- [x] Write plan.md and progress.md

---

## Phase 1 — pyeza-golang Reorg (main session)

- [ ] Create `web/` directory tree (web/templates/components/, web/templates/blocks/, web/templates/partials/, web/templates/icons/, web/styles/base/, web/styles/components/, web/styles/themes/, web/js/components/, web/js/table/)
- [ ] Move 28 component HTML files → `web/templates/components/`
- [ ] Move 5 calendar HTML files → `web/templates/components/calendar/`
- [ ] Move 6 table HTML files → `web/templates/components/table/`
- [ ] Move 11 partial HTML files → `web/templates/partials/`
- [ ] Move 7 block HTML files → `web/templates/blocks/`
- [ ] Move 137 icon HTML files → `web/templates/icons/`
- [ ] Move 3 base CSS files (layout.css, main-base.css, typography.css) → `web/styles/base/`
- [ ] Move 34 component CSS files → `web/styles/components/`
- [ ] Move 15 theme CSS files → `web/styles/themes/`
- [ ] Delete `styles/form-drawer.css.bak` (stale backup)
- [ ] Move 9 component JS files → `web/js/components/`
- [ ] Move 15 table JS files → `web/js/table/`
- [ ] Update `embed.go` → `//go:embed all:web`
- [ ] Update `assets.go` source paths: `styles/` → `web/styles/`, `assets/js/` → `web/js/`; split into `assets_styles.go` + `assets_js.go`
- [ ] Split `renderer.go` → `renderer.go` + `renderer_funcs.go`
- [ ] Split `labels.go` → `labels.go` + `labels_types.go`
- [ ] Audit `notification-drawer.js` missing-from-CopyStaticAssets (Risk 3)
- [ ] `go build ./...` in pyeza-golang — must pass
- [ ] `go test ./...` in pyeza-golang — must pass
- [ ] Commit pyeza-golang
- [ ] Bump pyeza-golang submodule pointer in ichizen-golang root repo (separate commit)

---

## Phase 2 — Pair Agents (parallel, after Phase 1 submodule pointer committed)

### Pair A: centymo-golang + hybra-golang
- [ ] Agent launched
- [ ] centymo: go mod tidy
- [ ] centymo: import edits (if types.go shim removed)
- [ ] centymo: go build ./... — pass
- [ ] hybra: go mod tidy
- [ ] hybra: go build ./... — pass
- [ ] Pair A: commit + submodule pointer bumped
- [ ] Pair A: reported back ≤150 words

### Pair B: fycha-golang + entydad-golang
- [ ] Agent launched
- [ ] fycha: go mod tidy
- [ ] fycha: import edits (if types.go shim removed)
- [ ] fycha: go build ./... — pass
- [ ] entydad: go mod tidy
- [ ] entydad: import edits (if types.go shim removed)
- [ ] entydad: go build ./... — pass
- [ ] Pair B: commit + submodule pointer bumped
- [ ] Pair B: reported back ≤150 words

### Pair C: cyta-golang + fayna-golang
- [ ] Agent launched
- [ ] cyta: go mod tidy
- [ ] cyta: import edits (if types.go shim removed)
- [ ] cyta: go build ./... — pass
- [ ] fayna: go mod tidy
- [ ] fayna: import edits (if types.go shim removed)
- [ ] fayna: go build ./... — pass
- [ ] Pair C: commit + submodule pointer bumped
- [ ] Pair C: reported back ≤150 words

---

## Phase 3 — service-admin Update (main session, after all pairs done)

- [ ] Update go.work / go.mod submodule references
- [ ] Apply any service-admin Go import edits (estimated 0–5 files)
- [ ] `go build ./...` — pass
- [ ] `go test ./...` — pass
- [ ] `seed-rbac` (required before E2E per CLAUDE.md rule 5)
- [ ] E2E smoke test (Playwright)
- [ ] Commit service-admin

---

## Phase 4 — Submodule Pointer Bumps (ichizen-golang root)

- [ ] pyeza-golang pointer (already done in Phase 1)
- [ ] centymo-golang pointer (separate commit)
- [ ] hybra-golang pointer (separate commit)
- [ ] fycha-golang pointer (separate commit)
- [ ] entydad-golang pointer (separate commit)
- [ ] cyta-golang pointer (separate commit)
- [ ] fayna-golang pointer (separate commit)

---

## Risks Tracking

| # | Risk | Status |
|---|---|---|
| 1 | types.go shim removal blast radius | OPEN — consider deferring to Phase 2b |
| 2 | runtime.Caller path resolution after move | OPEN — verify with go build -v |
| 3 | notification-drawer.js not in CopyStaticAssets | OPEN — audit in Phase 1 |
| 4 | Template name collision check | OPEN — verify during Phase 1 |
| 5 | form-drawer.css.bak stale file | OPEN — delete in Phase 1 |
| 6 | pyeza dependency-root invariant preserved | LOW — no new imports added |
| 7 | Phase 3 gated on all pairs | OPEN — coordinate timing |
