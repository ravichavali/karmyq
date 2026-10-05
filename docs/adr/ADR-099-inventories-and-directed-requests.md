# ADR-099: Inventories and Directed Requests

**Status**: Accepted
**Date**: 2026-10-01
**Sprint**: 132 (number allocated by the maintainer)

## Context

Members need to describe both skills they offer and things they can share. Before PR A,
the profile's fixed skill picker and free-text tags were separate stores, and matching read
only the picker store. PR A makes the tag editor the single source consumed by matching
(`services/request-service/src/routes/requests.ts:302`).

The approved sprint design adds a catalog in PR B and a private borrowing request in PR C.
A general request cannot implement that privacy contract by itself: the existing
`request_created` subscriber sends the title to active community members
(`services/notification-service/src/events/subscriber.ts:164`). PR S has already closed the
notification and match-view caller-scoping holes (BUG-055 and BUG-057). BUG-056 remains a
separate maintainer decision about ordinary request visibility.

## Decision

### One skill store

`auth.user_tags`, filtered to `tag_type='skill'`, is authoritative. A new
`auth.skill_vocabulary` table provides canonical slugs, display labels and synonyms.
The nullable `user_tags.skill_slug` foreign key records a recognized skill. A check constraint
permits a non-null slug only on skill tags.

Resolution is exact after case, whitespace and slug normalization: slug, label or synonym.
An unrecognized phrase remains a valid tag. Curated matching uses its normalized text when no
slug exists. We do not add fuzzy write-time resolution: the shared scorer already compares
substrings (`packages/shared/src/matching/utils.ts:62`). `/requests/matched/for-user` retains
its category map using canonical skill slugs.

The migration resolves existing tags and copies legacy selections into the tag editor, with
idempotent inserts and updates. The vocabulary seed is also in `seed-data.sql`; a parity test
and a blocking fresh-install check before migration replay protect installations whose
ledger already marks the migration applied. Curated demo resets preserve the vocabulary.

Remove the fixed picker and its three `/users/:userId/skills` handlers. Retain the deprecated
`auth.user_skills` table for image rollback; do not dual-write. A rolled-back image sees the
legacy snapshot, not new tag edits. Removing the table is a later decision.

### Inventory catalog (PR B)

Use request-service with a new `inventory` schema, rather than another service. Each item has
exactly one owner: a user or a community. Personal items are private until their owner shares
them with selected communities. Active community admins manage community-owned items.
Reuse the borrow request's category and condition vocabulary. A catalog records availability;
it does not add due dates, returns or an on-loan state machine.

Centralize SQL predicates in `inventoryDb.ts`. Managers can read every status and write.
Other viewers see only available items through active community membership. A personal share
requires both the owner and viewer to remain active members of the shared community.
Leaving withdraws access without deleting the share; rejoining restores it.

### Directed borrowing (PR C)

An item-specific borrow ask creates an ordinary help request with `is_directed=true`, a user
or community target, and the item reference. The private audience is the requester plus the
target owner or the target community's active admins. Existing offer, message, completion and
karma flows are reused. A responder who already joined a match retains their private exchange
history and actions after admin demotion or target deletion; current recipients still gate new offers.

Two shared predicates have distinct jobs:

- `notDirectedSql` excludes directed requests from every browse surface, even for their
  requester and recipient: feed, curated, pulse, open asks, matched, dibs, admin lists and exports.
- `directedAudienceSql` permits the audience on private surfaces: detail, own requests,
  incoming asks, offers and participant-scoped match views. Others receive absence or 404.

The boolean flag is the fail-closed boundary. Target foreign keys use `ON DELETE SET NULL`;
losing a target narrows access to the requester instead of making a request public.
Own-request listing admits directed rows only when `requester_id` equals the authenticated
caller. A separate incoming-asks query and Helping section expose unanswered asks before a
match exists.

Never publish `request_created` for a directed ask. Publish `directed_request_created` with
recipients resolved from live ownership/membership; notify exactly those recipients.

### Enforcement

All audience and write decisions query live membership. JWT claims are role hints, not
authorization evidence. Do not rely on RLS: the generated schema does not force it, and an
owner connection can bypass policies. The demo connection role remains UNVERIFIED.

PR C must derive its read-surface inventory from an untruncated source scan, require either
the correct predicate or a justified non-listing classification, and prove the gate fails on
an injected unguarded listing. Real database tests must prove both audience access and
non-audience absence; notification and match tests also cover data outside help-request SQL.

## Consequences

Members maintain skills once. Existing selections survive the transition, and arbitrary skills
remain expressible. Vocabulary changes require migration/seed parity; a recognized label is
a matching hint, not an endorsement or verified qualification.

Catalog and request privacy become explicit application responsibilities. Every new read path
must preserve the shared predicates. Directed asks cannot appear on browse pages, so the
incoming inbox is necessary for recipients to act. Item possession does not yet influence the
shared BorrowMatcher; inventory-aware matching is deferred.

## Alternatives Considered

- **A separate inventory-service:** adds deployment and cross-service authorization work for a
  bounded catalog that already feeds requests.
- **Community-visible borrowing asks:** violates the owner's/requester's directed audience.
- **Keep the fixed `user_skills` picker:** preserves two editors with conflicting matching behavior.
- **Drop the legacy table immediately:** breaks image rollback against an already migrated schema.
- **RLS alone:** does not protect against owner-role connections and cannot replace tested SQL scope.

## Delivery Notes

PR B implements the catalog through seven authenticated routes under `/requests/inventory`.
The router mounts before the broad `/requests` routes, so `/:id` and admin middleware cannot
capture inventory paths. A real-app route test protects that ordering. Reads apply one
`itemAudienceSql`, composed from `itemManagerSql`, and writes apply the manager predicate.
Non-audience item reads and writes return 404; visible-but-unmanageable writes return 403.
Unavailable personal/community items remain visible only to owners/active admins respectively.

Creator attribution uses nullable `created_by REFERENCES auth.users(id) ON DELETE SET NULL`.
The supported simulation deletion script hard-deletes users
(`services/simulation-service/delete-simulated-users.sql:11`); community property must survive
its creator's deletion. Ownership still cascades when the owning user/community is deleted.
Share replacement locks the item and validates live owner memberships before replacing the set
within one transaction. Community listing validates the share in the selected community even
when the viewer can see the item elsewhere. The curated reset includes both inventory tables
as runtime data; vocabulary remains preserved. Borrowing remains PR C scope.

PR A review corrected the illustrative migration backfills: the old API accepted arbitrary
skill text, so an inner vocabulary join would hide valid legacy skills from the sole editor.
The importer retains unmatched text with a null slug. Existing tags and legacy selections
both use trim/lowercase/whitespace normalization and exact slug/label/synonym lookup before
insertion, preserving canonical hints on the first run and keeping reruns idempotent. Exact
raw tag uniqueness remains unchanged. Real PostgreSQL integration coverage exercises these
cases, including known labels, synonyms, custom skills and existing exact collisions.

PR A implements skills only. PR B and PR C will amend this record with their implementation
evidence, including account-deletion and aggregate-count decisions. This ADR remains Accepted
until PR C is deployed; catalog and directed-request behavior above is the approved design,
not a claim that those later PRs have shipped.

### PR C implementation amendment

Borrow creation locks the item and relevant live membership rows, validates the selected
community's audience, and writes one directed borrow row and one attribution junction in a
transaction. It reuses a caller's existing open ask for the item on a resend, preserving the original
terms and attribution. The same transaction writes `inventory.borrow_notification_outbox` with
the explicit event recipients. After commit, it publishes only `directed_request_created` to
**`karmyq-directed-notifications`**, consumed solely by notification-service. A failed publish returns
the committed ask's ID (201); the durable relay retries it. Acknowledged but unconfirmed deliveries
are checked again after five minutes; exhausted failed jobs are retried with the same stable job ID.
Delivery re-resolves canonical request content and the current personal target or active admins,
ignoring the saved recipient/content snapshot. Deleted requests and recipients cannot receive a
queued private title. The subscriber stamps delivered_at after processing every current recipient. Its partial
unique index on (user_id, data.request_id) prevents duplicate notifications/SSE across retries.
No membership fan-out occurs, and unrelated consumers cannot steal these jobs. Existing shared
event routing is unchanged. Curated reset classifies the outbox as reset; hard request deletion
cascades its intent. Preferences that disable in-app delivery count as handled.

Browse reads use `notDirectedSql`; detail/own-request lists use `directedAudienceSql`, with existing
responders retaining history. Incoming asks and new-offer eligibility use current recipients only.
Match reads/mutations and action items use `matchParticipantSql`. Existing owner-only provider-offer
history and retention counts need no redundant audience filter. Own-request access requires
the requester filter to equal the JWT caller. Community triage, boost, dibs and match proposals
cannot act on directed rows. Relationship-context endpoints return no context for directed
asks because the shared topology contract has no directed tier; shared packages stay unchanged.

Community stats/export request and match lists **and their counts**, feed pulse counts and
named recent helpers exclude directed exchanges. Internal karma, standing, badges, retention
and graph projections still include them. Private match participants receive mark-done and rating
decisions. The offered-awaiting preview and its count exclude directed asks; private proposed
matches render once in Helping commitments. Nullable activity joins put the exclusion in ON and
use the canonical request_communities junction, retaining member stats with no public requests.
Non-manager item share metadata omits communities the owner has left; refreshed metadata updates
the borrow form's choice, and a stale-access 404 explains recovery.
Existing cohort-gated reputation health aggregates remain unchanged. The SQL surface gate checks
WHERE guard placement per query block and alias, rejects unconstrained OR/marker-only guards and
unparenthesized dynamic predicate fragments, and matches
reviewed exceptions by exact SQL SHA256, never by substring. It remains conservative static coverage,
not a general SQL authorization proof; ON semantics need exact reviewed exceptions and runtime
tests remain authoritative. Execution notes carry
the full file:line inventory.

**Rollout and rollback:** the additive migration is compatible with earlier binaries, but
earlier binaries have no directed privacy guards (`services/request-service/src/services/feed/basicFeedRanker.ts:171`).
After the first directed row exists, image rollback must retain these guards or make affected
reads unavailable. Never clear `is_directed` to accommodate rollback. The maintainer must choose
a privacy-preserving rollback path before authorizing deployment. This ADR remains Accepted
until PR C deploys.
