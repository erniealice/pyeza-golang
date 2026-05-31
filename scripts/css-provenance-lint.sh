#!/usr/bin/env bash
# =============================================================================
# css-provenance-lint.sh — CSS token-provenance PRE-GATE for the ichizen monorepo
# =============================================================================
# Standalone, grep/ripgrep-based, ZERO dependencies (POSIX grep is enough; ripgrep
# is used automatically if present, only for speed). Runs in any CI.
#
# WHAT IT ENFORCES (the W2 "DEFINE in pyeza, REFERENCE in packages" convention):
#
#   RULE 1  No color/shadow/theme-variant TOKEN DEFINITION outside the sanctioned
#           pyeza files. A line `--<name>: <literal>` where <literal> is a #hex /
#           rgb() / rgba() / hsl() / hsla() / linear|radial-gradient(... color) is
#           allowed ONLY in packages/pyeza-golang/web/styles/themes/*.css (the 15
#           themes) and packages/pyeza-golang/web/styles/base/{layout,main-base}.css.
#
#   RULE 2  No RAW color literal in a property VALUE inside non-pyeza domain/app CSS
#           (packages/{centymo,entydad,fycha,fayna,hybra}-golang/assets/css/**.css
#           and apps/*/assets/css/** excluding the auto-generated main.css). Domain
#           CSS may only reference var(--token). A literal that appears purely as a
#           var() FALLBACK — var(--token, #fff) — is tolerated (matches the
#           ichizen-css-audit "NOT a violation" policy; rule 17 there is a P3 nit,
#           not a pre-gate failure).
#
#   RULE 3  DEFINE-in-pyeza / REFERENCE-in-packages, enforced via the committed
#           token-ownership MANIFEST (docs/wiki/articles/css-provenance-manifest.md):
#           every color/shadow/theme token a theme defines MUST be present in the
#           manifest, and the manifest's theme-token set MUST equal the live set.
#           A token defined anywhere whose owning file does not match the manifest
#           is a drift violation.
#
#   RULE 4  Every non-pyeza domain CSS file carries its mandatory {pkg}- prefix
#           (centymo- / entydad- / fycha- / fayna- / hybra-).
#
#   RULE 5  Uniformity guard: all 15 theme files define the IDENTICAL color-token
#           name set. A theme missing or adding a token FAILS.
#
# EXIT: 0 = GREEN (clean), 1 = RED (>=1 violation), 2 = harness error.
#
# State today is already clean (F-CSS-1 refuted) so this exits 0. Injecting a raw
# `color: #333` into a domain CSS file, or a new `--accent-foo: #abc` definition in
# a domain file, makes it exit 1.
# =============================================================================

set -u

# ---- locate repo root (script lives at packages/pyeza-golang/scripts/) --------
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]:-$0}")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"

# allow override (CI may invoke from elsewhere): first arg = repo root
if [ "${1:-}" != "" ] && [ -d "${1:-}" ]; then
  ROOT="$(cd "$1" && pwd)"
fi

THEMES_DIR="$ROOT/packages/pyeza-golang/web/styles/themes"
BASE_DIR="$ROOT/packages/pyeza-golang/web/styles/base"
MANIFEST="$ROOT/docs/wiki/articles/css-provenance-manifest.md"

# Non-pyeza domain/app CSS roots (RULE 2 + RULE 4 scope). Pyeza web/styles/** is
# the design-system implementation layer and is intentionally NOT in this list.
DOMAIN_GLOBS=(
  "$ROOT/packages/centymo-golang/assets/css"
  "$ROOT/packages/entydad-golang/assets/css"
  "$ROOT/packages/fycha-golang/assets/css"
  "$ROOT/packages/fayna-golang/assets/css"
  "$ROOT/packages/hybra-golang/assets/css"
)

# pick a grepper
if command -v rg >/dev/null 2>&1; then
  GREP() { rg --no-config "$@"; }
  GREP_MODE="ripgrep"
else
  GREP() { grep "$@"; }
  GREP_MODE="grep"
fi

fail=0
note() { printf '%s\n' "$*"; }
violation() { fail=1; printf 'FAIL  %s\n' "$*"; }

# Regex fragments (ERE).
HEX='#[0-9A-Fa-f]{3,8}\b'
FUNC='(rgba?|hsla?)\('
GRAD='(linear|radial|conic)-gradient\('
# RULE 1 (token DEFINITION): a gradient literal also counts as a defined color value.
COLOR_LITERAL_DEF="($HEX|$FUNC|$GRAD)"
# RULE 2 (raw literal in a domain VALUE): a gradient built purely from var(--token)
# references is fine, so the gradient FUNCTION NAME is not itself a literal — only a
# raw hex/rgb/hsl surviving the var()-strip is. (linear-gradient(135deg, var(--x)...) is OK.)
COLOR_LITERAL_VALUE="($HEX|$FUNC)"

# Color/shadow/theme TOKEN name pattern (the tokens that must be theme-owned).
THEME_TOKEN='--(bg|text|accent|status|shadow|app-color|theme|border)[A-Za-z0-9-]*'

note "css-provenance-lint  (engine: $GREP_MODE)"
note "  root:    $ROOT"
note "  themes:  $THEMES_DIR"
note "  base:    $BASE_DIR"
note ""

# ----------------------------------------------------------------------------
# RULE 5 — theme uniformity (run first: it also yields the canonical token set)
# ----------------------------------------------------------------------------
note "RULE 5 — theme token-set uniformity"
theme_files=()
while IFS= read -r f; do theme_files+=("$f"); done < <(find "$THEMES_DIR" -maxdepth 1 -name '*.css' | sort)

if [ "${#theme_files[@]}" -eq 0 ]; then
  note "ERROR: no theme files found under $THEMES_DIR"; exit 2
fi

token_names_of() {
  # all `--name:` token names declared in a theme file, sorted-unique
  grep -oE '^\s*--[A-Za-z0-9-]+:' "$1" | tr -d ' :' | sort -u
}

canon_file="${theme_files[0]}"
canon_set="$(token_names_of "$canon_file")"
# hash the canonical set the SAME way we hash each theme's set (token_names_of | shasum)
# so the trailing-newline handling matches and identical sets compare equal.
canon_hash="$(token_names_of "$canon_file" | shasum | cut -d' ' -f1)"
canon_count="$(printf '%s\n' "$canon_set" | grep -c .)"
note "  canonical set: $canon_count tokens (from $(basename "$canon_file")), hash=$canon_hash"

theme_count=0
for f in "${theme_files[@]}"; do
  theme_count=$((theme_count + 1))
  this_hash="$(token_names_of "$f" | shasum | cut -d' ' -f1)"
  if [ "$this_hash" != "$canon_hash" ]; then
    violation "RULE 5: $(basename "$f") token set differs from canonical theme set"
    note "        diff vs canonical:"
    diff <(printf '%s\n' "$canon_set") <(token_names_of "$f") | sed 's/^/          /'
  fi
done
if [ "$theme_count" -ne 15 ]; then
  violation "RULE 5: expected 15 theme files, found $theme_count"
fi
[ "$fail" -eq 0 ] && note "  OK — all $theme_count themes define the identical $canon_count-token set"
note ""

# ----------------------------------------------------------------------------
# RULE 1 — no color/shadow/theme TOKEN DEFINITION outside themes + base
# ----------------------------------------------------------------------------
note "RULE 1 — color/shadow/theme token definitions only in themes + base"
# scan every *.css under the repo EXCEPT the sanctioned theme + base files and
# the auto-generated app main.css; a `--<themeTokenName>: <colorLiteral>` there fails.
while IFS= read -r f; do
  case "$f" in
    "$THEMES_DIR"/*) continue ;;                                  # themes: allowed
    "$BASE_DIR"/layout.css|"$BASE_DIR"/main-base.css) continue ;; # base: allowed
    */assets/css/app/main.css) continue ;;                        # auto-generated
  esac
  # match a theme-token DEFINITION whether it starts a line or sits mid-line after
  # `{` or `;` (e.g. `.x { --accent-foo: #abc; }`) — both are real declarations.
  hits="$(grep -nE "(^|[{;[:space:]])$THEME_TOKEN:[[:space:]]*$COLOR_LITERAL_DEF" "$f" 2>/dev/null)"
  if [ -n "$hits" ]; then
    while IFS= read -r line; do
      violation "RULE 1: color/shadow/theme token defined outside pyeza themes/base: ${f#$ROOT/}:$line"
    done <<< "$hits"
  fi
done < <(find "$ROOT/packages" "$ROOT/apps" -name '*.css' 2>/dev/null)
[ "$fail" -eq 0 ] || true
note "  (token definitions are confined to themes + base)"
note ""

# ----------------------------------------------------------------------------
# RULE 2 — no raw color literal in non-pyeza domain/app CSS property VALUES
# ----------------------------------------------------------------------------
note "RULE 2 — no raw color literals in domain/app CSS (var() fallbacks tolerated)"
domain_files=()
for d in "${DOMAIN_GLOBS[@]}"; do
  [ -d "$d" ] || continue
  while IFS= read -r f; do domain_files+=("$f"); done < <(find "$d" -name '*.css' 2>/dev/null | sort)
done

for f in "${domain_files[@]}"; do
  # Single awk pass per file. NR gives a reliable line number. On a SCRUBBED copy
  # of each line (strip /* comments */ + blank out var(--x, <fallback>) fallbacks so
  # a literal living only inside a fallback or comment is not flagged), test for a
  # raw color literal. Emit "NR:original-line" for each real hit.
  # NOTE: comment-strip and var-strip use STRING patterns (dynamic regex), not awk
  # /literal/ regexes — a `/* ... */` regex literal breaks the BSD/macOS awk parser
  # on the embedded `*/`. String patterns are portable across gawk and one-true-awk.
  hits="$(awk \
    -v cpat='/\\*[^*]*\\*+([^/*][^*]*\\*+)*/' \
    -v vpat='var\\(--[A-Za-z0-9-]+[^)]*\\)' '
    {
      orig  = $0
      scrub = $0
      gsub(cpat, "",         scrub)   # strip /* ... */ comments
      gsub(vpat, "var(--T)", scrub)   # neutralize var(--x, <fallback>) fallbacks
      if (scrub ~ /#[0-9A-Fa-f]{3,8}([^0-9A-Fa-f]|$)/ || scrub ~ /(rgba?|hsla?)\(/)
        printf "%d:%s\n", NR, orig
    }
  ' "$f")"
  if [ -n "$hits" ]; then
    while IFS= read -r line; do
      [ -n "$line" ] && violation "RULE 2: raw color literal in domain CSS value: ${f#$ROOT/}:$line"
    done <<< "$hits"
  fi
done
[ "${#domain_files[@]}" -gt 0 ] && note "  scanned ${#domain_files[@]} domain CSS file(s)"
note ""

# ----------------------------------------------------------------------------
# RULE 4 — domain CSS file prefix
# ----------------------------------------------------------------------------
note "RULE 4 — domain CSS file {pkg}- prefix"
for f in "${domain_files[@]}"; do
  base="$(basename "$f")"
  # owning package from path: packages/<pkg>-golang/assets/css/...
  pkg="$(printf '%s' "$f" | sed -E 's#.*/packages/([a-z]+)-golang/assets/css/.*#\1#')"
  case "$base" in
    "$pkg"-*) : ;;
    *) violation "RULE 4: domain CSS file missing '${pkg}-' prefix: ${f#$ROOT/}" ;;
  esac
done
note "  (all domain files carry their {pkg}- prefix)"
note ""

# ----------------------------------------------------------------------------
# RULE 3 — manifest is the source of truth; theme set must match it
# ----------------------------------------------------------------------------
note "RULE 3 — manifest <-> live theme drift"
if [ ! -f "$MANIFEST" ]; then
  violation "RULE 3: manifest not found at ${MANIFEST#$ROOT/}"
else
  # manifest rows are markdown table rows whose first column is `--token`. Some
  # flattened rows live inside a blockquote, so allow an optional leading '> '.
  manifest_tokens="$(grep -oE '^>?\s*\|\s*`--[A-Za-z0-9-]+`' "$MANIFEST" | grep -oE '`--[A-Za-z0-9-]+`' | tr -d '`' | sort -u)"
  manifest_count="$(printf '%s\n' "$manifest_tokens" | grep -c .)"
  if [ "$manifest_count" -eq 0 ]; then
    violation "RULE 3: no token rows parsed from manifest ${MANIFEST#$ROOT/}"
  else
    # The manifest covers BOTH theme tokens and base structural tokens. The drift
    # check we enforce: every live THEME token must appear in the manifest.
    missing="$(comm -23 <(printf '%s\n' "$canon_set") <(printf '%s\n' "$manifest_tokens"))"
    if [ -n "$missing" ]; then
      while IFS= read -r t; do
        [ -n "$t" ] && violation "RULE 3: live theme token '$t' absent from manifest (drift)"
      done <<< "$missing"
    else
      note "  OK — all $canon_count live theme tokens are present in the manifest ($manifest_count rows total)"
    fi
  fi
fi
note ""

# ----------------------------------------------------------------------------
note "============================================================"
if [ "$fail" -eq 0 ]; then
  note "RESULT: GREEN — CSS provenance is clean (RULES 1-5 pass)"
  exit 0
else
  note "RESULT: RED — CSS provenance violation(s) above"
  exit 1
fi
