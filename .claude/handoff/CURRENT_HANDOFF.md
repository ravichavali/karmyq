# Sprint 90 — Designed to Forget — PLANNED, READY TO EXECUTE

> **▶ STATUS (2026-06-07):** Sprint 89 (Community Sovereignty Redesign) **shipped to master** as
> `ae63e9f` (#73), **v10.13.0** — the whole `/communities/[id]` page is now four warm tabs with warm
> Home default + pulse. Sprint 90 is **planned and ready to execute**. Spec + plan written; version will
> bump **10.13.0 → 10.14.0**. No code written yet — next session executes the plan.

---

## Quick Start

1. Read this handoff.
2. Branch already exists with the planning commit — just check it out:
   `git checkout feature/sprint-90-designed-to-forget` (NOT `-b` — it exists).
3. Open plan: `docs/superpowers/plans/2026-06-07-sprint-90-designed-to-forget.md`
4. Run: `/execute-plan` (uses superpowers:subagent-driven-development)

## Sprint 90 goal (one sentence)

Make Karmyq's "designed to forget" promise **real for content** (a `memoryRetentionJob` that anonymizes
completed-exchange free-text to sentinels, hard-deletes expired/unmatched requests, and cascade-forgets
messages — all keeping aggregates, karma untouched) and **visible for members** (relationships
that perceptibly fade by `decayTier`, a re-warming nudge, a transparency page, and a warm-restyled
profile with a memory section).

## Why now

Forgetting is already real at the **edge layer** (`trustEdgeSweepJob` deletes decayed trust edges below
`disappearance_threshold`; reputation decays; requests expire) but it's **invisible** and content
(request free-text, messages) is retained forever. IDEAS.md [2026-06-04] flags this as a
strategic gap: "ranking math, not a visible, trustworthy promise." Sprint 90 closes it.

## Scope decisions locked with maintainer (2026-06-07)

1. **Spine = deepen the policy AND polish the profile** (both options 2 + 3 from scoping). Big sprint;
   sequenced so the visible-decay surfaces don't block on the backend retention policy landing first.
2. **What forgets:** completed-request free-text — `title`/`description`/`payload`/`requirements` —
   (anonymize to `'[forgotten]'` sentinel), expired/unmatched requests (hard-delete), messages (cascade
   with parent exchange). **Karma is OUT** (review correction 2026-06-07): `karma_records` has no PII and
   `reason` is a load-bearing enum filtered by trust math — touching it corrupts trust scores. Left intact.
3. **Method = anonymize to sentinels (NOT NULL columns), keep aggregates** (reputation/trust/pulse math
   must stay correct). Expired-unmatched is the one hard-delete (no aggregate value).
4. **Member controls = transparency only** this sprint (see, don't yet hand-delete/export).
5. **Profile = warm restyle + memory section** (full S87–89 commons look).
6. **All four visible surfaces ship:** fading relationship visuals, transparency page, profile memory
   section, re-warming nudge.

## The Exchange Unit cascade (the maintainer's question, answered)

A `help_request` + its `match` + the `conversation` (`messaging.conversations.request_match_id`) + that
conversation's `messages` are **one Exchange Unit**. Forgetting cascades along it: when a completed
request's free-text is forgotten, its conversation's messages forget in the **same transaction**. The
`match` and `karma_records` are **never touched** (they are the aggregate). Expired/unmatched requests
have no match → no conversation → clean hard-delete with nothing to cascade.

## Critical Implementation Notes (copied verbatim from spec)

1. **`karma_records` is OFF LIMITS — never write to it.** No PII; `reason` is a load-bearing enum
   (`'Provided help'`/`'Received help'`/milestones) filtered across `trustMetricsDb`, `trustEvolutionDb`,
   `communityTrustService`, `reputation.ts`. Touching `reason`/`points` silently corrupts trust scores.
   Forgetting only ever writes `help_requests` and `messages`.
2. **Target columns are `NOT NULL` → sentinel, never `NULL`.** `help_requests.title`/`description` and
   `messages.content` are `NOT NULL`; `NULL` throws. Write `'[forgotten]'` (+ `'{}'::jsonb` for
   `payload`/`requirements`). **`messages.content` is the column, NOT `body`.** Conversations link to an
   exchange via `messaging.conversations.request_match_id` (the cascade join).
3. **Forget ALL request free-text** — `title`, `description`, `payload`, `requirements` — not just
   `description` (else PII stays in `title`/`payload`).
4. **Exchange Unit cascade runs in one transaction per exchange** — request + its conversation's messages
   forget together or none. Karma is NOT part of the cascade.
5. **Expired model is the `expired` boolean, NOT `status='expired'`.** `status` is
   `open`/`dibs_pending`/`matched`/`completed`/`cancelled` (CHECK in `20260603-feed-vocab-reconciliation.sql`)
   — never `expired`; the expiration job sets the separate `expired = TRUE` flag. Hard-delete only
   `expired = TRUE` with NO match row, **aging from `updated_at`** (the job stamps it when it flips the
   flag — `created_at` would delete a just-expired old request immediately). Completed-anonymize trigger:
   `status='completed' AND updated_at < now() - window` (no `completed_at` column exists).
6. **`retention_config` NULL-row idempotency:** a bare `UNIQUE(community_id)` does NOT make the NULL
   global row unique in Postgres (`ON CONFLICT` won't fire on re-run → dup rows). Add a partial unique
   index `WHERE community_id IS NULL` + seed with `WHERE NOT EXISTS`. Resolution: community → global →
   hardcoded fallback. (Cross-schema FK to `communities.communities` is the established precedent — run
   the migration-validator agent anyway.)
7. **`classifyDecayTier(currentWeight, threshold)` is ONE shared pure helper** (`@karmyq/shared`) consumed
   by endpoints + tests — never inline the band math twice. Bands: `strong` r≥3, `warm` 2–3, `fading`
   1.3–2, `nearly_forgotten` 1–1.3 (nudge fires here), swept r<1.
8. **The job lives in cleanup-service** alongside `trustEdgeSweepJob` / `reputationDecayJob` /
   `expirationJob` / `requestTtlSweepJob`, wired into the same scheduler in `src/index.ts`; writes to
   `requests` + `messaging` schemas (cleanup-service already does cross-schema work).
9. **JWT field is `communities`** (`user.communities ?? []`) for the membership gate on new endpoints.
10. **API unwrap:** frontend consumes `res.data`, not `res.data.data`.
11. **`trust_edges_live` is a VIEW** — read `current_weight`; never write it. Sweep deletes from
    `trust_edges` base table.
12. **No empty profile tiles** — memory section suppresses rows with no data.
13. **Landing docs gitignored** (`git add -f`); **nav.json reverts** after `generate-docs` (grep-verify, re-apply).
14. **ADR numbering:** ADR-069 (retention/forgetting) + ADR-070 (visible decay) this sprint; next free = **071**.
15. **Idempotent migration + guarded global-row seed**; job no-ops safely on empty config (fallback windows).

## Data model (one migration: `20260607-designed-to-forget.sql`)

- New `requests.retention_config` (mirrors `trust_decay_config`) — 3 windows (completed/expired/message)
  + partial unique index on the NULL global row + `WHERE NOT EXISTS` guarded seed.
- `help_requests.content_forgotten_at`, `messages.forgotten_at`. **No karma column** (karma is untouched).
- Two partial indexes (`WHERE ... forgotten_at IS NULL`) so each sweep scans only un-forgotten rows.

## New endpoints

- **Extend** `/trust/graph/:communityId/full` + `/trust/graph/:communityId` (the routes that power
  `TrustGraphTab` via `getFullCommunityGraph()`/`getTrustGraph()`, in
  `services/social-graph-service/src/routes/trustGraph.ts`) — add per-edge `currentWeight`,
  `disappearanceThreshold`, `decayTier`. **There is NO `/connections` endpoint** — don't invent one.
- `GET /trust/me/memory?communityId=` (active + fading + nearly-forgotten) — new, same router
- `GET /trust/relationships/fading?communityId=` (nudge feed) — new, same router
- `GET /api/requests/retention-policy?communityId=` (resolved windows + held/forgotten counts; no PII)

## Reference

- **Spec:** `docs/superpowers/specs/2026-06-07-sprint-90-designed-to-forget-design.md`
- **Plan:** `docs/superpowers/plans/2026-06-07-sprint-90-designed-to-forget.md`
- **Existing decay infra (reuse, don't duplicate):** `services/cleanup-service/src/jobs/trustEdgeSweepJob.ts`,
  `reputationDecayJob.ts`; `social_graph.trust_edges_live` view + `trust_decay_config`
  (migration `20260526-interaction-halflife.sql`); manifesto §7 / ADR-066 / ADR-056.
- **Warm-commons style assets (S88):** `apps/frontend/src/styles/karmyq-shell.css` (`.kq-*`),
  `TrustPathBadge presentation="feed"`.

---

## Multi-sprint arc

- **Sprint 87** — Product Truth & UX Reset; warm-commons approved. ✅ v10.11.0.
- **Sprint 88** — Core help-loop redesign: shell + Dashboard Home + Community feed. ✅ v10.12.0.
- **Sprint 89** — Community sovereignty redesign: the whole community page. ✅ v10.13.0.
- **Sprint 90 (THIS)** — Designed to forget: real content retention + visible decay + profile memory. → v10.14.0.
- **Sprint 91** — Mobile parity from the polished web model.
- **Sprint 92** — Architecture & service pruning.

---

# Archived Context — Sprint 89 Community Sovereignty Redesign — ✅ MERGED + DEPLOYED (v10.13.0)

> Sprint 89 shipped via PR **#73** (`ae63e9f`). Implemented: members-gated pulse endpoint (reuses the S86
> texture aggregation via shared `fetchCommunityPulse` + new `timeSensitive`); warm four-tab page
> (`Home · People · How we're connected · Stewardship` + group-only Activities); warm Home default for ALL
> roles (headline bug — warm feed was admin-gated — fixed); `CommunityHero` + `CommunityPulse`; `BrowseTab`
> split → `StewardRequestsAdmin` under `StewardshipTab`; centralized `lib/communityTabs.ts` deep-link
> resolver; ADR-068 + landing docs + onboarding + CONTEXT/registry. All quality gates green.

---

## Persistent Context (carry forward unchanged)

### Multi-agent PR process — ✅ LIVE on master (2026-06-02, PR #45)
- `.github/pull_request_template.md` = the cross-agent PR contract (Summary / Validation / Docs / Quality gates / Security dismissals / Follow-ups / Lane).
- `.github/workflows/pr-contract.yml` fails a PR whose body is empty or missing the four required headers; `dependabot[bot]` passes through.
- master **branch protection**: required checks = `pr-contract`, `Lint & Type Check`, `Test Frontend`, `Test Backend Services (Unit + Regression)`, `Code Scanning Gate (ADR-060)`, `Security Audit`; `strict: true`; 1 approving review; `enforce_admins: false`.
- **Merge authority:** Admin owns approval + merge; Claude validates merge-readiness and recommends, executes merge only on Admin authorization ("pull it in"). Agents never self-merge.
- **Enforcement is identity-based** — same-machine agents (Claude, Codex) share admin `gh` creds, so "no direct push to master" is convention-by-discipline for them, not a hard gate. See AGENTS.md "Enforcement reality".
- A deliberate empty marker commit `90b9067` exists on master — do NOT "clean it up".

### ⚠️ Open dependabot PRs (#34–50) still need unblocking
The open dependabot PRs predate `pr-contract.yml`; their stale branches have no `pr-contract` status, so the now-required check **blocks** them. To unblock each: comment **`@dependabot rebase`** → recreated branch includes the workflow and passes via bot pass-through. Then review/merge per dependabot merge discipline (**inspect grouped PRs for MAJOR bumps; don't rapid-merge** — 5 concurrent deploys caused ENOTEMPTY). Several are major bumps (tailwindcss 3→4 #41, typescript-eslint 6→8 #40, expo/vector-icons 14→15 #39, gesture-handler 2→3 #37, eslint-config-expo 8→56 #36, eslint-config-next 15→16 #35) — inspect before merging.

### Architecture Gotchas (Persistent)
- **Landing page docs**: `apps/landing/src/data/docs/` is in `.gitignore` — always `git add -f`. (`docs/design/` is NOT gitignored — only the landing data dir is.)
- **nav.json revert bug**: `generate-docs.ts` regenerates nav.json — run from `apps/landing/`; grep-verify after; re-apply if reverted
- **ADR numbering**: ADR-069 + ADR-070 created in S90; next free = 071.
- **JWT field** is `communities` not `communityMemberships` — always `user.communities ?? []`
- **Schema is `communities.communities`** (plural schema name) — older `community.*` comments are stale
- **API response unwrap**: `createApiClient` interceptor already unwraps the envelope — use `res.data`, not `res.data.data`
- **trust_edges_live is a VIEW**: never INSERT/UPDATE it — write `trust_edges`, read `trust_edges_live`
- **messaging schema**: `messages.content` (NOT `body`); `conversations.request_match_id` links a thread to its exchange.
- **`git add` on CLAUDE.md**: tracked as lowercase `claude.md`
- **Solo dev — no worktrees**: work directly on feature branches
- **Root package.json version**: **10.13.0** (Sprint 89 shipped; S90 bumps to 10.14.0).
- **CI security gates**: dependency audit (ADR-059, blocking `--audit-level=high`) + CodeQL code-scanning gate (ADR-060) run automatically on push
- **`request_type` vs `category`**: `request_type` = 5-value `request_type_enum` (filter); `category` = fine
  payload subtype (`transportation` etc., what `RequestPayloadRenderer` switches on, what matching keys off).
  S86 surfaces `category` as `payload_type` on the card (ADR-067).

### Pre-Existing TDD Failures (do NOT fix — a NEW failure this sprint is a real regression)
`sprint-39-provider-ux` (7), `sprint-43-feed-ranking` (crashes), `admin-schemas-api.test.ts` (request-service), `sprint-68-halflife` (6 DB-conn), `sprint-67-governance` (DB-conn), social-graph-service tdd `sprint-66`/`sprint-67`/`sprint-68`, plus the 5 frontend TDD failures noted in S89 (trust-model / useTrustQuestions / sprint-38/39/40).

### ⚠️ Deploy drift watch
`karmyq.org` live content drifted from `master` around Sprint 83. If judging by live content, first confirm the most recent "Deploy to Demo" GitHub Actions run succeeded and live content matches `master`.

### Sprint 81 residual (carried)
- JWT-in-URL exposure → nginx log scrub (shipped Sprint 83). Token TTL kept at 1h (documented). SSE auth tests promoted to regression.
