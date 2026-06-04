# Sprint 85 — Unified Feed: Dashboard Home — 📋 READY TO EXECUTE

> **▶ STATUS (2026-06-03):** Sprint 84 (research & direction) is complete and merged. Sprint 85 is
> **planned and ready to execute** — spec + plan written, all four scoping decisions made (recommended
> options). This sprint **implements** the unified feed's first vertical slice (Dashboard Home).
> Version bumps **10.8.0 → 10.9.0**. This sprint ships code, schema, API, and docs — **not** `no-deploy`.

## Quick Start

1. Read this handoff
2. Check out branch: `git checkout -b feature/sprint-85-unified-feed-dashboard-home`
3. Open plan: `docs/superpowers/plans/2026-06-03-sprint-85-unified-feed-dashboard-home.md`
4. Run: `/execute-plan` (uses superpowers:subagent-driven-development)

## Sprint 85 goal (one sentence)

Build the unified feed's first vertical slice — a canonical `request` card + a server-computed `decision`
top band on **Dashboard Home**, served from `GET /requests/curated?view=home` — landing the
urgency/status/`match_score` reconciliations the card depends on and verify-locking Withdraw-Offer.

## Scoping decisions (made 2026-06-03 — all recommended)

1. **Scope = first vertical slice (steps 1–3):** canonical card + unified item shape + decision band on
   Dashboard Home. Community Feed view, texture layer, and legacy retirement → **Sprint 86**.
2. **Source of truth = extend `request-service`** `/requests/curated` with `view=home` (NOT the Feed
   service). It already owns ranking + the live dashboard wiring.
3. **Vocabulary reconciliation ships now:** one urgency scale (`urgent|high|medium|low`, `critical→urgent`),
   one status token (`proposed` replaces `pending` on `help_requests`), one `match_score` scale (0–100 +
   `match_reason`). `request_type` enum is already canonical (payload subtypes are separate).
4. **Withdraw-Offer fix = verify-lock:** backend already allows both participants (Sprint 62). S85 wires the
   decision band's Withdraw to `rejectMatch(matchId)`, adds a regression test (responder withdraws own offer),
   and confirms deploy runs current `src` (stale `'Only the requester can reject'` lives only in `dist/`).

## Multi-sprint arc

- **Sprint 84** — unified feed research & direction. ✅ Complete (doc + mockups, `no-deploy`).
- **Sprint 85 (this)** — implement the unified feed, **Dashboard Home first** (steps 1–3). 📋 Ready.
- **Sprint 86 (next)** — Community Feed view + admin-console split + `activity`/`story` texture layer +
  retire `Feed/Feed.tsx` + de-dup `FeedFilterPanel`/`FilterChipRow` + mobile parity (steps 4–6).

## Reference

- **Spec:** `docs/superpowers/specs/2026-06-03-sprint-85-unified-feed-dashboard-home-design.md`
- **Plan:** `docs/superpowers/plans/2026-06-03-sprint-85-unified-feed-dashboard-home.md`
- **Direction doc (read for full design reasoning):** `docs/design/sprint-84-unified-feed/README.md`
  (audit §2, data/action inventory §3, principles §5, unified IA §6, build sequence §7.2, open questions §7.4)
- **Mockups:** `docs/design/sprint-84-unified-feed/mockups/` (`dashboard-home.html` is the target)

## ⚠️ Critical Implementation Notes (copied from spec — these prevent the bugs)

1. **Source of truth is `request-service`, not the Feed service** — extend `/requests/curated` with `view=home`.
2. **Withdraw-Offer already works at the backend** (Sprint 62: `PUT /matches/:id/reject` allows both
   participants, `matches.ts:408`). Stale guard string lives only in `dist/`/`coverage/` — never edit those; a
   clean rebuild purges them. S85 = wire decision-band Withdraw + regression test (responder withdraws) + confirm
   deploy runs `src`.
3. **`request_type` is the 5-value `request_type_enum`** (`generic|ride|borrow|service|event`), already canonical.
   The 6 payload subtypes (transportation/moving_help/childcare/tech_help/home_repair/food) are a **separate
   `payload` concept** — do NOT migrate or conflate. No `request_type` DB change.
4. **Urgency: map `critical → urgent` before the CHECK; use `??`/`!= null` not `||`** for defaults (0 is valid).
5. **`match_score` is one 0–100 integer scale** + a `match_reason` string; normalize at the API boundary.
6. **Status token: `proposed` replaces `pending`** on `help_requests` ONLY. Grep all services + frontend +
   simulation for `status = 'pending'` writes/reads on `help_requests`; the `dibs`/`offers` tables keep their own
   `pending` lifecycle — do NOT migrate those.
7. **Action altitude is server-side** — compute `priority` in the curated handler; client renders in array order.
   Leave `CommitmentsTab` working unchanged (it stays home of the action handlers the band reuses).
8. **ADR-066 is reserved** for the Unified Feed Model — write it against real S85 code.
9. **Migration is idempotent + dry-run first** — `SELECT DISTINCT status/urgency` before adding CHECKs so no live
   row violates them (FK-dedup migration dry-run discipline).

---

## Persistent Context (carry forward unchanged)

### Multi-agent PR process — ✅ LIVE on master (2026-06-02, PR #45)
- `.github/pull_request_template.md` = the cross-agent PR contract (Summary / Validation / Docs / Quality gates / Security dismissals / Follow-ups / Lane).
- `.github/workflows/pr-contract.yml` fails a PR whose body is empty or missing the four required headers; `dependabot[bot]` passes through.
- master **branch protection**: required checks = `pr-contract`, `Lint & Type Check`, `Test Frontend`, `Test Backend Services (Unit + Regression)`, `Code Scanning Gate (ADR-060)`, `Security Audit`; `strict: true`; 1 approving review; `enforce_admins: false`.
- **Merge authority:** Admin owns approval + merge; Claude validates merge-readiness and recommends, executes merge only on Admin authorization ("pull it in"). Agents never self-merge. (PR #52 was admin-merged via `gh pr merge --admin` after explicit author authorization, since branch protection requires a review the solo-dev flow can't self-supply.)
- **Enforcement is identity-based** — same-machine agents (Claude, Codex) share admin `gh` creds, so "no direct push to master" is convention-by-discipline for them, not a hard gate. See AGENTS.md "Enforcement reality".
- A deliberate empty marker commit `90b9067` exists on master — do NOT "clean it up".

### ⚠️ NEXT-SESSION WARM-UP — unblock dependabot PRs
The open dependabot PRs (#34–50) predate `pr-contract.yml`; their stale branches have no `pr-contract` status, so the now-required check **blocks** them. To unblock each: comment **`@dependabot rebase`** → recreated branch includes the workflow and passes via bot pass-through. Then review/merge per dependabot merge discipline (**inspect grouped PRs for MAJOR bumps; don't rapid-merge** — 5 concurrent deploys caused ENOTEMPTY). Several here ARE major bumps (tailwindcss 3→4 #41, typescript-eslint 6→8 #40, expo/vector-icons 14→15 #39, gesture-handler 2→3 #37, eslint-config-expo 8→56 #36, eslint-config-next 15→16 #35) — inspect before merging.

### Architecture Gotchas (Persistent)
- **Landing page docs**: `apps/landing/src/data/docs/` is in `.gitignore` — always `git add -f`. (Note: `docs/design/` is NOT gitignored — only the landing data dir is.)
- **nav.json revert bug**: `generate-docs.ts` regenerates nav.json — run from `apps/landing/`; grep-verify after; re-apply if reverted
- **ADR numbering**: 059 = dependency gate, 060 = code-scanning gate, 061 = supply-chain hardening, 062 = community identity/idempotent creation, 063 = canonical trust metric + unified graph viz, 064 = authorize from authenticated identity, 065 = karmyq.org/karmyq.com domain roles, **066 = reserved for Sprint 85 unified-feed model**. (Next free after 066: 067.)
- **JWT field** is `communities` not `communityMemberships` — always `user.communities ?? []`
- **Schema is `communities.communities`** (plural schema name) — older `community.*` comments are stale
- **API response unwrap**: `createApiClient` interceptor already unwraps the envelope — use `res.data`, not `res.data.data`
- **trust_edges_live is a VIEW**: never INSERT/UPDATE it — write `trust_edges`, read `trust_edges_live`
- **`git add` on CLAUDE.md**: tracked as lowercase `claude.md`
- **Solo dev — no worktrees**: work directly on feature branches
- **Root package.json version**: 10.8.0 (Sprint 83 shipped; Sprint 84 research was no-deploy). **Sprint 85 bumps it to 10.9.0.**
- **CI security gates**: dependency audit (ADR-059, blocking `--audit-level=high`) + CodeQL code-scanning gate (ADR-060) run automatically on push

### Pre-Existing TDD Failures (do NOT fix — a NEW failure this sprint is a real regression)
`sprint-39-provider-ux` (7), `sprint-43-feed-ranking` (crashes), `admin-schemas-api.test.ts` (request-service), `sprint-68-halflife` (6 DB-conn), `sprint-67-governance` (DB-conn), social-graph-service tdd `sprint-66`/`sprint-67`/`sprint-68`.

### ⚠️ Deploy drift watch
`karmyq.org` live content drifted from `master` around Sprint 83. PR #51 + #52 are merged — if judging by live content, first confirm the "Deploy to Demo" GitHub Actions run succeeded and live `karmyq.org` matches `master`.

### Sprint 81 residual (carried)
- JWT-in-URL exposure → nginx log scrub (shipped Sprint 83). Token TTL kept at 1h (documented). SSE auth tests promoted to regression.
