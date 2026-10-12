# ADR-100: Skill Visibility and Endorsements

**Status**: Accepted
**Date**: 2026-10-12
**Sprint**: 133 — PR A (visibility and discovery); PR B (endorsements) follows

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

## Endorsements — PR B pending

The maintainer approved vouching by completed-match partners and pair-capped trust edge
reconciliation. PR B will document its eligibility checks, transport evidence from BUG-060,
revision job IDs, serialization, withdrawals and enqueue recovery here. PR A implements
visibility and discovery only. Turning sharing off is a display rule: it will not delete
endorsements or change trust edges.

## Consequences

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
