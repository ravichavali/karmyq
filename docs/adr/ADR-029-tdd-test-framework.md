# ADR-029: Test-Driven Development (TDD) Framework

**Status**: Accepted
**Date**: 2026-01-31
**Deciders**: Development Team

---

## Context

The project had issues with testing and CI/CD:
- Tests were frequently skipped due to failures
- No clear separation between unit tests, integration tests, and work-in-progress tests
- Integration tests ran locally even without database access, causing failures
- No systematic way to promote work-in-progress tests to regression suite
- Pre-push hooks were blocking legitimate work due to failing WIP tests

We needed a framework that:
1. **NEVER allows skipping unit + regression tests** (core requirement)
2. Separates tests by type and readiness level
3. Allows work-in-progress tests without blocking commits/pushes
4. Automatically promotes passing TDD tests to regression
5. Only runs integration tests when database is available

---

## Decision

We implemented a **three-tier TDD framework** with automatic test promotion:

### Test Directory Structure

Every service and app follows this structure:
```
tests/
  ├── unit/         # Unit tests (mocked, no external dependencies)
  ├── regression/   # Locked-in tests that MUST pass
  ├── tdd/          # Work-in-progress tests (can fail)
  └── integration/  # Integration tests (require real database)
```

### Test Scripts (package.json)

All services/apps have these scripts:
```json
{
  "test": "npm run test:unit && npm run test:regression",
  "test:unit": "jest tests/unit --passWithNoTests",
  "test:regression": "jest tests/regression --passWithNoTests",
  "test:tdd": "jest tests/tdd --passWithNoTests",
  "test:integration": "jest tests/integration"
}
```

**Note**: For the `@karmyq/tests` package, explicit path patterns are required:
```json
{
  "test:unit": "jest --testPathPattern=unit/ --passWithNoTests",
  "test:regression": "jest --testPathPattern=regression/ --passWithNoTests",
  "test:tdd": "jest --testPathPattern=tdd/ --passWithNoTests"
}
```

### Git Pre-Push Hook Behavior

The pre-push hook (`scripts/git-hooks/pre-push`) enforces:

1. **Integration Tests** (if database available):
   - Runs: `cd tests && npm run test:integration`
   - **Blocks push if fails** (database issues indicate real problems)
   - Skips if no DATABASE_URL (local development)

2. **Unit + Regression Tests** (ALWAYS):
   - Runs: `npm test` (which runs unit + regression)
   - **BLOCKS push if fails** ❌ (core tenant of framework)
   - Exit code 1 prevents push
   - Message: "Unit + regression tests failed. Fix failing tests or use --no-verify to skip"

3. **TDD Tests** (informational):
   - Runs: `npm run test:tdd`
   - **NEVER blocks push** ✅ (tests are work-in-progress)
   - Reports pass/fail for awareness
   - Suggests promotion to regression if all pass

### Auto-Promotion Script

`scripts/promote-tdd-tests.js` automates test promotion:

```bash
# Run manually or via CI
npm run test:promote-tdd
```

**Behavior**:
- Runs each test file in `tdd/` individually
- If test passes: moves file to `regression/`
- If test fails: leaves in `tdd/`
- Reports: number promoted, number remaining

---

## Core Tenants

These are **non-negotiable** rules of the framework:

### 1. Unit + Regression Tests MUST ALWAYS Pass

```bash
# This MUST succeed before push
npm test
```

- No skipping allowed (except --no-verify for emergencies)
- Pre-push hook enforces this
- Any failure blocks the push
- Fix the test or move to tdd/ if WIP

### 2. TDD Tests Can Fail

```bash
# This can fail without blocking
npm run test:tdd
```

- TDD tests are work-in-progress
- Failures are expected and don't block work
- Use for:
  - Writing tests before implementation (TDD)
  - Exploring new features
  - Tests that need refactoring
  - Flaky tests being debugged

### 3. Automatic Promotion

```bash
# When a TDD test passes once
mv tests/tdd/feature.test.ts tests/regression/feature.test.ts
```

- Manual or via `npm run test:promote-tdd`
- Once in regression, test MUST pass forever
- Regression = contract with the codebase
- Breaking regression test = breaking change

### 4. Integration Tests Only When Database Available

```bash
# Pre-push hook checks for database
if check_postgres; then
  npm run test:integration  # BLOCKS if fails
else
  echo "Skipping integration tests"  # Does NOT block
fi
```

- Integration tests require real database
- Run on server (karmyq.com) but not locally (unless DB setup)
- Use environment detection to decide whether to run

---

## Rationale

### Why Three Tiers?

1. **Unit Tests**: Fast, isolated, always pass
   - No external dependencies
   - Pure logic testing
   - Run in milliseconds

2. **Regression Tests**: Locked-in behavior
   - Defines what "working" means
   - Cannot be changed without intention
   - Prevents accidental breaking changes

3. **TDD Tests**: Work-in-progress
   - Allows TDD workflow (write test first)
   - Doesn't block development
   - Automatically graduates when ready

### Why Block on Unit + Regression?

**Previous problem**: Tests were frequently skipped because:
- WIP tests were mixed with regression tests
- No separation of concerns
- Developers used `--no-verify` habitually

**Solution**: Clear separation means:
- Blocking on unit + regression is acceptable (they should pass!)
- TDD tests don't block (they're expected to fail)
- No need to skip hooks anymore

### Why Auto-Promotion?

**Previous problem**: Developers forgot to move passing tests to regression

**Solution**: Automation ensures:
- Passing tests are immediately locked in
- Regression suite grows over time
- No manual tracking needed

---

## Implementation

### File Changes

1. **All Services** (`services/*/package.json`):
   - Added `test:unit`, `test:regression`, `test:tdd` scripts
   - Created `tests/{unit,regression,tdd}/` directories
   - Moved existing tests to appropriate tier

2. **Frontend** (`apps/frontend/package.json`):
   - Same structure as services
   - Moved existing tests to `tdd/` (need work)

3. **Tests Package** (`tests/package.json`):
   - Uses `--testPathPattern` for explicit filtering
   - Required due to Jest path resolution issues

4. **Root** (`package.json`):
   - Added `test:unit`, `test:regression`, `test:tdd` scripts
   - Delegates to turbo for parallel execution

5. **Pre-Push Hook** (`scripts/git-hooks/pre-push`):
   - Section 1: Integration tests (conditional)
   - Section 2: Unit + regression (MUST PASS)
   - Section 3: TDD tests (informational)

6. **Auto-Promotion** (`scripts/promote-tdd-tests.js`):
   - New script for automatic test promotion
   - Can be run manually or in CI

### Added Scripts

Created `scripts/add-tdd-scripts.js`:
- Bulk-updated all service package.json files
- Avoided JSON syntax errors from bash sed
- Consistent structure across services

---

## Consequences

### Positive

✅ **Clear separation of concerns**
- Developers know where to put each type of test
- No confusion about what "must pass" means

✅ **TDD workflow enabled**
- Write tests first without blocking commits
- Tests automatically promote when ready

✅ **Regression suite grows automatically**
- No manual tracking of "ready" tests
- Suite becomes more comprehensive over time

✅ **Pre-push hooks are effective**
- Blocking on unit + regression is acceptable
- Developers stop using `--no-verify`

✅ **Integration tests only where appropriate**
- No local failures due to missing database
- Server runs full integration suite

### Negative

⚠️ **Three directories to manage**
- More complexity than single `tests/` directory
- Need to remember which tier for new tests

⚠️ **Manual promotion required (for now)**
- Auto-promotion script exists but must be run manually
- Could integrate into pre-push or CI in future

⚠️ **Empty directories initially**
- `unit/` and `regression/` may be empty for some services
- Requires `--passWithNoTests` flag

---

## Alternatives Considered

### Alternative 1: Single Test Directory with Tags

Use Jest tags to mark tests as `@unit`, `@regression`, `@tdd`:

```javascript
// @regression
test('should do something', () => { ... });
```

**Rejected because**:
- Harder to enforce in pre-push hook
- Easy to forget tags
- No file system boundary

### Alternative 2: Separate Test Files by Suffix

Use naming convention: `*.unit.test.ts`, `*.regression.test.ts`, `*.tdd.test.ts`

**Rejected because**:
- Harder to filter with Jest
- No clear directory boundary
- Easy to mix files in same directory

### Alternative 3: Allow Failures in Default Test Suite

Keep single test suite but use `--passWithNoTests` or `--bail false`:

**Rejected because**:
- Defeats the purpose of tests
- No way to know what "must pass"
- Pre-push hook meaningless

---

## Related Decisions

- **ADR-028**: npm workspace Docker build
  - TDD framework respects workspace structure
  - Test scripts work in monorepo context

- **Future ADR**: CI/CD Integration
  - Auto-promotion in CI pipeline
  - Coverage requirements per tier
  - Deployment gating on regression tests

---

## References

- [Pre-push hook](../../scripts/git-hooks/pre-push)
- [Auto-promotion script](../../scripts/promote-tdd-tests.js)
- [Add TDD scripts](../../scripts/add-tdd-scripts.js)
- [CLAUDE.md](../../CLAUDE.md) - Updated with TDD workflow

---

## Notes

This ADR was created after implementing the TDD framework in response to:
1. Frequent test failures blocking pushes
2. Developer frustration with pre-push hooks
3. No clear way to work on tests without breaking CI

The framework has been validated by successful pushes with all unit + regression tests passing.

**Core Tenant Reminder**: Going forward, we should NEVER skip the unit + regression suite. That is a core tenant of our TDD framework.
