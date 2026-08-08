#!/bin/sh
# Install git hooks from scripts/git-hooks into the directory git ACTUALLY reads.
#
# That directory is NOT always .git/hooks. When core.hooksPath is set, git reads only
# that path and ignores .git/hooks entirely. This script used to hardcode .git/hooks,
# so on any machine with core.hooksPath set (husky sets it) every hook it installed was
# dead code -- pushes completed silently in seconds with no tests run. See ADR-092's
# sibling finding and tests/regression/sprint-123-git-hooks-installed.test.ts.

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

# Resolve where git will ACTUALLY look for hooks. core.hooksPath wins whenever it is
# set; otherwise git uses .git/hooks. Installing anywhere else is a silent no-op.
#
# This deliberately reads the MERGED value, because merged is what git itself obeys -- reading
# only --local would miss a global setting and put us right back to installing into a directory
# git never reads. The out-of-repo refusal below is what keeps that safe.
hooks_dir=$(git config --get core.hooksPath || true)
[ -z "$hooks_dir" ] && hooks_dir=".git/hooks"

# core.hooksPath may hold an absolute Windows path with backslashes (husky writes one).
# Backslashes are not path separators to sh, so normalize before touching the filesystem.
case "$hooks_dir" in
  *\\*) hooks_dir=$(printf '%s' "$hooks_dir" | tr '\\' '/') ;;
esac

# Refuse to install outside this repository. A machine-global core.hooksPath (a common setup for
# shared commit-msg linting) would otherwise get Karmyq's hooks written into a directory every
# repo on the machine uses -- and the `rm "$target"` below would delete whatever was there first.
# Karmyq's pre-push hard-exits without a Karmyq package.json, so that would break unrelated repos.
#
# Scope: this is a lexical prefix test, not a canonicalizing one -- a path containing `..` can
# still walk out. That is deliberate and sufficient: core.hooksPath is trusted local config, and
# the case this guards is an ACCIDENTAL global setting, not an adversarial one.
repo_root=$(git rev-parse --show-toplevel)
case "$hooks_dir" in
  /*|?:/*)
    hooks_abs="$hooks_dir" ;;
  *)
    hooks_abs="$repo_root/$hooks_dir" ;;
esac

# Compare case-insensitively. Windows paths are case-insensitive and the two sources disagree in
# practice: `git rev-parse --show-toplevel` returns `C:/...` while core.hooksPath holds `c:\...`.
# A case-sensitive prefix test rejects a hooks dir that is plainly inside the repo.
repo_root_cmp=$(printf '%s' "$repo_root" | tr '[:upper:]' '[:lower:]')
hooks_abs_cmp=$(printf '%s' "$hooks_abs" | tr '[:upper:]' '[:lower:]')
case "$hooks_abs_cmp" in
  "$repo_root_cmp"/*) ;;
  *)
    echo "❌ core.hooksPath resolves OUTSIDE this repository:"
    echo "     $hooks_abs"
    echo "   Refusing to install -- Karmyq's hooks would break every other repo on this machine."
    echo "   Fix: git config --local core.hooksPath .git/hooks   (then re-run)"
    exit 1 ;;
esac

mkdir -p "$hooks_dir"
echo "  Hooks directory: $hooks_dir"
echo ""

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

    target="$hooks_dir/$hook_name"

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
      # Absolute symlink: hooks_dir is not always two levels below the repo root
      # (.husky is one, and core.hooksPath may be absolute), so "../../$hook" is
      # only correct for .git/hooks and silently dangles anywhere else.
      ln -sf "$repo_root/$hook" "$target"
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
  echo "✅ Successfully installed $installed hook(s) into $hooks_dir"
  echo ""
  echo "Installed hooks:"
  echo "  • pre-commit  - Runs service analysis and documentation checks"
  echo "  • pre-push    - Runs tests before pushing (skip with --no-verify)"
  echo ""
  echo "ℹ️  Hooks will run automatically on commit/push"
  echo "ℹ️  To bypass: use --no-verify flag"
  echo ""
fi
