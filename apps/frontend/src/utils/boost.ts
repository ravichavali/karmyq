export function isBoostActive(req: { is_boosted?: boolean | null; boosted_expires_at?: string | null }): boolean {
  if (!req.is_boosted) return false
  if (!req.boosted_expires_at) return false
  return new Date(req.boosted_expires_at) > new Date()
}
