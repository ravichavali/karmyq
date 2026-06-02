<!--
Karmyq PR contract. Agents opening PRs via `gh pr create`/API: GitHub does NOT
auto-apply this template — copy it into your --body and fill every section.
The `pr-contract` CI check fails the PR if the required headers are missing.
-->

## Summary

<!-- What changed and why, in 2-4 sentences. -->

## Validation

<!-- Evidence: the commands you ran and their results. -->
- [ ] `npx tsc --noEmit` on affected packages — result:
- [ ] `npm run test:unit` / `npm run test:regression` — result:
- [ ] `npm run feedback:check` (if behavior/docs changed) — result:

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
