/**
 * Client-side JWT payload decoding (BUG-032, Sprint 120 PR C).
 *
 * `atob` returns one character per BYTE, so a UTF-8 payload decoded with `atob` alone turns every
 * multi-byte character into mojibake — "Southeast PDX Helpers — Group B" arrived in the UI as
 * "Southeast PDX Helpers â€" Group B". Re-reading those bytes through `TextDecoder('utf-8')` gives
 * the real characters back.
 *
 * The payload is NOT verified here — this is display/context state only; every authorization
 * decision re-derives membership from a live lookup.
 */
export function decodeJwtPayload<T = any>(token: string): T | null {
  try {
    const segment = token.split('.')[1]
    if (!segment) return null

    const base64 = segment.replace(/-/g, '+').replace(/_/g, '/')
    const binary = atob(base64)
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0))
    return JSON.parse(new TextDecoder('utf-8').decode(bytes)) as T
  } catch {
    return null
  }
}
