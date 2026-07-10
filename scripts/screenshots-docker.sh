#!/usr/bin/env bash
# RUMI Frontend — run the screenshot-baseline suite inside the pinned
# Playwright linux image, so captures match CI byte-for-byte regardless of
# the host OS (macOS font rasterisation differs — never bake baselines there).
#
# Usage:
#   bash scripts/screenshots-docker.sh             # compare against committed baselines
#   bash scripts/screenshots-docker.sh --update    # regenerate baselines (--update-snapshots)
#
# Prereqs (same stack the functional e2e suite uses — see e2e/README.md):
#   - backend API up on :5221 with the e2e seed applied (e2e/seed/seed.sql)
#   - docker
#
# Notes:
#   - macOS: the container reaches the host backend via host.docker.internal;
#     node_modules and .next are shadowed by named volumes (linux binaries).
#     To refresh deps after a lockfile change:
#       docker volume rm rumi-screenshots-node-modules
#   - Linux: runs with --network host and reuses the host node_modules.
set -euo pipefail

GREEN='\033[0;32m'; RED='\033[0;31m'; CYAN='\033[0;36m'; NC='\033[0m'
info() { echo -e "${CYAN}ℹ${NC}  $1"; }
ok()   { echo -e "${GREEN}✓${NC}  $1"; }
fail() { echo -e "${RED}✗${NC}  $1"; exit 1; }

cd "$(dirname "$0")/.."

UPDATE_FLAG=""
for arg in "$@"; do
  case "$arg" in
    --update) UPDATE_FLAG="--update-snapshots" ;;
    -h|--help) sed -n '2,18p' "$0"; exit 0 ;;
    *) fail "Unknown arg: $arg" ;;
  esac
done

command -v docker >/dev/null || fail "docker not installed."
docker info >/dev/null 2>&1 || fail "Docker daemon not running."

# Image tag MUST match the installed @playwright/test version — the browsers
# baked into the image are version-locked to the npm package.
PLAYWRIGHT_VERSION="$(node -p "require('./package-lock.json').packages['node_modules/@playwright/test'].version")"
IMAGE="mcr.microsoft.com/playwright:v${PLAYWRIGHT_VERSION}-noble"

# The API origin must stay `localhost` — the app's CSP carries
# `upgrade-insecure-requests`, and browsers upgrade http:// requests to any
# non-localhost host (e.g. host.docker.internal) to https://, which the CSP
# connect-src then blocks and the app silently falls back to mockApiClient
# data. Keeping localhost also makes the baked bundle identical to CI's.
API_URL="http://localhost:5221"

DOCKER_ARGS=(--rm --init --ipc=host -w /work -v "$PWD":/work)
IN_CONTAINER_SETUP=":"

if [[ "$(uname -s)" == "Linux" ]]; then
  DOCKER_ARGS+=(--network host)
else
  # macOS: no host networking — run a tiny in-container TCP proxy so the
  # container's localhost:5221 forwards to the host backend. Shadow host-OS
  # build artifacts (darwin binaries) with named volumes.
  DOCKER_ARGS+=(-v rumi-screenshots-node-modules:/work/node_modules -v rumi-screenshots-next:/work/.next)
  read -r -d '' PROXY_JS <<'JS' || true
const net = require("net");
net.createServer((c) => {
  const u = net.connect(5221, "host.docker.internal");
  c.pipe(u).pipe(c);
  c.on("error", () => u.destroy());
  u.on("error", () => c.destroy());
}).listen(5221, "127.0.0.1");
JS
  IN_CONTAINER_SETUP="node -e '${PROXY_JS}' & { [ -x node_modules/.bin/playwright ] || npm ci --prefer-offline --no-audit; }"
fi

# Preflight: the backend must be reachable from where the browser will call it.
if ! curl -fsS --max-time 3 "${E2E_API_BASE_URL:-http://localhost:5221}/api/health" >/dev/null 2>&1; then
  fail "Backend not reachable on ${E2E_API_BASE_URL:-http://localhost:5221}. Boot + seed it first (e2e/README.md §Screenshot baseline)."
fi

info "Image:    $IMAGE"
info "API URL:  $API_URL (in-container)"
info "Mode:     ${UPDATE_FLAG:-compare}"

docker run "${DOCKER_ARGS[@]}" \
  -e E2E_API_BASE_URL="$API_URL" \
  -e SCREENSHOT_PORT="${SCREENSHOT_PORT:-3100}" \
  "$IMAGE" \
  bash -c "$IN_CONTAINER_SETUP && npx playwright test -c playwright.screenshots.config.ts $UPDATE_FLAG"

ok "Screenshot suite finished."
