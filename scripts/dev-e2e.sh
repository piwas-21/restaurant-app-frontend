#!/usr/bin/env bash
# RUMI Frontend — local Playwright E2E orchestration.
#
# What it does:
#   1. Ensures the backend (.NET API) and Postgres are up on :5221 / :5432.
#      If `--start-backend` is set, runs `bash ../backend/scripts/dev-up.sh`
#      in the background; otherwise just health-checks and fails if not up.
#   2. Exports E2E_DATABASE_URL and E2E_API_BASE_URL for the test process.
#   3. Lets Playwright bring up the Next.js dev server itself
#      (see playwright.config.ts → webServer).
#   4. Runs `npx playwright test` with any args you pass through.
#
# Usage:
#   bash scripts/dev-e2e.sh                       # backend must already be running
#   bash scripts/dev-e2e.sh --start-backend       # also boot the backend stack
#   bash scripts/dev-e2e.sh -- --ui               # forward args to Playwright
#   bash scripts/dev-e2e.sh -- e2e/tests/auth     # run a specific path
#   bash scripts/dev-e2e.sh --help

set -euo pipefail

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; CYAN='\033[0;36m'; NC='\033[0m'
info() { echo -e "${CYAN}ℹ${NC}  $1"; }
ok()   { echo -e "${GREEN}✓${NC}  $1"; }
warn() { echo -e "${YELLOW}⚠${NC}  $1"; }
fail() { echo -e "${RED}✗${NC}  $1"; exit 1; }

cd "$(dirname "$0")/.."
FRONTEND_DIR="$(pwd)"
WORKSPACE_ROOT="$(cd .. && pwd)"
BACKEND_DIR="$WORKSPACE_ROOT/backend"

# ── Args ─────────────────────────────────────────────────────────────
START_BACKEND=false
PLAYWRIGHT_ARGS=()
while [[ $# -gt 0 ]]; do
  case "$1" in
    --start-backend) START_BACKEND=true; shift ;;
    -h|--help) sed -n '2,18p' "$0"; exit 0 ;;
    --) shift; PLAYWRIGHT_ARGS+=("$@"); break ;;
    *) PLAYWRIGHT_ARGS+=("$1"); shift ;;
  esac
done

# ── Defaults (override by exporting before invoking) ─────────────────
: "${E2E_API_BASE_URL:=http://localhost:5221}"
: "${E2E_BASE_URL:=http://localhost:3000}"
: "${E2E_MAILPIT_URL:=http://localhost:8025}"
export E2E_API_BASE_URL E2E_BASE_URL E2E_MAILPIT_URL

# E2E_DATABASE_URL and E2E_DATABASE_TARGET must be explicit. The disposable
# marker is an operator assertion that this database is reserved for E2E; the
# target preflight also checks its parsed hostname before any DB write. Set both
# in your shell before invoking this script. The guard runs before Playwright or
# Next.js loads app env files. Do not mark a shared restaurant DB disposable
# just because it is reachable on localhost.
if [[ -z "${E2E_DATABASE_URL:-}" ]]; then
  fail "E2E_DATABASE_URL is not set. Set it to the dedicated E2E database and set E2E_DATABASE_TARGET=disposable before re-running."
fi
export E2E_DATABASE_URL

# ── Preflight ────────────────────────────────────────────────────────
command -v node >/dev/null || fail "node not installed."
command -v npx  >/dev/null || fail "npx not installed."
command -v curl >/dev/null || fail "curl not installed."
node scripts/e2e-database-target.mjs || fail "E2E database target preflight failed."

# ── 1. Backend up? ───────────────────────────────────────────────────
backend_up() {
  curl -fsS --max-time 2 "${E2E_API_BASE_URL}/api/health" >/dev/null 2>&1
}

BACKEND_PID=""
cleanup() {
  if [[ -n "$BACKEND_PID" ]] && kill -0 "$BACKEND_PID" 2>/dev/null; then
    info "Stopping backend (PID $BACKEND_PID)…"
    kill "$BACKEND_PID" 2>/dev/null || true
    wait "$BACKEND_PID" 2>/dev/null || true
  fi
}
trap cleanup EXIT INT TERM

# ── 1a. Mailpit up? Required for the email-verify path. ─────────────
mailpit_up() {
  curl -fsS --max-time 2 "${E2E_MAILPIT_URL}/api/v1/info" >/dev/null 2>&1
}

if mailpit_up; then
  ok "Mailpit reachable at ${E2E_MAILPIT_URL}."
else
  warn "Mailpit not reachable at ${E2E_MAILPIT_URL}. Starting one-off container…"
  command -v docker >/dev/null || fail "docker required to start Mailpit. Run it yourself: docker run -d --name rumi-mailpit-e2e -p 1025:1025 -p 8025:8025 axllent/mailpit:v1.29.7"
  # Reuse an existing container if it's just stopped; otherwise create.
  if docker inspect rumi-mailpit-e2e >/dev/null 2>&1; then
    docker start rumi-mailpit-e2e >/dev/null
  else
    docker run -d --name rumi-mailpit-e2e -p 1025:1025 -p 8025:8025 axllent/mailpit:v1.29.7 >/dev/null
  fi
  for i in {1..15}; do
    if mailpit_up; then ok "Mailpit ready."; break; fi
    sleep 1
    if [[ $i -eq 15 ]]; then fail "Mailpit did not respond within 15s."; fi
  done
fi

# Reminder: the running backend MUST be configured to send via Mailpit.
# scripts/dev-e2e.sh cannot enforce this on a backend it didn't start —
# verify by checking the backend log or restart with:
#   ASPNETCORE_ENVIRONMENT=Development \
#   EmailSettings__SmtpHost=localhost EmailSettings__SmtpPort=1025 \
#   EmailSettings__EnableSsl=false EmailSettings__UseAuthentication=false \
#   dotnet run --project RestaurantSystem.Api --launch-profile http
info "Backend SMTP must point at Mailpit (EmailSettings__SmtpHost=localhost:1025)."

# ── 1b. Backend up? ──────────────────────────────────────────────────
if backend_up; then
  ok "Backend reachable at ${E2E_API_BASE_URL}."
else
  if $START_BACKEND; then
    [[ -d "$BACKEND_DIR" ]] || fail "Backend dir not found: $BACKEND_DIR"
    info "Starting backend stack via $BACKEND_DIR/scripts/dev-up.sh…"
    (cd "$BACKEND_DIR" && bash scripts/dev-up.sh) &
    BACKEND_PID=$!
    info "Waiting for backend on ${E2E_API_BASE_URL}/api/health (timeout 90s)…"
    for i in {1..90}; do
      if backend_up; then ok "Backend ready."; break; fi
      sleep 1
      if [[ $i -eq 90 ]]; then fail "Backend did not respond within 90s."; fi
    done
  else
    fail "Backend not reachable at ${E2E_API_BASE_URL}. Re-run with --start-backend, or boot it yourself: (cd $BACKEND_DIR && bash scripts/dev-up.sh)"
  fi
fi

# ── 2. Run Playwright (it brings up Next.js itself) ──────────────────
info "Running Playwright…"
info "  E2E_API_BASE_URL=${E2E_API_BASE_URL}"
info "  E2E_BASE_URL=${E2E_BASE_URL}"
info "  E2E_MAILPIT_URL=${E2E_MAILPIT_URL}"
info "  E2E database target preflight passed."

cd "$FRONTEND_DIR"
# Run as child (no `exec`) so the cleanup trap fires on Playwright exit and
# tears down the backend we started. Forward Playwright's exit code.
# The `${ARR[@]+"${ARR[@]}"}` form is needed because `set -u` treats an empty
# array's `${ARR[@]}` expansion as unbound on bash < 4.4-ish.
set +e
npx playwright test ${PLAYWRIGHT_ARGS[@]+"${PLAYWRIGHT_ARGS[@]}"}
PLAYWRIGHT_EXIT=$?
set -e
exit "$PLAYWRIGHT_EXIT"
