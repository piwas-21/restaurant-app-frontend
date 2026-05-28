#!/usr/bin/env bash
# scripts/test-affected.sh — pre-push affected-test gate
#
# Runs Jest's --findRelatedTests on the source files changed vs the upstream
# branch (default: origin/develop). The goal is to catch the common-case unit
# test regressions before they reach CI, without paying the full `npm test`
# cost on every push.
#
# Wired into .pre-commit-config.yaml under default_stages: [pre-push].
# Source of truth referenced from CLAUDE.md §7.
#
# Usage:
#   scripts/test-affected.sh                 # diff vs origin/develop
#   scripts/test-affected.sh origin/main     # diff vs alternate upstream
#
# Behavior:
#   - Determine changed .ts/.tsx/.js/.jsx files under src/ between $UPSTREAM and HEAD.
#   - If none: exit 0 (skip).
#   - Else: jest --findRelatedTests <files> --passWithNoTests --bail
#   - --passWithNoTests so changed source files without a colocated test do not
#     fail the gate (they're already caught by lint/typecheck/file-length).
#   - --bail so the dev sees the first failure fast.

set -euo pipefail

UPSTREAM="${1:-origin/develop}"

# Verify upstream ref exists; if not, skip with a friendly message rather than
# failing the push. (e.g. detached HEAD, fresh clone without origin/develop.)
if ! git rev-parse --verify --quiet "$UPSTREAM" >/dev/null; then
  echo "test-affected: upstream ref '$UPSTREAM' not found; skipping."
  exit 0
fi

# Find the merge-base so we only consider commits unique to this branch.
# Use ...HEAD (three-dot) — matches the spec; equivalent to diff against
# merge-base for --name-only with a single side.
#
# Output is NUL-delimited (-z) so filenames with spaces survive intact, then
# filtered to source extensions under src/. Portable to bash 3.2 (macOS).
CHANGED_FILE="$(mktemp -t test-affected.XXXXXX)"
trap 'rm -f "$CHANGED_FILE"' EXIT

git diff -z --name-only --diff-filter=ACMR "${UPSTREAM}...HEAD" -- \
  ':(glob)src/**/*.ts' \
  ':(glob)src/**/*.tsx' \
  ':(glob)src/**/*.js' \
  ':(glob)src/**/*.jsx' \
  2>/dev/null > "$CHANGED_FILE" || true

# Count non-empty entries in the NUL-delimited list.
COUNT=$(tr -cd '\0' < "$CHANGED_FILE" | wc -c | tr -d ' ')

if [[ "$COUNT" -eq 0 ]]; then
  echo "test-affected: no source files changed vs ${UPSTREAM}; skipping affected-test run."
  exit 0
fi

echo "test-affected: ${COUNT} changed file(s) vs ${UPSTREAM}; running Jest --findRelatedTests..."

# Resolve a jest binary. Prefer the local install (matches the pinned Jest
# version); fall back to npx for environments where deps haven't been
# installed yet (in which case the run is best-effort, not blocking).
#
# Stored as a bash array so multi-word commands (e.g. `npx --no-install jest`)
# expand without relying on word-splitting an unquoted string (ShellCheck SC2086).
JEST_CMD=()
if [[ -x "./node_modules/.bin/jest" ]]; then
  JEST_CMD=("./node_modules/.bin/jest")
elif command -v npx >/dev/null 2>&1; then
  JEST_CMD=("npx" "--no-install" "jest")
else
  echo "test-affected: no local jest and no npx available; skipping."
  exit 0
fi

# Use xargs to safely pass many filenames to jest without blowing the shell
# arg limit. NUL-delim via -0 keeps spaces/newlines in filenames intact.
xargs -0 "${JEST_CMD[@]}" --findRelatedTests --passWithNoTests --bail < "$CHANGED_FILE"
