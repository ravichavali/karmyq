#!/bin/sh
# Install git hooks by creating symlinks from .git/hooks to scripts/git-hooks
# This ensures hooks are always up-to-date with the source files

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Skip hook installation in CI/Docker environments
# Check for common CI/Docker indicators
if [ -n "$CI" ]; then
  echo "ℹ️  Skipping git hooks installation (CI environment)"
  exit 0
fi

if [ -f "/.dockerenv" ]; then
  echo "ℹ️  Skipping git hooks installation (Docker environment)"
  exit 0
fi

if [ -f "/proc/1/cgroup" ] && grep -q docker /proc/1/cgroup 2>/dev/null; then
  echo "ℹ️  Skipping git hooks installation (Docker environment)"
  exit 0
fi

echo ""
echo "🪝 Installing Git Hooks..."
echo ""

# Check if we're in a git repository
if [ ! -d ".git" ]; then
  echo "⚠️  Not in a git repository, skipping hooks installation"
  exit 0
fi

# Check if git-hooks directory exists
if [ ! -d "scripts/git-hooks" ]; then
  echo "❌ Error: scripts/git-hooks directory not found"
  exit 1
fi

# Create .git/hooks directory if it doesn't exist
mkdir -p .git/hooks

# Counter for installed hooks
installed=0

# Install each hook
for hook in scripts/git-hooks/*; do
  if [ -f "$hook" ]; then
    hook_name=$(basename "$hook")

    # Skip README or other docs
    if [[ "$hook_name" == README* ]] || [[ "$hook_name" == *.md ]]; then
      continue
    fi

    target=".git/hooks/$hook_name"

    # Remove existing hook (whether it's a file or symlink)
    if [ -e "$target" ] || [ -L "$target" ]; then
      rm "$target"
      echo "  Removing existing $hook_name"
    fi

    # On Windows/Git Bash, we need to copy instead of symlink
    # because symlinks may not work properly
    if [[ "$OSTYPE" == "msys" ]] || [[ "$OSTYPE" == "win32" ]]; then
      cp "$hook" "$target"
      chmod +x "$target"
      echo "  ✓ Installed $hook_name (copy)"
    else
      # On Unix, use relative symlinks
      ln -sf "../../$hook" "$target"
      chmod +x "$hook"
      echo "  ✓ Installed $hook_name (symlink)"
    fi

    installed=$((installed + 1))
  fi
done

echo ""
if [ $installed -eq 0 ]; then
  echo "❌ No hooks found to install"
  exit 1
else
  echo "✅ Successfully installed $installed hook(s)"
  echo ""
  echo "Installed hooks:"
  echo "  • pre-commit  - Runs service analysis and documentation checks"
  echo "  • pre-push    - Runs tests before pushing (skip with --no-verify)"
  echo ""
  echo "ℹ️  Hooks will run automatically on commit/push"
  echo "ℹ️  To bypass: use --no-verify flag"
  echo ""
fi
