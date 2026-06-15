/**
 * S99-001 — community-service returns 403 "Only community admins can view statistics".
 * Mirror that authorization on the client so non-admin members never trigger the failing
 * request, which otherwise floods the console with 403s + "Failed to load statistics" every
 * time a member opens the Stewardship tab.
 */
export interface CommunityStatsViewer {
  isAdmin: boolean
}

export function canViewCommunityStats(viewer: CommunityStatsViewer): boolean {
  return viewer.isAdmin === true
}
