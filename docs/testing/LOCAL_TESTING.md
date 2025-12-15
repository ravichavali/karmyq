# Local Testing Guide

> **Quick Start**: Run `scripts/test-local.bat quick` (Windows) or `./scripts/test-local.sh quick` (Mac/Linux) before every commit.

## Why Test Locally?

Testing locally before committing helps you:
- ✅ Catch bugs **before** they reach CI/CD
- ✅ Get **instant feedback** (no waiting for GitHub Actions)
- ✅ Save CI/CD minutes (especially on self-hosted runners)
- ✅ Iterate faster during development

---

## Quick Commands

### Windows
```cmd
# Fast tests (type-check + integration) - ~30 seconds
scripts\test-local.bat quick

# E2E tests only - ~3-5 minutes
scripts\test-local.bat e2e

# All tests (full suite) - ~5-7 minutes
scripts\test-local.bat
```

### Mac/Linux
```bash
# Fast tests (type-check + integration) - ~30 seconds
./scripts/test-local.sh quick

# E2E tests only - ~3-5 minutes
./scripts/test-local.sh e2e

# All tests (full suite) - ~5-7 minutes
./scripts/test-local.sh
```

---

## Test Modes Explained

### 1. Quick Mode (Recommended for Pre-Commit)
**What it runs**:
- TypeScript type checking on Feed Service
- Integration tests for Feed Service APIs

**When to use**:
- Before every commit
- During active development
- When making small changes

**Time**: ~30 seconds

**Command**:
```bash
./scripts/test-local.sh quick
```

---

### 2. E2E Mode (Recommended for Pre-Push)
**What it runs**:
- Full E2E tests for Social Karma v2.0 UI
- Tests all frontend components with real backend

**When to use**:
- Before pushing to remote
- After completing a feature
- Before creating a PR

**Time**: ~3-5 minutes

**Command**:
```bash
./scripts/test-local.sh e2e
```

---

### 3. Full Mode (Recommended Before PR)
**What it runs**:
- Type checking
- Integration tests
- E2E tests

**When to use**:
- Before creating a pull request
- Before merging to main/develop
- For final validation

**Time**: ~5-7 minutes

**Command**:
```bash
./scripts/test-local.sh
```

---

## Automatic Testing (Git Hooks)

Want tests to run automatically? Set up Git hooks with Husky!

### Option 1: Manual Testing (Default)
You run tests manually when you want:
```bash
git add .
./scripts/test-local.sh quick  # Run manually
git commit -m "your message"
```

**Pros**:
- Full control over when tests run
- Faster commits (no waiting)
- Can skip tests when needed

**Cons**:
- Easy to forget to test
- May commit broken code

---

### Option 2: Automatic Testing (Git Hooks)

**Setup** (one-time):
```bash
./scripts/setup-git-hooks.sh
```

**What happens**:
- **On `git commit`**: Runs quick tests (30 seconds)
- **On `git push`**: Runs E2E tests (3-5 minutes)

**Pros**:
- Never forget to test
- Guaranteed quality
- Catches issues before push

**Cons**:
- Commits take 30 seconds
- Pushes take 3-5 minutes
- Can be annoying during rapid iteration

**Skip hooks when needed**:
```bash
git commit --no-verify -m "WIP: quick save"
git push --no-verify
```

**Uninstall hooks**:
```bash
rm -rf .husky
npm uninstall husky
```

---

## Manual Testing (No Scripts)

If you prefer to run tests manually without scripts:

### 1. Type Check
```bash
cd services/feed-service
npm run type-check
```

### 2. Integration Tests
```bash
# Ensure services are running
docker-compose -f infrastructure/docker/docker-compose.yml up -d

# Run tests
cd tests
npm test integration/feed-service.test.ts
```

### 3. E2E Tests
```bash
# Ensure services are running
docker-compose -f infrastructure/docker/docker-compose.yml up -d

# Seed test data
cat tests/e2e/seed-social-karma-v2-simple.sql | \
  docker exec -i karmyq-postgres psql -U karmyq_user -d karmyq_db

# Run tests
cd tests/e2e
npm test tests/10-social-karma-v2.spec.ts
```

---

## Troubleshooting

### Services Not Running
**Error**: `Feed Service not running`

**Fix**:
```bash
docker-compose -f infrastructure/docker/docker-compose.yml up -d
docker-compose -f infrastructure/docker/docker-compose.yml ps
```

---

### Test Data Not Seeded
**Error**: Tests fail because no milestones found

**Fix**:
```bash
cat tests/e2e/seed-social-karma-v2-simple.sql | \
  docker exec -i karmyq-postgres psql -U karmyq_user -d karmyq_db
```

---

### Integration Tests Fail
**Error**: Connection refused or timeout

**Check service health**:
```bash
curl http://localhost:3007/health
docker logs karmyq-feed-service --tail 50
```

**Restart services**:
```bash
docker-compose -f infrastructure/docker/docker-compose.yml restart feed-service
```

---

### E2E Tests Fail
**Error**: Playwright can't find elements

**View screenshots**:
```bash
# Open test results folder
cd tests/e2e/test-results
```

**Run in headed mode** (see browser):
```bash
cd tests/e2e
npm test tests/10-social-karma-v2.spec.ts -- --headed
```

**Debug specific test**:
```bash
npm test tests/10-social-karma-v2.spec.ts -- --debug
```

---

### Type Check Fails
**Error**: TypeScript errors in Feed Service

**Fix errors**:
```bash
cd services/feed-service
npm run type-check
# Fix reported errors
```

---

## Best Practices

### 1. Test Before Every Commit
```bash
# Your workflow
git add .
./scripts/test-local.sh quick  # 30 seconds
git commit -m "fix: update API response parsing"
```

### 2. Test Before Every Push
```bash
# Your workflow
./scripts/test-local.sh e2e  # 3-5 minutes
git push origin feature-branch
```

### 3. Test Before Creating PR
```bash
# Your workflow
./scripts/test-local.sh  # Full suite, 5-7 minutes
# If all pass, create PR
gh pr create --title "feat: Social Karma v2 UI"
```

### 4. Iterate Quickly During Development
```bash
# Make changes
# Test quickly
./scripts/test-local.sh quick

# Make more changes
# Test quickly again
./scripts/test-local.sh quick

# When feature complete
./scripts/test-local.sh e2e
```

---

## CI/CD vs Local Testing

### Local Testing
- **Speed**: Instant (30 seconds - 5 minutes)
- **Feedback**: Immediate
- **Cost**: Free (uses your machine)
- **When**: During development

### GitHub Actions CI/CD
- **Speed**: Slower (queue + setup + run)
- **Feedback**: After push (5-10 minutes)
- **Cost**: CI/CD minutes (free tier limited)
- **When**: On push/PR, automatic validation

**Recommendation**: Use **local testing** for fast iteration, use **CI/CD** for final validation and team coordination.

---

## Performance Tips

### Speed Up Integration Tests
Cache Docker builds:
```bash
docker-compose -f infrastructure/docker/docker-compose.yml build --parallel
```

### Speed Up E2E Tests
Run specific test files:
```bash
cd tests/e2e
npm test tests/10-social-karma-v2.spec.ts  # Only Social Karma v2
```

Run in parallel (when you have multiple test files):
```bash
npm test -- --workers=4
```

### Skip Tests During Rapid Iteration
When you're rapidly iterating and NOT ready to commit:
```bash
# Just save your work
git commit --no-verify -m "WIP: testing approach"

# When ready, run tests
./scripts/test-local.sh quick
git commit --amend --no-edit
```

---

## Summary

| Mode | Time | Command | When |
|------|------|---------|------|
| **Quick** | 30s | `./scripts/test-local.sh quick` | Before commit |
| **E2E** | 3-5m | `./scripts/test-local.sh e2e` | Before push |
| **Full** | 5-7m | `./scripts/test-local.sh` | Before PR |

**Recommended Workflow**:
1. Develop → `quick` → Commit
2. Feature complete → `e2e` → Push
3. Ready for review → `full` → Create PR
4. CI/CD validates → Merge

You now have **complete control** over when and how tests run! 🚀
