#!/bin/bash
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
if [ -n "$CI" ] || [ -f "/.dockerenv" ] || grep -sq 'docker\|lxc' /proc/1/cgroup 2>/dev/null; then
  echo "ℹ️  Skipping git hooks installation (CI/Docker environment)"
  exit 0
fi

echo ""
echo "🪝 Installing Git Hooks..."
echo ""

# Check if we're in a git repository
if [ ! -d ".git" ]; then
  echo -e "${YELLOW}⚠️  Not in a git repository, skipping hooks installation${NC}"
  exit 0
fi

# Check if git-hooks directory exists
if [ ! -d "scripts/git-hooks" ]; then
  echo -e "${RED}❌ Error: scripts/git-hooks directory not found${NC}"
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
      echo -e "${BLUE}  Removing existing $hook_name${NC}"
    fi

    # On Windows/Git Bash, we need to copy instead of symlink
    # because symlinks may not work properly
    if [[ "$OSTYPE" == "msys" ]] || [[ "$OSTYPE" == "win32" ]]; then
      cp "$hook" "$target"
      chmod +x "$target"
      echo -e "${GREEN}  ✓ Installed $hook_name (copy)${NC}"
    else
      # On Unix, use relative symlinks
      ln -sf "../../$hook" "$target"
      chmod +x "$hook"
      echo -e "${GREEN}  ✓ Installed $hook_name (symlink)${NC}"
    fi

    installed=$((installed + 1))
  fi
done

echo ""
if [ $installed -eq 0 ]; then
  echo -e "${RED}❌ No hooks found to install${NC}"
  exit 1
else
  echo -e "${GREEN}✅ Successfully installed $installed hook(s)${NC}"
  echo ""
  echo "Installed hooks:"
  echo "  • pre-commit  - Runs service analysis and documentation checks"
  echo "  • pre-push    - Runs tests before pushing (skip with --no-verify)"
  echo ""
  echo -e "${BLUE}ℹ️  Hooks will run automatically on commit/push${NC}"
  echo -e "${BLUE}ℹ️  To bypass: use --no-verify flag${NC}"
  echo ""
fi
