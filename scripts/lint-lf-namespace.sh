#!/usr/bin/env bash

##############################################################################
# lint-lf-namespace.sh — Enforce the W1 `window.lf` tiered-namespace convention.
#
# pyeza is the single source of truth and owns the `window.lf.ui.*` surface.
# This is the JS twin of the Q-JS4 CSS-provenance lint (folded into
# ichizen-css-audit) and mirrors esqyma/scripts/lint-no-jargon.sh — the
# existing in-repo grep-assertion lint convention. Wire it in CI next to the
# apps/service-admin/scripts/audit-tags.sh-style checks.
#
# Locked decision Q-JS1 (Option A): `window.lf` is a REGISTRY ONLY.
#   window.lf.ui.*            pyeza design-system primitives (tables: ui.table.*)
#   window.lf.<pkg>.<entity>.<fn>   page logic, owned by its package
#   window.lf._internal.*    private / unstable helpers
# A back-compat ALIAS layer keeps every legacy flat `lf.<Primitive>` call-site
# resolving during the soak (aliases are NOT dropped this wave).
#
# Three guards (see docs/plan/20260530-js-css-architecture/plan.md, W1):
#   (1) FLAT-ROOT KEY GUARD — any `window.lf.<X> =` whose first segment <X>
#       is NOT in the allow-set fails the build (kills new flat-root leaves).
#   (2) PROVENANCE GUARD — every `window.lf.ui.*` / `window.lf.ui.table.*`
#       assignment must originate under packages/pyeza-golang; every
#       `window.lf.<pkg>.*` assignment must originate in that pkg's source.
#   (3) ALIAS-PRESENCE GUARD — each renamed primitive still has its
#       back-compat alias registered in 00-lf-namespace.js (W1 keeps aliases).
#
# The <pkgnames> portion of the allow-set is built DYNAMICALLY from the
# package directory list (strip the `-golang` suffix), so adding a package
# needs no lint edit.
#
# Usage:
#   bash packages/pyeza-golang/scripts/lint-lf-namespace.sh          # lint
#   bash packages/pyeza-golang/scripts/lint-lf-namespace.sh --verbose
#
# Exit non-zero on any violation, so this plugs straight into CI.
#
# Notes:
# - macOS ships bash 3.2 (no associative arrays) + BSD grep (no \b). We use
#   case-stmt / space-padded-string membership and explicit [^A-Za-z0-9_]
#   word boundaries — same constraints audit-tags.sh works under.
##############################################################################

set -eo pipefail

VERBOSE=0
while [ $# -gt 0 ]; do
  case "$1" in
    --verbose|-v) VERBOSE=1 ;;
    *) echo "Unknown option: $1" >&2; exit 2 ;;
  esac
  shift
done

# --- Resolve the monorepo root from this script's location ------------------
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"     # .../pyeza-golang/scripts
PYEZA_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"                       # .../packages/pyeza-golang
PACKAGES_DIR="$(cd "$PYEZA_DIR/.." && pwd)"                     # .../packages
ROOT_DIR="$(cd "$PACKAGES_DIR/.." && pwd)"                      # monorepo root

PYEZA_JS_DIR="$PYEZA_DIR/web/js"
NAMESPACE_FILE="$PYEZA_DIR/web/js/components/00-lf-namespace.js"

# --- Search roots: pyeza source + every call-site tree ----------------------
# EXCLUDE the auto-copied apps/service-admin/assets/js/pyeza/* mirror — pyeza
# source is the single source of truth and copies there VERBATIM at startup,
# so linting the mirror would double-count pyeza's own assignments.
SEARCH_DIRS=""
[ -d "$PYEZA_JS_DIR" ] && SEARCH_DIRS="$SEARCH_DIRS $PYEZA_JS_DIR"
for d in "$PACKAGES_DIR"/*/views; do
  [ -d "$d" ] && SEARCH_DIRS="$SEARCH_DIRS $d"
done
[ -d "$ROOT_DIR/apps/service-admin" ] && SEARCH_DIRS="$SEARCH_DIRS $ROOT_DIR/apps/service-admin"

# A path under the auto-copied pyeza mirror is excluded from every scan.
MIRROR_FRAGMENT="apps/service-admin/assets/js/pyeza/"

##############################################################################
# Build the allow-set.
#
#   Fixed registry keys : ui _internal version ns define on
#   App namespace       : serviceAdmin   (the app — not a package dir)
#   Dynamic <pkgnames>  : every packages/<name> with the `-golang` suffix
#                         stripped (centymo, cyta, entydad, espyna, fayna,
#                         fycha, hybra, pyeza, ...). copya / esqyma / lyngua
#                         (no suffix) pass through unchanged. Adding a package
#                         dir grows the allow-set with ZERO lint edits.
##############################################################################
FIXED_KEYS="ui _internal version ns define on serviceAdmin"

PKG_KEYS=""
for p in "$PACKAGES_DIR"/*/; do
  name="$(basename "$p")"
  name="${name%-golang}"     # strip the -golang suffix when present
  PKG_KEYS="$PKG_KEYS $name"
done

# Space-padded for a clean " $key " substring membership test (no \b needed).
ALLOW_SET=" $FIXED_KEYS $PKG_KEYS "

is_allowed_root() {
  case "$ALLOW_SET" in
    *" $1 "*) return 0 ;;
    *)        return 1 ;;
  esac
}

# Map a file path to the package whose namespace it is allowed to own.
#  - anything under packages/pyeza-golang -> "pyeza" (also owns "ui")
#  - packages/<pkg>-golang/... or packages/<pkg>/... -> "<pkg>"
#  - apps/service-admin/assets/js/<subdir>/... -> "<subdir>"
#      (app-hosted DOMAIN page-logic is organised into per-package subdirs:
#       assets/js/{centymo,entydad,fayna,fycha}/. The subdir DECLARES the
#       namespace it owns — e.g. assets/js/fycha/account-tree.js legitimately
#       owns window.lf.fycha.*. The pyeza/ + vendor/ subdirs are excluded
#       elsewhere — pyeza/ is the verbatim mirror; vendor/ is third-party.)
#  - apps/service-admin/... otherwise (e.g. assets/js/*.js, templates) -> "serviceAdmin"
owning_pkg_for_path() {
  local path="$1"
  case "$path" in
    "$PYEZA_DIR"/*) echo "pyeza"; return 0 ;;
    "$ROOT_DIR"/apps/service-admin/assets/js/*/*)
      # Path under a one-level subdir of assets/js -> that subdir owns it.
      local tail="${path#$ROOT_DIR/apps/service-admin/assets/js/}"
      local sub="${tail%%/*}"
      echo "${sub%-golang}"; return 0 ;;
    "$ROOT_DIR"/apps/service-admin/*) echo "serviceAdmin"; return 0 ;;
  esac
  # packages/<dir>/...  -> strip -golang
  local rest="${path#$PACKAGES_DIR/}"
  local dir="${rest%%/*}"
  echo "${dir%-golang}"
}

##############################################################################
# Collect every `window.lf.<X> =` assignment line across the search roots.
#
# Pattern: window.lf.<first>[.<rest>] =   (single '=', not '==' / '===').
# We capture file:line:text so all three guards share one scan.
##############################################################################
collect_assignments() {
  # -E extended regex; the trailing class rejects ==/===/!= comparisons.
  grep -rnE 'window\.lf\.[A-Za-z_][A-Za-z0-9_.]* *=([^=]|$)' $SEARCH_DIRS \
    --include='*.js' --include='*.html' --include='*.htm' 2>/dev/null \
    | grep -v "$MIRROR_FRAGMENT" || true
}

# lhs_target returns the assignment TARGET — the text on the left of the FIRST
# top-level '='. This is critical: a line like
#   window.lf.AccountTree = window.lf.fycha.ledger.AccountTree;
# has `window.lf.` on BOTH sides. We must key off the LHS (the thing being
# assigned), never the RHS value. Cut at the first '=' (rejecting ==/=>),
# then keep only the LHS.
lhs_target() {
  # Drop a leading 'window.' prefix concern by operating on the whole LHS.
  echo "$1" | sed -E 's/[[:space:]]*=([^=].*|$)//'
}

# Extract the FIRST segment after `window.lf.` on the assignment's LHS.
first_segment() {
  local lhs
  lhs="$(lhs_target "$1")"
  echo "$lhs" | sed -E 's/.*window\.lf\.([A-Za-z_][A-Za-z0-9_]*).*/\1/'
}

# Full dotted assignment target (segments after window.lf on the LHS).
assignment_path() {
  local lhs
  lhs="$(lhs_target "$1")"
  echo "$lhs" | sed -E 's/.*window\.lf\.([A-Za-z_][A-Za-z0-9_.]*[A-Za-z0-9_]|[A-Za-z_][A-Za-z0-9_]*).*/\1/'
}

VIOLATIONS=0

echo "lint-lf-namespace: scanning pyeza source + call-site trees (mirror excluded)"
echo "allow-set roots: $(echo $ALLOW_SET | tr -s ' ')"
echo ""

ASSIGNMENTS="$(collect_assignments)"

##############################################################################
# GUARD 1 — FLAT-ROOT KEY GUARD
#   Fail any window.lf.<X> = whose <X> is not in the allow-set.
##############################################################################
echo "== Guard 1: flat-root key guard =="
G1=0
while IFS= read -r line; do
  [ -z "$line" ] && continue
  file="${line%%:*}"
  rest="${line#*:}"
  lineno="${rest%%:*}"
  code="${line#*:*:}"

  seg="$(first_segment "$code")"
  [ -z "$seg" ] && continue

  if ! is_allowed_root "$seg"; then
    echo "  VIOLATION: window.lf.$seg = ... is not an allowed flat-root key"
    echo "    at $file:$lineno"
    [ $VERBOSE -eq 1 ] && echo "    > $(echo "$code" | sed 's/^[[:space:]]*//')"
    G1=$((G1 + 1))
  fi
done <<EOF
$ASSIGNMENTS
EOF
if [ $G1 -eq 0 ]; then echo "  OK — no stray flat-root assignments."; fi
VIOLATIONS=$((VIOLATIONS + G1))
echo ""

##############################################################################
# GUARD 2 — PROVENANCE GUARD
#   window.lf.ui.*        must originate under packages/pyeza-golang.
#   window.lf.<pkg>.*     must originate in that pkg's own source tree.
#   (serviceAdmin.* must come from apps/service-admin.)
# Only assignments with a tiered (multi-segment, e.g. ui.X / centymo.X) target
# are provenance-checked; bare flat-root leaves are Guard 1's job.
##############################################################################
echo "== Guard 2: provenance guard =="
G2=0
while IFS= read -r line; do
  [ -z "$line" ] && continue
  file="${line%%:*}"
  rest="${line#*:}"
  lineno="${rest%%:*}"
  code="${line#*:*:}"

  seg="$(first_segment "$code")"
  [ -z "$seg" ] && continue

  # Skip registry-internal roots that have no package owner.
  case "$seg" in
    version|ns|define|on|_internal) continue ;;
  esac

  owner="$(owning_pkg_for_path "$file")"

  if [ "$seg" = "ui" ]; then
    # ui.* (incl. ui.table.*) is pyeza-owned only.
    if [ "$owner" != "pyeza" ]; then
      echo "  VIOLATION: window.lf.ui.* assigned outside pyeza (owner=$owner)"
      echo "    at $file:$lineno"
      [ $VERBOSE -eq 1 ] && echo "    > $(echo "$code" | sed 's/^[[:space:]]*//')"
      G2=$((G2 + 1))
    fi
    continue
  fi

  # Package namespace: window.lf.<pkg>.* must come from that pkg's source.
  if is_allowed_root "$seg"; then
    if [ "$seg" != "$owner" ]; then
      echo "  VIOLATION: window.lf.$seg.* assigned from a foreign tree (owner=$owner)"
      echo "    at $file:$lineno"
      [ $VERBOSE -eq 1 ] && echo "    > $(echo "$code" | sed 's/^[[:space:]]*//')"
      G2=$((G2 + 1))
    fi
  fi
done <<EOF
$ASSIGNMENTS
EOF
if [ $G2 -eq 0 ]; then echo "  OK — every tiered assignment matches its owning tree."; fi
VIOLATIONS=$((VIOLATIONS + G2))
echo ""

##############################################################################
# GUARD 3 — ALIAS-PRESENCE GUARD (this wave only)
#   Every renamed primitive must still carry its back-compat alias in
#   00-lf-namespace.js so legacy call-sites keep resolving. Aliases are NOT
#   dropped in W1. We assert each REQUIRED legacy key has an ALIASES row.
##############################################################################
echo "== Guard 3: alias-presence guard =="
G3=0
REQUIRED_ALIASES="Sheet Dialog Toast FocusTrap Calendar FormComponents FormPassword Popover NotificationDrawer NotificationSheet toggleAuditDetails TableCore TableState TableToolbar TableColumns TableDialog TableDropdowns TableExport TablePagination TableSearch TableSort TableSelection TableFilters TableDensity TableServer TableActions BulkAction"
if [ ! -f "$NAMESPACE_FILE" ]; then
  echo "  VIOLATION: registry/alias file missing: $NAMESPACE_FILE"
  G3=$((G3 + 1))
else
  for key in $REQUIRED_ALIASES; do
    # Match an ALIASES row:  ['Key', 'ui...']  — single-quoted legacy key.
    if ! grep -qE "\[[[:space:]]*'$key'[[:space:]]*," "$NAMESPACE_FILE"; then
      echo "  VIOLATION: back-compat alias for lf.$key is not registered in 00-lf-namespace.js"
      G3=$((G3 + 1))
    fi
  done
fi
if [ $G3 -eq 0 ]; then echo "  OK — all renamed primitives keep a back-compat alias."; fi
VIOLATIONS=$((VIOLATIONS + G3))
echo ""

##############################################################################
# Report + exit
##############################################################################
if [ $VIOLATIONS -gt 0 ]; then
  echo "lint-lf-namespace: FAIL — $VIOLATIONS violation(s)."
  echo "  See docs/plan/20260530-js-css-architecture/plan.md (W1) + decisions.md (Q-JS1)."
  exit 1
fi

echo "lint-lf-namespace: PASS — window.lf root is clean and provenance holds."
exit 0
