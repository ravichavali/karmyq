---
name: ship
description: Run the full end-of-sprint ship cycle for Karmyq — quality gates, PR review, merge, CI/CD deploy, post-deploy smoke test, and handoff update. Use when a sprint's implementation is complete and the user says "ship it", "/ship", "run the ship cycle", or wants the full review→merge→deploy→verify flow in one pass.
disable-model-invocation: false
---

# Ship Cycle

The standing review → merge → deploy → verify loop you run nearly every sprint. This skill
**orchestrates** the existing tools and skills; it does not duplicate them. Run it from the
completed feature branch with a clean working tree.

**Skip entirely if the plan is tagged `no-deploy`** (then run only Phases 1–2 and stop).

Run the phases in order. After each phase emit a **≤5-line** status summary and keep responses
concise — long end-to-end runs otherwise trip output limits and lose the transcript.

---

## Phase 1 — Quality gates (the four standing SDLC gates)

Run on the branch diff, in this order. These are the standing quality gates — never skip one.

1. **Tests** — `npm test` (unit + regression MUST pass). After any delete/rename this session,
   first `Grep` the repo for stale references and bust the Turbo cache (`--force` or run the
   affected suite directly) — green-locally/red-in-CI is the #1 recurring friction.
2. **`/simplify`** — apply quality cleanups.
3. **`/code-review`** — resolve real findings; dismiss false positives with written justification.
4. **`/security-review`** — auth/JWT/membership logic especially. Confirm authorization is derived
   from **live membership lookups, not stale JWT claims**.

If any gate surfaces a finding, fix it and re-run that gate before moving on.

## Phase 2 — Verify the security gates are clear

- **CI deps audit (ADR-059)** and **CodeQL (ADR-060)** must be green.
- **Recurring CodeQL alerts on this repo are documented false positives** (e.g. `js/request-forgery`
  on `apps/frontend/src/lib/api.ts`). **You cannot dismiss them — surface the exact alert(s) to the
  user and ask them to dismiss via the UI.** Do not loop the dismissal API. If the gate false-blocks
  the fix-shipping push (rescan lag), wait for the rescan and re-run — do not `--no-verify`.

## Phase 3 — Merge & deploy

Hand off to the **`deploy` skill** for the mechanical merge → push → pipeline → health steps.
Before invoking it, confirm branch hygiene:

- Branch is based on **`origin/master`** (not a stale local master); planning/handoff commits live
  on the feature branch, not orphaned on master.
- **Never force-push or direct-push master.** If the base is broken, open a fresh replacement PR.
- Fold docs into this PR — no separate post-merge docs push (it triggers a second deploy → demo 502).

Then run the `deploy` skill end-to-end (merge → `git push origin master` → watch GitHub Actions
go green → run any plan-listed server scripts).

## Phase 4 — Post-deploy smoke test

Do not declare done until production is verified live — this is the step that usually gets cut off:

```bash
npm run health:check
curl -s https://karmyq.com/health | jq .
```

Plus a quick API smoke + UI check for the feature just shipped (per the plan's validation step).

## Phase 5 — Update the handoff

Invoke the **`update-handoff`** skill (or `deploy` Phase 7): mark the sprint deployed, record
post-deploy notes/follow-ups, and set the next-sprint direction if known.

---

**Output a final one-line verdict:** shipped & verified, or blocked-at-phase-N with the reason.
