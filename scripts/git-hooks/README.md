# Git Hooks

This directory contains the source git hooks for the karmyq project.

## Installation

Hooks are automatically installed when you run `npm install` via the postinstall script.

To manually install/update hooks:
```bash
npm run hooks:install
```

## Available Hooks

### pre-commit
**Purpose**: Ensures service changes are properly analyzed and documented

**What it does**:
1. Detects changes to services/ directory
2. Runs service dependency analysis
3. Generates/updates:
   - `services/dependency-graph.md`
   - `services/impact-analysis.md`
   - `services/version-drift.md`
4. Runs feedback loop checks for required documentation updates

**Excludes**: Auto-generated governance files from triggering their own regeneration

**Skip**: `git commit --no-verify`

### pre-push
**Purpose**: Runs tests before pushing to ensure code quality

**What it does**:
1. Checks if PostgreSQL database is available
2. If DB available: Runs integration tests
3. If DB not available: Skips integration tests with warning
4. Always runs unit tests

**Environment Variables**:
- `SKIP_PREPUSH=1`: Skip all pre-push checks
- `DATABASE_URL` or `POSTGRES_HOST`: Used to detect database availability

**Skip Options**:
- `git push --no-verify` - Skip hook entirely
- `SKIP_PREPUSH=1 git push` - Skip via environment variable

## Hook Management

### Source of Truth
- Hooks in this directory (`scripts/git-hooks/`) are the source of truth
- Changes here are copied/symlinked to `.git/hooks/` during installation

### Platform Differences
- **Unix/Linux/Mac**: Hooks are symlinked from `.git/hooks/` to `scripts/git-hooks/`
- **Windows/Git Bash**: Hooks are copied (symlinks may not work reliably)

### Updating Hooks
After modifying hooks in this directory:
1. Run `npm run hooks:install` to update active hooks
2. Commit changes to `scripts/git-hooks/`
3. Other developers will get updated hooks on their next `npm install`

## Troubleshooting

### Hooks not running
```bash
# Reinstall hooks
npm run hooks:install

# Verify hooks are installed
ls -la .git/hooks/
```

### Pre-push tests failing
```bash
# Check if database is running
docker ps | grep postgres

# Skip tests for this push
git push --no-verify

# Or use environment variable
SKIP_PREPUSH=1 git push
```

### Modifying hook behavior
Edit the hook file in `scripts/git-hooks/`, then run:
```bash
npm run hooks:install
```

## Best Practices

1. **Don't bypass hooks routinely** - They're there for a reason
2. **Update hook logic here** - Not directly in `.git/hooks/`
3. **Test hook changes** - Make a test commit/push after modifying
4. **Document changes** - Update this README when adding/modifying hooks
