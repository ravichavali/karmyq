---
name: deploy
description: Karmyq PR → independent review → authorized merge → CI/CD deploy → health, plus post-merge closeout. Use when taking a reviewed PR to merge, or in the chat AFTER the maintainer merged a PR ("verify PR N's merge", "check the deploy", "record the post-merge updates") — that chat starts at Step 6.
disable-model-invocation: false
---

# Deploy to Demo

End-of-sprint review, authorized merge, and deployment to karmyq.com.

A chat ends once its PR is open, and the maintainer merges between chats. **A post-merge chat
starts at Step 6.**

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

## Step 2: Confirm the quality gates are green

The four standing SDLC gates are **owned by the `ship` skill's Phase 1** — that is the one place
they are enumerated. This step confirms they were run and are clean; it does not re-run them. If
you invoked `deploy` standalone, go run Phase 1's gates first, then come back here.

```bash
npm run feedback:check    # advisory docs to-do list for the diff
```

`feedback:check` is **advisory** and reads the *staged* diff — on an already-committed branch that
diff is empty, so a clean result is **not** proof the docs are complete. Check the changed paths
yourself.

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
gh pr view <N> --json state,mergeCommit,mergedAt   # state MERGED; take the full merge SHA
gh run list --commit <full merge sha> --workflow "CI/CD Pipeline"   # the deploy run for that commit
gh run view <run id> --json conclusion,jobs         # conclusion AND job count
```

Wait for the run to go green. If it fails, read the logs and fix the root cause — do not re-run
blindly without diagnosing. The pipeline rolls back on failed health verification.

Judge the run by its conclusion and its jobs, not by `gh pr checks`: a job that was never created
does not show up in the checks list, which can read all-pass while the run failed.

Then read the **open CodeQL alerts on master** and the merge commit's analysis. Alerts can be
re-raised on master alone, on lines the PR never touched, and they block the deploy even when the
PR's own gate was green. Report them with the `ship` skill's blocker report; never dismiss them
yourself.

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

Invoke the **`update-handoff`** skill. It decides *which* handoff file you own — single stream, or
the lane the router points at — rather than assuming `CURRENT_HANDOFF.md`; in router mode, writing
the router instead of your lane file corrupts the one document carrying cross-session state.

Record the merged SHA, the verified run, and any post-deploy follow-ups. Do this on the next task
branch — a docs-only master push would trigger a second deploy.

Post-merge records ride in the same commit. Mark a shipped ADR **Implemented**, in the ADR and in
the `docs/adr/README.md` index. Mark fixed entries in `docs/BUGS.md`. Archive the handoff when the
feature shipped (`.claude/handoff/README.md`). Close with the next-chat prompt (`CLAUDE.md` →
*Session Workflow*).
