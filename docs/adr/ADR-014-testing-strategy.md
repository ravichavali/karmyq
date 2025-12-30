# ADR-014: Testing Strategy (Integration + E2E + Unit)

**Date**: 2025-12-29
**Status**: Accepted
**Deciders**: Development Team
**Related**: docs/testing/, CLAUDE.md, DEVELOPMENT_PROCESS.md

## Context

With 9 microservices, 2 frontends, and complex data flows, we needed a comprehensive testing strategy that catches bugs at the right level without duplicating effort.

## Decision

**Three-tier testing pyramid: Integration tests (API), E2E tests (UI workflows), Unit tests (business logic).**

### 1. Integration Tests (API Level)

**Location**: `tests/integration/`
**Tool**: Custom test scripts + curl
**Scope**: Test each service's REST API

```bash
# Run all integration tests
npm run test:integration

# Test specific service
cd tests/integration && node test-auth-service.js
```

**Coverage**:
- ✅ Auth flows (login, signup, sessions)
- ✅ CRUD operations (communities, requests, matches)
- ✅ Authorization (RLS, multi-tenancy)
- ✅ Event publishing (Redis queue)

**Benefits**:
- Fast (~1-2 minutes for all services)
- No UI brittleness
- Tests actual HTTP endpoints
- Catches API contract breaks

### 2. E2E Tests (Full Workflows)

**Web**: Playwright (`tests/e2e/`)
**Mobile**: Maestro (`apps/mobile/.maestro/`)

```bash
# Web E2E
npm run test:e2e

# Mobile E2E
maestro test apps/mobile/.maestro/
```

**Coverage**:
- ✅ Login/Registration flows
- ✅ Community browsing
- ✅ Request creation
- ✅ Match flows
- ✅ Profile management

**Benefits**:
- Tests actual user flows
- Catches integration issues
- Validates frontend-backend connection
- Slower (~3-5 minutes) but high confidence

### 3. Unit Tests (Business Logic)

**Tool**: Jest + TypeScript
**Location**: `__tests__/` next to source files

```bash
# Run all unit tests
npm run test:unit

# Watch mode
npm run test:watch
```

**Coverage**:
- ✅ Validation schemas (Zod)
- ✅ Utility functions
- ✅ React components (Jest + RTL)
- ✅ Parser logic

**Benefits**:
- Fastest (seconds)
- Isolated testing
- Easy debugging
- High coverage (98%+ on business logic)

## Testing Before Commits

**Required**: Run full test suite before committing

```bash
# Windows
scripts\test-all.bat

# Mac/Linux
./scripts/test-all.sh
```

**Quick mode** for rapid iteration:
```bash
./scripts/test-local.sh quick  # ~30 seconds
```

## Consequences

### Positive

- **Comprehensive**: Catches bugs at all levels
- **Fast Feedback**: Unit tests run in seconds
- **Confidence**: E2E tests validate real workflows
- **Regression Prevention**: Integration tests catch API breaks

### Negative

- **Maintenance**: Three test suites to maintain
- **Time**: Full suite takes 5-10 minutes
- **Flakiness**: E2E tests can be brittle
- **Learning Curve**: Developers must know all tools

## Alternatives Considered

### Alternative 1: E2E Only

- **Why rejected**: Too slow, brittle, hard to debug

### Alternative 2: Unit Tests Only

- **Why rejected**: Misses integration issues, false confidence

### Alternative 3: Manual Testing Only

- **Why rejected**: Doesn't scale, regressions inevitable

## References

- Testing guide: `docs/testing/LOCAL_TESTING.md`
- Mobile testing: `docs/testing/MOBILE_TESTING_GUIDE.md`
- Test scripts: `scripts/test-all.bat`, `scripts/test-local.sh`
- Integration tests: `tests/integration/`
- E2E tests: `tests/e2e/`
