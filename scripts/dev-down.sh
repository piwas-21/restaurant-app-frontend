#!/usr/bin/env bash
# RUMI Frontend — stop the local dev server.
#
# Usage:
#   bash scripts/dev-down.sh           # finds and kills the next dev server on :3000
#
# Note: typical workflow is just Ctrl-C in the terminal running `npm run dev`.
# This script exists for the case where the dev server was orphaned
# (terminal closed without Ctrl-C, or running detached).

set -euo pipefail

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
ok()   { echo -e "${GREEN}✓${NC}  $1"; }
warn() { echo -e "${YELLOW}⚠${NC}  $1"; }

cd "$(dirname "$0")/.."

PORT=3000
PIDS=$(lsof -ti tcp:"$PORT" 2>/dev/null || true)

if [[ -z "$PIDS" ]]; then
  ok "No process listening on :$PORT — already stopped."
  exit 0
fi

warn "Killing process(es) on :$PORT — PID(s): $PIDS"
echo "$PIDS" | xargs kill 2>/dev/null || true
sleep 1

# Verify
if lsof -ti tcp:"$PORT" >/dev/null 2>&1; then
  warn "Process still alive after SIGTERM. Sending SIGKILL…"
  echo "$PIDS" | xargs kill -9 2>/dev/null || true
fi

ok "Dev server stopped."
