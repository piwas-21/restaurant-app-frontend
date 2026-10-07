#!/usr/bin/env bash
set -Eeuo pipefail

FRONTEND_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd -P)"
COMPOSE_FILE="$FRONTEND_DIR/e2e/p11/compose.yaml"
TARGET_HELPER="$FRONTEND_DIR/scripts/e2e-p11-target.cjs"
EVIDENCE_ROOT="/tmp/table-account-p11-evidence"
NODE22_BIN="${NODE22_BIN:-}"
KEEP_RUN="${P11_KEEP_RUN:-0}"
BACKEND_DIR="${P11_BACKEND_DIR:-/Users/mahmutkaya/workspace/worktrees/table-accounts/backend-cash-rounding}"
API_PID=""
SNAPSHOT_COMPLETE="false"
COMPOSE_DOWN_COMPLETE="false"
RUN_ID=""
COMPOSE_PROJECT=""
EVIDENCE_DIR=""

fail() {
  printf 'P11 local run stopped: %s\n' "$1" >&2
  exit 1
}

[[ "$KEEP_RUN" == "0" || "$KEEP_RUN" == "1" ]] || fail 'P11_KEEP_RUN must be 0 or 1.'
STATE_DIR="$(mktemp -d /tmp/table-account-p11.XXXXXXXX)"
chmod 700 "$STATE_DIR"

stop_api() {
  if [[ -n "$API_PID" ]] && kill -0 "$API_PID" 2>/dev/null; then
    kill -TERM "$API_PID" 2>/dev/null || true
    wait "$API_PID" 2>/dev/null || true
  fi
  API_PID=""
}

compose() {
  docker compose --env-file "$STATE_DIR/compose.env" -p "$COMPOSE_PROJECT" -f "$COMPOSE_FILE" "$@"
}

finish() {
  local result=$?
  set +e
  stop_api
  if [[ "$SNAPSHOT_COMPLETE" == "true" && "$COMPOSE_DOWN_COMPLETE" != "true" ]]; then
    if compose down --volumes --remove-orphans; then
      COMPOSE_DOWN_COMPLETE="true"
    else
      printf 'P11 snapshot is safe at %s, but its run-owned Compose project remains available: %s\n' \
        "$EVIDENCE_DIR/database.dump" "$COMPOSE_PROJECT" >&2
    fi
  fi
  if [[ "$COMPOSE_DOWN_COMPLETE" == "true" && "$STATE_DIR" == /tmp/table-account-p11.* ]]; then
    rm -rf -- "$STATE_DIR"
  elif [[ -n "$STATE_DIR" && -d "$STATE_DIR" ]]; then
    printf 'P11 private run state retained for inspection: %s\n' "$STATE_DIR" >&2
  fi
  exit "$result"
}
trap finish EXIT

if [[ -z "$NODE22_BIN" ]]; then
  NODE22_BIN="$(command -v node || true)"
elif [[ "$NODE22_BIN" != */* ]]; then
  NODE22_BIN="$(command -v "$NODE22_BIN" || true)"
fi
[[ -n "$NODE22_BIN" && -x "$NODE22_BIN" ]] || \
  fail 'Node is unavailable on PATH; install Node 22 or set NODE22_BIN to a Node 22 executable.'
NODE_VERSION="$("$NODE22_BIN" -p 'process.versions.node')"
[[ "${NODE_VERSION%%.*}" == "22" ]] || fail 'the harness requires Node 22.'
NODE22_DIR="$(dirname "$NODE22_BIN")"
export PATH="$NODE22_DIR:$PATH"

command -v docker >/dev/null 2>&1 || fail 'Docker is not installed or unavailable on PATH.'
command -v dotnet >/dev/null 2>&1 || fail 'the .NET SDK is not installed or unavailable on PATH.'
command -v curl >/dev/null 2>&1 || fail 'curl is required for local API health checks.'
command -v rg >/dev/null 2>&1 || fail 'ripgrep is required for the isolated service health check.'
docker compose version >/dev/null 2>&1 || fail 'Docker Compose v2 is required.'
[[ -f "$COMPOSE_FILE" && -f "$TARGET_HELPER" ]] || fail 'the P11 Compose file or target guard is missing.'
[[ -f "$BACKEND_DIR/RestaurantSystem.Api/RestaurantSystem.Api.csproj" ]] || \
  fail 'P11_BACKEND_DIR must point to the current backend-cash-rounding worktree.'
[[ -f "$BACKEND_DIR/RestaurantSystem.Infrastructure/RestaurantSystem.Infrastructure.csproj" ]] || \
  fail 'the current backend infrastructure project could not be found.'

"$NODE22_BIN" "$TARGET_HELPER" init "$STATE_DIR"
# These files are generated only by the target helper. Their values are restricted to
# alphanumeric run identities and hex credentials, so sourcing them cannot evaluate user input.
set -a
# shellcheck disable=SC1091 # Generated only by the target helper above.
source "$STATE_DIR/compose.env"
set +a
RUN_ID="$P11_RUN_ID"
COMPOSE_PROJECT="$P11_COMPOSE_PROJECT"
EVIDENCE_DIR="$EVIDENCE_ROOT/$RUN_ID"
mkdir -p "$EVIDENCE_ROOT" "$EVIDENCE_DIR"
chmod 700 "$EVIDENCE_ROOT" "$EVIDENCE_DIR"

compose up -d

ready=false
for _ in $(seq 1 90); do
  if compose exec -T postgres pg_isready -U "$P11_DATABASE_USER" -d "$P11_DATABASE_NAME" >/dev/null 2>&1 && \
    compose exec -T redis redis-cli ping 2>/dev/null | rg -q '^PONG$'; then
    ready=true
    break
  fi
  sleep 1
done
[[ "$ready" == "true" ]] || fail 'the isolated PostgreSQL 16 and Redis services did not become healthy.'

postgres_binding="$(compose port postgres 5432)"
redis_binding="$(compose port redis 6379)"
[[ "$postgres_binding" == 127.0.0.1:* && "$redis_binding" == 127.0.0.1:* ]] || \
  fail 'Compose did not publish its database and Redis ports on loopback only.'
postgres_port="${postgres_binding##*:}"
redis_port="${redis_binding##*:}"

"$NODE22_BIN" "$TARGET_HELPER" configure "$STATE_DIR" "$postgres_port" "$redis_port"
set -a
# shellcheck disable=SC1091 # Generated mode-0600 profile from the target helper above.
source "$STATE_DIR/runner.env"
set +a
"$NODE22_BIN" "$TARGET_HELPER" check

(
  cd "$BACKEND_DIR"
  dotnet ef database update \
    --project "$BACKEND_DIR/RestaurantSystem.Infrastructure/RestaurantSystem.Infrastructure.csproj" \
    --startup-project "$BACKEND_DIR/RestaurantSystem.Api/RestaurantSystem.Api.csproj"
)

cd "$FRONTEND_DIR"
"$NODE22_BIN" scripts/e2e-seed.mjs

umask 077
: >"$STATE_DIR/backend.log"
dotnet run --project "$BACKEND_DIR/RestaurantSystem.Api/RestaurantSystem.Api.csproj" \
  --no-build --no-launch-profile >"$STATE_DIR/backend.log" 2>&1 &
API_PID=$!

api_ready=false
for _ in $(seq 1 120); do
  if curl --silent --show-error --fail "$E2E_API_BASE_URL/api/health" >/dev/null 2>&1; then
    api_ready=true
    break
  fi
  if ! kill -0 "$API_PID" 2>/dev/null; then
    break
  fi
  sleep 1
done
[[ "$api_ready" == "true" ]] || fail "the local API did not become healthy; see the private backend log at $STATE_DIR/backend.log."

export P11_ARTIFACT_DIR="$STATE_DIR/playwright"
export P11_KEEP_RUN="$KEEP_RUN"
mkdir -p "$P11_ARTIFACT_DIR"
chmod 700 "$P11_ARTIFACT_DIR"
set +e
"$NODE22_BIN" node_modules/@playwright/test/cli.js test --config e2e/p11/playwright.config.ts
test_status=$?
set -e

if [[ "$KEEP_RUN" != "1" || "$test_status" -ne 0 ]]; then
  stop_api
fi
mkdir -p "$EVIDENCE_DIR/playwright"
chmod 700 "$EVIDENCE_DIR/playwright"
cp -R "$P11_ARTIFACT_DIR/." "$EVIDENCE_DIR/playwright/"
cp "$STATE_DIR/backend.log" "$EVIDENCE_DIR/backend.log"
chmod -R go-rwx "$EVIDENCE_DIR"
chmod 600 "$EVIDENCE_DIR/backend.log"

umask 077
# shellcheck disable=SC2016 # Variables must expand inside the PostgreSQL container.
if ! compose exec -T postgres sh -c \
  'PGPASSWORD="$POSTGRES_PASSWORD" pg_dump --format=custom --no-owner --no-privileges -U "$POSTGRES_USER" -d "$POSTGRES_DB"' \
  >"$EVIDENCE_DIR/database.dump"; then
  fail "the run-owned database snapshot failed; the volume and private state are retained at $STATE_DIR."
fi
[[ -s "$EVIDENCE_DIR/database.dump" ]] || fail "the database snapshot was empty; the volume and private state are retained at $STATE_DIR."
chmod 600 "$EVIDENCE_DIR/database.dump"
SNAPSHOT_COMPLETE="true"

if [[ "$test_status" -eq 0 ]]; then
  journey_result="passed"
else
  journey_result="failed"
fi
cat >"$EVIDENCE_DIR/run.json" <<EOF
{
  "runId": "$RUN_ID",
  "result": "$journey_result",
  "databaseSnapshot": "database.dump",
  "localApiOrigin": "loopback only",
  "localUiOrigin": "loopback only",
  "onlineProvider": "disabled",
  "cashSettlement": "synthetic local record; no physical cash moved",
  "physicalPrinter": "not connected or claimed"
}
EOF
chmod 600 "$EVIDENCE_DIR/run.json"

if [[ "$test_status" -ne 0 ]]; then
  printf 'P11 browser journey failed with exit code %s. The complete run-owned database snapshot and private logs are at %s\n' \
    "$test_status" "$EVIDENCE_DIR" >&2
  exit "$test_status"
fi

printf 'P11 browser journey and database snapshot completed. Private evidence: %s\n' "$EVIDENCE_DIR"

if [[ "$KEEP_RUN" == "1" ]]; then
  printf 'P11 local stack remains available for connected acceptance. API: %s; private runner profile: %s/runner.env. Press Ctrl-C to stop the API and remove only this run-owned Compose project.\n' \
    "$E2E_API_BASE_URL" "$STATE_DIR"
  while true; do
    sleep 5
  done
fi
