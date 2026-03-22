# Deploy to Demo

End-of-sprint merge, push, and deployment to karmyq.com.

**Skip entirely if the plan is tagged `no-deploy`.**

---

## Step 1: Merge to master

```bash
git checkout master
git pull
git merge feature/sprint-NN-{slug}
git branch -d feature/sprint-NN-{slug}
```

## Step 2: Run pre-deploy verification

```bash
npm test                  # unit + regression must pass
npm run feedback:check    # docs must be complete
```

If either fails — stop, fix, re-run before continuing.

## Step 3: Push to origin (triggers GitHub Actions CI/CD)

```bash
git push origin master
```

## Step 4: Monitor the pipeline

```bash
gh run list --limit 3
```

Wait for the run to go green. If it fails, read the logs and fix the root cause — do not push again without diagnosing.

## Step 5: SSH to demo and run any needed scripts

If the sprint includes DB migrations, seed scripts, or other server-side steps listed in the plan:

```bash
ssh ubuntu@karmyq.com
cd ~/karmyq
# Run each script listed in the plan, e.g.:
# node scripts/migrate.js
# psql $DATABASE_URL < infrastructure/postgres/migrations/NNNN_*.sql
```

If the plan lists no scripts, skip this step.

## Step 6: Verify health

```bash
npm run health:check
# or
curl -s https://karmyq.com/health | jq .
```

## Step 7: Update the handoff

Mark deployment complete in `CURRENT_HANDOFF.md`. Record any post-deploy notes or follow-up issues found during deploy.
