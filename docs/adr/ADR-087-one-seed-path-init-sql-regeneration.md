# ADR-087: One Seed Path — init.sql Regeneration

**Status**: Implemented
**Date**: 2026-07-17
**Sprint**: 120
**Version**: 11.31.0

## Context

Karmyq currently has two ways to construct a database: load
`infrastructure/postgres/init.sql`, or apply the ordered migration chain. The snapshot has been
maintained separately from the migrations and has drifted behind them. CI compensates by loading
the snapshot and replaying every migration through `scripts/ci-apply-full-schema.sh`, tolerating
known collisions. That workaround proves that the chain can eventually converge one particular
snapshot, but it does not make fresh installs equivalent to the migrated schema and cannot detect
a newly added object that applies cleanly.

The snapshot also contains curated development seed rows that a schema-only dump does not retain.
Any replacement must preserve those rows without turning them into another hand-maintained schema
source. Finally, a generated snapshot of the completed schema must tell `apply-migrations.sh` that
the migrations represented by the snapshot are already applied; otherwise a fresh installation
immediately replays the chain against its own generated result.

## Decision

**`infrastructure/postgres/init.sql` is a generated product of the complete ordered migration
chain, not an independently maintained schema.**

- `scripts/regenerate-init-sql.sh` builds a scratch PostgreSQL database from the current snapshot,
  applies the full migration chain using the repository's collision-tolerant migration semantics,
  takes a normalized schema-only dump, and emits deterministic output.
- The generated schema section is clearly fenced and must never be edited by hand. Schema changes
  continue to enter the repository only as migrations.
- Curated development rows live separately in `infrastructure/postgres/seed-data.sql`. The
  regeneration script appends that reviewable source to the generated schema output.
- The generated snapshot backfills `public.schema_migrations` with exactly the migration filenames
  represented by that run, using the same key format as `scripts/apply-migrations.sh`. Loading the
  snapshot and then applying migrations therefore performs no schema replay.
- Regeneration runs in a dedicated GitHub Actions workflow backed by PostgreSQL 15. The workflow
  validates a second fresh database before publishing `init.sql` as an artifact.
- `scripts/ci-apply-full-schema.sh` remains, but becomes a drift guard. Its `--drift-check` mode
  compares normalized schema-only dumps from before and after migration replay and fails on any
  difference. Existing collision checks and sentinels remain defense in depth.

## Consequences

### Positive

- Local Docker, CI, and new environments begin from the same schema produced by the migration
  chain.
- Schema ownership stays unambiguous: migrations are authored; `init.sql` is regenerated.
- A before/after schema comparison detects cleanly applied drift that error allowlists cannot see.
- Curated development data remains explicit and independently reviewable.
- Fresh installs do not replay migrations already represented by the snapshot.

### Negative / trade-offs

- Updating the migration chain may require running the regeneration workflow and committing its
  artifact before fresh-install parity is restored.
- Reviewers must inspect generated schema diffs as well as the authored migration.
- Regeneration depends on a real PostgreSQL 15 environment; on machines without Docker, GitHub
  Actions is the supported execution path.
- Dump normalization is part of the determinism contract and must be maintained across PostgreSQL
  tooling changes.

## Alternatives considered

- **Continue hand-editing `init.sql` alongside migrations** — rejected because two authored schema
  sources inevitably drift and have already done so.
- **Delete `init.sql` and run all migrations for every fresh install** — rejected because the
  repository's Docker and CI bootstrap paths rely on an initialization snapshot and curated seed
  data.
- **Keep the CI convergence workaround only** — rejected because collision tolerance cannot detect
  a new migration that applies cleanly, and it leaves fresh installs observably behind.
- **Dump the demo database** — rejected because demo is not an authoritative schema source and can
  itself lack tracked migration effects.
- **Embed curated seed SQL inside the regeneration script** — rejected because a dedicated SQL file
  is easier to review, test, and maintain without mixing data with pipeline mechanics.
