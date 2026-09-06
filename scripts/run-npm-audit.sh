#!/usr/bin/env bash
# npm audit with a cached verdict and a retried, legible fetch (frontend #712).
#
# The gate's verdict rides on ONE round-trip to the npm registry's advisory endpoint,
# whose latency is not ours: measured on this repo it ran 25s, 27s, 3m06s, then blew past
# the 5-minute job cap four times (#711) — each death reporting as CANCELLED, which reads
# like a human pressed stop. Raising the cap (#711) was a bound, not a cure. This script
# is the cure the issue asked for, on two axes:
#
#   1. A slow registry must not cost the merge queue. The verdict is cached per
#      package-lock.json hash — the audit input only changes when the lockfile does —
#      with a calendar-week salt so a cached verdict can never outlive ~7 days (an
#      advisory published against an UNCHANGED lockfile still lands within the week).
#      On a cache miss the fetch is retried with backoff, and each attempt is capped
#      with coreutils `timeout` so even a genuine hang comes back as a classified,
#      retried failure instead of a CANCELLED job.
#
#   2. Failures must be legible. npm audit exits non-zero BOTH for findings and for
#      fetch errors, so the exit code cannot classify the run — the JSON can: valid
#      output always carries metadata.vulnerabilities, whatever the verdict. Anything
#      else is a fetch failure and says so, loudly, with the one action that helps
#      (re-run the job). If this job ever still shows CANCELLED, that can only be a
#      runner-level hang, not a fetch failure.
#
# The verdict itself is still decided by scripts/check-npm-audit.mjs (the expiring
# allowlist), re-run on EVERY invocation including cache hits — so allowlist expiry
# dates are enforced at run time, never frozen by the cache. Note actions/cache only
# SAVES the cache when the job succeeds, so a red audit re-fetches live every run
# until it is fixed — which is the honest behaviour for a failing gate.
set -euo pipefail

CACHE_DIR=".npm-audit-cache"
VERDICT="$CACHE_DIR/audit.json"
CACHED_AT="$CACHE_DIR/cached-at"
ATTEMPTS=3
PER_ATTEMPT_TIMEOUT_SECS=240
SLEEP_BASE="${AUDIT_RETRY_BASE_SLEEP:-20}"

run_audit() {
  # `timeout` bounds a hung registry round-trip so the retry loop can classify it;
  # macOS lacks coreutils timeout, so degrade to unbounded there (local use only —
  # CI runners are ubuntu and always have it).
  if command -v timeout >/dev/null 2>&1; then
    timeout "$PER_ATTEMPT_TIMEOUT_SECS" npm audit --json > /tmp/npm-audit-raw.json 2> /tmp/npm-audit-err.log
  else
    npm audit --json > /tmp/npm-audit-raw.json 2> /tmp/npm-audit-err.log
  fi
}

is_valid_audit_json() {
  node -e 'const a = JSON.parse(require("fs").readFileSync("/tmp/npm-audit-raw.json", "utf8")); if (!a.metadata || !a.metadata.vulnerabilities) process.exit(1);' 2>/dev/null
}

if [[ -f "$VERDICT" ]]; then
  echo "✓ using cached npm-audit verdict (cached: $(cat "$CACHED_AT")) — skipping the registry round-trip."
  echo "  allowlist expiry is still evaluated NOW by scripts/check-npm-audit.mjs."
  node scripts/check-npm-audit.mjs "$VERDICT"
  exit 0
fi

mkdir -p "$CACHE_DIR"
for attempt in $(seq 1 "$ATTEMPTS"); do
  status=0
  run_audit || status=$?

  if is_valid_audit_json; then
    cp /tmp/npm-audit-raw.json "$VERDICT"
    date -u +"%Y-%m-%dT%H:%M:%SZ" > "$CACHED_AT"
    if [[ "$status" -eq 0 ]]; then
      echo "✓ npm audit ran against the live registry (attempt ${attempt}/${ATTEMPTS})."
    fi
    node scripts/check-npm-audit.mjs "$VERDICT"
    exit $?
  fi

  echo "::warning::npm audit could not fetch advisories (attempt ${attempt}/${ATTEMPTS}) — this is a fetch failure, not an audit finding."
  if [[ -s /tmp/npm-audit-err.log ]]; then
    tail -n 3 /tmp/npm-audit-err.log
  fi
  if [[ "$attempt" -lt "$ATTEMPTS" ]]; then
    sleep "$((SLEEP_BASE * attempt))"
  fi
done

echo "::error::Could not fetch advisories from the npm registry after ${ATTEMPTS} attempts — the audit did NOT run. Re-run this job; fixing dependencies cannot help while the registry is unreachable."
exit 1
