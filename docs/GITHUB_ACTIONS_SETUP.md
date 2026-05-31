# GitHub Actions Setup for Automatic Deployment

This document explains how to set up automatic deployment to karmyq.com via GitHub Actions.

## Overview

When you push to the `master` branch, GitHub Actions will automatically:
1. ✅ Run all tests (unit + integration)
2. ✅ Build Docker images
3. ✅ SSH to karmyq.com
4. ✅ Run `./scripts/deploy.sh` (which runs integration tests on production DB)
5. ✅ Verify service health
6. ✅ Auto-rollback if anything fails

## Required GitHub Secrets

You need to add these secrets to your GitHub repository:

### Navigate to GitHub Secrets
1. Go to your repository on GitHub
2. Click **Settings** → **Secrets and variables** → **Actions**
3. Click **New repository secret** for each of the following:

### Secrets to Add

#### 1. `PROD_SSH_PRIVATE_KEY`
**Description:** SSH private key for connecting to karmyq.com

**How to get it:**
```bash
# On your local machine where you can already SSH to karmyq.com
cat ~/.ssh/id_rsa
# Or create a dedicated deploy key:
ssh-keygen -t rsa -b 4096 -C "github-actions-deploy" -f ~/.ssh/karmyq_deploy
cat ~/.ssh/karmyq_deploy
```

**Value:** Copy the entire private key including:
```
-----BEGIN OPENSSH PRIVATE KEY-----
...entire key content...
-----END OPENSSH PRIVATE KEY-----
```

**Add public key to server:**
```bash
# Copy public key to karmyq.com
ssh ubuntu@karmyq.com
cat >> ~/.ssh/authorized_keys << 'EOF'
<paste your public key here>
EOF
```

#### 2. `PROD_SERVER_HOST`
**Description:** Hostname or IP address of production server

**Value:**
```
karmyq.com
```
or the server's IP address if DNS isn't set up yet.

#### 3. `PROD_SERVER_USER`
**Description:** SSH username for production server

**Value:**
```
ubuntu
```
(or whatever user runs the karmyq services)

## Testing the Setup

### 1. Verify Secrets are Set
In GitHub: Settings → Secrets → Actions
- You should see 3 secrets listed (values are hidden)

### 2. Test SSH Connection Locally
```bash
# Use the same credentials to verify connection works
ssh ubuntu@karmyq.com "cd ~/karmyq && git status"
```

### 3. Trigger a Deployment
```bash
# Make a small change and push to master
git checkout master
echo "# Test deployment" >> README.md
git add README.md
git commit -m "test: trigger GitHub Actions deployment"
git push origin master
```

### 4. Monitor Deployment
1. Go to GitHub → **Actions** tab
2. Watch the workflow run
3. Click on the workflow to see detailed logs
4. Verify all steps pass (especially "Deploy to karmyq.com")

## Workflow Behavior

### On Success
- ✅ Tests pass in GitHub Actions
- ✅ Docker images build successfully
- ✅ SSH connection established
- ✅ Integration tests run on karmyq.com
- ✅ Deployment completes
- ✅ Health checks pass
- 🎉 New code is live!

### On Failure
- ❌ If tests fail in GitHub Actions → **No deployment attempted**
- ❌ If SSH fails → **Deployment aborted**
- ❌ If integration tests fail on server → **Auto-rollback to previous commit**
- ❌ If health checks fail → **Marked as failed, but services may still be running**

## Deployment Timeline

Typical deployment takes **5-10 minutes**:
- 2-3 min: GitHub Actions tests + build
- 1 min: SSH connection + git pull
- 2-3 min: Integration tests on karmyq.com
- 3-5 min: Docker build (on server)
- 30 sec: Health verification

## Security Gates (Blocking)

CI runs a standing **dependency security gate** ([ADR-059](adr/ADR-059-dependency-security-gate.md)). The `security:` job in `.github/workflows/ci.yml` runs:

```yaml
- name: Run npm audit (blocking — no high/critical vulns; see ADR-059)
  run: npm audit --package-lock-only --audit-level=high
```

- **Blocking**: any **high or critical** dependency vulnerability fails the build — no deploy proceeds.
- **SLA**: no high/critical open > **1 week**; no vulnerability of any severity open > **2 weeks**.
- **Remediation**: patch transitive vulns at the leaf via root-`package.json` `overrides`; bump direct deps directly. Never `npm audit fix --force` (it installs breaking framework downgrades). See ADR-059 for the override gotchas (`uuid` ESM cap, exact-version `tar`, `@swc/helpers`/`ts-jest` pins).
- **Emergency escape**: if the gate blocks a genuine hotfix, `git push --no-verify` bypasses the local hook; CI remains the backstop. Use only to unblock, then remediate within the SLA.

### Code-Scanning Gate (CodeQL) — [ADR-060](adr/ADR-060-code-scanning-gate.md)

A second blocking gate, the `code-scanning-gate` job, fails the build on **open critical/high CodeQL alerts**. Because CodeQL runs via **GitHub default setup** (no committed `codeql.yml`), the gate is a CI job that queries the code-scanning API rather than a CodeQL workflow step.

- **CodeQL config** (repo settings, applied via API — not a file):
  ```bash
  gh api -X PATCH repos/:owner/:repo/code-scanning/default-setup \
    -f query_suite=extended -f threat_model=remote_and_local
  ```
  (`security-extended` + `remote_and_local` — deeper coverage than the prior `default`/`remote`.)
- **Fail-open on *missing analysis* only**: default-setup analysis is async, so the job polls for an analysis on the pushed SHA (bounded). No analysis in the window → warn + pass. Analysis present with open critical/high → **fail**. Never fails open on present findings.
- **Disposition discipline**: fix real findings; dismiss false-positive/won't-fix **with a written justification** via `gh api -X PATCH .../code-scanning/alerts/{n} -f state=dismissed …`. A "fixed" alert clears on the next scan — never dismiss it.
- **SLA**: same as the dependency gate (high/crit ≤ 1 week, any ≤ 2 weeks).

### Supply-Chain & Secrets Hardening — [ADR-061](adr/ADR-061-supply-chain-and-secrets-hardening.md)

Shipped alongside the gates:

- **`ignore-scripts=true`** in `.npmrc` blocks dependency lifecycle scripts (worm vector). ⚠️ **Git hooks no longer auto-install** — run `npm run hooks:install` after clone.
- **`npm ci` everywhere** (incl. `e2e-tests.yml`) — deterministic, lockfile-only installs.
- **`npm audit signatures`** + **OSV-Scanner** steps in the `security:` job — registry-provenance + broader advisory coverage (informational first). **Socket GitHub App** recommended as the behavioral complement (console install).
- **`.github/dependabot.yml`** — grouped, weekly, review-gated; **no auto-merge**.
- **Third-party Actions pinned to commit SHA** (`docker/*`, `osv-scanner-action`).
- **Secret scanning + push protection** already enabled; validity-checks + non-provider-patterns sub-toggles are a UI/org-move follow-up (see ADR-061).

## Manual Deployment Override

If GitHub Actions is down or you need to deploy urgently:

```bash
# SSH to server and deploy manually
ssh ubuntu@karmyq.com
cd ~/karmyq
./scripts/deploy.sh

# Or skip tests for emergency deploy
SKIP_TESTS=1 ./scripts/deploy.sh
```

## Workflow Files

- **Main CI/CD**: `.github/workflows/ci.yml`
  - Handles production deployments on push to master
  - Runs tests, builds, deploys

- **Tests**: `.github/workflows/test.yml`
  - Runs on PRs and all branches
  - Unit + integration tests

- **E2E Tests**: `.github/workflows/e2e-tests.yml`
  - End-to-end testing

## Security Notes

### SSH Key Security
- ✅ Private key is stored encrypted in GitHub Secrets
- ✅ Key is only accessible during workflow runs
- ✅ Key is never logged or exposed
- ✅ Consider using a dedicated deploy key (not your personal key)

### Deployment Safety
- ✅ Integration tests must pass before deployment
- ✅ Auto-rollback on test failure
- ✅ Health checks verify deployment success
- ✅ No manual intervention required

### Secrets Management
- **Never commit secrets to code**
- Use GitHub Secrets for sensitive values
- Rotate SSH keys periodically
- Audit secret access in GitHub Settings

## Troubleshooting

### Deployment Fails: "Permission denied (publickey)"
**Cause:** SSH key not properly set up

**Fix:**
```bash
# Verify public key is on server
ssh ubuntu@karmyq.com "cat ~/.ssh/authorized_keys"

# Verify private key in GitHub Secrets matches
# GitHub Settings → Secrets → PROD_SSH_PRIVATE_KEY
```

### Deployment Fails: "Integration tests failed"
**Cause:** Tests detected an issue before deployment

**Fix:**
1. Check the workflow logs for test failures
2. Fix the failing tests locally
3. Push the fix
4. Deployment will retry automatically

### Health Checks Fail After Deployment
**Cause:** Services didn't start properly

**Fix:**
```bash
# SSH to server and check logs
ssh ubuntu@karmyq.com
cd ~/karmyq
docker compose -f infrastructure/docker/docker-compose.yml -f infrastructure/docker/docker-compose.prod.yml logs

# Restart specific service
docker compose restart <service-name>
```

### Workflow Doesn't Trigger
**Cause:** Push was to wrong branch

**Fix:**
```bash
# Workflow only runs on master branch
git checkout master
git merge your-feature-branch
git push origin master
```

## Disabling Automatic Deployment

If you need to temporarily disable automatic deployment:

1. Go to GitHub → Settings → Environments → production
2. Add a "Required reviewers" rule
3. Or disable the workflow: Actions → CI/CD Pipeline → ⋯ → Disable workflow

## Re-enabling Automatic Deployment

1. Remove required reviewers from production environment
2. Or re-enable workflow in Actions tab

## Next Steps

After setting up:
1. [ ] Add the 3 required secrets to GitHub
2. [ ] Test SSH connection manually
3. [ ] Make a test commit to trigger deployment
4. [ ] Monitor the workflow run
5. [ ] Verify services are healthy on karmyq.com
6. [ ] Set up notifications (optional)

## Getting Help

If deployment fails:
1. Check GitHub Actions logs for errors
2. Check server logs: `ssh ubuntu@karmyq.com "cd ~/karmyq && docker compose logs"`
3. Review this document for troubleshooting steps
4. Manual deployment is always available as fallback
