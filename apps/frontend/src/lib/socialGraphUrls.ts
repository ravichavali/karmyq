// Pure URL builders for social-graph endpoints that interpolate user-supplied
// values into the path. encodeURIComponent keeps a stray slash/space/`?` from
// altering the request path — defense-in-depth against the request-forgery
// alerts CodeQL raised on api.ts (Sprint 76, ADR-060). The host is always a
// fixed NEXT_PUBLIC_* base URL, so this is hardening, not the SSRF fix itself.
export function buildValidateInvitationUrl(baseUrl: string, invitationCode: string): string {
  return `${baseUrl}/invitations/validate/${encodeURIComponent(invitationCode)}`;
}
