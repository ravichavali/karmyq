export function describeMatchSignal(score?: number | null, reason?: string | null): string | null {
  if (score == null) return reason || null
  if (score >= 75) return reason ? `strong fit · ${reason}` : 'strong fit'
  if (score >= 50) return reason ? `good match · ${reason}` : 'good match'
  if (score >= 30) return reason ? `nearby fit · ${reason}` : 'nearby fit'
  return reason ? `may still help · ${reason}` : 'may still help'
}
