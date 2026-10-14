/** Internal SQL identifiers/parameter positions only; user values must remain bound parameters.
 * Callers join auth.user_privacy_settings as ps with LEFT JOIN, for the opt-out default.
 */
export function skillVisibleToSql(ownerAlias: string, viewerParam: string): string {
  return `/* skill-visible */ (
    ${ownerAlias}.id = ${viewerParam}::uuid OR (
      COALESCE(ps.share_skills_with_communities, true) AND EXISTS (
        SELECT 1 FROM communities.members skill_owner_member
        JOIN communities.members skill_viewer_member
          ON skill_viewer_member.community_id = skill_owner_member.community_id
        WHERE skill_owner_member.user_id = ${ownerAlias}.id
          AND skill_owner_member.status = 'active'
          AND skill_viewer_member.user_id = ${viewerParam}::uuid
          AND skill_viewer_member.status = 'active'
      )
    )
  )`;
}

export function activeMemberSql(communityParam: string, viewerParam: string): string {
  return `EXISTS (
    SELECT 1 FROM communities.members skill_membership
    WHERE skill_membership.community_id = ${communityParam}::uuid
      AND skill_membership.user_id = ${viewerParam}::uuid AND skill_membership.status = 'active'
  )`;
}

/** A completed match between the owner and the viewer, in either direction (ADR-100 eligibility).
 * Needs `requests.matches m JOIN requests.help_requests r ON r.id = m.request_id` in scope. */
export function completedPairSql(ownerExpr: string, viewerParam: string): string {
  return `m.status = 'completed' AND (
    (r.requester_id = ${viewerParam}::uuid AND m.responder_id = ${ownerExpr})
    OR (r.requester_id = ${ownerExpr} AND m.responder_id = ${viewerParam}::uuid)
  )`;
}
