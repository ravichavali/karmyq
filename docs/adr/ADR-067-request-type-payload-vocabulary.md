# ADR-067: `request_type` vs `payload_type` Vocabulary

**Status**: Implemented
**Date**: 2026-06-04
**Sprint**: 86
**Version**: 10.10.0

## Context

[ADR-066](ADR-066-unified-feed-model.md) shipped the unified feed but left one modelling seam
documented and untouched: `RequestCardData.request_type` was *typed* as the fine payload-subtype
union (`transportation | moving_help | tech_help | …`, what `RequestPayloadRenderer` switches on)
but at runtime carried the coarse 5-value `request_type_enum` (`generic | ride | borrow | service |
event`, the filter dimension). One field was being asked to do two incompatible jobs:

1. **Filtering** — "show me only `ride` requests" needs the coarse enum.
2. **Payload rendering** — "render the pickup/dropoff detail" needs the fine subtype.

Because the card fed the *enum* value to a renderer that switches on the *subtype*, the polymorphic
payload detail never rendered on the canonical card (the `switch` always missed).

Complicating the fix, the fine subtype isn't stored cleanly anywhere. The `help_requests.category`
column is the only source, and it is **mixed-vocabulary**:

- On INSERT (`requests.ts`), `category` is written the *same value as* `request_type` — so newer rows
  hold the coarse enum (`generic`, `ride`, …).
- Older / seed / simulation rows hold **skill tokens** (`moving`, `tech_support`, `gardening`,
  `cooking`, …) — the values the matching SQL keys off (`r.category = 'moving' AND s.skill IN (…)`).

So `category` is neither cleanly the enum nor cleanly the renderer's subtype. A raw `category`
passthrough to the renderer would be **wrong** (it would feed `moving`/`generic`/`gardening`, none of
which the renderer knows).

## Decision

Separate the two concerns into two fields, with **no database migration**:

- **`request_type`** stays the coarse 5-value `request_type_enum` — the filter dimension. Unchanged.
- **`payload_type`** is a new derived field (the fine subtype union) that drives `RequestPayloadRenderer`.
  It is computed from `category` through a single canonical adapter, `categoryToPayloadType()`
  (`services/request-service/src/services/payloadType.ts`):
  - Known aliases are translated to the renderer vocabulary: `moving → moving_help`,
    `tech_support → tech_help`, `cooking → food`, `ride → transportation`, and the already-aligned
    `transportation`/`childcare`/`home_repair`/`pet_care`/`food` pass through.
  - **Everything else returns `undefined`** — the coarse enum values (`generic`/`borrow`/`service`/
    `event`), unmapped skill tokens (`gardening`/`tutoring`/…), and null/empty. `RequestPayloadRenderer`
    already no-ops on an unknown type / empty payload, so an unmapped category is a safe fallback, never
    a regression.

`categoryToPayloadType` is the **single** place this translation happens — routes and components never
inline a category map. The seam fix is applied in `toRequestCardData`, so **both** the Dashboard Home
(`view=home`) and Community (`view=community`) views light up payload detail.

## Consequences

**Easier:**
- Payload detail (pickup/dropoff, moving floors, tech device, etc.) finally renders on the one
  canonical `RequestCard`, on both feed views.
- Filtering (coarse enum) and payload rendering (fine subtype) are no longer entangled in one field.
- One audited translation point means the messy `category` vocabulary is contained, not spread.

**Harder / deferred:**
- The map is alias-driven; a genuinely new `category` value renders without payload detail until its
  alias is added to `categoryToPayloadType`. This is intentional (safe degradation) and unit-tested
  (`tests/unit/payload-type.test.ts` asserts the alias cases and the unknown→undefined contract).
- The longer-term cleanup — normalizing `category` itself, or a dedicated `payload_type` column — is
  still possible later; this ADR deliberately avoids a migration.

## References
- [ADR-066: Unified Feed Model](ADR-066-unified-feed-model.md) — the seam this closes
- `services/request-service/src/services/payloadType.ts` — the canonical adapter
- `services/request-service/tests/unit/payload-type.test.ts` — the map + unknown→undefined guard
