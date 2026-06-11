/**
 * Coerce an axios/API error into a human-readable STRING for display.
 *
 * The shared `sendError` envelope is `{ success:false, error:{ code, message } }` — an
 * OBJECT (it violates the CLAUDE.md `error: "CODE"` string contract; logged to
 * docs/IDEAS.md as an architecture follow-up). Rendering that object directly into JSX
 * throws React #31 ("Objects are not valid as a React child") → the whole-app
 * ErrorBoundary trips. Funnel API errors through this helper before putting them in
 * component state so a string is always rendered.
 *
 * Resolution order: error.message → error.code → string error → top-level message →
 * err.message → fallback.
 */
export function getErrorMessage(err: any, fallback = 'Something went wrong'): string {
  const data = err?.response?.data
  const error = data?.error
  const candidate =
    (error && typeof error === 'object' ? error.message ?? error.code : undefined) ??
    (typeof error === 'string' ? error : undefined) ??
    (typeof data?.message === 'string' ? data.message : undefined) ??
    (typeof err?.message === 'string' ? err.message : undefined)
  return typeof candidate === 'string' && candidate.length > 0 ? candidate : fallback
}
