/**
 * Sprint 86 / ADR-067 — `category → payload_type` adapter (TDD, the sleeper-bug guard).
 *
 * The DB `category` column is mixed-vocabulary: on INSERT it gets the same value as the
 * 5-value `request_type` enum (`generic|ride|borrow|service|event`), while older/seed/sim
 * rows hold skill tokens (`moving`, `tech_support`, `gardening`, …) that the matching SQL
 * keys off (requests.ts:112–123). The card's `RequestPayloadRenderer` switches on the fine
 * subtype (`moving_help`/`tech_help`/…), so `categoryToPayloadType` must translate the known
 * aliases and return `undefined` for everything else (the renderer no-ops safely on an
 * unknown type / empty payload — no regression).
 *
 * Per the robust-testing standard: assert exact mapped values, no stubs, prove the
 * unknown→undefined contract that keeps the renderer safe.
 */

import { categoryToPayloadType } from '../../src/services/payloadType';

describe('categoryToPayloadType — the category↔payload-subtype normalization map', () => {
  it('passes through categories already aligned with the renderer vocabulary', () => {
    expect(categoryToPayloadType('transportation')).toBe('transportation');
    expect(categoryToPayloadType('childcare')).toBe('childcare');
    expect(categoryToPayloadType('home_repair')).toBe('home_repair');
    expect(categoryToPayloadType('pet_care')).toBe('pet_care');
    expect(categoryToPayloadType('food')).toBe('food');
    expect(categoryToPayloadType('moving_help')).toBe('moving_help');
    expect(categoryToPayloadType('tech_help')).toBe('tech_help');
  });

  it('translates the legacy skill-token aliases the matching SQL keys off', () => {
    // These are the older/seed/sim `category` values — the renderer never knew them.
    expect(categoryToPayloadType('moving')).toBe('moving_help');
    expect(categoryToPayloadType('tech_support')).toBe('tech_help');
    expect(categoryToPayloadType('cooking')).toBe('food');
    expect(categoryToPayloadType('ride')).toBe('transportation');
  });

  it('returns undefined for unrecognized tokens — renderer no-ops safely (no regression)', () => {
    // Skill tokens with no payload renderer, the coarse request_type enum values, and junk.
    for (const unknown of [
      'gardening',
      'tutoring',
      'language',
      'professional_advice',
      'cleaning',
      'generic',
      'borrow',
      'service',
      'event',
      'ride_share',
      '',
    ]) {
      expect(categoryToPayloadType(unknown)).toBeUndefined();
    }
  });

  it('returns undefined for null/undefined category (older rows, missing data)', () => {
    expect(categoryToPayloadType(null)).toBeUndefined();
    expect(categoryToPayloadType(undefined)).toBeUndefined();
  });
});
