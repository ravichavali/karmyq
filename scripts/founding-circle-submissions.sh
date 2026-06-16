#!/usr/bin/env bash
#
# founding-circle-submissions.sh — read the karmyq.org /join/ intake queue.
#
# The landing /join/ form POSTs to the auth-service, which stores leads in
# auth.founding_circle_submissions (see infrastructure/postgres/init.sql).
# Run this ON THE DEMO SERVER (karmyq.com) where the karmyq-postgres container runs.
#
# Usage:
#   ./founding-circle-submissions.sh            # summary table, newest first
#   ./founding-circle-submissions.sh --full     # all columns, one field per line
#   ./founding-circle-submissions.sh --count    # counts grouped by status
#   ./founding-circle-submissions.sh --csv       > leads.csv   # CSV export
#
# Credentials never hit the terminal: psql runs inside the container using its
# own POSTGRES_* env vars.

set -euo pipefail

CONTAINER="karmyq-postgres"
MODE="${1:-summary}"

# Refuse to run if the DB container isn't here (i.e. you're not on the server).
if ! docker ps --format '{{.Names}}' | grep -qx "$CONTAINER"; then
  echo "error: container '$CONTAINER' not running here." >&2
  echo "Run this on the demo server (ssh ubuntu@karmyq.com), not your laptop." >&2
  exit 1
fi

run_sql() {
  # $1 = extra psql flags, $2 = SQL
  docker exec "$CONTAINER" sh -c \
    "PGPASSWORD=\$POSTGRES_PASSWORD psql -U \"\$POSTGRES_USER\" -d \"\$POSTGRES_DB\" $1 -c \"$2\""
}

case "$MODE" in
  --full)
    run_sql "-x" \
      "SELECT * FROM auth.founding_circle_submissions ORDER BY created_at DESC;"
    ;;
  --count)
    run_sql "" \
      "SELECT status, count(*) FROM auth.founding_circle_submissions GROUP BY status ORDER BY status;"
    ;;
  --csv)
    run_sql "" \
      "\\copy (SELECT id, email, lens, contribution, concern, status, created_at, reviewed_at FROM auth.founding_circle_submissions ORDER BY created_at DESC) TO STDOUT WITH CSV HEADER"
    ;;
  summary|"")
    run_sql "" \
      "SELECT created_at, email, lens, status FROM auth.founding_circle_submissions ORDER BY created_at DESC;"
    ;;
  *)
    echo "unknown option: $MODE" >&2
    echo "use: (no args) | --full | --count | --csv" >&2
    exit 2
    ;;
esac
