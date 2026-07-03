import { DB_REQUEST_STATUS, toDbRequestStatus } from '../../src/fixtures/curatedDemo/baselineWriter';
import { CURATED_DEMO_MANIFEST } from '../../src/fixtures/curatedDemo/manifest';

// The live requests.help_requests.chk_help_requests_status constraint (not present in the CI
// init.sql schema, which is why it slipped through) allows only these values.
const ALLOWED = new Set(['open', 'dibs_pending', 'matched', 'completed', 'cancelled']);

describe('Sprint 117 help_requests status is constraint-safe', () => {
  it('maps every lifecycle value to a chk_help_requests_status-allowed status', () => {
    for (const dbStatus of Object.values(DB_REQUEST_STATUS)) {
      expect(ALLOWED.has(dbStatus)).toBe(true);
    }
  });

  it('maps every status used by the curated manifest to an allowed status', () => {
    for (const request of CURATED_DEMO_MANIFEST.requests) {
      expect(ALLOWED.has(toDbRequestStatus(request.status))).toBe(true);
    }
    // Exchange-derived requests are always 'completed', which is allowed.
    expect(ALLOWED.has(toDbRequestStatus('completed'))).toBe(true);
  });
});
