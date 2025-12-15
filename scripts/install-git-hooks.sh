#!/bin/bash
#
# Install Git Hooks for Karmyq
# Sets up pre-commit and pre-push hooks to enforce testing
#

set -e

echo "🔧 Installing Git hooks for Karmyq..."

# Check if we're in a git repository
if [ ! -d ".git" ]; then
  echo "❌ Error: Not in a git repository"
  exit 1
fi

# Create .git/hooks directory if it doesn't exist
mkdir -p .git/hooks

# Copy hooks
echo "📋 Copying pre-commit hook..."
cp scripts/git-hooks/pre-commit .git/hooks/pre-commit
chmod +x .git/hooks/pre-commit

echo "📋 Copying pre-push hook..."
cp scripts/git-hooks/pre-push .git/hooks/pre-push
chmod +x .git/hooks/pre-push

echo ""
echo "✅ Git hooks installed successfully!"
echo ""
echo "The following hooks are now active:"
echo "  • pre-commit: TypeScript type check + integration tests"
echo "  • pre-push: Full test suite (integration + E2E)"
echo ""
echo "To bypass hooks (not recommended):"
echo "  git commit --no-verify"
echo "  git push --no-verify"
echo ""
