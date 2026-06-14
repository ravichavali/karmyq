# Trust Truth Audit + Functional Repairs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking. Run `/simplify` after each implementation task.

**Goal:** Make Karmyq's trust paths, graphs, relationship labels, and normal trust-dependent flows
accurate from DB truth through API responses to the frontend.

**Architecture:** Sprint 98 starts with a live/demo trust audit, then fixes confirmed semantic drift
in the social-graph service, request-service relationship consumers, and frontend trust surfaces.
The first concrete social-graph hypothesis is that missing community context can make `/paths`
compare the string `platform` to a UUID cache column and 500 before relationship semantics are
reached. No new product table is planned; any data repair must be idempotent and documented.

**Tech Stack:** Node.js/Express/TypeScript, Next.js 14, PostgreSQL 15, Bull queue.

---

## File Map

### New files to create
| File | Responsibility |
|------|----------------|
| `docs/bugs/sprint-98-trust-truth-audit.md` | Sprint audit findings, named bugs, root-cause notes, fixed/deferred decisions, and live validation evidence. |
| `scripts/audit-trust-truth.sql` | Repeatable DB audit for trust edge membership, graph/path cache drift, provider shared communities, dibs relationship truth, and dashboard feed data. |
| `services/social-graph-service/tests/tdd/sprint-98-trust-path-context.test.ts` | DB-backed tests for community-scoped versus platform-wide path semantics and cache keys. |
| `services/social-graph-service/tests/tdd/sprint-98-trust-graph-membership.test.ts` | Tests for graph node/link active-membership invariants. |
| `services/request-service/tests/tdd/sprint-98-relationship-labels.test.ts` | Tests for provider shared communities and dibs relationship reason truth. |
| `apps/frontend/tests/tdd/sprint-98-trust-path-context.test.tsx` | Tests that frontend surfaces pass community context to trust path requests. |
| `apps/frontend/tests/tdd/sprint-98-feed-caught-up-show-more.test.tsx` | Test that dashboard feed does not show caught-up and show-more states together. |
| `infrastructure/postgres/migrations/20260614-trust-truth-repair.sql` | Optional only if demo data requires deploy-time idempotent repair. |

### Existing files to modify
| File | Change |
|------|--------|
| `services/social-graph-service/src/services/pathComputation.ts` | Clarify and fix community-scoped path computation if audit confirms drift. |
| `services/social-graph-service/src/routes/paths.ts` | Honor `X-Community-ID`, align single and batch path semantics, and avoid stale cache meaning. |
| `services/social-graph-service/src/routes/trustCard.ts` | Use the same community/path semantics as `/paths`. |
| `services/social-graph-service/src/database/trustEdgeDb.ts` | Fix graph membership or decayed-weight invariants if audit confirms drift. |
| `apps/frontend/src/lib/api.ts` | Allow trust path/batch/trust-card calls to pass community context. |
| `apps/frontend/src/hooks/useTrustPath.ts` | Accept optional community context and parse local user defensively. |
| `apps/frontend/src/components/Feed/RequestCard.tsx` | Pass community context and use approved relationship wording. |
| `apps/frontend/src/components/Feed/UnifiedFeed.tsx` | Fix caught-up/show-more contradiction while preserving widened-feed terminal copy. |
| `apps/frontend/src/components/requests/DibsPrompt.tsx` | Align copy with server relationship reasons. |
| `apps/frontend/src/components/providers/ProviderCard.tsx` and provider pages | Keep shared-community labels distinct from exchange trust. |
| `services/request-service/src/routes/dibs.ts`, `services/request-service/src/db/dibsDb.ts` | Fix relationship reason data if audit confirms drift. |
| `services/request-service/src/routes/providers.ts` | Fix shared-community active-membership filtering if audit confirms drift. |
| `docs/guides/trust-connections.md` | Define relationship labels and semantics. |
| `docs/guides/trust-graph.md` | Document graph inclusion/exclusion rules. |
| `docs/guides/dashboard-home.md` | Document caught-up/show-more behavior. |
| `docs/guides/demo-data.md` | Add Sprint 98 trust audit checklist. |
| `docs/features/SOCIAL_GRAPH_TRUST_PATHS.md` | Update if path semantics change or fallback is clarified. |
| `services/social-graph-service/CONTEXT.md` | Document recent trust path/graph fixes. |
| `services/request-service/CONTEXT.md` | Document request/provider/dibs relationship fixes. |
| `apps/frontend/CONTEXT.md` | Document trust path context and feed-state fixes. |
| `services/registry.json` | Update only if endpoint descriptions change. |
| `apps/landing/src/data/docs/*` | Generated docs output after source guide updates. |
| `package.json`, `package-lock.json` | Version bump `11.6.0` -> `11.7.0`. |
| `.claude/handoff/CURRENT_HANDOFF.md` | Track execution progress and final validation evidence. |

---

## Critical Implementation Notes

1. **Audit first.** Do not fix individual trust surfaces before running the DB/API/UI trust audit.
   The likely problem is semantic drift across layers, not one component typo.
2. **Find the root cause before fixing.** Use systematic debugging for each confirmed issue:
   reproduce, trace source data, compare working surfaces, then write the failing test.
3. **Community context is the main suspect.** Every path/badge/graph fix must answer whether the
   relationship is community-scoped or platform-wide and label it accordingly.
4. **Do not make client-side filters hide server truth.** If an API returns misleading relationship
   data, fix the API or explicitly document the historical/platform meaning.
5. **Use decayed trust consistently.** Graph node/edge trust metrics should read from
   `social_graph.trust_edges_live` unless a test proves a different metric is intentional.
6. **Active membership matters.** Any UI phrase that says "in this community" or "fellow member"
   must be backed by active `communities.members` rows.
7. **Cache invalidation matters.** `auth.social_distances` can preserve old path meaning. Include
   cache rows in the audit and clear/recompute only with an idempotent script if needed.
8. **Provider labels are not exchange trust.** Shared provider/community labels should not imply a
   completed help exchange unless the exchange path exists.
9. **Dashboard feed state must be coherent.** "You're caught up" and "Show more open requests"
   should not appear together as competing terminal states.
10. **Robust tests are required.** Prefer DB-backed tests for path and graph invariants. Mock only
   browser rendering and external services.
11. **Live demo validation is required.** Use `maria.reyes@test.karmyq.com` / `password123` as the
   rich tester unless the audit finds a better account.
12. **Version bump:** root `package.json` and `package-lock.json` move `11.6.0` -> `11.7.0`.

---

## Task 1: Branch, bug log, and trust audit SQL

**Files:**
- Create: `docs/bugs/sprint-98-trust-truth-audit.md`
- Create: `scripts/audit-trust-truth.sql`

- [ ] Create the feature branch from current `master`.

```bash
git checkout -b feature/sprint-98-trust-truth-audit
```

- [ ] Create the bug log with the named bugs and an audit-results section.

```markdown
# Sprint 98 Trust Truth Audit

**Date opened:** 2026-06-14
**Release target:** v11.7.0
**Primary tester:** `maria.reyes@test.karmyq.com` / `password123`

## Named Bugs

| ID | Severity | Area | Finding | Decision |
|---|---|---|---|---|
| BUG-098-001 | High | Trust paths | Community context can drift from visible surface. | Audit first |
| BUG-098-002 | High | Path computation | Exchange path graph may be platform-wide while scoring/cache is community-scoped. | Audit first |
| BUG-098-003 | High | Graph APIs | Graph nodes/links may not prove active membership for claimed scope. | Audit first |
| BUG-098-004 | Medium | Relationship labels | UI labels use multiple relationship meanings. | Fix confirmed drift |
| BUG-098-005 | Low | Dashboard feed | "You're caught up" can appear with "Show more open requests." | Fix |
| BUG-098-006 | Low | Legacy endpoints | `/network` may still be reachable but no longer authoritative. | Audit/document |

## Relationship Semantics

| Label | Backing truth |
|---|---|
| Direct exchange connection | Completed help exchange path of degree 1. |
| Indirect exchange path | Completed help exchange path of degree 2 or 3. |
| Fellow community member | Shared active community membership, no exchange proof implied. |
| Invitation connection | Accepted invitation lineage. |
| Shared provider/community context | Provider and viewer share active community membership. |

## Audit Findings

Paste live/demo output summaries here before implementation.
```

- [ ] Create `scripts/audit-trust-truth.sql` with these checks:

```sql
\echo '1. Trust edges whose endpoints are not active members of edge community'
SELECT te.community_id, c.name AS community_name, te.user_id_a, ua.email AS user_a_email,
       te.user_id_b, ub.email AS user_b_email, te.raw_weight
FROM social_graph.trust_edges te
JOIN communities.communities c ON c.id = te.community_id
JOIN auth.users ua ON ua.id = te.user_id_a
JOIN auth.users ub ON ub.id = te.user_id_b
LEFT JOIN communities.members ma
  ON ma.community_id = te.community_id AND ma.user_id = te.user_id_a AND ma.status = 'active'
LEFT JOIN communities.members mb
  ON mb.community_id = te.community_id AND mb.user_id = te.user_id_b AND mb.status = 'active'
WHERE ma.id IS NULL OR mb.id IS NULL
ORDER BY c.name, te.raw_weight DESC;

\echo '2. exchange social_graph.connections without a completed match between the users'
SELECT sg.user_a_id, ua.email AS user_a_email, sg.user_b_id, ub.email AS user_b_email, sg.type
FROM social_graph.connections sg
JOIN auth.users ua ON ua.id = sg.user_a_id
JOIN auth.users ub ON ub.id = sg.user_b_id
WHERE sg.type = 'exchange'
  AND NOT EXISTS (
  SELECT 1
  FROM requests.matches m
  JOIN requests.help_requests hr ON hr.id = m.request_id
  WHERE m.status = 'completed'
    AND (
      (hr.requester_id = sg.user_a_id AND m.responder_id = sg.user_b_id)
      OR (hr.requester_id = sg.user_b_id AND m.responder_id = sg.user_a_id)
    )
)
ORDER BY ua.email, ub.email;

\echo '3. Cached social distances with missing, expired, or suspicious community context'
SELECT sd.user_a_id, ua.email AS user_a_email, sd.user_b_id, ub.email AS user_b_email,
       sd.community_id, sd.degrees_of_separation, sd.connection_type, sd.expires_at
FROM auth.social_distances sd
JOIN auth.users ua ON ua.id = sd.user_a_id
JOIN auth.users ub ON ub.id = sd.user_b_id
WHERE sd.community_id IS NULL
   OR sd.expires_at <= NOW()
   OR NOT EXISTS (
     SELECT 1
     FROM communities.communities c
     WHERE c.id = sd.community_id
   )
ORDER BY sd.computed_at DESC
LIMIT 100;

\echo '4. Provider shared-community candidates that are not active on both sides'
SELECT pp.id AS provider_id, viewer.email AS viewer_email, provider_user.email AS provider_email,
       cm_provider.community_id
FROM requests.provider_profiles pp
JOIN auth.users provider_user ON provider_user.id = pp.user_id
JOIN communities.members cm_provider ON cm_provider.user_id = pp.user_id
JOIN communities.members cm_viewer ON cm_viewer.community_id = cm_provider.community_id
JOIN auth.users viewer ON viewer.id = cm_viewer.user_id
WHERE cm_provider.status <> 'active' OR cm_viewer.status <> 'active'
LIMIT 100;

\echo '5. Dibs community_connection candidates with no active shared community'
SELECT m.request_id, hr.requester_id, m.responder_id
FROM requests.matches m
JOIN requests.help_requests hr ON hr.id = m.request_id
WHERE m.admin_proposed = TRUE
  AND NOT EXISTS (
    SELECT 1
    FROM communities.members requester_member
    JOIN communities.members responder_member
      ON responder_member.community_id = requester_member.community_id
     AND responder_member.user_id = m.responder_id
     AND responder_member.status = 'active'
    WHERE requester_member.user_id = hr.requester_id
      AND requester_member.status = 'active'
  )
LIMIT 100;
```

- [ ] Run the audit against demo and paste summarized results into the bug log.

```bash
scp scripts/audit-trust-truth.sql ubuntu@karmyq.com:/tmp/audit-trust-truth.sql
ssh ubuntu@karmyq.com "docker cp /tmp/audit-trust-truth.sql karmyq-postgres:/tmp/audit-trust-truth.sql && docker exec karmyq-postgres sh -c 'PGPASSWORD=$POSTGRES_PASSWORD psql -U \"$POSTGRES_USER\" -d \"$POSTGRES_DB\" -f /tmp/audit-trust-truth.sql'"
```

- [ ] Run `/simplify` on the audit script and bug log.

---

## Task 2: API smoke audit for rich tester trust surfaces

**Files:**
- Modify: `docs/bugs/sprint-98-trust-truth-audit.md`

- [ ] Login as `maria.reyes@test.karmyq.com` and capture a token.

- [ ] API-smoke these endpoints with at least one known community and two known target users from
  the audit:

```bash
curl -H "Authorization: Bearer $TOKEN" -H "X-Community-ID: $COMMUNITY_ID" \
  "https://karmyq.com/api/paths/$TARGET_USER_ID"

curl -X POST -H "Authorization: Bearer $TOKEN" -H "X-Community-ID: $COMMUNITY_ID" \
  -H "Content-Type: application/json" \
  -d "{\"target_user_ids\":[\"$TARGET_USER_ID\"]}" \
  "https://karmyq.com/api/paths/batch"

curl -H "Authorization: Bearer $TOKEN" \
  "https://karmyq.com/api/trust/graph/$COMMUNITY_ID"

curl -H "Authorization: Bearer $TOKEN" \
  "https://karmyq.com/api/trust/graph/$COMMUNITY_ID/full"
```

- [ ] Probe the concrete missing-context failure mode. This request intentionally omits
  `X-Community-ID`.

```bash
curl -i -H "Authorization: Bearer $TOKEN" \
  "https://karmyq.com/api/paths/$TARGET_USER_ID"
```

Expected before fixes may be `500` if the route passes the literal string `platform` into the UUID
`auth.social_distances.community_id` lookup. Record the status and response body in the bug log.

- [ ] Record whether single path, batch path, trust-card, and graph data agree on relationship
  meaning.

- [ ] Run `/simplify` before implementation work.

---

## Task 3: TDD - social graph path context and cache semantics

**Files:**
- Create: `services/social-graph-service/tests/tdd/sprint-98-trust-path-context.test.ts`
- Implementation targets: `services/social-graph-service/src/services/pathComputation.ts`,
  `services/social-graph-service/src/routes/paths.ts`

- [ ] Write DB-backed tests with exact fixtures:
  - user A and user B have a completed exchange in community 1.
  - user A and user B share active membership in community 2 but have no completed exchange there.
  - `computeTrustPath(A, B, community1)` returns `connectionType='exchange'`, `degrees=1`.
  - `computeTrustPath(A, B, community2)` returns either the approved community-scoped result or a
    clearly labeled platform fallback, matching the design decision.
  - cached `auth.social_distances` rows are keyed by the same explicit community context.
  - a route request with no `X-Community-ID` and no `currentCommunityId` never passes the string
    `platform` to a UUID `community_id` query and does not return an accidental 500.

- [ ] Run the focused test and confirm it fails before implementation.

```bash
cd services/social-graph-service
npm run test:tdd -- sprint-98-trust-path-context.test.ts
```

- [ ] Run `/simplify`.

---

## Task 4: Fix social graph path context

**Files:**
- Modify: `services/social-graph-service/src/services/pathComputation.ts`
- Modify: `services/social-graph-service/src/routes/paths.ts`
- Modify: `services/social-graph-service/src/routes/trustCard.ts`
- Test: `services/social-graph-service/tests/tdd/sprint-98-trust-path-context.test.ts`

- [ ] Implement the approved path semantic from the spec. Preferred behavior:
  community-scoped exchange paths when `communityId` is a real UUID; platform-wide fallback only
  when no community context exists.

- [ ] Make `/paths/:targetUserId`, `/paths/batch`, and `/trust-card/:targetUserId` use the same
  community-context resolver.

- [ ] Preserve backward compatibility for callers without a community header by labeling fallback
  responses clearly.

- [ ] Run focused tests.

```bash
cd services/social-graph-service
npm run test:tdd -- sprint-98-trust-path-context.test.ts
```

- [ ] Run social-graph service tests.

```bash
cd services/social-graph-service
npm test
```

- [ ] Run `/simplify` on the social-graph path diff.

---

## Task 5: TDD - graph active-membership invariants

**Files:**
- Create: `services/social-graph-service/tests/tdd/sprint-98-trust-graph-membership.test.ts`
- Implementation target: `services/social-graph-service/src/database/trustEdgeDb.ts`

- [ ] Write tests for:
  - community ego graph excludes or labels trust-edge neighbors who are not active members of the
    requested community.
  - full community graph returns active members only.
  - aggregate graph includes only relationships from the caller's active communities.
  - node trust scores and link weights use decayed `current_weight` values.

- [ ] Run the focused test and confirm any current drift fails.

```bash
cd services/social-graph-service
npm run test:tdd -- sprint-98-trust-graph-membership.test.ts
```

- [ ] Run `/simplify`.

---

## Task 6: Fix graph invariants, if confirmed

**Files:**
- Modify: `services/social-graph-service/src/database/trustEdgeDb.ts`
- Modify: `services/social-graph-service/src/routes/trustGraph.ts`
- Test: `services/social-graph-service/tests/tdd/sprint-98-trust-graph-membership.test.ts`

- [ ] If tests reveal non-member nodes or edges in community-scoped graphs, add active-membership
  joins at the DB query layer.

- [ ] If tests reveal metric drift, switch the affected aggregate to `trust_edges_live.current_weight`
  and document the exact semantic.

- [ ] If the product deliberately wants historical edges, add an explicit response flag such as
  `relationshipScope: 'historical'` only after documenting that decision.

- [ ] Run graph tests and service tests.

```bash
cd services/social-graph-service
npm run test:tdd -- sprint-98-trust-graph-membership.test.ts
npm test
```

- [ ] Run `/simplify`.

---

## Task 7: TDD - request-service relationship labels

**Files:**
- Create: `services/request-service/tests/tdd/sprint-98-relationship-labels.test.ts`
- Implementation targets: `services/request-service/src/routes/providers.ts`,
  `services/request-service/src/routes/dibs.ts`, `services/request-service/src/db/dibsDb.ts`

- [ ] Test provider shared communities:
  - viewer and provider both active in community A -> returned in `shared_communities`.
  - provider inactive or viewer inactive -> not returned.

- [ ] Test dibs reason derivation:
  - prior completed similar match -> `prior_similar_success`.
  - prior completed match in a different category -> `trusted_neighbor`.
  - provider match -> `provider_match`.
  - zero prior completed matches plus active shared community admission -> `community_connection`.
  - no active shared community -> no `community_connection` label.

- [ ] Run the focused test and confirm drift fails.

```bash
cd services/request-service
npm run test:tdd -- sprint-98-relationship-labels.test.ts
```

- [ ] Run `/simplify`.

---

## Task 8: Fix request-service relationship semantics

**Files:**
- Modify: `services/request-service/src/routes/providers.ts`
- Modify: `services/request-service/src/routes/dibs.ts`
- Modify: `services/request-service/src/db/dibsDb.ts`
- Modify: `services/request-service/src/services/dibsReason.ts`
- Test: `services/request-service/tests/tdd/sprint-98-relationship-labels.test.ts`

- [ ] Fix provider shared-community queries to require active membership for both viewer and
  provider.

- [ ] Fix dibs candidate data so `community_connection` only means active shared community, not a
  hidden proxy for prior work.

- [ ] Keep server reasons authoritative; do not recreate reason logic in the frontend.

- [ ] Run focused and service tests.

```bash
cd services/request-service
npm run test:tdd -- sprint-98-relationship-labels.test.ts
npm test
```

- [ ] Run `/simplify`.

---

## Task 9: TDD - frontend passes trust path community context

**Files:**
- Create: `apps/frontend/tests/tdd/sprint-98-trust-path-context.test.tsx`
- Implementation targets: `apps/frontend/src/hooks/useTrustPath.ts`,
  `apps/frontend/src/lib/api.ts`, `apps/frontend/src/components/Feed/RequestCard.tsx`

- [ ] Test that a community-scoped request card passes `X-Community-ID` to the trust path API.

- [ ] Test that a provider/shared-community surface does not label shared membership as an exchange
  connection.

- [ ] Test localStorage parse failure does not crash `useTrustPath`.

- [ ] Run the focused test and confirm it fails before implementation.

```bash
cd apps/frontend
npm run test:tdd -- sprint-98-trust-path-context.test.tsx --runInBand
```

- [ ] Run `/simplify`.

---

## Task 10: Fix frontend trust context and copy

**Files:**
- Modify: `apps/frontend/src/lib/api.ts`
- Modify: `apps/frontend/src/hooks/useTrustPath.ts`
- Modify: `apps/frontend/src/components/Feed/RequestCard.tsx`
- Modify: `apps/frontend/src/components/requests/DibsPrompt.tsx`
- Modify: `apps/frontend/src/components/providers/ProviderCard.tsx`
- Optional modify: provider detail pages that render `TrustPathBadge`
- Test: `apps/frontend/tests/tdd/sprint-98-trust-path-context.test.tsx`

- [ ] Extend social-graph API wrappers to accept optional `communityId` headers.

- [ ] Update `useTrustPath(targetUserId, { communityId })` and keep old call sites working.

- [ ] Pass the visible community context from feed/request surfaces.

- [ ] Align DibsPrompt/provider copy with the relationship semantics table.

- [ ] Run focused frontend test and unit tests.

```bash
cd apps/frontend
npm run test:tdd -- sprint-98-trust-path-context.test.tsx --runInBand
npm run test:unit
```

- [ ] Run `/simplify`.

---

## Task 11: TDD - caught-up and show-more are mutually coherent

**Files:**
- Create: `apps/frontend/tests/tdd/sprint-98-feed-caught-up-show-more.test.tsx`
- Implementation target: `apps/frontend/src/components/Feed/UnifiedFeed.tsx`

- [ ] Write tests for:
  - initial feed with hidden lower-ranked asks shows "Show more open requests" but not "You're
    caught up."
  - genuinely empty/finite feed shows caught-up copy but not "Show more open requests."
  - after clicking show more, the feed shows one terminal state.

- [ ] Run the focused test and confirm it fails before implementation.

```bash
cd apps/frontend
npm run test:tdd -- sprint-98-feed-caught-up-show-more.test.tsx --runInBand
```

- [ ] Run `/simplify`.

---

## Task 12: Fix caught-up/show-more dashboard feed state

**Files:**
- Modify: `apps/frontend/src/components/Feed/UnifiedFeed.tsx`
- Test: `apps/frontend/tests/tdd/sprint-98-feed-caught-up-show-more.test.tsx`

- [ ] Refactor the feed terminal-state branching so "caught up" and "show more" are mutually
  exclusive before expansion.

- [ ] Preserve Sprint 97 behavior: after expansion, the widened feed ends with a finite terminal
  note.

- [ ] Run focused frontend tests.

```bash
cd apps/frontend
npm run test:tdd -- sprint-98-feed-caught-up-show-more.test.tsx --runInBand
```

- [ ] Run `/simplify`.

---

## Task 13: Legacy endpoint audit and data repair decision

**Files:**
- Modify: `docs/bugs/sprint-98-trust-truth-audit.md`
- Optional create: `infrastructure/postgres/migrations/20260614-trust-truth-repair.sql`
- Optional modify: `services/social-graph-service/src/routes/network.ts`
- Optional modify: `apps/frontend/src/lib/api.ts`

- [ ] Use `rg` to find all `/network`, `getNetwork`, `social_graph.connections`, and
  `auth.social_distances` consumers.

- [ ] If `/network` has no active frontend consumer, document it as legacy or remove the unused
  frontend wrapper. Do not delete the backend route unless tests and docs prove it is safe.

- [ ] If audit reveals data drift that must be repaired, create an idempotent repair script and
  re-run the audit.

- [ ] Run `/simplify`.

---

## Task 14: Docs, generated landing docs, contexts, version bump

**Files:**
- Modify: `docs/guides/trust-connections.md`
- Modify: `docs/guides/trust-graph.md`
- Modify: `docs/guides/dashboard-home.md`
- Modify: `docs/guides/demo-data.md`
- Optional modify: `docs/features/SOCIAL_GRAPH_TRUST_PATHS.md`
- Modify: `services/social-graph-service/CONTEXT.md`
- Modify: `services/request-service/CONTEXT.md`
- Modify: `apps/frontend/CONTEXT.md`
- Optional modify: `services/registry.json`
- Generated modify: `apps/landing/src/data/docs/*`
- Modify: `package.json`, `package-lock.json`
- Modify: `.claude/handoff/CURRENT_HANDOFF.md`

- [ ] Update user guides and contexts with the final relationship semantics.

- [ ] Update `services/registry.json` only if endpoint descriptions changed.

- [ ] Regenerate landing docs.

```bash
npm run build --workspace apps/landing
```

- [ ] Force-add changed generated docs.

```bash
git add -f apps/landing/src/data/docs
```

- [ ] Bump root version `11.6.0` -> `11.7.0`.

- [ ] Update handoff with execution progress and any deferred findings.

- [ ] Run `/simplify`.

---

## Task 15: SDLC quality gates

**Files:**
- Entire branch diff.

- [ ] Run final `/simplify` on the whole diff.

```bash
git diff --stat
```

- [ ] Run `/code-review` on the branch diff and resolve correctness findings.

```bash
git diff -- apps/frontend services/social-graph-service services/request-service docs scripts infrastructure
```

- [ ] Run `/security-review` on the branch diff and resolve real findings. Record false positives
  in the PR body.

```bash
npm audit --package-lock-only --audit-level=high
```

- [ ] Run the new TDD tests directly, not only through Turbo cache.

```bash
cd services/social-graph-service
npm run test:tdd -- sprint-98-trust-path-context.test.ts sprint-98-trust-graph-membership.test.ts

cd ../../services/request-service
npm run test:tdd -- sprint-98-relationship-labels.test.ts

cd ../../apps/frontend
npm run test:tdd -- sprint-98-trust-path-context.test.tsx sprint-98-feed-caught-up-show-more.test.tsx --runInBand
```

---

## Task 16: Final verification

**Files:**
- Entire branch.

- [ ] Type-check.

```bash
npx tsc --noEmit
```

- [ ] Run unit + regression tests.

```bash
npm test
```

- [ ] Run TDD suite.

```bash
npm run test:tdd
```

- [ ] Run feedback check.

```bash
npm run feedback:check
```

- [ ] Run service analysis if `services/registry.json` or service dependencies changed.

```bash
npm run analyze:services
```

- [ ] Update the bug log with final fixed/deferred status.

---

## Task 17: Merge + Deploy

**Files:**
- PR body: `.github/pull_request_template.md`
- Handoff: `.claude/handoff/CURRENT_HANDOFF.md`

- [ ] Create a PR from `feature/sprint-98-trust-truth-audit` to `master`.
  `gh pr create` does not auto-apply the template, so copy `.github/pull_request_template.md`
  into the PR body and fill every section.

- [ ] Complete cross-agent review, `/code-review`, and `/security-review`.

- [ ] After Admin authorization, merge to `master` and push. CI/CD is the primary deploy path.

- [ ] Monitor GitHub Actions until v11.7.0 deploy is green.

- [ ] If a repair migration/script was created, confirm it applied and re-run
  `scripts/audit-trust-truth.sql`.

---

## Task 18: Sprint 98 Post-Deploy Validation (Human Checklist)

### 1. API trust path smoke

```bash
curl -H "Authorization: Bearer $TOKEN" -H "X-Community-ID: $COMMUNITY_ID" \
  "https://karmyq.com/api/paths/$TARGET_USER_ID" | jq '.data'
```

Expected: path relationship type and community/platform scope match the semantics table.

### 2. Graph membership smoke

```bash
curl -H "Authorization: Bearer $TOKEN" \
  "https://karmyq.com/api/trust/graph/$COMMUNITY_ID" | jq '.data.nodes | length'
```

Expected: community graph nodes/links match active membership rules documented in the bug log.

### 3. UI flow check

Login as:

```text
maria.reyes@test.karmyq.com / password123
```

Expected: dashboard trust network loads, community "How we're connected" agrees with People
membership, feed badges use correct relationship terms, and provider/dibs surfaces do not imply
exchange trust where only shared membership exists.

### 4. Dashboard feed check

On Dashboard Home, inspect the empty/caught-up state and "Show more open requests."

Expected: "You're caught up" and "Show more open requests" do not appear together. After expanding,
the feed ends with one finite terminal state.

### 5. DB audit

```bash
ssh ubuntu@karmyq.com "docker cp /tmp/audit-trust-truth.sql karmyq-postgres:/tmp/audit-trust-truth.sql && docker exec karmyq-postgres sh -c 'PGPASSWORD=$POSTGRES_PASSWORD psql -U \"$POSTGRES_USER\" -d \"$POSTGRES_DB\" -f /tmp/audit-trust-truth.sql'"
```

Expected: no release-blocking trust truth drift remains, or every remaining row is explicitly
documented as historical/deferred in `docs/bugs/sprint-98-trust-truth-audit.md`.
