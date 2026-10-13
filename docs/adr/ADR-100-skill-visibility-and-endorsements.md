# ADR-100: Skill Visibility and Endorsements

**Status**: Accepted
**Date**: 2026-10-12
**Sprint**: 133 — PR A (visibility and discovery); PR B (endorsements)

## Context

Sprint 132 established skill tags as the single skill store. Caller-owned profile tags
serve the editor and feed matching; members also need to find someone with a skill in
their community. A cross-user read needs an explicit audience and a consistent opt-out.

## Decision

Skills are shared by default with people who currently share at least one active community
membership with their owner. The owner can turn sharing off using
`share_skills_with_communities` in `/users/me/settings`. Missing privacy rows default to
sharing on. The owner can always read their own skills, including after opting out.

All cross-user skill reads use `skillVisibleToSql` from
`services/auth-service/src/db/skillVisibility.ts:4`. It checks self access or sharing plus
live active co-membership. JWT community claims do not grant access. Only skill tags are
returned; interests, needs, email and other profile fields are excluded. Hidden and missing
owners receive the same 404. A visible owner with no skill tags receives an empty list.

Community directory and search require a live active caller membership in the selected
community and include only its active members who satisfy the same predicate. Directory
counts use distinct member IDs. Opting out removes the owner from other members' directory
counts, searches and profile skill views; their own reads still use the self exception.

Search resolves a full slug, label or synonym through the existing `resolveSkillSlug`
(`services/auth-service/src/services/skillVocabulary.ts:8`). Unresolved text uses the matching
key: lowercase trimmed text, with non-alphanumeric runs replaced by underscores. Search
does not use substrings, is capped at 50 members, and orders by name then ID. Directory
labels use the vocabulary label when resolved; free-text labels are chosen deterministically.

`auth.user_skills` is dropped by `20261008-skill-visibility.sql`; the curated reset policy
removes its classification. The previous deployed images use `auth.user_tags` for matching,
so an image rollback does not need the legacy table. Historical migration tests reconstruct
the old table transactionally. `GET /requests/matched/for-user` and its unused frontend
wrapper are retired; the curated feed continues using skill tags.

## Endor## Endorsements (PR B)

**Eligibility.** A member may vouch for a skill tag of someone they share a **completed** match with,
in either direction, and whose skill they can currently see (`skillVisibleToSql`). Both conditions
are evaluated inside the same SQL statement that writes the row (`POST /auth/skills/endorsements`,
`services/auth-service/src/routes/skills.ts`), so visibility cannot change between check and write.
The endorsee is the tag's owner, read in that statement. A missing tag, a hidden tag and a caller
with no completed match get the same 404; a vouch for your own skill is a 400. The most recent
qualifying match is stored in `match_id` (no cross-schema FK). Eligibility is checked at write
time only: a completed match is permanent, so a vouch survives the endorser leaving the community.

**One row per (endorser, tag).** Withdrawing sets `withdrawn_at`; re-endorsing clears it on the same
row. Every real state change bumps `revision` in the same statement; a repeat endorse of an active
row, or a repeat withdrawal, changes nothing and publishes nothing. Opting out of skill sharing hides
the skill and its vouch controls but does **not** delete endorsements or change trust edges: a vouch is
a fact, visibility is a display rule. Deleting the tag cascades its endorsements; the delete locks the tag
and every endorsement row of it first, so a concurrent revive cannot slip between read and cascade.

**Trust graph: reconcile, never increment.** `skill_endorsement_changed` carries only which pair
changed. social-graph recomputes, for the pair and each community, `endorsement_count` = number of
distinct endorsers among the two with an active endorsement whose match's request is in that community
(`requests.request_communities`). The value is 0, 1 or 2: five vouches from one person count once,
mutual vouching counts twice; per-skill counts on the profile keep the detail. Redelivery, retries,
withdrawal and tag deletion therefore converge to the same row. Reconcile never touches `stability`;
it moves `last_interaction_at` only when the count rises and inserts an edge only for a count above 0
(`services/social-graph-service/src/services/endorsementReconcile.ts`).

**Serialization.** Both writers of a pair's edges, the endorsement reconcile and the `match_completed`
path (`upsertTrustEdge`), run in one transaction holding
`pg_advisory_xact_lock(hashtextextended('trust-pair:' || a || ':' || b, 0))` on the normalized pair
(`withPairLock`, `trustEdgeDb.ts`). `raw_weight` is computed inside the `UPDATE` from the row's current
count columns, never from a value read earlier. A real-Postgres test proves a stale reconcile released
after a withdrawal's reconcile ends at 0, and a negative control proves the same interleaving without
the lock ends at 1.

**Transport.** BUG-060 is confirmed: Bull 4.16.5 hands any waiting job to any worker and fails a job
whose name that worker never registered (`bull/lib/queue.js:1203-1208`, `:1246`). Live, 15 of 60
`request_created` jobs on the shared queue never reached their only handler. The event therefore uses the
dedicated queue `karmyq-skill-endorsement-social-graph` (publisher auth-service, sole consumer
social-graph). Other events keep their transport this sprint; BUG-060 tracks them.

**Job ids.** `endorsement-<row id>-r<revision>` for a state change and `endorsement-<row id>-deleted` for a
tag-deletion cascade. Distinct changes never share an id (no timestamp collisions); a retried publish of
the same change reuses its id, so Bull drops the duplicate.

**Publish after commit; the lost-enqueue gap is accepted.** If the enqueue fails or exceeds its 2 s bound after
the commit, the API still succeeds and logs the error with both user ids; the pair heals on its next endorsement change.
Operators repair drift with `node dist/scripts/reconcileEndorsementEdges.js` inside the social-graph
container (dry run by default, `--apply` to write; a demo run needs its own authorization). No outbox.

**Formula-derived weight.** Reconcile, like the `match_completed` path before it, rewrites `raw_weight` from
the count columns. An edge whose weight was not formula-derived (a fusion carry edge, a curated demo edge
with a projected weight) is normalized to the formula on its first endorsement change.

**Known limitation.** A community split copies `endorsement_count` into the child community's edges
(`fissionService.ts`). Because reconcile derives counts from match communities, the pair's next
endorsement change sets that inherited copy to 0.

quences

Members can discover community skills while sharing remains under the owner's control.
Leaving a shared community or becoming pending removes cross-user access immediately.
Discovery reads query live membership and privacy state, adding database work in exchange
for access that does not outlive membership.

Skills remain useful for private feed matching when sharing is off. This setting applies
to skill discovery, rather than changing request matching or the profile editor.

## Alternatives considered

- Public skill profiles: would disclose skills beyond the mutual-aid community audience.
- JWT-only membership checks: would preserve access after a member leaves.
- Separate visibility rules for search and profiles: would make opting out incomplete.
- Substring search: would make a full skill key and a partial query behave differently.
- Incrementing `endorsement_count` per event: retries and re-endorsements would inflate trust and a
  withdrawal could not be reversed exactly.
- Publishing on the shared `karmyq-events` queue: BUG-060 loses a share of those jobs.
- A transactional outbox: closes the lost-enqueue gap but adds a relay; deferred while a backfill exists.
- Vouching by any co-member: would let people vouch for skills they never saw used.
