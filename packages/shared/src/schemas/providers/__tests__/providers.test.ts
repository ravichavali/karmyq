/**
 * Tests: Provider Schemas (ADR-041)
 *
 * Validates that provider type definitions and constants are correctly exported.
 */

import { PROVIDER_SERVICE_TYPES } from '../index';

describe('Provider Schemas', () => {
  it('exports known service types', () => {
    expect(PROVIDER_SERVICE_TYPES).toContain('ride');
    expect(PROVIDER_SERVICE_TYPES).toContain('tradesperson');
    expect(PROVIDER_SERVICE_TYPES).toContain('tutor');
    expect(PROVIDER_SERVICE_TYPES).toContain('other');
  });

  it('service types array is non-empty', () => {
    expect(PROVIDER_SERVICE_TYPES.length).toBeGreaterThan(0);
  });
});
