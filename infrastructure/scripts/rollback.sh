#!/bin/bash

# infrastructure/scripts/rollback.sh
# Usage: ./rollback.sh [production|staging] [git-ref]

ENV=${1:-production}
TARGET_COMMIT=${2:-HEAD^} # Default to previous commit

echo "⏪ Rolling back $ENV to $TARGET_COMMIT..."

# 1. Revert Code
git reset --hard $TARGET_COMMIT

# 2. Redeploy
echo "🔄 Redeploying..."
./infrastructure/scripts/deploy.sh $ENV

echo "✅ Rollback complete!"
