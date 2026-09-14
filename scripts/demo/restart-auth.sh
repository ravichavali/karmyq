#!/usr/bin/env bash
# Sprint 129 (BUG-039) — DEMO_RESTART_AUTH_CMD wiring for `rotate:demo-stories`.
#
# auth-service is a Docker container on the demo host (NOT pm2). A plain `docker restart` re-runs
# the SAME container with its original environment, so it would not pick up the republished story
# IDs — the container must be RECREATED so compose re-interpolates them.
#
# Two things here are load-bearing and were learned from `scripts/deploy.sh`:
#
#   1. Compose gets its values from the PROCESS ENVIRONMENT, not from an env_file. deploy.sh does
#      `set -a; source .env.demo`, and the compose file interpolates `${DEMO_*}`. There is no `.env`
#      on the host, so running compose without sourcing first would interpolate EMPTY values and
#      silently deploy an auth-service with the demo disabled.
#   2. The deployment is TWO compose files — the base plus `docker-compose.prod.yml`. Recreating
#      with only the base file drops every production override.
#
# Fails closed: if the container does not come back healthy, this exits non-zero so `rotateStories`
# stops before reporting success.
#
#   bash scripts/demo/restart-auth.sh

set -euo pipefail

# `npm --workspace` runs with cwd set to the WORKSPACE directory, not the repo root, so every
# relative path below would otherwise resolve under services/simulation-service/. Anchor to the
# repo root derived from this script's own location instead of trusting cwd.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR/../.."

ENV_FILE="${DEMO_ENV_FILE:-.env.demo}"
SERVICE="${DEMO_AUTH_SERVICE:-auth-service}"
CONTAINER="${DEMO_AUTH_CONTAINER:-karmyq-auth-service}"
COMPOSE_FILES="${DEMO_COMPOSE_FILES:--f infrastructure/docker/docker-compose.yml -f infrastructure/docker/docker-compose.prod.yml}"

if [ ! -f "$ENV_FILE" ]; then
  echo "restart-auth: refusing — env file not found: $ENV_FILE" >&2
  exit 1
fi

# Same contract as deploy.sh: export everything so compose can interpolate ${VAR}.
set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

# Assert the demo config actually made it into the environment. Recreating the container with an
# empty DEMO_SESSION_ENABLED is exactly the failure this rotation exists to repair, so refuse
# rather than deploy a silently-disabled demo.
if [ "${DEMO_SESSION_ENABLED:-}" != "true" ]; then
  echo "restart-auth: refusing — DEMO_SESSION_ENABLED is not 'true' after sourcing $ENV_FILE" >&2
  exit 1
fi
for v in DEMO_PERSONA_EMAIL DEMO_ORDINARY_REQUEST_ID DEMO_ORDINARY_MATCH_ID \
         DEMO_PROVIDER_REQUEST_ID DEMO_PROVIDER_OFFER_ID; do
  if [ -z "${!v:-}" ]; then
    echo "restart-auth: refusing — $v is empty after sourcing $ENV_FILE" >&2
    exit 1
  fi
done

echo "restart-auth: recreating $SERVICE"
# shellcheck disable=SC2086
docker compose $COMPOSE_FILES up -d --force-recreate --no-deps "$SERVICE"

# Wait for readiness rather than sleeping a fixed guess (the mistake BUG-036 records in CI).
# Poll the service's own /health from INSIDE the container: /health is not exposed through nginx.
deadline=$(( $(date +%s) + 120 ))
until docker exec "$CONTAINER" node -e '
  const http = require("http");
  const port = process.env.PORT || 3001;
  const req = http.get({ host: "127.0.0.1", port, path: "/health", timeout: 2000 },
                       r => process.exit(r.statusCode === 200 ? 0 : 1));
  // The node timeout option EMITS a timeout event; it does not close the request. Without this
  // handler a container that accepts the connection but never responds hangs this process
  // forever, and the until-loop below never runs again to check its own 120s deadline -- the
  // fixed-sleep failure BUG-036 records, in a different disguise. Destroy and fail so we retry.
  req.on("timeout", () => { req.destroy(); process.exit(1); });
  req.on("error", () => process.exit(1));
' >/dev/null 2>&1; do
  if [ "$(date +%s)" -ge "$deadline" ]; then
    echo "restart-auth: FAILED — $CONTAINER did not report healthy within 120s" >&2
    docker logs --tail 40 "$CONTAINER" >&2 || true
    exit 1
  fi
  sleep 2
done

echo "restart-auth: $CONTAINER recreated and healthy"
