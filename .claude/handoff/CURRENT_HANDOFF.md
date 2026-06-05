# Sprint 87 — Product Truth & UX Reset — ✅ EXECUTED (direction APPROVED)

> **▶ STATUS (2026-06-05):** Sprint 87 **executed** — all 14 plan tasks complete. Quick wins done
> (version → **10.11.0**; `apps/frontend/CONTEXT.md` BrowseFeed→UnifiedFeed drift fixed; landing
> `CommunityStories.tsx` was already honest = no change). Demo DB **cleaned** (de-spammed 23.6k matches
> → max offers/request 876→6; enforced the 150 Dunbar cap, −785 over-cap members; backup + rollback in
> `docs/design/sprint-87/data-prep-log.md`). Deliverables in `docs/design/sprint-87/`: scorecard,
> member-login UX audit (10 screenshots), visual research, **5 high-fidelity HTML mockups + contact
> sheet**, presentation rules, S88 recommendation.
>
> **▶ DIRECTION VERDICT = APPROVED** (maintainer, 2026-06-05): the warm-commons/calm direction in the
> mockups + presentation rules is the **adopted basis for Sprint 88**. All mockup + `presentation-rules.md`
> banners flipped **PROPOSED → APPROVED**. The S88 implementation plan is written from this **next**
> (shared design-system shell + Dashboard Home first, per `sprint-88-recommendation.md` §3).
>
> **▶ MERGE STATE:** PR **#69** open (quick wins + design artifacts + Codex-review fixes); **awaiting
> maintainer "pull it in"** (admin-merge authority). Codex review applied pre-merge: ARCHITECTURE
> source-of-truth fixes (SSE is authenticated; JWT field is **`communities`** not `communityMemberships`;
> middleware example), handoff version state. Gates green: `npm test` 27/27, landing build ✓, `npm audit`
> 0 vulns, `feedback:check` ✓; no new TDD failures (zero production logic changed). Codex flagged
> Integration Tests still in-progress at review time — confirm green before merge.
>
> **▶ NEXT:** (1) maintainer authorizes merge → `/deploy`, monitor Deploy-to-Demo green. (2) **Write the
> Sprint 88 plan** from the approved direction (`sprint-88-recommendation.md`): shared shell + Dashboard
> Home; relationship-led card; KarmaBadge removal; match-% demote; `minScore≥30` curated + "show more
> open"; impression logging on the `view=home`/`view=community` union path; finite "caught up" state.
> Carry-forward bugs to fix in S88: em-dash **mojibake** in community-name rendering; cumulative
> **"— Group A — Group B"** fission names; **mobile FAB overlapping** the card CTA; empty community **KPI
> tiles**.
>
> _(superseded original status:)_ Sprint 86 shipped + bug-bashed clean (v10.10.0, PRs #60–#66). Sprint 87
> was a **manifesto-first presentation reset** — design-research-first, NOT a code-execute sprint.
>
> **Execution decisions locked (2026-06-05):**
> - **Deploy posture:** quick wins ship in one PR (real deploy); design artifacts ride along but touch no production UI.
> - **Mockup fidelity:** static HTML/CSS throwaway pages (`frontend-design`) under `docs/design/sprint-87/mockups/`.
> - **Mockup scope:** all five surfaces (Dashboard Home, Community Home, Request Card, Profile/Trust, Governance/Fission-Fusion).
> - **UX audit capture:** Claude drives demo via Playwright MCP (member login → navigate → screenshot → notes).
>
> **Multi-agent process:** every plan/PR/branch/commit is reviewed by the agent that did NOT author it
> (Codex ↔ Claude). One owner per artifact. The roadmap (`...sprint-87-90-polish-reset-review-and-roadmap.md`)
> was Codex-authored / Claude-reviewed; **Claude authored this Sprint 87 spec + plan**, so Codex reviews them.

---

## Quick Start — Sprint 87: Product Truth & UX Reset

1. Read this handoff **and** the roadmap spec: `docs/superpowers/specs/2026-06-05-sprint-87-90-polish-reset-review-and-roadmap.md` (locked decisions at top).
2. Check out branch: `git checkout -b feature/sprint-87-product-truth-and-ux-reset`
3. Open plan: `docs/superpowers/plans/2026-06-05-sprint-87-product-truth-and-ux-reset.md`
4. Run: `/execute-plan` (uses superpowers:subagent-driven-development)

**Order matters:** quick wins (Tasks 1–3) → **clean/seed demo data (Task 4)** → UX audit (Task 6) →
visual research (Task 7) → mockups (Task 8) → presentation rules (Task 9) → S88 recommendation (Task 10)
→ gates/verify/deploy. The audit is only as honest as the data behind it — do not audit before the reseed.

## Sprint 87 goal (one sentence)

Establish Karmyq's new manifesto-first presentation direction — ship low-risk source-of-truth & landing
quick wins, clean demo data, and produce a product-polish scorecard + screenshot UX audit + visual
research + throwaway HTML mockups (5 surfaces) + a written presentation-rules system — so Sprint 88
executes the help-loop redesign from an approved direction.

## Decisions locked (2026-06-05, maintainer — full detail in the roadmap spec)

1. **Aesthetic = "warm commons, calm behavior"** — warmth is identity (people/stories/relationship reasons
   lead, humane voice); calm is discipline (finite queues, no engagement chrome, quiet density, visible
   privacy/decay). Reference feel: neighborhood library / thoughtful newsletter. Not cold SaaS, not loud civic.
2. **Quick wins are in scope** — stale metadata, `apps/frontend/CONTEXT.md` BrowseFeed drift, landing
   placeholder stories. **No production UI rewrite until direction approved.**
3. **Score-vs-relationship taxonomy** — lead with relationship path (`TrustPathBadge`/"via X"); remove
   per-person reputation/trust SCORES (`KarmaBadge`); de-emphasize match %. **KarmaBadge removal folds
   into the S88 card redesign** — S87 only documents the rule, does NOT edit `RequestCard`.
4. **Community feed "show all open" = both** — curated-first (`minScore≥30`) + low-altitude member "show
   more open" + admin all-status list (#64). Implements S88; S87 records the decision.
5. **"Designed to forget" stays Sprint 90**, seeded small in Sprint 88.

## Multi-sprint arc

- **Sprint 84** — unified feed research & direction. ✅ Complete (`no-deploy`).
- **Sprint 85** — unified feed, Dashboard Home first. ✅ Shipped v10.9.0.
- **Sprint 86** — Community Feed view + texture + legacy retirement + seam fix. ✅ Shipped v10.10.0.
- **Sprint 87 (THIS)** — Product Truth & UX Reset (quick wins + demo-data + scorecard + audit + mockups + rules). Target v10.11.0.
- **Sprint 88** — Core help-loop redesign (RequestCard hierarchy, KarmaBadge removal, finite-queue states,
  impression logging on `view=home`/`view=community`, community `minScore` "show more open", seed of "what fades", RequestWizard copy).
- **Sprint 89** — Community sovereignty redesign. **Sprint 90** — Trust/forgetting/profile.
  **Sprint 91** — Mobile parity from the polished model. **Sprint 92** — Architecture & service pruning.

## Reference

- **Roadmap (arc + locked decisions):** `docs/superpowers/specs/2026-06-05-sprint-87-90-polish-reset-review-and-roadmap.md`
- **Spec:** `docs/superpowers/specs/2026-06-05-sprint-87-product-truth-and-ux-reset-design.md`
- **Plan:** `docs/superpowers/plans/2026-06-05-sprint-87-product-truth-and-ux-reset.md`
- **Design artifacts land in:** `docs/design/sprint-87/` (NOT gitignored).
- **High-signal findings (what the audit/mockups respond to):** see roadmap §High-Signal Findings #1–8.

## ⚠️ Critical Implementation Notes (copied from spec — these prevent scope creep + the common bugs)

1. **No production UI rewrite this sprint.** Only the two quick wins touch production code
   (`CommunityStories.tsx`, `apps/frontend/CONTEXT.md`) + metadata. Everything else is
   `docs/design/sprint-87/` artifacts. Resist scope creep into S88 card/shell work.
2. **`KarmaBadge` is NOT removed this sprint** (Decision 3 folds it into the S88 card redesign). Document
   the taxonomy rule; do not edit `RequestCard`.
3. **Clean/seed demo data BEFORE the screenshot audit** — an audit on stale-sim data judges noise.
   Order: data cleanup → audit → mockups.
4. **Drive the audit via Playwright with a real MEMBER login** (JWT field is `communities`). Capture each
   surface as a member, not just admin. If demo looks wrong, confirm the latest "Deploy to Demo" run
   succeeded first (deploy-drift watch).
5. **Mockups are throwaway & standalone** — static HTML/CSS, not wired into `apps/frontend`. Build with
   `frontend-design` against warm-commons/calm.
6. **Landing docs dir is gitignored** (`apps/landing/src/data/docs/`) → `git add -f`. **`docs/design/`
   is NOT gitignored.** Run `generate-docs` from `apps/landing/`; **grep-verify nav.json after** (it reverts).
7. **`git add` CLAUDE.md** is lowercase `claude.md` on Windows.
8. **Optimize deliverables for the maintainer's approval decision**, not for completeness — the mockups +
   presentation rules are the gate to S88.

## ADR numbering

No ADR this sprint (design direction, not an architectural decision). Next free ADR number = **068**.
066 = unified-feed model (S85), 067 = `request_type` vs `payload_type` seam (S86).

---

## Persistent Context (carry forward unchanged)

### Multi-agent PR process — ✅ LIVE on master (2026-06-02, PR #45)
- `.github/pull_request_template.md` = the cross-agent PR contract (Summary / Validation / Docs / Quality gates / Security dismissals / Follow-ups / Lane).
- `.github/workflows/pr-contract.yml` fails a PR whose body is empty or missing the four required headers; `dependabot[bot]` passes through.
- master **branch protection**: required checks = `pr-contract`, `Lint & Type Check`, `Test Frontend`, `Test Backend Services (Unit + Regression)`, `Code Scanning Gate (ADR-060)`, `Security Audit`; `strict: true`; 1 approving review; `enforce_admins: false`.
- **Merge authority:** Admin owns approval + merge; Claude validates merge-readiness and recommends, executes merge only on Admin authorization ("pull it in"). Agents never self-merge. (PR #52/#58 were admin-merged via `gh pr merge --admin` after explicit author authorization, since branch protection requires a review the solo-dev flow can't self-supply.)
- **Enforcement is identity-based** — same-machine agents (Claude, Codex) share admin `gh` creds, so "no direct push to master" is convention-by-discipline for them, not a hard gate. See AGENTS.md "Enforcement reality".
- A deliberate empty marker commit `90b9067` exists on master — do NOT "clean it up".

### ⚠️ Open dependabot PRs (#34–50) still need unblocking
The open dependabot PRs predate `pr-contract.yml`; their stale branches have no `pr-contract` status, so the now-required check **blocks** them. To unblock each: comment **`@dependabot rebase`** → recreated branch includes the workflow and passes via bot pass-through. Then review/merge per dependabot merge discipline (**inspect grouped PRs for MAJOR bumps; don't rapid-merge** — 5 concurrent deploys caused ENOTEMPTY). Several are major bumps (tailwindcss 3→4 #41, typescript-eslint 6→8 #40, expo/vector-icons 14→15 #39, gesture-handler 2→3 #37, eslint-config-expo 8→56 #36, eslint-config-next 15→16 #35) — inspect before merging.

### Architecture Gotchas (Persistent)
- **Landing page docs**: `apps/landing/src/data/docs/` is in `.gitignore` — always `git add -f`. (`docs/design/` is NOT gitignored — only the landing data dir is.)
- **nav.json revert bug**: `generate-docs.ts` regenerates nav.json — run from `apps/landing/`; grep-verify after; re-apply if reverted
- **ADR numbering**: see "ADR numbering" above (next free = 068).
- **JWT field** is `communities` not `communityMemberships` — always `user.communities ?? []`
- **Schema is `communities.communities`** (plural schema name) — older `community.*` comments are stale
- **API response unwrap**: `createApiClient` interceptor already unwraps the envelope — use `res.data`, not `res.data.data`
- **trust_edges_live is a VIEW**: never INSERT/UPDATE it — write `trust_edges`, read `trust_edges_live`
- **`git add` on CLAUDE.md**: tracked as lowercase `claude.md`
- **Solo dev — no worktrees**: work directly on feature branches
- **Root package.json version**: **10.11.0** (Sprint 87 executed; bumped from 10.10.0). **Sprint 88 → 10.12.0.**
- **CI security gates**: dependency audit (ADR-059, blocking `--audit-level=high`) + CodeQL code-scanning gate (ADR-060) run automatically on push
- **`request_type` vs `category`**: `request_type` = 5-value `request_type_enum` (filter); `category` = fine
  payload subtype (`transportation` etc., what `RequestPayloadRenderer` switches on, what matching keys off).
  S86 surfaces `category` as `payload_type` on the card (ADR-067).

### Pre-Existing TDD Failures (do NOT fix — a NEW failure this sprint is a real regression)
`sprint-39-provider-ux` (7), `sprint-43-feed-ranking` (crashes), `admin-schemas-api.test.ts` (request-service), `sprint-68-halflife` (6 DB-conn), `sprint-67-governance` (DB-conn), social-graph-service tdd `sprint-66`/`sprint-67`/`sprint-68`.

### ⚠️ Deploy drift watch
`karmyq.org` live content drifted from `master` around Sprint 83. If judging by live content, first confirm the most recent "Deploy to Demo" GitHub Actions run succeeded and live content matches `master`.

### Sprint 85 residual / carry-forward
- **Home-feed impression logging gap**: the `requests.feed_events` impression INSERT only fires on the
  **legacy array** path of `handleCuratedFeed`, not the `view=home` (or `view=community`) union path.
  Carried to **Sprint 88** (help-loop redesign).
- **One manual UI check from S85** (low priority): confirm on demo Dashboard Home that a responder can
  withdraw an offer from the decision band — covered by the S85 verify-lock test; visual confirm only.

### Sprint 81 residual (carried)
- JWT-in-URL exposure → nginx log scrub (shipped Sprint 83). Token TTL kept at 1h (documented). SSE auth tests promoted to regression.
