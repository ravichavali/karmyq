# Sprint 99: Release Experience Audit + Fine Tune - Design Spec

**Date**: 2026-06-14
**Status**: Approved
**Version**: v11.7.0 -> v11.8.0
**Sprint Branch**: `feature/sprint-99-release-experience-audit`

---

## Overview

Sprints 97 and 98 tightened the release path by repairing demo data quality, membership truth,
trust-path semantics, graph membership rules, relationship labels, and feed terminal states. Sprint
99 shifts from one subsystem to the full release experience: walk the demo as a real evaluator would,
find the places where the product feels confusing, contradictory, stale, or underexplained, then ship
a small set of high-signal fixes.

This is an audit-first fine-tune sprint, not a redesign sprint. The work starts with a structured
live/demo walkthrough across the dashboard, community pages, provider flows, request creation,
relationship copy, demo data, and karmyq.org first impression. Each finding is categorized by user
impact and root cause. Only bounded repairs that improve trust, clarity, or demo readiness are in
scope for implementation.

The sprint should leave Karmyq easier to evaluate: fewer false empty states, clearer relationship
language, less confusing provider/community link-up, cleaner demo records, and first impressions that
match the product's promise. Anything that becomes architectural, multi-sprint, or purely aesthetic is
captured and deferred rather than absorbed into this sprint.

### Core Principle: Truth before polish

If a screen says a relationship, request, provider, community, or platform state means something, the
data and copy should back it up.

---

## Multi-Sprint Arc

### Sprint 97 - Release Readiness Data Quality + Functional Bug Bash (complete, v11.6.0)

Repaired first-run demo blockers, community membership bootstrap drift, and several high-risk
release-readiness bugs.

### Sprint 98 - Trust Truth Audit + Functional Repairs (complete, v11.7.0)

Reconciled trust paths, graph membership, relationship labels, legacy network usage, and feed
caught-up/show-more state.

### Sprint 99 - Release Experience Audit + Fine Tune (this sprint, v11.8.0)

Audit the full evaluator path and ship a tight set of clarity, trust, and demo-readiness repairs.

### Sprint 100+ - Feature or deeper UX arc (upcoming)

Candidates include founding-circle review/notify tooling, platform-scoped service requests, broader
provider/community UX, or a research-first UI facelift. Sprint 99 should produce evidence for which
one matters most next.

---

## New Concepts

### Release Experience Finding

A documented issue discovered during the end-to-end evaluator walkthrough. Every finding includes:

| Field | Meaning |
|---|---|
| ID | `S99-NNN`, assigned in the bug log. |
| Surface | Dashboard, community, provider, request, landing, data, docs, or cross-cutting. |
| User impact | What a real evaluator or member would misunderstand, mistrust, or fail to do. |
| Root cause | UI copy, state branching, API/data truth, demo data, docs, or unknown. |
| Decision | Fix in Sprint 99, defer with rationale, or no-op after investigation. |

### Fine-Tune Repair

A bounded implementation change discovered by the audit. A repair is eligible for Sprint 99 only if:

- It can be verified with a focused test or repeatable smoke check.
- It improves trust, clarity, or demo readiness.
- It does not require a new product concept, major schema change, or broad redesign.
- It updates docs/context where behavior or user-facing meaning changes.

---

## Audit Lanes

**Environment:** The walkthrough is against the live demo environment, not a local dev stack:
`https://karmyq.com` for the app/API and `https://karmyq.org` for landing. Use Playwright/browser
access when available; otherwise record the missing browser capability as a blocker before Task 2.
Before starting, read the maintainer-local memory note `reference_demo_ux_audit_access.md` if
available. Key demo facts: SSH is `ubuntu@karmyq.com`; Postgres runs in the `karmyq-postgres`
container; DB operations should use the container env; and seeded demo users use `password123`.

1. **Dashboard Home**
   - Feed hierarchy, decision bands, show-more/caught-up states, empty states, trust badges, and
     first useful action.

2. **Community pages**
   - Home, People, How we're connected, Stewardship, tab labels, member/provider relationship
     language, and community-scoped truth.

3. **Provider flows**
   - Provider directory, provider detail, shared-community labels, offers, dibs prompts, and whether
     provider/community link-up is understandable.

4. **Request flows**
   - Ask creation, Get Help/Get Service split, platform/community scope, request cards, offer states,
     and first-ask routing explanation.
   - If the audit selects feed filtering or browsable-request behavior for repair, trace every feed
     query surface before implementing. Prior sprint memory warns request filtering lives in multiple
     places, including `services/request-service/src/utils/queryBuilder.ts`.

5. **Trust and relationship copy**
   - Copy must distinguish exchange trust, indirect path, fellow member, provider availability,
     shared community, and invitation lineage without implying unsupported relationships.

6. **Demo data quality**
   - Stale, orphaned, contradictory, or noisy demo records that make the platform harder to evaluate.

7. **Landing first impression**
   - karmyq.org home/join/docs first impression, including contained visual or functional defects such
     as the `NetworkVisualization` resize bug. Full landing redesign is out of scope.

---

## Scope

### In Scope

- A structured audit log for live/demo release experience findings.
- Screenshots or notes for key confusing states where visual comparison helps.
- Focused frontend copy/state/layout repairs in existing components.
- Focused backend or SQL repairs only when audit evidence shows the UI confusion is caused by data or
  API truth.
- Contained landing polish that directly improves first impression or fixes a real bug.
- Demo-data cleanup scripts if the audit finds repeatable stale/orphaned records.
- Tests for every implemented repair.
- User guide, landing-doc, service context, and handoff updates.

### Explicitly Deferred

- Broad UI facelift or new visual language.
- New social features such as introductions, endorsements, testimonials, or blog publishing.
- Founding-circle review/notify workflow.
- Service consolidation phase 2.
- Mobile parity unless a shared API bug affects mobile too.
- Full provider/community architecture redesign.
- Large schema changes unless the audit finds a release-blocking correctness bug that cannot be fixed
  otherwise.

---

## Data Model

No new product tables are planned.

Potential audit or repair scripts may be added:

| File | Purpose |
|---|---|
| `scripts/audit-release-experience.sql` | Optional repeatable demo-data audit for confusing stale/orphaned records discovered during the walkthrough. |
| `infrastructure/postgres/migrations/20260614-release-experience-repair.sql` | Optional deploy-time repair only if the issue must be corrected with an idempotent migration. |

Any data repair must be idempotent and documented in the Sprint 99 audit log. Manual live-data edits
without a script are out of scope.

---

## API Endpoints

No new endpoint is planned by default. The audit may lead to small behavior or response-copy fixes on
existing endpoints:

| Method | Path | Service | Possible change |
|---|---|---|---|
| GET | `/requests/curated` | request-service | Clarify feed item state or relationship data if UI confusion comes from the response. |
| GET | `/requests/feed` | request-service | Verify absorbed feed behavior still matches current frontend expectations. |
| GET | `/requests/:id/dibs-candidate` | request-service | Fine-tune reason/context copy only if Sprint 98 semantics are still confusing in the UI. |
| GET | `/providers` | request-service | Verify shared-community labels are understandable and truthful. |
| GET | `/trust/graph` | social-graph-service | Verify dashboard relationship graph payload supports clear copy. |
| GET | `/trust/graph/:communityId` | social-graph-service | Verify community graph payload supports clear community-scoped labels. |

Endpoint descriptions in `services/registry.json` must be updated if behavior or response semantics
change.

---

## Frontend Changes

The exact implementation files are selected after the audit. Likely surfaces:

- `apps/frontend/src/pages/dashboard.tsx`
  - Dashboard first-use and feed context around selected community, tabs, and primary actions.

- `apps/frontend/src/components/Feed/UnifiedFeed.tsx`
  - Feed state branching, finite states, texture cards, and request-card ordering if the audit finds
    confusing behavior.

- `apps/frontend/src/components/Feed/RequestCard.tsx`
  - Relationship badge, request scope, urgency, provider/service wording, and action copy.

- `apps/frontend/src/pages/communities/[id].tsx`
  - Community page tab state, page framing, and empty/error states.

- `apps/frontend/src/components/community/tabs/*`
  - Home, People, How we're connected, and Stewardship clarity fixes.

- `apps/frontend/src/components/providers/*` and provider pages
  - Provider/community link-up explanation and shared-community wording.

- `apps/frontend/src/components/requests/DibsPrompt.tsx`
  - First-ask routing explanation, if the audit shows Sprint 98's server truth still reads as a UI
    hint rather than a relationship choice.

- `apps/landing/src/components/NetworkVisualization.tsx`
  - Reset canvas transform before scaling on resize if the landing resize bug is selected.

- `apps/landing/src/app/page.tsx`
  - Optional contained adjustment to extend the network field beyond the hero only if it improves the
    first impression and remains small.

---

## User Guide & Doc Updates

Docs are mandatory even if the implemented repairs are small.

- `docs/bugs/sprint-99-release-experience-audit.md`
  - New audit log with findings, screenshots/notes, decisions, fixed/deferred status, and validation
    evidence.

- `docs/guides/dashboard-home.md`
  - Update if feed, action, empty-state, or first-use behavior changes.

- `docs/guides/finding-communities-guide.md`, `docs/guides/group-communities-guide.md`,
  `docs/guides/community-admin-guide.md`, and/or `docs/guides/trust-graph.md`
  - Update the specific affected guide if community tab framing, provider link-up, graph, or
    relationship copy changes.

- `docs/guides/using-service-providers-guide.md`, `docs/guides/provider-mode-guide.md`, and/or
  `docs/guides/provider-dibs-guide.md`
  - Update the specific affected guide if provider/community link-up or offer/dibs wording changes.

- `docs/guides/demo-data.md`
  - Add Sprint 99 audit and cleanup checks if data scripts are created.

- `apps/frontend/src/lib/onboarding/workflows.ts`
  - Update if any onboarding workflow text or navigation path changes.

- `apps/frontend/CONTEXT.md`
  - Record frontend release-experience fixes.

- `services/request-service/CONTEXT.md` and/or `services/social-graph-service/CONTEXT.md`
  - Update only if service behavior changes.

- `apps/landing/src/data/docs/*`
  - Regenerate generated docs from source updates and force-add changed generated JSON.

No ADR is expected. If Sprint 99 chooses a new canonical relationship, provider/community, or demo
data policy, create ADR-078. ADR-078 was checked as unclaimed during planning on 2026-06-14.

---

## Critical Implementation Notes

1. **Audit first, then freeze the fix list.** Do not start patching random polish issues before the
   walkthrough findings are logged and ranked.
2. **Tasks 1-4 stay in the main session.** The audit, judgment, ranking, and fix-list freeze are not
   subagent fan-out work. Dispatch subagents only after Task 4, once exact files and selected repairs
   are named.
3. **Truth beats prettiness.** A small copy or state fix that prevents a false claim is more valuable
   than a visual flourish.
4. **Keep the sprint bounded.** Fix P0/P1 clarity and demo-readiness issues first; defer broad
   redesigns, new concepts, and multi-sprint UX arcs.
5. **Do not hide server truth in the client.** If the frontend is confusing because an API or data
   record is wrong, fix the source or document the limitation.
6. **Provider/community link-up is a top suspect.** Audit whether members can understand the
   difference between provider availability, shared community membership, offers, dibs, and exchange
   trust.
7. **Name exact files at freeze.** Wildcard areas like `community/tabs/*` and `providers/*` are
   discovery hints only. Task 4 must replace them with an exact implementation file list before
   coding starts.
8. **Use the visual companion only where seeing helps.** Use it for layout/copy comparisons or visual
   state triage, not for textual requirement decisions.
9. **Demo data cleanup must be scripted.** No one-off edits on the demo database without a repeatable
   SQL/script artifact and before/after evidence.
10. **Every implemented repair needs a test.** UI state repairs get focused frontend tests; data/API
   repairs get service or SQL-backed tests.
11. **Docs stay in sync.** If behavior, navigation, or user-facing meaning changes, update source
   docs, generated landing docs, contexts, and onboarding copy where relevant.
12. **Version bump:** root `package.json` and `package-lock.json` move `11.7.0` -> `11.8.0`.

---

## Success Criteria

- Sprint 99 audit log exists and covers dashboard, community, provider, request, trust/copy, demo
  data, and landing first impression lanes.
- Findings are ranked and either fixed or explicitly deferred with rationale.
- The implemented fix list is small enough to review and deploy safely.
- Provider/community link-up confusion is either repaired or documented as the next major UX arc.
- No implemented UI state makes a false claim about data, relationship, membership, or request state.
- Every implemented repair has a focused test or repeatable smoke check.
- Required docs, generated landing docs, contexts, and handoff are updated.
- `npm test`, `npm run test:tdd`, `npm run feedback:check`, type checks, dependency audit,
  `/simplify`, `/code-review`, and `/security-review` complete before merge.
