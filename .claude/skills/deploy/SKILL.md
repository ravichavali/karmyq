# Deploy to Demo

End-of-sprint review, authorized merge, and deployment to karmyq.com.

**Skip entirely if the plan is tagged `no-deploy`.**

> ⚠️ **Deployment happens by merging an approved PR — never by pushing the master branch.**
> Every master push is a full deploy with rollback-on-failure, so a direct push bypasses the
> review gates and can 502 the demo. Contributors do not self-merge and do not push master.
> See `CLAUDE.md` → *Merge, Deploy & Security-Gate Discipline*.

---

## Step 1: Confirm the branch and its base

```bash
git branch --show-current      # a task branch
git status --short             # clean tree
git fetch origin
git log -1 --oneline origin/master
```

The branch must be based on a fetched `origin/master`. Update a diverged branch with a merge
commit, never a rebase and force-push.

## Step 2: Run all four SDLC gates on the branch diff

```bash
npm test                  # unit + regression; must exit 0
npm run feedback:check    # advisory docs to-do list for the diff
```

`npm test` blocks. `feedback:check` is **advisory** and reads the *staged* diff — an empty staged
diff is not proof that the docs are complete.

The four standing SDLC gates are enumerated **once**, in the `ship` skill's *Phase 1* — run them
from there rather than from a second list here, with effort calibrated to diff size. If any gate
surfaces a finding, fix it and re-run that gate before continuing.

## Step 3: Open the PR with the full template

Fill in every section of `.github/pull_request_template.md`. Push the task branch with the normal
hooks enabled.

## Step 4: Independent review and readiness recommendation

A non-author reviews the diff. Claude then states a readiness recommendation based on the PR's
**latest head** — its current check results on GitHub are the authority, and an earlier green head
does not establish readiness for a newer diff.

```bash
gh pr view <N> --json state,mergeable,statusCheckRollup
```

## Step 5: Authorized merge

**The maintainer must explicitly authorize the merge.** An `--admin` override needs its own
separate, explicit authorization each time — a required approving review cannot be self-provided on
a PR authored by the same account.

Merging the approved PR is what triggers the CI/CD pipeline and the deployment.

## Step 6: Monitor the pipeline

```bash
gh run list --limit 3
```

Wait for the run to go green. If it fails, read the logs and fix the root cause — do not re-run
blindly without diagnosing. The pipeline rolls back on failed health verification.

## Step 7: SSH to demo and run any needed scripts

If the sprint includes DB migrations, seed scripts, or other server-side steps listed in the plan:

```bash
ssh ubuntu@karmyq.com
cd ~/karmyq
# Run each script listed in the plan, e.g.:
# node scripts/migrate.js
# psql $DATABASE_URL < infrastructure/postgres/migrations/NNNN_*.sql
```

If the plan lists no scripts, skip this step. Demo data operations need their own explicit
per-operation authorization.

## Step 8: Verify health

`npm run health:check` needs `jq` — run it **on the server**. From the Windows dev box `jq` is
absent and `/health` 404s through nginx, so probe with node against a real route instead:

```bash
node -e "fetch('https://karmyq.com/api/auth/login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({email:'<sim user>',password:'<sim password>'})}).then(async r=>console.log(r.status, (await r.text()).slice(0,200)))"
```

## Step 9: Update the handoff

Mark deployment complete in `CURRENT_HANDOFF.md`, recording the merged SHA and the verified run.
Record any post-deploy notes or follow-up issues found during deploy. Do this on the next task
branch — a docs-only master push would trigger a second deploy.
