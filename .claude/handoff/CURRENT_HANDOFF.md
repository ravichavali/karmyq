# Sprint 125 — Provider Standing & Community Reach (PLANNED, ready to execute)

> ## State as of 2026-08-13
>
> Sprint 124 shipped as PR #204, squash `a1cf9eca`, version **v11.44.0**. Demo deploy healthy,
> issue #196 closed, `master` and `origin/master` both at `a1cf9eca`.
>
> This branch is `feature/sprint-125-provider-standing`, cut from that synced master. **Sprint 125
> is now fully planned** — spec and plan are written, and all five open product decisions were
> resolved by the maintainer on 2026-08-13.
>
> ⏰ **The `image-size` exemptions are valid through 2026-08-17 and FAIL from 2026-08-18.**
> `expires` is the first invalid day (`scripts/audit-exemptions.js:107`). Task 1 of the plan is
> that work and must not slip.

## Sprint goal

Enforce the provider policy that migration `022-provider-profiles.sql` and ADR-041 already shipped
— community-gated reach, authenticated directory — and remove the `image-size` advisories before
their exemptions stop being valid.

## Quick Start

1. Read this handoff
2. Stay on branch: `feature/sprint-125-provider-standing` (already cut; confirm a clean tree)
3. Open plan: [`docs/superpowers/plans/2026-08-13-sprint-125-provider-standing.md`](../../docs/superpowers/plans/2026-08-13-sprint-125-provider-standing.md)
4. Run: `/execute-plan` (uses superpowers:subagent-driven-development)

Spec: [`docs/superpowers/specs/2026-08-13-sprint-125-provider-standing-design.md`](../../docs/superpowers/specs/2026-08-13-sprint-125-provider-standing-design.md)

---

## Decisions made 2026-08-13 (do not relitigate)

| Question | Decision |
|---|---|
| Unauthenticated global directory | **Require auth, stay global.** Not retired, not community-restricted. Verified safe: no unauthenticated consumer exists. |
| Where the config columns are enforced | **New community-scoped endpoint** — the surface did not exist and had to be built. |
| Does standing gate global registration | **No — reach only.** ADR-041's self-registration stands, unamended and not superseded. |
| `provider_services_list` | **In scope.** All three columns enforced together; no third inert column left behind. |
| Provider with no trust row when floor > 0 | **Fail closed — `COALESCE(score, 0)`.** Per ADR-037:27. The `trust_scores.score` DEFAULT 50 inconsistency is noted and deferred. |

---

## Verified findings that shaped the plan

Read out of source on 2026-08-13, not taken from the prior audit prose:

- **The three config columns are genuinely inert.** Written by `config.ts:58-60,209-211,240-242`
  and `ProfileTab.tsx:120-122,342-361`; read by no service. Other matches are generated `dist/` and
  `coverage/` artifacts only.
- **No community-scoped provider surface existed.** Every route in `providers.ts` is global or
  owner-scoped; `GET /`, `GET /:providerId` and `GET /:providerId/rate-cards` were fully public.
  The arc spec's "enforce at the community surface" presumed a surface that was never built.
- **⚠️ The endpoint could not be `/communities/:id/providers`** — `nginx.conf:172-173` routes that
  prefix to community-service. It is `GET /providers/community/:communityId`, riding the existing
  `nginx.conf:208-209` rule, so **no nginx change and no deploy-ordering hazard**.
- **Two different scores share the word "trust"**: `reputation.trust_scores` (user × community,
  ADR-037, DEFAULT 50) is what the gate filters; `reputation.provider_trust_scores` (provider
  profile, 60/30/10) is what the directory ranks. Confusing them rejects the wrong people.
- **`providers.ts:64-82` already derives live `shared_communities`** but only annotates — it filters
  nothing. Reuse it; do not derive membership a second way.
- **`image-size` re-measured against live arbiters 2026-08-13** — unchanged from 2026-08-11:
  `image-size@2.0.2` latest, both GHSAs affect `<= 2.0.2` with `first_patched_version: null` and
  neither withdrawn, `metro@0.87.0` still declares `^1.0.2`, resolved tree still
  `expo@57.0.12 → @expo/metro@56.0.0 → metro@0.84.4 → image-size@1.2.1`. `audit-exemptions.js`
  exits 0 with 10 findings under exemption.

---

## Critical Implementation Notes (verbatim from the spec)

1. **`expires` is the first INVALID day** — valid through 2026-08-17, fails from 2026-08-18. Any
   renewal is capped at 7 days, needs fresh measurements plus written rationale, and requires
   explicit maintainer authorization. **The monitor workflow must never edit
   `security/audit-exemptions.json`.** A renewal does not complete Task 0.
2. **Two trust scores, different grains** — never substitute one for the other.
3. **`COALESCE(ts.score, 0)`, never bare `ts.score`** — `LEFT JOIN` plus explicit `COALESCE`; an
   `INNER JOIN` silently drops providers even when the floor is 0.
4. **Membership re-derived live** from `communities.members` (`status = 'active'`) for both viewer
   and provider. The JWT claim is a login-time snapshot.
5. **The JWT field is `communities`, not `communityMemberships`.**
6. **Express route order decides reachability** — register `/community/:communityId` **before**
   `GET /:providerId` (`providers.ts:315`), as `/providers/my` (`:108`) already relies on.
7. **NOT `/communities/:id/providers`** — wrong service via nginx.
8. **Empty `provider_services_list` means "all types allowed"**, not deny-all.
9. **A community with no `community_configs` row is disabled, not an error** — empty layer, not the
   404 `config.ts` returns.
10. **Gates must be proven to REJECT** — both directions, per condition, independently.
11. **RLS is on** — a query skipping `setDbContext` sees nothing rather than erroring.
12. **`init.sql` is generated** — migration → `regenerate-init-sql.sh` → commit both.
13. **`apps/landing/src/data/docs/api.json` is generated**; revert landing-doc churn before commit.
14. **Windows**: no `jq`, unreliable `curl` — use `node -e`; `| tail` masks exit codes.

---

## Carried item

**BUG-036 remains open:** `.github/workflows/test.yml` uses a fixed `sleep 30` before the Docker
health probe, racing cold image pulls. Separately scoped — the Sprint 125 plan does not adopt it.

---

## Arc

- Sprint 123 — licensing and truth audit: complete, v11.43.0.
- Sprint 124 — exemption mechanism and honest Expo drift gate: complete, v11.44.0.
- **Sprint 125 — `image-size` Task 0 + provider standing/community reach: planned, executing.**
- Sprint 126 — honest demo-data backfill through production math.
- Sprint 127 — live simulation across all users.

---

## Standing mechanics

- Branch from `origin/master`; never direct-push to master and never force-push.
- Every merge needs explicit maintainer authorization; `--admin` override needs its own each time.
- Do not use a docs-only master push to reconcile this handoff; land it with Sprint 125 work.
- Dependency edits are surgical: no workspace install, dedupe, or lockfile scratch regeneration.
- Assert resolved versions after every dependency operation; npm's "up to date" text is not proof.
- `curl` and `jq` are unreliable/unavailable on this Windows machine; use Node for probes/JSON.
- All four SDLC gates remain mandatory before merge: testing, simplify, code review, security
  review. `/code-review` runs at **high** effort this sprint — the diff changes an authorization
  surface.
