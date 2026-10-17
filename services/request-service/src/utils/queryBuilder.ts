import { notDirectedSql, directedAudienceSql } from '../db/directedAudience';
import { requestReadableSql } from '../db/eligibility';
export interface RequestsQueryFilters {
  community_id?: string;
  status?: string;
  type?: string;
  requester_id?: string;
  limit?: string | number;
  offset?: string | number;
  include_admin_notes?: string;
  /**
   * BUG-002: the authenticated viewer. When set, requests the viewer already has a
   * live (proposed/matched) match on are excluded, so an already-engaged request
   * never reappears as browsable on reload. (GET /requests is the generic browse
   * route behind authMiddleware — the curated/sister/matched feeds exclude the same
   * way in requests.ts.)
   */
  viewer_id?: string;
}

export interface RequestsQueryResult {
  queryText: string;
  params: any[];
}

export function buildRequestsQuery(filters: RequestsQueryFilters): RequestsQueryResult {
  const {
    community_id,
    status,
    type,
    requester_id,
    limit = 50,
    offset = 0,
    include_admin_notes,
    viewer_id,
  } = filters;

  const includeAdminNotes = include_admin_notes === 'true' && !!community_id;
  // Each value is bound once, in order; `bind` returns its `$n`, so no position is ever counted by hand.
  const params: any[] = [];
  const bind = (value: unknown) => { params.push(value); return `$${params.length}`; };

  // When include_admin_notes is active, community_id is bound once as $1 for the JOIN and the WHERE
  // filter reuses it. If community_id is absent, includeAdminNotes is always false (see above).
  const adminNotesParam = includeAdminNotes ? bind(community_id) : null;
  const conditions: string[] = [];
  if (status) conditions.push(`r.status = ${bind(status)}`);
  if (community_id) conditions.push(`rc.community_id = ${adminNotesParam ?? bind(community_id)}`);
  // Only a JWT-equal requester selects the private list. All other uses remain browse, including
  // spoofed filters, and browse is gated by the read boundary below (BUG-065).
  const requesterParam = requester_id ? bind(requester_id) : null;
  if (requesterParam) conditions.push(`r.requester_id = ${requesterParam}`);
  if (type) conditions.push(`r.category = ${bind(type)}`);
  // Always bound: with no viewer the boundary still admits trust_network/platform asks, as GET /requests/:id does.
  const viewerParam = bind(viewer_id ?? null);
  const isPrivate = !!requester_id && requester_id === viewer_id;
  if (!isPrivate) conditions.push(requestReadableSql('r', viewerParam));
  if (viewer_id) {
    // BUG-002: exclude requests the viewer already has a live offer/match on.
    conditions.push(`NOT EXISTS (
        SELECT 1 FROM requests.matches m_self
        WHERE m_self.request_id = r.id
          AND m_self.responder_id = ${viewerParam}
          AND m_self.status IN ('proposed', 'matched')
      )`);
  }

  const groupByExtra = includeAdminNotes ? ', ran.note' : '';
  const queryText = `
      SELECT DISTINCT
        r.id, r.requester_id, r.title, r.description,
        r.category, r.urgency, r.status, r.created_at, r.updated_at,
        r.request_type, r.payload, r.requirements,
        r.visibility_scope, r.visibility_max_degrees,
        r.scheduled_for,
        u.name as requester_name,
        STRING_AGG(DISTINCT c.name, ', ') as community_name,
        STRING_AGG(DISTINCT rc.community_id::text, ',') as community_ids${includeAdminNotes ? ',\n        ran.note as admin_note' : ''}
      FROM requests.help_requests r
      LEFT JOIN auth.users u ON r.requester_id = u.id
      LEFT JOIN requests.request_communities rc ON r.id = rc.request_id
      LEFT JOIN communities.communities c ON rc.community_id = c.id${includeAdminNotes ? `
      LEFT JOIN requests.request_admin_notes ran ON ran.request_id = r.id AND ran.community_id = ${adminNotesParam}::uuid` : ''}
      WHERE r.expired = FALSE
        AND ${isPrivate ? directedAudienceSql('r', requesterParam!) : notDirectedSql('r')}
        AND (${conditions.join('\n        AND ') || 'TRUE'})
      GROUP BY r.id, r.requester_id, r.title, r.description, r.category, r.urgency, r.status, r.created_at, r.updated_at, r.request_type, r.payload, r.requirements, r.visibility_scope, r.visibility_max_degrees, r.scheduled_for, u.name${groupByExtra}
      ORDER BY r.created_at DESC
      LIMIT ${bind(limit)} OFFSET ${bind(offset)}`;

  return { queryText, params };
}
