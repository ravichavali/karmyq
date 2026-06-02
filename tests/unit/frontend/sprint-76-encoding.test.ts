import { buildFoundingCircleMailto } from '../../../apps/landing/src/lib/buildSubscribeMailto';
import { buildValidateInvitationUrl } from '../../../apps/frontend/src/lib/socialGraphUrls';

// Sprint 76 (ADR-060): the two REAL code-scanning alerts were a DOM-XSS via an
// unencoded email in a mailto: href (Movement.tsx) and an unencoded path segment
// in a raw-axios invitation-validate call (api.ts). These tests lock in the
// encoding so the controls cannot silently regress.

describe('Sprint 76 — URL/mailto encoding (XSS / SSRF hardening)', () => {
  describe('buildFoundingCircleMailto', () => {
    it('percent-encodes every user field so none can break out of the body param', () => {
      const result = buildFoundingCircleMailto({
        email: 'a b+c#d@x.com',
        lens: 'organizer & builder',
        contribution: 'UX / research',
        concern: '<script>alert(1)</script>',
      });

      expect(result).toBe(
        'mailto:contact@karmyq.org?subject=Founding%20circle%20interest&body=' +
          encodeURIComponent(
            [
              'I am interested in the Karmyq founding circle.',
              '',
              'Email: a b+c#d@x.com',
              'Lens: organizer & builder',
              'What I can contribute: UX / research',
              'What I want to pressure-test: <script>alert(1)</script>',
            ].join('\n')
          )
      );
      // The raw, un-encoded sequence must never appear verbatim in the href.
      expect(result).not.toMatch(/<script>alert\(1\)<\/script>/);
    });

    it('trims surrounding whitespace before encoding', () => {
      expect(
        buildFoundingCircleMailto({
          email: '  me@x.com  ',
          lens: '  researcher  ',
          contribution: '  critique  ',
          concern: '  governance  ',
        })
      ).toContain(
        encodeURIComponent('Email: me@x.com')
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
