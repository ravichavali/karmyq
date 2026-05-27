# Sprint 69: Fission Mechanism — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build the complete community fission lifecycle — size-triggered auto-suggest, admin split proposal with trust-graph-driven member clustering, prestige-weighted community vote, and executed split that creates two child communities with a `split_origin` community link.

**Architecture:** Three new DB tables (`split_proposals`, `split_votes`, `split_member_assignments`) owned by community-service. The greedy bisection algorithm runs inside community-service by cross-schema-querying `social_graph.trust_edges_live` directly — no new social-graph-service endpoint needed.

**Tech Stack:** Node.js/Express/TypeScript, Next.js 14, PostgreSQL 15, Bull queue.

---

## File Map

### New files to create

| File | Responsibility |
|------|---------------|
| `infrastructure/postgres/migrations/20260527-fission.sql` | Three new tables: split_proposals, split_votes, split_member_assignments |
| `services/community-service/src/routes/splits.ts` | All 6 split-related route handlers |
| `services/community-service/src/database/splitsDb.ts` | DB query functions for proposals, votes, assignments |
| `services/community-service/src/services/fissionService.ts` | Clustering algorithm + execute-split transaction |
| `apps/frontend/src/components/community/tabs/FissionTab.tsx` | State-machine UI: propose → assign → vote → execute → done |
| `apps/frontend/src/components/FissionProposalModal.tsx` | Admin modal: group names + rationale form |
| `apps/frontend/src/components/FissionAssignmentView.tsx` | Member assignment table with toggle buttons |
| `docs/adr/ADR-057-fission-mechanism.md` | Architecture decision: algorithm choice + lifecycle |
| `apps/landing/src/data/docs/concepts/adr-057-fission-mechanism.json` | Landing page ADR entry |
| `apps/landing/src/data/docs/guides/community-fission.json` | User guide: "Splitting a Community" |
| `services/community-service/tests/tdd/sprint-69-fission.test.ts` | TDD: clustering algorithm + execute atomicity |

### Existing files to modify

| File | Change |
|------|--------|
| `infrastructure/postgres/migrations/20260527-fission.sql` | (new — listed above) |
| `services/community-service/src/index.ts` | Mount splits router at `/communities` |
| `services/community-service/src/routes/communities.ts` | Add `size_alert` + `active_split_proposal` to GET /communities/:id |
| `apps/frontend/src/components/CommunityHeader.tsx` | Render `SizeAlertBanner` when `size_alert` non-null |
| `apps/frontend/src/pages/communities/index.tsx` | Add FissionTab to tab list (admin-gated or when proposal active) |
| `services/community-service/CONTEXT.md` | Document new endpoints + tables |
| `services/registry.json` | Add 7 new community-service endpoints |
| `apps/landing/src/data/docs/services/community-service.json` | Add new endpoints |
| `apps/landing/src/data/nav.json` | Add fission guide + ADR-057 entries |
| `scripts/generate-docs.ts` | Add `community-fission` and `adr-057-fission-mechanism` to hardcoded slug list |
| `docs/adr/ADR-018-community-splitting-mechanics.md` | Update Phase 2 to Implemented; link to ADR-057 |

---

## ⚠️ Critical Implementation Notes (read before Task 2)

1. **`trust_edges_live` is read-only.** It is a VIEW. Clustering reads from it; never write to it. All trust_edge writes go to `trust_edges`.

2. **JWT field is `communities`, not `communityMemberships`.** Admin check in splits.ts must use `user.communities ?? []` and check `m.role === 'admin'`.

3. **Parent community is NOT deleted on execute.** Set `status='split'`. Karma records, requests, and history reference the parent ID. Members are added to child communities; the parent row persists.

4. **`UNIQUE (community_id, status)` constraint caveat.** Prevents two active proposals. Also prevents a second proposal after execution (two `executed` rows). Demo-scope acceptable; document it.

5. **Clustering runs at proposal creation time only.** Result stored in `split_member_assignments`. Does not re-run when admin adjusts. Intentional.

6. **Landing page docs are in `.gitignore`.** Always `git add -f apps/landing/src/data/docs/` when staging.

7. **nav.json silently reverts.** Add new slugs to hardcoded list in `scripts/generate-docs.ts` — not just to nav.json directly.

8. **TDD tests go in `services/community-service/tests/tdd/`** — not the root `tests/tdd/`.

9. **ADR-057 is next.** Verify by `ls docs/adr/ | sort | tail -5` before creating.

10. **Unassigned members at execute time** are auto-assigned to the smaller group before the transaction proceeds.

---

## Task 1: Feature branch + DB migration

**Files:**
- Create: `infrastructure/postgres/migrations/20260527-fission.sql`

- [ ] **Create the feature branch**

```bash
git checkout -b feature/sprint-69-fission
```

- [ ] **Write the migration** — three tables: `community.split_proposals`, `community.split_votes`, `community.split_member_assignments` plus indexes. Full DDL is in the design spec.

- [ ] **Run the migration against local DB**

```bash
# From infrastructure/postgres/migrations/
psql $DATABASE_URL -f 20260527-fission.sql
# OR via the run-migration script
.\run-migration.bat 20260527-fission.sql
```

- [ ] **Verify tables exist**

```bash
psql $DATABASE_URL -c "\dt community.split*"
# Should list: split_proposals, split_votes, split_member_assignments
```

---

## Task 2: Fission service — clustering algorithm

**Files:**
- Create: `services/community-service/src/services/fissionService.ts`
- Create: `services/community-service/src/database/splitsDb.ts`

- [ ] **Create `splitsDb.ts`** with query functions:
  - `getProposal(splitId)` → full proposal row
  - `getActiveSplitProposal(communityId)` → proposal where status not in ('executed', 'rejected')
  - `getAssignments(splitId)` → all member assignment rows for a proposal
  - `getVotes(splitId)` → all votes with prestige_weight
  - `insertProposal(data)` → INSERT returning id
  - `insertAssignments(proposalId, assignments[])` → bulk INSERT
  - `updateAssignments(proposalId, changes[])` → UPDATE assigned_to + admin_overridden=true
  - `insertVote(proposalId, userId, vote, prestigeWeight)` → INSERT or UPDATE
  - `updateProposalStatus(splitId, status, extra?)` → UPDATE status + optional fields

- [ ] **Create `fissionService.ts`** with two exports:

  **`clusterCommunityMembers(communityId, pool)`** — greedy bisection:
  ```typescript
  // 1. Fetch members: SELECT user_id FROM community.members WHERE community_id=$1 AND status='active'
  // 2. Fetch trust edges: SELECT user_id_a, user_id_b, effective_weight FROM social_graph.trust_edges_live
  //    WHERE community_id=$1 AND (user_id_a = ANY($2) AND user_id_b = ANY($2))
  // 3. Sort members by total trust degree desc
  // 4. Seed: top-half → groupA, bottom-half → groupB
  // 5. Up to 10 passes: for each member, if trust_to_other_group > trust_to_same AND |A|-|B| <= 1 → swap
  // 6. Return { groupA: string[], groupB: string[] }
  ```

  **`executeSplit(splitId, adminId, pool)`** — atomic transaction:
  ```typescript
  // Inside BEGIN/COMMIT:
  // 1. SELECT proposal + validate status='approved' and admin is member of parent community
  // 2. Auto-assign 'unassigned' members to smaller group
  // 3. INSERT INTO community.communities (group_a_name) returning id → childAId
  // 4. INSERT INTO community.communities (group_b_name) returning id → childBId
  // 5. INSERT INTO community.members for each assignment (group_a → childAId, group_b → childBId)
  // 6. INSERT INTO community.community_links (split_origin, trust_carry_factor=0.40)
  // 7. UPDATE split_proposals: status='executed', executed_at, child_community_a/b_id
  // 8. UPDATE community.communities SET status='split' WHERE id=communityId
  ```

- [ ] **Verify fissionService compiles**

```bash
cd services/community-service && npx tsc --noEmit
```

---

## Task 3: Splits routes

**Files:**
- Create: `services/community-service/src/routes/splits.ts`
- Modify: `services/community-service/src/index.ts`

- [ ] **Create `splits.ts`** with all 6 routes. Use the same auth middleware pattern as `governance.ts`. Admin-gate creation, assignment, start-vote, and execute routes. Allow all active members to GET and vote.

  Route structure:
  ```typescript
  router.post('/:communityId/splits', ...)           // create proposal + seed assignments
  router.get('/:communityId/splits/:splitId', ...)   // get proposal + assignments + vote tally
  router.put('/:communityId/splits/:splitId/assignments', ...) // admin bulk-update
  router.post('/:communityId/splits/:splitId/start-vote', ...) // discussion → voting
  router.post('/:communityId/splits/:splitId/vote', ...)       // member votes
  router.post('/:communityId/splits/:splitId/execute', ...)    // admin executes approved split
  ```

  Admin check pattern (copy from governance.ts):
  ```typescript
  const memberships = req.user?.communities ?? [];
  const isAdmin = memberships.some(m => m.id === communityId && m.role === 'admin');
  if (!isAdmin) return res.status(403).json({ success: false, message: 'Admin only' });
  ```

  For **`POST /splits`**: call `clusterCommunityMembers()`, then `insertProposal()`, then `insertAssignments()` with cluster_suggestion values.

  For **`POST /splits/:id/vote`**: fetch member's karma from reputation-service OR query `reputation.karma_records` directly (same pattern as governance) to get prestige_weight.

  For **`POST /splits/:id/execute`**: call `executeSplit()` from fissionService.

- [ ] **Mount splits router in `index.ts`**:
  ```typescript
  import splitsRouter from './routes/splits';
  app.use('/communities', splitsRouter);
  ```

- [ ] **Smoke test routes mount**

```bash
cd services/community-service && npm run dev &
curl -s http://localhost:3002/health | jq .success
# Should return true
```

---

## Task 4: Size alert on GET /communities/:id

**Files:**
- Modify: `services/community-service/src/routes/communities.ts`

- [ ] **Find the `GET /:id` handler** in `communities.ts` and add `size_alert` computation:

  ```typescript
  const members = row.current_members ?? 0;
  let size_alert: string | null = null;
  if (members >= 140) size_alert = 'urgent_split';
  else if (members >= 130) size_alert = 'recommend_split';
  else if (members >= 120) size_alert = 'approaching';

  // Also fetch active split proposal (if any)
  const proposalRes = await pool.query(
    `SELECT id, status, group_a_name, group_b_name FROM community.split_proposals
     WHERE community_id = $1 AND status NOT IN ('executed', 'rejected')
     LIMIT 1`,
    [communityId]
  );
  const active_split_proposal = proposalRes.rows[0] ?? null;
  ```

  Return both in the response `data` object.

- [ ] **Verify with curl** against a community that has enough members, or manually insert a test row with `current_members=135`.

---

## Task 5: Frontend — size alert banner + FissionTab entry point

**Files:**
- Modify: `apps/frontend/src/components/CommunityHeader.tsx`
- Modify: `apps/frontend/src/pages/communities/index.tsx`
- Create: `apps/frontend/src/components/community/tabs/FissionTab.tsx`

- [ ] **Add `SizeAlertBanner`** inline in `CommunityHeader.tsx`. Only render when `community.size_alert` is non-null:

  ```tsx
  {community.size_alert && (
    <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-sm text-amber-800">
      {community.size_alert === 'urgent_split'
        ? `⚠️ This community has ${community.current_members} members — consider splitting to maintain cohesion.`
        : community.size_alert === 'recommend_split'
        ? `This community is approaching its optimal size. A split may help maintain trust.`
        : `Community growing — ${community.current_members}/150 members.`}
      {isAdmin && !community.active_split_proposal && (
        <button onClick={() => setShowFissionTab(true)} className="ml-2 underline font-medium">
          Propose Split →
        </button>
      )}
    </div>
  )}
  ```

- [ ] **Add FissionTab to community tabs** in `communities/index.tsx`. Show tab if user is admin OR `active_split_proposal` is non-null (proposal is visible to all members during voting):

  ```tsx
  {(isAdmin || community.active_split_proposal) && (
    <Tab label="Split" key="fission">
      <FissionTab community={community} isAdmin={isAdmin} onRefresh={refetchCommunity} />
    </Tab>
  )}
  ```

- [ ] **Create `FissionTab.tsx`** with state-machine rendering:

  ```tsx
  // State: no_proposal | discussion | voting | approved | rejected | executed
  // Derive from community.active_split_proposal.status (or null)

  if (!proposal && isAdmin) → <FissionProposalModal onSubmit={createProposal} />
  if (proposal.status === 'discussion' && isAdmin) → <FissionAssignmentView ... />
  if (proposal.status === 'voting') → <VotePanel proposal={proposal} onVote={castVote} />
  if (proposal.status === 'approved' && isAdmin) → <ExecuteButton onExecute={executeSplit} />
  if (proposal.status === 'executed') → <SplitCompleteView childA={...} childB={...} />
  ```

---

## Task 6: Frontend — proposal creation modal

**Files:**
- Create: `apps/frontend/src/components/FissionProposalModal.tsx`

- [ ] **Create `FissionProposalModal.tsx`** — a modal form with:
  - Input: "Name for Group A" (text, required)
  - Input: "Name for Group B" (text, required)
  - Textarea: "Rationale" (why split now)
  - On submit: `POST /api/communities/:id/splits` → `{ group_a_name, group_b_name, rationale }`
  - After submit: close modal, parent calls `onRefresh()` to reload proposal state

  The response includes the seeded member assignments. No need to display the algorithm's output in this modal — that's the next step (FissionAssignmentView).

---

## Task 7: Frontend — member assignment view

**Files:**
- Create: `apps/frontend/src/components/FissionAssignmentView.tsx`

- [ ] **Create `FissionAssignmentView.tsx`** — shown to admin during `discussion` phase:

  Table with columns: Member name, Cluster suggestion (algorithm's guess), Current assignment, Toggle button.

  ```tsx
  // Fetch: GET /api/communities/:id/splits/:splitId
  // response.data.assignments: [{ userId, userName, clusterSuggestion, assignedTo }]

  // Toggle button flips assignedTo between 'group_a' and 'group_b'
  // On change: PUT /api/communities/:id/splits/:splitId/assignments
  //   body: [{ userId, assignedTo }]

  // Summary row: "Group A: N members | Group B: M members"

  // "Open Voting" button: POST .../start-vote → transitions to voting phase
  // Disabled if any member is still 'unassigned'
  ```

  Visual cue: highlight rows where `assignedTo !== clusterSuggestion` (admin overrode the algorithm).

---

## Task 8: Frontend — voting panel

**Files:**
- Modify: `apps/frontend/src/components/community/tabs/FissionTab.tsx` (inline VotePanel)

- [ ] **Add VotePanel inline in `FissionTab.tsx`** for `voting` status. Shown to all members:

  ```tsx
  // Display: proposal rationale, group A members list, group B members list
  // User's current assignment shown ("You will be in: Group A — {group_a_name}")
  // Vote buttons: Yes / No / Abstain (disabled if already voted)
  // Progress bar: X% voted (quorum), Y% approval
  // Voting ends: {proposal.voting_ends_at} countdown

  // Admin: additional "Execute Split" button if status='approved'
  // On execute: POST .../execute → shows SplitCompleteView on success
  ```

---

## Task 9: Docs — ADR-057 + user guide + landing page

**Files:**
- Create: `docs/adr/ADR-057-fission-mechanism.md`
- Create: `apps/landing/src/data/docs/concepts/adr-057-fission-mechanism.json`
- Create: `apps/landing/src/data/docs/guides/community-fission.json`
- Modify: `docs/adr/ADR-018-community-splitting-mechanics.md`
- Modify: `apps/landing/src/data/nav.json`
- Modify: `scripts/generate-docs.ts`

- [ ] **Create `ADR-057-fission-mechanism.md`** documenting:
  - Context: trust graph (Sprint 65–68) provides cleavage data; ADR-018 Phase 2 now implementable
  - Decision: greedy bisection algorithm (Kernighan-Lin inspired); parent-community preserved as `status='split'`; trust carry-over via `split_origin` community_link at 0.40 factor
  - Consequences: parent ID persists in historical records; second split proposal blocked by UNIQUE constraint (demo-scope limitation)

- [ ] **Update `ADR-018-community-splitting-mechanics.md`**: Change Phase 2 status from "Planned" to "Implemented (Sprint 69)". Add reference to ADR-057.

- [ ] **Create `community-fission.json`** user guide — cover: why communities split, how to propose, how to read the cluster suggestion, how to vote, what happens after execution (both communities are active; history stays in parent).

- [ ] **Create `adr-057-fission-mechanism.json`** landing page entry with `slug`, `number: "057"`, `title`, `status: "implemented"`, `content` (full markdown).

- [ ] **Update `nav.json`**: add entries under "User Guides" and "Architecture Decisions".

- [ ] **Update `scripts/generate-docs.ts`**: add `'community-fission'` and `'adr-057-fission-mechanism'` to the hardcoded slug list (to prevent nav.json revert on next build).

- [ ] **Verify nav.json has entries**

```bash
grep -c "fission" apps/landing/src/data/nav.json
# Should be >= 2
```

---

## Task 10: CONTEXT.md + registry.json + TDD test

**Files:**
- Modify: `services/community-service/CONTEXT.md`
- Modify: `services/registry.json`
- Modify: `apps/landing/src/data/docs/services/community-service.json`
- Create: `services/community-service/tests/tdd/sprint-69-fission.test.ts`

- [ ] **Update `services/community-service/CONTEXT.md`**:
  - Add three new tables to "Database Schema" section
  - Add 7 new endpoints to "API Endpoints" section
  - Add "Recent Changes" entry: Sprint 69 — Fission Mechanism

- [ ] **Update `services/registry.json`**: add 7 new endpoints under community-service's `apis.provides` array.

- [ ] **Update `apps/landing/src/data/docs/services/community-service.json`**: add the same 7 endpoints.

- [ ] **Create `sprint-69-fission.test.ts`** with at minimum:

  ```typescript
  describe('Sprint 69 — Fission Mechanism', () => {
    describe('clusterCommunityMembers', () => {
      it('splits members into two balanced groups', () => {
        // 4 members, edges: A-B:0.9, A-C:0.8, B-C:0.7, D-E:0.8 (no cross-cluster edges)
        // Expect: one group gets {A,B,C}, other gets {D,E} — or any 2/2 split with coherent clusters
        const members = ['a','b','c','d'];
        const edges = [
          { user_id_a:'a', user_id_b:'b', effective_weight: 0.9 },
          { user_id_a:'a', user_id_b:'c', effective_weight: 0.8 },
          { user_id_a:'b', user_id_b:'c', effective_weight: 0.7 },
        ];
        const result = clusterMembers(members, edges);
        // Groups are balanced: |groupA - groupB| <= 1
        expect(Math.abs(result.groupA.length - result.groupB.length)).toBeLessThanOrEqual(1);
      });

      it('handles members with no trust edges (distributes alternately)', () => {
        const members = ['a','b','c','d'];
        const result = clusterMembers(members, []);
        expect(result.groupA.length).toBe(2);
        expect(result.groupB.length).toBe(2);
      });

      it('keeps trust-dense subgraphs together', () => {
        // A-B:0.95, A-C:0.90, C-D:0.01 (D is isolated from A-B-C cluster)
        const members = ['a','b','c','d'];
        const edges = [
          { user_id_a:'a', user_id_b:'b', effective_weight: 0.95 },
          { user_id_a:'a', user_id_b:'c', effective_weight: 0.90 },
          { user_id_a:'c', user_id_b:'d', effective_weight: 0.01 },
        ];
        const result = clusterMembers(members, edges);
        // a,b,c should be in the same group (or at least a and b together)
        const aGroup = result.groupA.includes('a') ? 'groupA' : 'groupB';
        const bGroup = result.groupA.includes('b') ? 'groupA' : 'groupB';
        expect(aGroup).toBe(bGroup);
      });
    });

    describe('size_alert computation', () => {
      it('returns null below 120 members', () => {
        expect(computeSizeAlert(119)).toBeNull();
      });
      it('returns approaching at 120', () => {
        expect(computeSizeAlert(120)).toBe('approaching');
      });
      it('returns recommend_split at 130', () => {
        expect(computeSizeAlert(130)).toBe('recommend_split');
      });
      it('returns urgent_split at 140', () => {
        expect(computeSizeAlert(140)).toBe('urgent_split');
      });
    });
  });
  ```

  Export `clusterMembers` and `computeSizeAlert` as pure functions from `fissionService.ts` so they can be unit-tested without DB.

- [ ] **Run TDD tests**

```bash
cd services/community-service && npm run test:tdd
```

---

## Task 11: Type check + pre-push verification

**Files:** None (verification only)

- [ ] **TypeScript check — community-service**

```bash
cd services/community-service && npx tsc --noEmit
```

- [ ] **TypeScript check — frontend**

```bash
cd apps/frontend && npx tsc --noEmit
```

- [ ] **Run unit + regression tests**

```bash
npm test
```

- [ ] **Run TDD tests**

```bash
npm run test:tdd
```

- [ ] **Run feedback loop check**

```bash
npm run feedback:check
```

- [ ] **Stage landing page docs (gitignore bypass)**

```bash
git add -f apps/landing/src/data/docs/
```

- [ ] **Verify nav.json has fission entries after generate-docs (confirm no revert)**

```bash
grep "fission" apps/landing/src/data/nav.json
```

---

## Task 12: Merge + Deploy

Use the `/deploy` skill.

- [ ] **Commit all changes** with message: `feat(fission): Sprint 69 — Community Fission Mechanism`

- [ ] **Merge to master and push** — GitHub Actions deploys automatically.

```bash
git checkout master
git merge feature/sprint-69-fission
git push origin master
```

- [ ] **Monitor GitHub Actions** — confirm CI passes and deploy completes.

- [ ] **If migration needs manual run on demo server** (new tables in the DB):

```bash
ssh ubuntu@karmyq.com
cd ~/karmyq
psql $DATABASE_URL -f infrastructure/postgres/migrations/20260527-fission.sql
```

- [ ] **Smoke test on karmyq.com**

```bash
curl https://karmyq.com/api/community/health
# Then test in browser: community page → size alert → fission tab
```
