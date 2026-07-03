#!/bin/bash
#
# Sprint 117: the legacy full-truncate has been replaced by the single guarded demo reset.
# The old script disabled constraints and truncated a stale, incomplete table list, with no
# fingerprint, backup, advisory lock, or transaction. It is no longer a supported path.
#
# This wrapper now delegates to the guarded, dry-run-by-default reset. Pass --apply (plus the
# required demo fingerprint, backup dir, and DEMO_PERSONA_PASSWORD) to actually mutate data.
#
#   ./scripts/truncate-database.sh                 # dry-run plan
#   ./scripts/truncate-database.sh --apply         # guarded destructive reset (approved downtime)

set -e

echo "⚠️  truncate-database.sh is deprecated — delegating to the guarded curated demo reset."
echo "    Read-only plan by default; add --apply for the destructive path."
echo ""

exec npm --workspace @karmyq/simulation-service run reset:demo -- "$@"
