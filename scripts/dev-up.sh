#!/usr/bin/env bash
# RUMI Frontend — start the local Next.js dev server.
#
# What it does:
#   1. Verifies .env.local exists (template from .env.example if missing).
#   2. Health-checks the backend (curl $NEXT_PUBLIC_API_URL/api/health).
#   3. Runs `npm install` only if package-lock.json changed since last install.
#   4. Starts `npm run dev` (Next.js dev server with Turbopack).
#
# Usage:
#   bash scripts/dev-up.sh                # full flow
#   bash scripts/dev-up.sh --no-run       # set up only; don't start dev server
#   bash scripts/dev-up.sh --no-backend-check   # skip backend health check
#   bash scripts/dev-up.sh --help

set -euo pipefail

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; CYAN='\033[0;36m'; NC='\033[0m'
info() { echo -e "${CYAN}ℹ${NC}  $1"; }
ok()   { echo -e "${GREEN}✓${NC}  $1"; }
warn() { echo -e "${YELLOW}⚠${NC}  $1"; }
fail() { echo -e "${RED}✗${NC}  $1"; exit 1; }

cd "$(dirname "$0")/.."

# ── Args ─────────────────────────────────────────────────────────────
NO_RUN=false
NO_BACKEND_CHECK=false
while [[ $# -gt 0 ]]; do
  case "$1" in
    --no-run) NO_RUN=true; shift ;;
    --no-backend-check) NO_BACKEND_CHECK=true; shift ;;
    -h|--help) sed -n '2,15p' "$0"; exit 0 ;;
    *) fail "Unknown arg: $1" ;;
  esac
done

# ── Preflight ────────────────────────────────────────────────────────
command -v node >/dev/null || fail "node not installed."
command -v npm  >/dev/null || fail "npm not installed."

# ── 1. .env.local ─────────────────────────────────────────────────────
info "[1/4] Checking .env.local…"
if [[ ! -f .env.local ]]; then
  warn ".env.local missing. Bootstrapping via scripts/dev-secrets.sh…"
  bash scripts/dev-secrets.sh
fi
ok ".env.local present."

# ── 2. Backend health check ──────────────────────────────────────────
if $NO_BACKEND_CHECK; then
  warn "Skipping backend health check (--no-backend-check)."
else
  info "[2/4] Health-checking backend…"
  # Read NEXT_PUBLIC_API_URL from .env.local without sourcing (avoids exec of arbitrary content).
  API_URL=$(grep -E '^NEXT_PUBLIC_API_URL=' .env.local | head -1 | cut -d'=' -f2- | tr -d '"' | tr -d "'")
  if [[ -z "$API_URL" ]]; then
    warn "NEXT_PUBLIC_API_URL not set in .env.local. Skipping backend check."
  else
    # Try /api/health first (standard), fall back to root.
    if curl -sf -m 3 "$API_URL/api/health" >/dev/null 2>&1; then
      ok "Backend reachable at $API_URL/api/health."
    elif curl -sf -m 3 "$API_URL/health" >/dev/null 2>&1; then
      ok "Backend reachable at $API_URL/health."
    elif curl -sf -m 3 "$API_URL" >/dev/null 2>&1; then
      warn "Backend root reachable at $API_URL but no /health endpoint. Continuing anyway."
    else
      warn "Backend NOT reachable at $API_URL. Did you run 'bash scripts/dev-up.sh' in the backend repo?"
      warn "Continuing — Next.js will still start, but API calls will fail until backend is up."
    fi
  fi
fi

# ── 3. npm install (only if lockfile changed) ─────────────────────────
info "[3/4] Checking npm dependencies…"
LOCK_HASH_FILE="node_modules/.package-lock-hash"
if [[ -f package-lock.json ]]; then
  CURRENT_HASH=$(shasum -a 256 package-lock.json 2>/dev/null | cut -d' ' -f1 || sha256sum package-lock.json | cut -d' ' -f1)
  if [[ ! -f "$LOCK_HASH_FILE" ]] || [[ "$CURRENT_HASH" != "$(cat "$LOCK_HASH_FILE" 2>/dev/null)" ]]; then
    info "package-lock.json changed since last install. Running npm install…"
    npm install
    echo "$CURRENT_HASH" > "$LOCK_HASH_FILE"
    ok "Dependencies installed."
  else
    ok "Dependencies up to date."
  fi
else
  warn "package-lock.json missing. Running npm install…"
  npm install
fi

# ── 4. npm run dev ───────────────────────────────────────────────────
echo ""
ok "Frontend ready:"
echo "    Dev server (when started): http://localhost:3000"
echo "    Backend (per .env.local):  ${API_URL:-not set}"
echo ""

if $NO_RUN; then
  echo "  Skipping npm run dev (--no-run). Start manually:  npm run dev"
  exit 0
fi

info "[4/4] Starting Next.js dev server (Ctrl-C to stop)…"
echo ""
exec npm run dev
