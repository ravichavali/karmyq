# Sprint 125: Provider Standing & Community Reach — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Enforce the provider policy that migration `022-provider-profiles.sql` and ADR-041
already shipped — community-gated reach, authenticated directory — and remove the `image-size`
advisories before their exemptions stop being valid on 2026-08-18.

**Architecture:** A new `GET /providers/community/:communityId` in request-service applies a
three-condition reach gate (community opt-in × personal trust floor × service-type allowlist) over
the existing global `requests.provider_profiles`, reusing the live-membership join already at
`providers.ts:64-82`. The three global read routes gain `authMiddleware`. No schema change beyond
one index.

**Tech Stack:** Node.js 24/Express 5/TypeScript, Next.js 15, PostgreSQL 15 (RLS), Bull queue.

**Spec:** [`docs/superpowers/specs/2026-08-13-sprint-125-provider-standing-design.md`](../specs/2026-08-13-sprint-125-provider-standing-design.md)

---

## File Map

### New files to create

| File | Responsibility |
|------|---------------|
| `.github/workflows/image-size-advisory-watch.yml` | Weekly schedule-only upstream monitor; files/updates one issue; never edits the exemption registry |
| `scripts/check-image-size-upstream.js` | The arbiter query: live npm versions, both GHSA advisories, Metro's declared dep, local exemption horizon |
| `infrastructure/postgres/migrations/20260813-provider-reach-index.sql` | `idx_trust_scores_community_user` for the reach join |
| `services/request-service/src/services/providerReachService.ts` | The three-condition reach gate, in one place |
| `services/request-service/tests/tdd/sprint-125-provider-reach-gate.test.ts` | Reach-gate behavior, both directions per condition |
| `services/request-service/tests/unit/providerReachService.test.ts` | Unit tests for the gate predicate |
| `tests/regression/sprint-125-provider-auth-gate.test.ts` | The three global routes reject anonymous callers |
| `apps/frontend/src/components/community/tabs/ProvidersTab.tsx` | Community provider layer UI |
| `docs/adr/ADR-095-authenticated-provider-directory-and-reach-gated-standing.md` | The two decisions + fail-closed rule |
| `apps/landing/src/data/docs/concepts/adr-095-authenticated-provider-directory.json` | ADR landing page |

### Existing files to modify

| File | Change |
|------|--------|
| `services/request-service/src/routes/providers.ts` | Add `GET /community/:communityId` **before** `:315`; add `authMiddleware` to `:28`, `:158`, `:315`; delete now-dead `decodeOptionalViewer` (`:12-23`) |
| `services/request-service/CONTEXT.md` | New endpoint, auth changes, reach gate; correct `:2989-2991` |
| `services/community-service/CONTEXT.md` | Name the consumer of the three config columns |
| `services/registry.json` | `request-service.apis.provides` entries |
| `infrastructure/postgres/init.sql` | **Regenerated**, never hand-edited |
| `apps/frontend/src/lib/api/providerApi.ts` | `getCommunityProviders()` |
| `apps/frontend/src/lib/communityTabs.ts` | Register Providers tab |
| `apps/frontend/src/components/community/tabs/ProfileTab.tsx` | Allowlist editor + helper text |
| `apps/frontend/src/lib/onboarding/workflows.ts` | Admin enable-provider-services step |
| `docs/adr/ADR-041-two-layer-mutual-aid-services.md` | Status note → ADR-095 (NOT superseded) |
| `docs/adr/README.md` | Index ADR-095 |
| `apps/landing/src/data/docs/nav.json` | Wire the new pages (grep-verify after edit — it silently reverts) |
| `security/audit-exemptions.json` | Delete both entries on remediation (Task 1) |

---

## ⚠️ Critical Implementation Notes (read before Task 2)

1. **`expires` is the first INVALID day.** Both `image-size` exemptions are valid through
   2026-08-17 and fail from 2026-08-18. `scripts/audit-exemptions.js:107` is the authority. Any
   renewal is capped at 7 days by `MAX_EXEMPTION_DAYS`, needs fresh measurements and a written
   rationale, and the monitor workflow must **never** edit `security/audit-exemptions.json`.
2. **Two trust scores, different grains.** The community gate filters
   `reputation.trust_scores.score` (user × community, ADR-037, **DEFAULT 50**). The directory ranks
   `reputation.provider_trust_scores.trust_score` (provider profile, 60/30/10 service quality).
   Never substitute one for the other.
3. **`COALESCE(ts.score, 0)`, never bare `ts.score`.** Use a `LEFT JOIN` plus explicit `COALESCE`
   so a missing row scores 0. An `INNER JOIN` silently drops providers even when the floor is 0.
4. **Membership is re-derived live** from `communities.members` with `status = 'active'`, for both
   the viewer and the provider. The JWT claim is a login-time snapshot and must not gate visibility.
5. **The JWT field is `communities`, not `communityMemberships`.**
6. **Express route order decides reachability.** `GET /:providerId` (`providers.ts:315`) would
   swallow `/community/:communityId`. Register the new route **before** it — the ordering
   `/providers/my` (`:108`) already relies on. Assert it in a test.
7. **NOT `/communities/:id/providers`** — `nginx.conf:172-173` routes that prefix to
   community-service. `/providers/community/:communityId` rides the existing
   `nginx.conf:208-209` rule and needs **no nginx change**.
8. **Empty `provider_services_list` means "all types allowed."** Default is `'{}'`; a deny-all
   reading switches off every community that opted in without setting a list. Use
   `cardinality(c.provider_services_list) = 0 OR pp.service_type = ANY(c.provider_services_list)`.
9. **A community with no `community_configs` row is disabled, not an error** — return an empty
   layer, not the 404 `config.ts` returns.
10. **Gates must be proven to REJECT.** Every gate test asserts both directions — eligible appears
    AND ineligible is absent — for each of the three conditions independently.
11. **RLS is on.** A query that skips `setDbContext` sees nothing rather than erroring. A silently
    empty layer in integration tests is the tell.
12. **`init.sql` is generated.** Add the migration, run `scripts/regenerate-init-sql.sh`, commit
    both, or the drift gate blocks.
13. **`apps/landing/src/data/docs/api.json` is generated**; `npm test` regenerates landing docs.
    Revert timestamp/HEAD-sha churn before committing.
14. **Windows**: `jq` unavailable, `curl` flag parsing unreliable — use `node -e`. `| tail` masks
    exit codes.

---

## Task 1: Security Task 0 — `image-size` remediation decision

**Files:**
- Create: `scripts/check-image-size-upstream.js`
- Modify: `security/audit-exemptions.json` (only on remediation or authorized renewal)

- [ ] **Write the arbiter script.** It must query live sources, never a shadow map: `npm view
      image-size version`, `npm view metro@latest dependencies.image-size`, both GHSA ids via the
      GitHub advisories API, the resolved tree via `npm ls image-size --all --json`, and the local
      exemption horizon from `security/audit-exemptions.json`. It exits non-zero **only** when
      something actionable changed. It never writes to the registry.

- [ ] **Run it and record the measurements.** Baseline as of 2026-08-13: `image-size@2.0.2` latest,
      both advisories `<= 2.0.2` with `first_patched_version: null`, `metro@0.87.0` still declaring
      `^1.0.2`, resolved `image-size@1.2.1`.

```bash
node scripts/check-image-size-upstream.js
```

- [ ] **Attempt true remediation** (spec §Required behavior 5). Preferred order:
      (a) a tested `patch-package` patch to `metro/src/Assets.js` removing the `image-size`
      dependency path, or (b) an immutable, narrowly tested 1.x-compatible fork preserving Metro's
      CommonJS default-export contract. **A renamed copy of vulnerable code is not remediation.**

- [ ] **Prove removal with hostile fixtures.** Malicious ICNS, JXL and HEIF inputs must not hang
      the parser (these are the three parser families the two advisories cover). Assert a bounded
      time, not merely "no crash".

- [ ] **Verify the tree and the gate.**

```bash
npm ci                                   # strict, must succeed
npm ls image-size --all                  # must be absent, or the patched version
node scripts/audit-exemptions.js         # must pass with the entries DELETED
npm audit --package-lock-only --audit-level=high
cd apps/mobile && npx tsc --noEmit && npm test
```

- [ ] **If remediation cannot land before 2026-08-18: STOP and ask the maintainer.** A renewal is a
      fresh reviewed decision — max 7 days, fresh measurements, written rationale, explicit
      authorization. Do not renew unilaterally, and do not treat renewal as completing Task 0.

---

## Task 2: Weekly upstream monitor workflow

**Files:**
- Create: `.github/workflows/image-size-advisory-watch.yml`

- [ ] **Model it on `.github/workflows/expo-sdk-drift.yml`** — schedule + `workflow_dispatch` only
      (never `pull_request`, which would make merges depend on registry reachability),
      `concurrency` group, `permissions: {contents: read, issues: write}`, `NODE_VERSION: "24.x"`.

- [ ] **Weekly cron, off the hour** to avoid GitHub's peak-of-hour backlog.

- [ ] **Signal policy:** quiet while upstream is unchanged. File or update exactly one issue when a
      patched release or compatible Metro path appears, or when the exemption horizon needs a
      decision. Reuse a label so repeat runs update rather than multiply issues.

- [ ] **Assert the workflow cannot write the registry.**

```bash
grep -n "audit-exemptions" .github/workflows/image-size-advisory-watch.yml   # read-only refs only
node -e "const y=require('fs').readFileSync('.github/workflows/image-size-advisory-watch.yml','utf8'); if(/pull_request/.test(y)) throw new Error('must not trigger on PRs')"
```

- [ ] **Prove it can actually fire.** Run it with `workflow_dispatch` against a deliberately stale
      local horizon and confirm it reports; a monitor never observed failing is not a monitor.

---

## Task 3: Reach index migration

**Files:**
- Create: `infrastructure/postgres/migrations/20260813-provider-reach-index.sql`
- Modify: `infrastructure/postgres/init.sql` (regenerated)

- [ ] **Add the index**, guarded with `IF NOT EXISTS`.

```sql
CREATE INDEX IF NOT EXISTS idx_trust_scores_community_user
  ON reputation.trust_scores(community_id, user_id);
```

- [ ] **Regenerate and commit both files.**

```bash
bash scripts/regenerate-init-sql.sh
cd tests && npx jest regression/sprint-120-init-sql-drift-gate.test.ts
```

---

## Task 4: TDD — reach-gate tests FIRST (RED)

**Files:**
- Create: `services/request-service/tests/tdd/sprint-125-provider-reach-gate.test.ts`
- Create: `services/request-service/tests/unit/providerReachService.test.ts`

- [ ] **Write failing tests before any implementation.** Each of the three conditions gets a
      reject case AND an accept case:

| Condition | Must APPEAR | Must be ABSENT |
|---|---|---|
| `provider_services_enabled` | community opted in | community opted out; community with **no config row** |
| `provider_min_personal_trust_score` | provider score ≥ floor | provider score < floor; provider with **no trust row** and floor > 0 |
| `provider_services_list` | type in list; **list empty** | type not in list |

- [ ] **Plus the structural cases:** non-member viewer → `403`; anonymous → `401`; opted-out
      community → `200` with `data: []`, not an error; route resolves to the layer and not to
      `GET /:providerId`'s 404.

- [ ] **Confirm the tests are RED for the right reason** (endpoint missing), not a typo.

```bash
cd services/request-service && npx jest tests/tdd/sprint-125-provider-reach-gate.test.ts
```

---

## Task 5: Implement the reach gate

**Files:**
- Create: `services/request-service/src/services/providerReachService.ts`
- Modify: `services/request-service/src/routes/providers.ts`

- [ ] **Put the three-condition predicate in one place** so the route stays thin and the predicate
      is unit-testable.

- [ ] **Register `GET /community/:communityId` BEFORE `GET /:providerId` (`:315`).**

- [ ] **Verify the viewer's active membership live** before returning anything; `403` otherwise.

- [ ] **The query shape** — `LEFT JOIN` + `COALESCE`, empty list means all:

```sql
SELECT pp.*, u.name AS user_name, pts.trust_score
FROM requests.provider_profiles pp
JOIN communities.members pm
  ON pm.user_id = pp.user_id AND pm.community_id = $1 AND pm.status = 'active'
JOIN communities.community_configs c
  ON c.community_id = $1
LEFT JOIN reputation.trust_scores ts
  ON ts.user_id = pp.user_id AND ts.community_id = $1
LEFT JOIN auth.users u ON u.id = pp.user_id
LEFT JOIN reputation.provider_trust_scores pts ON pts.provider_id = pp.id
WHERE pp.is_active = TRUE
  AND c.provider_services_enabled = TRUE
  AND COALESCE(ts.score, 0) >= c.provider_min_personal_trust_score
  AND (cardinality(c.provider_services_list) = 0
       OR pp.service_type = ANY(c.provider_services_list))
ORDER BY pts.trust_score DESC NULLS LAST, pp.created_at DESC
LIMIT $2 OFFSET $3
```

- [ ] **Missing `community_configs` row → empty layer.** The inner join above already yields zero
      rows; assert that explicitly rather than relying on it incidentally.

- [ ] **Tests go GREEN.**

```bash
cd services/request-service && npx jest tests/tdd/sprint-125-provider-reach-gate.test.ts tests/unit/providerReachService.test.ts
```

---

## Task 6: Close the public directory

**Files:**
- Modify: `services/request-service/src/routes/providers.ts`
- Create: `tests/regression/sprint-125-provider-auth-gate.test.ts`

- [ ] **Write the rejection test first**: anonymous `GET /providers`, `GET /providers/:id`,
      `GET /providers/:id/rate-cards` each return `401`.

- [ ] **Add `authMiddleware`** to `:28`, `:158`, `:315`.

- [ ] **Delete `decodeOptionalViewer` (`:12-23`)** and simplify the `shared_communities` block at
      `:64-82` — the viewer is now always present, so the `if (viewer && ...)` guard collapses.

- [ ] **Verify no orphaned references** after the delete (CLAUDE.md pre-commit discipline).

```bash
grep -rn "decodeOptionalViewer" services/ apps/ packages/ --include=*.ts | grep -v node_modules | grep -v dist/
cd tests && npx jest regression/sprint-125-provider-auth-gate.test.ts
```

---

## Task 7: Frontend — community provider layer

**Files:**
- Create: `apps/frontend/src/components/community/tabs/ProvidersTab.tsx`
- Modify: `apps/frontend/src/lib/api/providerApi.ts`, `apps/frontend/src/lib/communityTabs.ts`

- [ ] **Add `getCommunityProviders(communityId, params)`.** The axios interceptor already unwraps —
      use `res.data`, not `res.data.data`.

- [ ] **Build `ProvidersTab`.** Empty state: "This community has not enabled provider services."
      Distinguish it from "no providers meet this community's standing requirement yet."

- [ ] **Register the tab**, visible only when `provider_services_enabled`.

- [ ] **Tests per the CLAUDE.md UI coverage table**: renders correctly; conditional render shows
      for enabled / hidden for disabled; API call mocked with correct payload; data fetch shows
      data and degrades gracefully on error.

```bash
cd apps/frontend && npx jest ProvidersTab
```

---

## Task 8: Frontend — make the admin switch honest

**Files:**
- Modify: `apps/frontend/src/components/community/tabs/ProfileTab.tsx`

- [ ] **Add helper text** stating what enabling actually does now that it does something.

- [ ] **Surface `provider_services_list` as an editable allowlist.** It is held in state at `:122`
      but has no editor; an empty list must be presented as "all service types".

- [ ] **Test** that the allowlist round-trips through the config API.

```bash
cd apps/frontend && npx jest ProfileTab
```

---

## Task 9: ADR-095 + user guides + landing docs

**Files:**
- Create: `docs/adr/ADR-095-authenticated-provider-directory-and-reach-gated-standing.md`
- Create: `apps/landing/src/data/docs/concepts/adr-095-authenticated-provider-directory.json`
- Modify: `docs/adr/README.md`, `docs/adr/ADR-041-...md`, `apps/landing/src/data/docs/nav.json`,
  `docs/guides/`, `apps/frontend/src/lib/onboarding/workflows.ts`

- [ ] **Write ADR-095** recording: (1) the directory requires auth — narrowing ADR-041's "Publicly
      visible" to "visible to any authenticated member, still not community-gated", with the
      verified finding that no unauthenticated consumer exists; (2) standing gates reach, not
      registration, so ADR-041's self-registration stands; (3) unknown standing fails closed at 0,
      explicitly noting the `trust_scores.score` DEFAULT 50 inconsistency is deferred.

- [ ] **Add a status note to ADR-041** pointing at ADR-095. It is **not** superseded.

- [ ] **Index ADR-095** in `docs/adr/README.md` (the drift gate requires every ADR indexed).

- [ ] **Landing pages** in the documented JSON shapes, each wired into `nav.json`.
      **Grep-verify `nav.json` after editing — it silently reverts.**

- [ ] **User guide + onboarding workflow** for enabling a community's provider layer.

```bash
grep -n "adr-095" apps/landing/src/data/docs/nav.json
cd tests && npx jest regression/doc-context-drift-gate.test.ts
```

---

## Task 10: CONTEXT.md + registry.json + integration test

**Files:**
- Modify: `services/request-service/CONTEXT.md`, `services/community-service/CONTEXT.md`,
  `services/registry.json`
- Create: integration coverage in `services/request-service/tests/integration/`

- [ ] **Update `request-service/CONTEXT.md`**: the new endpoint, the three now-authenticated
      routes, the reach gate. **Correct `:2989-2991`**, which currently describes the three columns
      as though they were enforced.

- [ ] **Update `community-service/CONTEXT.md`**: the config columns now have a named consumer.

- [ ] **Add the endpoint to `services/registry.json`** under `request-service.apis.provides`, and
      note the auth change on the three modified routes.

- [ ] **Integration test against a real DB** proving the gate rejects — RLS on, `setDbContext`
      called.

```bash
npm run feedback:check
npm run analyze:services     # only if dependencies changed
```

---

## Task 11: SDLC quality gates

- [ ] **`/simplify`** on the branch diff — one pass, calibrated to diff size.
- [ ] **`/code-review`** on the branch diff — **high** effort (this diff changes an authorization
      surface). Resolve every correctness finding before merge.
- [ ] **`/security-review`** on the branch diff. Pay specific attention to: the new endpoint's
      membership check, whether any provider field leaks across communities, and whether the
      `403`/`401`/empty-layer distinction leaks community existence to non-members.
- [ ] Findings resolved, or dismissed **with written justification**.

---

## Task 12: Final verification

- [ ] **Type check every touched workspace.**

```bash
npx tsc --noEmit -p services/request-service
npx tsc --noEmit -p apps/frontend
```

- [ ] **Full blocking suite + advisory checks.**

```bash
npm test
npm run feedback:check
node scripts/audit-exemptions.js
```

- [ ] **Revert generated landing-doc churn** (timestamps / HEAD sha) before committing.

- [ ] **Confirm hooks are actually installed** — a push that finishes silently and instantly means
      no hook ran.

```bash
git config core.hooksPath && ls .husky/
```

- [ ] **Reconcile `CURRENT_HANDOFF.md`** against real state before claiming done.

---

## Task 13: Merge + Deploy

- [ ] Open the PR with the required contract headers.
- [ ] CI green: unit + regression, dependency audit (ADR-059), CodeQL (ADR-060), PR contract,
      doc/context drift gate.
- [ ] **Explicit maintainer authorization is required to merge.** `--admin` override needs its own
      explicit authorization each time.
- [ ] Merge to master → GitHub Actions builds ARM64, deploys, verifies health, rolls back on
      failure. Use the `/deploy` skill.
- [ ] Post-deploy smoke test: `POST /api/auth/login`, then the new endpoint against a real
      community with provider services enabled and disabled.
- [ ] Update the handoff and archive it if the sprint ships.
