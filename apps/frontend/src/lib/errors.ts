/**
 * Coerce an axios/API error into a human-readable STRING for display.
 *
 * Pre-S94 shared `sendError` envelopes used `{ success:false, error:{ code, message } }`.
 * Rendering that object directly into JSX throws React #31 ("Objects are not valid as a
 * React child") → the whole-app ErrorBoundary trips. Funnel API errors through this
 * helper before putting them in component state so a string is always rendered.
 *
 * Resolution order: legacy error.message/error.code object → top-level message (the
 * canonical S94 human message) → string error (a CODE, last resort) → err.message → fallback.
 * The canonical S94 envelope is `{ message:"Invalid credentials", error:"UNAUTHORIZED" }`, so
 * the human `message` must rank ABOVE the string `error` code — otherwise the UI shows the raw
 * code instead of the readable message.
 */
export function getErrorMessage(err: any, fallback = 'Something went wrong'): string {
  const data = err?.response?.data
  const error = data?.error
  const candidate =
    (error && typeof error === 'object' ? error.message ?? error.code : undefined) ??
    (typeof data?.message === 'string' && data.message.length > 0 ? data.message : undefined) ??
    (typeof error === 'string' ? error : undefined) ??
    (typeof err?.message === 'string' ? err.message : undefined)
  return typeof candidate === 'string' && candidate.length > 0 ? candidate : fallback
}
