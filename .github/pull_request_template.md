<!--
Karmyq PR contract. Agents opening PRs via `gh pr create`/API: GitHub does NOT
auto-apply this template — copy it into your --body and fill every section.
The `pr-contract` CI check fails the PR if the required headers are missing.
-->

## Summary

<!-- What changed and why, in 2-4 sentences. -->

## Validation

<!--
Evidence ledger: one row per claim this PR makes, here, in the handoff, or in commit messages.
Re-check it against the FINAL diff before every push and before asking for final review; a row
whose commit is no longer the head either gets re-run or says why it still holds.

- Commit: the SHA the command actually ran on, not the branch head you hope it matches.
- Cache: could the result be a replay? `forced` / `cold` / `cached` / `n/a`. Turbo --force
  does not clear Jest's or ts-jest's cache, and a stale `dist/` survives both.
- Limitation: what the evidence does NOT prove. A claim is only as strong as its evidence:
  `npm ci` passing proves the lockfile installs, not that an edit was surgical (compare the
  patch for that); an empty CodeQL PR result proves no NEW alert in the scanned files, not that
  an existing alert is fixed; local green is not CI green; one injected violation proves that
  path fails, not every path.
Typical rows: `npx tsc --noEmit` on affected packages, unit + regression, `npm run feedback:check`.
-->

| Claim | Commit | Command | Outcome | Cache | Limitation |
|---|---|---|---|---|---|
|  |  |  |  |  |  |

**Changes after the tested commit:** <!-- "None", or the SHAs and whether each needs a re-run. -->

## Docs updated

<!-- Tie to the CLAUDE.md feedback loops. Check what applies; "N/A" is a valid answer. -->
- [ ] Service `CONTEXT.md`
- [ ] `services/registry.json` (endpoints/events)
- [ ] ADR created/updated (if architectural)
- [ ] `apps/landing/` docs site (guide/concept/ADR/service JSON + nav.json)
- [ ] N/A — no behavior/doc change

## Quality gates

- [ ] Tests pass (unit + regression)
- [ ] `/simplify` run on the diff
- [ ] `/code-review` run on the diff
- [ ] `/security-review` run on the diff

## Security dismissals

<!--
Any CodeQL/dependency-audit alert dismissed for this change MUST be recorded here
with a one-line justification + link to the alert. Write "None" if there are none.
-->
None

## Follow-ups / known issues

<!-- Anything deferred, or "None". -->
None

## Lane

<!-- Required — one of: codex | claude | human -->
