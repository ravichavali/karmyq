import { buildSubscribeMailto } from '../../../apps/landing/src/lib/buildSubscribeMailto';
import { buildValidateInvitationUrl } from '../../../apps/frontend/src/lib/socialGraphUrls';

// Sprint 76 (ADR-060): the two REAL code-scanning alerts were a DOM-XSS via an
// unencoded email in a mailto: href (Movement.tsx) and an unencoded path segment
// in a raw-axios invitation-validate call (api.ts). These tests lock in the
// encoding so the controls cannot silently regress.

describe('Sprint 76 — URL/mailto encoding (XSS / SSRF hardening)', () => {
  describe('buildSubscribeMailto', () => {
    it('percent-encodes special characters in the email so they cannot break out of the body param', () => {
      const result = buildSubscribeMailto('a b+c#d@x.com');
      expect(result).toBe(
        'mailto:contact@karmyq.org?subject=Karmyq%20updates&body=' +
          encodeURIComponent('Please add me to the Karmyq updates list. My email: a b+c#d@x.com')
      );
      // The raw, un-encoded sequence must never appear verbatim in the href.
      expect(result).not.toMatch(/My email: a b\+c#d@x\.com/);
    });

    it('trims surrounding whitespace before encoding', () => {
      expect(buildSubscribeMailto('  me@x.com  ')).toContain(
        encodeURIComponent('My email: me@x.com')
      );
    });
  });

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
