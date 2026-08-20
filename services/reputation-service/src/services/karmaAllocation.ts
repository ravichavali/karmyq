/**
 * Karma Allocation Strategy (ADR-032) — compatibility surface.
 *
 * Sprint 126 (ADR-096) MOVED this implementation into `@karmyq/shared`
 * (`src/projections/completedMatchStanding.ts`) so live event delivery, the curated fixture
 * projection, and historical operator replay all allocate karma through one function rather than
 * three copies held "identical" by convention. A duplicated policy is exactly how the fixture and
 * production drifted apart on reason labels, milestone schedule, milestone scope, and community
 * selection in the first place.
 *
 * This module now re-exports the canonical implementation under its historical `allocateKarma`
 * name so existing importers keep working unchanged. Add new callers against
 * `allocateCompletedMatchKarma` from `@karmyq/shared` instead.
 */

export type {
  RequestTypeConfig,
  CommunityKarmaConfig,
  CommunityAllocation,
} from '@karmyq/shared';

export { allocateCompletedMatchKarma as allocateKarma } from '@karmyq/shared';
