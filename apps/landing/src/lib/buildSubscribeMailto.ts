// Builds the "follow the build" subscribe mailto: href.
// Extracted as a pure helper so the email — user-controlled input — is always
// percent-encoded before it lands in the href, closing the DOM-XSS vector
// CodeQL flagged on Movement.tsx (Sprint 76, ADR-060).
export function buildSubscribeMailto(email: string): string {
  const addr = email.trim();
  const subject = encodeURIComponent('Karmyq updates');
  const body = encodeURIComponent(
    `Please add me to the Karmyq updates list. My email: ${addr}`
  );
  return `mailto:contact@karmyq.org?subject=${subject}&body=${body}`;
}
