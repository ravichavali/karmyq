#!/bin/bash
#
# Setup Git Hooks for Local Testing
# This script installs Husky and sets up automatic pre-commit testing
#
# Usage:
#   ./scripts/setup-git-hooks.sh          # Install with pre-commit hook
#   ./scripts/setup-git-hooks.sh --skip-install  # Just create hook files
#

set -e

SKIP_INSTALL=${1:-""}

echo "========================================="
echo "  Git Hooks Setup - Karmyq"
echo "========================================="
echo ""

# Install Husky if not skipping
if [ "$SKIP_INSTALL" != "--skip-install" ]; then
  echo "📦 Installing Husky..."
  npm install --save-dev husky
  echo ""
fi

# Initialize Husky
echo "🔧 Initializing Husky..."
npx husky init

# Create pre-commit hook
echo "📝 Creating pre-commit hook..."
cat > .husky/pre-commit << 'EOF'
#!/bin/sh
. "$(dirname "$0")/_/husky.sh"

echo ""
echo "🧪 Running pre-commit tests..."
echo ""

# Run quick tests (type-check + integration)
./scripts/test-local.sh quick

if [ $? -ne 0 ]; then
  echo ""
  echo "❌ Tests failed! Commit aborted."
  echo ""
  echo "To skip tests (not recommended):"
  echo "  git commit --no-verify -m \"your message\""
  echo ""
  exit 1
fi

echo ""
echo "✅ Pre-commit tests passed!"
echo ""
EOF

chmod +x .husky/pre-commit

# Create pre-push hook
echo "📝 Creating pre-push hook..."
cat > .husky/pre-push << 'EOF'
#!/bin/sh
. "$(dirname "$0")/_/husky.sh"

echo ""
echo "🎭 Running pre-push E2E tests..."
echo ""

# Run E2E tests before pushing
./scripts/test-local.sh e2e

if [ $? -ne 0 ]; then
  echo ""
  echo "❌ E2E tests failed! Push aborted."
  echo ""
  echo "To skip tests (not recommended):"
  echo "  git push --no-verify"
  echo ""
  exit 1
fi

echo ""
echo "✅ Pre-push tests passed!"
echo ""
EOF

chmod +x .husky/pre-push

# Add npm script
echo "📝 Adding npm scripts..."
if ! grep -q "\"prepare\": \"husky\"" package.json; then
  npm pkg set scripts.prepare="husky"
fi

echo ""
echo "========================================="
echo "  ✅ Git hooks installed!"
echo "========================================="
echo ""
echo "Hooks created:"
echo "  - pre-commit: Runs type-check + integration tests"
echo "  - pre-push:   Runs E2E tests"
echo ""
echo "To disable hooks temporarily:"
echo "  git commit --no-verify"
echo "  git push --no-verify"
echo ""
echo "To uninstall hooks:"
echo "  rm -rf .husky"
echo "  npm uninstall husky"
echo ""
