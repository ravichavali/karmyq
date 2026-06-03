# karmyq.org Content Voice Pass — reconciled from v3 brief — ✅ IMPLEMENTED

> **▶ STATUS (2026-06-03):** Sprint 83 "LinkedIn Launch Relaunch" is **fully merged** (PR #51,
> `0e42b61`) on `origin/master`. A new content brief (`karmyq-org-v3.html` + handover) arrived
> proposing a manifesto-first rewrite. **Reviewed and reconciled:** the brief was written against a
> pre–Sprint-83 (deploy-drifted) snapshot. Decision = **keep Sprint 83 founding-circle positioning;
> cherry-pick only the non-conflicting content fixes.** Codex implemented the four remaining
> manifesto-body copy edits on `agent/codex/content-voice-pass` (PR #52); Claude review/merge is next.

## The decision (do not re-debate)
- The v3 brief restores manifesto-first positioning ("Find your neighbors" → karmyq.com primary).
  That **reverses Sprint 83 / ADR-065** (karmyq.org = commons/invitation; karmyq.com = secondary PoC).
- **Chosen: "stale — reconcile first."** Sprint 83 positioning + `contact@karmyq.org` stay. ADR-065 is
  untouched (no pivot). Only additive voice/accuracy fixes that don't touch the conversion funnel land.

## Reconciled scope — per-fix verdict
| Fix | State on master | Verdict |
|---|---|---|
| 1 — "Trust has been taken" surveillance correction | ✅ done (`TheThinking.tsx` §7) | skip |
| 2 — Governance/fission/fusion voice | ✅ done (`HowItWorks.tsx`; trust→daughters, karma+trust→fusion correct) | skip |
| 3 — Trust-evolution paragraph | ✅ done (`DeeperSections.tsx`, "accuracy over direction") | skip |
| 4 — Footer cleanup | ✅ done (`Footer.tsx`, no placeholder links) | skip |
| 5 — Links/CTA/email | ⚠️ footer + `contact@karmyq.org` already correct; "Find your neighbors primary" + gmail **conflict** | **drop conflicting parts** |
| 6 — Principles copy | ✅ done (`Principles.tsx` matches v3 verbatim) | skip |
| 7 — Timeline names | ✅ done (`FadingTimeline.tsx`, Priya/Maria/Aisha…) | skip |
| **8 — "How trust is measured" → compressed** | ✅ implemented (`HowItWorks.tsx`) | PR review |
| **9 — "Who gets believed" → banality of goodness** | ✅ implemented (`TheThinking.tsx`) | PR review |
| **10 — "Trust when you can afford to" → sharper** | ✅ implemented (`TheThinking.tsx`) | PR review |
| **11 — Three Layer-2 tightening cuts** | ✅ implemented (`TheThinking.tsx`) | PR review |

## Sprint Goal
Land the four remaining manifesto-body copy edits (Fixes 8, 9, 10, 11) in their exact brief wording,
without touching the Sprint 83 founding-circle funnel (Header/Hero/Movement/CTAs/Footer) or ADR-065.
This is now implemented; the next step is Claude PR review and Admin merge authorization.

---

## Quick Start
1. Review PR #52 / branch `agent/codex/content-voice-pass`.
2. Confirm scope stayed copy-only in:
   - `apps/landing/src/components/sections/TheThinking.tsx`
   - `apps/landing/src/components/sections/HowItWorks.tsx`
3. Confirm guardrails stayed intact: no Header/Hero/Movement/CTAs/Footer/nav changes, no ADR-065/docs-JSON/nav regen, no Gmail/unencoded mailto.
4. Validation completed by Codex:
   - `apps/landing`: `npm test -- --runInBand` ✅ 2 suites / 22 tests passed
   - `apps/landing`: `npm run build` ✅ passed; existing `Header.tsx` `<img>` lint warning only
   - repo root: `npm run feedback:check` ✅ passed ("No staged changes detected")
5. Run `/simplify`, `/code-review`, and `/security-review` on the final diff; Admin merges after Claude recommendation.

## Guardrails (do NOT do)
- ❌ Do **not** change Header/Hero/Movement/CTAs nav or primary CTA (keeps `#founding-circle`).
- ❌ Do **not** reintroduce the brief's unencoded mailto signup or `ravichavali@gmail.com` —
  `contact@karmyq.org` is canonical.
- ❌ No ADR change (no pivot → ADR-065 stays). No docs-JSON/nav regen (body copy only) → nav.json revert
  gotcha doesn't apply.
- ❌ Don't add claims beyond what's true (trust paths + cross-community carry exist; don't overstate).

---

## Persistent Context (carry forward unchanged)

### Multi-agent PR process — ✅ LIVE on master (2026-06-02, PR #45)
- `.github/pull_request_template.md` = the cross-agent PR contract (Summary / Validation / Docs / Quality gates / Security dismissals / Follow-ups / Lane).
- `.github/workflows/pr-contract.yml` fails a PR whose body is empty or missing the four required headers; `dependabot[bot]` passes through.
- master **branch protection**: required checks = `pr-contract`, `Lint & Type Check`, `Test Frontend`, `Test Backend Services (Unit + Regression)`, `Code Scanning Gate (ADR-060)`, `Security Audit`; `strict: true`; 1 approving review; `enforce_admins: false`.
- **Merge authority:** Admin owns approval + merge; Claude validates merge-readiness and recommends, executes merge only on Admin authorization ("pull it in"). Agents never self-merge.
- **Enforcement is identity-based** — same-machine agents (Claude, Codex) share admin `gh` creds, so "no direct push to master" is convention-by-discipline for them, not a hard gate. See AGENTS.md "Enforcement reality".
- A deliberate empty marker commit `90b9067` exists on master — do NOT "clean it up".

### ⚠️ NEXT-SESSION WARM-UP — unblock dependabot PRs
The 8 open dependabot PRs (#33–41) predate `pr-contract.yml`; their stale branches have no `pr-contract` status, so the now-required check **blocks** them. To unblock each: comment **`@dependabot rebase`** → recreated branch includes the workflow and passes via bot pass-through. Then review/merge per dependabot merge discipline (**inspect grouped PRs for MAJOR bumps; don't rapid-merge** — 5 concurrent deploys caused ENOTEMPTY).

### Architecture Gotchas (Persistent)
- **Landing page docs**: `apps/landing/src/data/docs/` is in `.gitignore` — always `git add -f`
- **nav.json revert bug**: `generate-docs.ts` regenerates nav.json — run from `apps/landing/`; grep-verify after; re-apply if reverted
- **ADR numbering**: 059 = dependency gate, 060 = code-scanning gate, 061 = supply-chain hardening, 062 = community identity/idempotent creation, 063 = canonical trust metric + unified graph viz, 064 = authorize from authenticated identity, **065 = karmyq.org/karmyq.com domain roles**.
- **JWT field** is `communities` not `communityMemberships` — always `user.communities ?? []`
- **Schema is `communities.communities`** (plural schema name) — older `community.*` comments are stale
- **API response unwrap**: `createApiClient` interceptor already unwraps the envelope — use `res.data`, not `res.data.data`
- **trust_edges_live is a VIEW**: never INSERT/UPDATE it — write `trust_edges`, read `trust_edges_live`
- **`git add` on CLAUDE.md**: tracked as lowercase `claude.md`
- **Solo dev — no worktrees**: work directly on feature branches
- **Root package.json version**: 10.8.0 (Sprint 83 shipped)
- **CI security gates**: dependency audit (ADR-059, blocking `--audit-level=high`) + CodeQL code-scanning gate (ADR-060) run automatically on push

### Pre-Existing TDD Failures (do NOT fix — a NEW failure this sprint is a real regression)
`sprint-39-provider-ux` (7), `sprint-43-feed-ranking` (crashes), `admin-schemas-api.test.ts` (request-service), `sprint-68-halflife` (6 DB-conn), `sprint-67-governance` (DB-conn), social-graph-service tdd `sprint-66`/`sprint-67`/`sprint-68`.

### ⚠️ Deploy drift watch
`karmyq.org` live content was out of sync with `master` at Sprint 83 implementation time (deploy/live-site
drift, not a branch issue). The v3 brief was written against that stale live site — which is *why* six of
its fixes were already done on master. Confirm live deploy status after merge before judging by live content.

### Sprint 81 residual (carried)
- JWT-in-URL exposure → nginx log scrub (shipped Sprint 83). Token TTL kept at 1h (documented). SSE auth tests promoted to regression.
