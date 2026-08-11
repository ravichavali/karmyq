# ADR-093: The `federation` Schema Is Reserved, Not Live

**Date**: 2026-08-07
**Status**: Accepted
**Deciders**: Ravi Chavali (maintainer)
**Related**: [ADR-087](ADR-087-one-seed-path-init-sql-regeneration.md) ·
[ADR-092](ADR-092-agpl-licensing-and-manifesto-audit.md) · Sprint 123

## Context

CLAUDE.md told every agent the database has **13 schemas**. It has twelve live ones and one fossil.

`infrastructure/postgres/migrations/001_federation_schema.sql` creates a `federation` schema with
**twelve tables** — `local_instance`, `instances`, `federation_links`, `blocked_instances`,
`federated_users`, `federated_user_mappings`, `federated_requests`, `federated_communities`,
`inbox`, `outbox`, `reputation_attestations`, `user_migrations` — including instance identity with
a public/private keypair (`local_instance.public_key`, `private_key`, `:20-21`) and a
`federation_enabled BOOLEAN DEFAULT false` flag (`:25`).

**No service implements any of it.** Verified 2026-08-07 — the search scope is stated inline
because a negative without a stated scope is not evidence:

```bash
grep -rn "federation\." services/ packages/ apps/frontend/src apps/mobile \
  --include=*.ts --include=*.tsx | grep -v node_modules
```

Every hit is in exactly two files, and neither is business logic:

| File | What it is |
|---|---|
| `services/simulation-service/src/fixtures/curatedDemo/tablePolicy.ts:151-162` | Reset-policy **metadata** — names the twelve tables so the demo reset knows to preserve `local_instance` and truncate the rest |
| `services/simulation-service/tests/regression/sprint-117-reset-safety.test.ts:65-67,111` | The test asserting that policy |

No route, no repository, no queue consumer, no frontend call. The keypair is never generated, the
inbox is never read, the flag is never checked. It is scaffolding for a design that was never built.

This is a *reverse* audit finding (Sprint 123 audit §2.3): not a claim that failed, but a thing the
system contains and never mentions. It matters because the agent-facing docs asserted a count that
implied twelve working subsystems plus one, and an agent reading "13 schemas" would reasonably
assume `federation` was live.

## Decision

**`federation` is documented as a reserved schema and deliberately not deleted.**

- CLAUDE.md's database section now reads **12 live + 1 reserved**, names `federation`, and links
  here.
- The schema, its migration and its reset policy stay exactly as they are.
- Any future federation work starts from this ADR rather than from the discovery that the tables
  already exist.

## Consequences

### Positive

- The docs stop implying a subsystem that does not exist.
- The next reader of `001_federation_schema.sql` learns its status in one hop instead of grepping
  for callers and concluding, correctly but expensively, that there are none.
- The design intent is preserved. The tables encode real decisions (keypair identity, inbox/outbox,
  reputation attestations across instances) that would otherwise have to be re-derived.

### Negative

- Twelve empty tables persist in every environment, including the demo database. The cost is
  negligible — no rows, no indexes under load, no queries — but they show up in schema dumps and in
  anything that enumerates tables.
- "Reserved" is a status that has to be *maintained*. If federation is never built, this ADR is the
  only thing preventing the count drifting back.

### Neutral

- `services/simulation-service`'s reset policy keeps naming the twelve tables. That is correct: the
  policy has to be total over tables that exist, live or not.

## Alternatives Considered

### Delete the schema

A migration dropping `federation` and its twelve tables, plus removing the reset-policy entries.

**Rejected.** `infrastructure/postgres/init.sql` is *generated* from `migrations/*.sql` (ADR-087)
and a drift gate enforces the regeneration, so deletion means either rewriting history in
`001_federation_schema.sql` — which breaks the generated-file contract for every existing database —
or adding a new drop migration that must run against the demo database, which already carries the
schema. That is real migration risk, for no user benefit and against a design the maintainer has not
abandoned.

### Leave it undocumented

Zero work. **Rejected:** it is exactly the state that produced the wrong count in CLAUDE.md, and
the audit had to spend a search proving the negative. Undocumented scaffolding is a tax on every
future reader.

### Implement federation

Out of scope by orders of magnitude, and not a decision this sprint is positioned to make.

## Implementation Notes

- `CLAUDE.md` — the *Database* section: "**13 schemas**, not 6" → 12 live + 1 reserved, naming
  `federation` and linking this ADR.
- No migration. No code change. No `services/registry.json` change.
- The twelve live schemas are: `auth`, `communities`, `requests`, `reputation`, `notifications`,
  `messaging`, `social_graph`, `feed`, `governance`, `feedback`, `provider`, `events`.

## References

- `infrastructure/postgres/migrations/001_federation_schema.sql`
- `services/simulation-service/src/fixtures/curatedDemo/tablePolicy.ts:151-162`
- Arc design §2.3 (reverse audit) —
  `docs/superpowers/specs/2026-08-06-sprint-123-126-manifesto-alignment-arc-design.md`
- [ADR-087: One Seed Path — init.sql Regeneration](ADR-087-one-seed-path-init-sql-regeneration.md)
