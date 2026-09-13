#!/usr/bin/env bash
# Sprint 129 (BUG-039) — DEMO_ENABLE_CMD wiring for `rotate:demo-stories`.
#
# `rotateMariaStories.ts` calls DEMO_ENABLE_CMD to re-enable public demo traffic before it
# re-verifies the demo session. `reset:demo` disables the demo during a reset, so this step has to
# be able to turn it back on; for a plain rotation it is a no-op, and it is written to be idempotent
# rather than stubbed out, so the same wiring serves both callers.
#
# Fails closed: a missing env file or an unwritable target is an error, never a silent pass.
#
#   DEMO_ENV_FILE=/home/ubuntu/karmyq/.env.demo bash scripts/demo/enable-demo.sh

set -euo pipefail

# `npm --workspace` runs with cwd set to the WORKSPACE directory, not the repo root, so every
# relative path below would otherwise resolve under services/simulation-service/. Anchor to the
# repo root derived from this script's own location instead of trusting cwd.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR/../.."

ENV_FILE="${DEMO_ENV_FILE:-.env.demo}"

if [ ! -f "$ENV_FILE" ]; then
  echo "enable-demo: refusing — env file not found: $ENV_FILE" >&2
  exit 1
fi
if [ ! -w "$ENV_FILE" ]; then
  echo "enable-demo: refusing — env file is not writable: $ENV_FILE" >&2
  exit 1
fi

# Preserve permissions and ownership by editing a temp copy and moving it back over the original.
tmp="$(mktemp "${ENV_FILE}.enable.XXXXXX")"
trap 'rm -f "$tmp"' EXIT
cp -p "$ENV_FILE" "$tmp"

if grep -qE '^DEMO_SESSION_ENABLED=' "$tmp"; then
  # Rewrite every occurrence: a duplicated key is last-wins, so changing only the first would lie.
  sed -i 's/^DEMO_SESSION_ENABLED=.*/DEMO_SESSION_ENABLED=true/' "$tmp"
else
  printf 'DEMO_SESSION_ENABLED=true\n' >> "$tmp"
fi

mv "$tmp" "$ENV_FILE"
trap - EXIT

# Assert the post-condition rather than trusting the edit. Every occurrence must read `true`:
# the file is known to carry duplicate keys, and last-wins means one stale line would still disable
# the demo while the first line looked correct.
total="$(grep -cE '^DEMO_SESSION_ENABLED=' "$ENV_FILE" || true)"
good="$(grep -cE '^DEMO_SESSION_ENABLED=true$' "$ENV_FILE" || true)"
if [ "$total" != "$good" ] || [ "$good" -lt 1 ]; then
  echo "enable-demo: FAILED — DEMO_SESSION_ENABLED is not true in $ENV_FILE" >&2
  exit 1
fi

echo "enable-demo: DEMO_SESSION_ENABLED=true in $ENV_FILE"
