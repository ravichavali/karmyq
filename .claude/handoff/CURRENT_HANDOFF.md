# Sprint 132 — Inventories and Skills — Handoff

**Date**: 2026-09-30
**Status**: PLANNED. Spec, plan and ADR number approved; nothing implemented yet.

> 🧭 **First product sprint after the maintenance freeze** (maintainer, 2026-09-30: dependency work
> needs a security advisory or a feature need; product is the default). Seed idea: `docs/IDEAS.md`
> [2026-09-30] architecture, *inventories for individuals and communities, and the skills work*.
>
> Sprint 131 shipped everything through **v11.74.0** (#287, `c187aa87`, deploy run 36745990078 green,
> smoke 200s, 0 open Dependabot alerts or PRs). Its full handoff is archived at
> [`archive/2026-09-30-sprint-131-maintenance-SHIPPED-v11.74.0.md`](archive/2026-09-30-sprint-131-maintenance-SHIPPED-v11.74.0.md).

> **No parallel lanes are active.** Git and PR state (`gh pr list`, `git log origin/master`) outrank
> anything written here.

## Quick Start

1. Read this handoff.
2. **PR A:** reuse `agent/claude/sprint-132-inventories-skills` (cut from `origin/master` `c187aa87`,
   v11.74.0; it carries the planning commit). **PR B / PR C:** once the previous PR has deployed,
   `git fetch origin` then `git switch -c agent/claude/sprint-132-pr-b-inventory origin/master` (or
   `…-pr-c-directed-borrow`). Never branch off a stale local master; unpushed local-master commits
   leak in through the squash-merge.
3. Open the plan: [`docs/superpowers/plans/2026-09-30-sprint-132-inventories-and-skills.md`](../../docs/superpowers/plans/2026-09-30-sprint-132-inventories-and-skills.md).
   Execute **one PR section per fresh chat** (A, then B, then C).
4. Invoke `superpowers:subagent-driven-development` directly (or `superpowers:executing-plans`).
   There is no `/execute-plan` slash command; superpowers removed it as a deprecated stub.

## Sprint goal

Members and communities can list shareable items (private until shared). "Ask to borrow" opens a
request only the owner (or the owning community's admins) can see, which runs the existing
match → message → karma loop. Skills have one source of truth that matching actually reads.

## Links

- Spec: [`docs/superpowers/specs/2026-09-30-sprint-132-inventories-and-skills-design.md`](../../docs/superpowers/specs/2026-09-30-sprint-132-inventories-and-skills-design.md)
- Plan: [`docs/superpowers/plans/2026-09-30-sprint-132-inventories-and-skills.md`](../../docs/superpowers/plans/2026-09-30-sprint-132-inventories-and-skills.md)
- ADR: **ADR-099** `docs/adr/ADR-099-inventories-and-directed-requests.md` (to be written in PR A)

## PR table

| PR | Scope | Branch | State |
|---|---|---|---|
| A | Skills single source: `auth.skill_vocabulary` + `user_tags.skill_slug`; matching reads tags; remove the fixed picker and `/users/:id/skills`; ADR-099 | `agent/claude/sprint-132-inventories-skills` | **NEXT**: execute plan section *PR A* in a fresh chat |
| B | Inventory catalog: `inventory` schema, `/requests/inventory/*`, item audience predicate, My things page, community Shared things tab | `agent/claude/sprint-132-pr-b-inventory` (cut after A deploys) | planned |
| C | Directed *Ask to borrow*: `is_directed` + targets on `help_requests`, directed audience predicate on **every** read surface + live-scan gate, `directed_request_created` event | `agent/claude/sprint-132-pr-c-directed-borrow` (cut after B deploys) | planned |

Versions: each PR bumps the minor from `origin/master` at merge time (11.75.0 / 11.76.0 / 11.77.0
if nothing else merges in between). Nothing is reserved.

## Maintainer decisions (planning chat, 2026-09-30)

1. **Scope:** inventory v1 plus a bounded skills cleanup (consolidate the two stores). Deeper skills
   work (endorsements, verification, discovery) moves to Sprint 133+.
2. **Inventory depth:** a catalog, with lending through a borrow request. **No** new lending state machine
   (no `on_loan` state, due dates or return flow in v1).
3. **Community inventory:** both kinds, community-owned items (admins manage them) **and** members'
   items shared with the community.
4. **Skills store:** `auth.user_tags` wins, with a normalized vocabulary (`skill_slug`). `auth.user_skills`
   is deprecated and **not dropped** this sprint (image-rollback safety).
5. **Borrow ask visibility:** **directed to the owner only** (or the owning community's admins). It is
   never on a feed.
6. **Default item visibility:** **private until shared**, per community, with membership checked live.
7. **Placement:** request-service, with a new `inventory` schema (13th live schema). No new service.
8. **ADR number:** **ADR-099**, allocated by the maintainer.
9. **Shipping:** **3 PRs** (A skills, B catalog, C directed borrow), so the reachability change
   gets isolated review.

## Critical implementation notes (verbatim from the spec)

1. **RLS doesn't protect these tables. Application SQL does.** The owner connection bypasses the
   existing policies (there's no `FORCE ROW LEVEL SECURITY` in `init.sql`, and the demo connection role
   is UNVERIFIED). Every visibility rule is a SQL predicate in one module, with tests proving both
   halves: the audience sees it and a non-audience member gets 404 or absence.
2. **Live membership only.** Item audience, admin writes, share validation and directed audience
   all query `communities.members` (`status='active'`, `role='admin'` where relevant). Never read
   `req.user.communities` for a decision. `adminActions.ts:9-23` is the anti-pattern (claim-derived
   admin check); don't copy it.
3. **Route order: mount `/requests/inventory` BEFORE `requestsRouter`** in
   `services/request-service/src/index.ts`, the same way `/requests/feed` is mounted first (`index.ts:99-106`).
   Otherwise `GET /requests/:id` (`requests.ts:1675`) captures `/requests/inventory` as `id='inventory'`.
   A test must hit `GET /requests/inventory/mine` through the real app and see the inventory handler.
4. **Directed requests fail closed on `is_directed`.** The target columns are `ON DELETE SET NULL`.
   Visibility keys off `is_directed`, so a deleted target narrows the audience to the requester and
   never opens it to the community. Test it: set the target to NULL, and a community member still
   gets 404.
5. **Never publish `request_created` for a directed request.** Its subscriber broadcasts the title to
   every active member (`notification-service/src/events/subscriber.ts:164-173`). Publish
   `directed_request_created` with live-resolved recipients. Update `services/registry.json` events and
   both services' CONTEXT.md.
6. **Classify every `help_requests` read path, untruncated.** The Surfaces table is a starting
   point from a 2026-09-30 grep. Re-run the grep without `| head`, classify every hit, and make the gate
   derive its inventory from the same live scan, not from a hand-written list. The gate must go red on
   an injected unguarded listing query (proven on a committed tree, restored from a byte copy).
7. **`GET /requests/:id` 404s a directed request for non-audience viewers *before* building the
   response.** That route currently returns any request, including `requester_email`, to any
   authenticated caller who has the id. That pre-existing breadth for *non-directed* requests is
   **out of scope**. Log it in `docs/BUGS.md` (the maintainer decides), and don't widen this sprint to fix it.
8. **Don't drop `auth.user_skills` in PR A.** A failed deploy rolls back the images and not the
   schema, and the old images read that table. Deprecate it with a `COMMENT` and drop it in a later sprint.
9. **Skill-slug resolution is exact after normalization, not fuzzy.** Normalize with
   lower + trim, then match on the slug, the label or a synonym. Don't use substring matching at write
   time: the shared matchers already substring-match at score time (`packages/shared/src/matching/utils.ts:62-66`),
   and doing it twice over-credits. An unresolved tag still reaches matching as
   `lower(regexp_replace(trim(tag_value), '[^a-z0-9]+', '_', 'gi'))`.
10. **Item categories and conditions reuse the existing borrow vocabularies**
    (`borrow.ts:25-34` keys; `BorrowRequestForm.tsx:12`), so PR C's prefilled request is a valid borrow
    request that the matcher understands. Don't invent a third vocabulary.
11. **No `packages/shared` change this sprint.** Inventory-aware `BorrowMatcher` is a Sprint 133
    candidate. Keeping shared untouched keeps the blast radius to auth, request, notification,
    community (read-only filters) and frontend.
12. **Version and merges.** Each PR bumps the minor from `origin/master`'s `package.json` at merge time
    (both `package.json` and `package-lock.json` root version). Merge one PR at a time, and wait for
    the deploy and health verify to finish. Each merge needs explicit maintainer authorization.
13. **Demo data / reset policy.** The curated reset walks only `MANAGED_SCHEMAS`
    (`services/simulation-service/src/fixtures/curatedDemo/tablePolicy.ts:11`), and an unclassified
    table in a managed schema is a hard failure. PR A classifies `auth.skill_vocabulary` as
    `'preserve'`. PR B adds `'inventory'` to `MANAGED_SCHEMAS` with both tables `'reset'`. Prove both
    with `sprint-117-reset-safety.test.ts`. Any demo data operation needs per-operation authorization.

Also in the plan's standing notes: **`scripts/regenerate-init-sql.sh` needs Docker.** There is none on
the Windows box, so use a disposable container on the demo host (ask first) or the Mac checkout.

## Carry-forward and open items

- **Sprint-number collision.** The unmerged branch `origin/lane/lanes-provenance` (`557bb547`, never
  opened as a PR) labels its lanes/stages/provenance work "Sprint 132" (maintainer, 2026-09-16). The
  maintainer named *this* product sprint 132 on 2026-09-30, so lanes-provenance renumbers whenever it
  is scheduled. Its spec, plan and lane file live only on that branch.
- **To log (critical note 7):** `GET /requests/:id` returns any request, including `requester_email`,
  to any authenticated caller who has the id. The route has no visibility check. It is pre-existing and
  out of scope; it needs a `docs/BUGS.md` entry and a maintainer triage.
- `/requests/matched/for-user` has no frontend caller (`api.ts:488` is unused). PR A repoints it, and
  it goes to IDEAS as a removal candidate.
- `apps/mobile` moderate audit chain (decode-uri-component ← query-string ← expo-router): no alert,
  and no non-downgrade fix. See `docs/IDEAS.md` [2026-09-30] tooling. Not an ADR-059 blocker.
- Sprint 131 follow-ups (fonts back to Turbopack, BUG-053 promoter, BUG-054 landing docs freshness,
  and the others) are in `docs/IDEAS.md` / `docs/BUGS.md`. They are not scheduled here.

## Ownership and base

| Field | Value |
|---|---|
| **Branch** | `agent/claude/sprint-132-inventories-skills`, cut 2026-09-30 from `origin/master` `c187aa87` (v11.74.0) |
| **Merged, never commit on them** | every Sprint 131 branch, including `agent/claude/sprint-131-dependabot-security-only` (#287) |
| **Active editor** | Claude (planning); the executor of each PR section |
| **Reviewer role** | A non-author reviews each completed diff; PR C additionally gets a fresh whole-branch review |
| **Shared resources** | ADR-099 is allocated. Dependency lane: Claude, but **no dependency work is planned** (the policy needs an advisory or a feature need). No demo data operation is planned; each needs its own authorization. |

## Persistent obligations (carried from Sprint 131, unchanged)

- Demo stories expire **2026-11-12**; BUG-041 recheck is due **2026-11-14**.
- GitHub posts a notice on every CI run: the `ubuntu-latest` label migrates to Ubuntu 26 from **2026-10-19**.
  Watch the first CI runs after that date, especially the Docker, Node and Postgres jobs.
- No docs-only master push; preserve the Sprint 130 archive in PR A. *(This was Sprint 131's PR A,
  now done: the archive is on master. It is not an instruction for Sprint 132's PR A.)*
- CodeQL PR scans are incremental; master rescans establish closure of existing master alerts.
- Windows: use Node for JSON/HTTP probes; no local Docker. Demo data operations require separate
  explicit authorization, and none are planned here.
- Root tests can promote unrelated TDD files and regenerate landing timestamps; inspect the tree
  after verification and preserve only intended changes.
- Contributor agents never self-merge; only Claude marks the sprint complete after actual delivery.

## Next unchecked action

Open a fresh chat on `agent/claude/sprint-132-inventories-skills` and execute plan section **PR A**
(Task A1: TDD tests first).
