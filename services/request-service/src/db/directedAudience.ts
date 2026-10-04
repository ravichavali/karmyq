// SQL identifiers/parameter positions are supplied only by internal callers; values stay bound.
export function notDirectedSql(alias: string): string {
  return `/* not-directed */ NOT ${alias}.is_directed`;
}
export function directedAudienceSql(alias: string, viewerParam: string): string {
  return `/* directed-audience */ (NOT ${alias}.is_directed
    OR ${alias}.requester_id = ${viewerParam}
    OR ${alias}.directed_to_user_id = ${viewerParam}
    OR (${alias}.directed_to_community_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM communities.members directed_admin
      WHERE directed_admin.community_id = ${alias}.directed_to_community_id
        AND directed_admin.user_id = ${viewerParam}
        AND directed_admin.status = 'active' AND directed_admin.role = 'admin')))`;
}
