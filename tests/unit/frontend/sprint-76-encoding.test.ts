import { buildValidateInvitationUrl } from '../../../apps/frontend/src/lib/socialGraphUrls';

// Sprint 76 (ADR-060): the two REAL code-scanning alerts were a DOM-XSS via an
// unencoded email in a mailto: href (Movement.tsx) and an unencoded path segment
// in a raw-axios invitation-validate call (api.ts). These tests lock in the
// encoding so the controls cannot silently regress.
//
// Sprint 96 (ADR-076): the founding-circle /join composer no longer builds a
// mailto href from user input at all — it POSTs JSON to the backend intake
// endpoint, which eliminates that DOM-XSS surface outright (a stronger
// remediation than encoding it). The mailto-encoding assertions were therefore
// retired with the helper; the path-param control below still applies.

describe('Sprint 76 — URL encoding (XSS / SSRF hardening)', () => {
  describe('buildValidateInvitationUrl', () => {
    it('encodes the path segment so a slash/space cannot alter the request path', () => {
      expect(buildValidateInvitationUrl('https://api.example.com', 'AB/CD 12')).toBe(
        'https://api.example.com/invitations/validate/AB%2FCD%2012'
      );
    });

    it('leaves a clean code untouched', () => {
      expect(buildValidateInvitationUrl('https://api.example.com', 'ABC123')).toBe(
        'https://api.example.com/invitations/validate/ABC123'
      );
    });
  });
});
