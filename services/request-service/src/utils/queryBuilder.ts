export interface RequestsQueryFilters {
  community_id?: string;
  status?: string;
  type?: string;
  requester_id?: string;
  limit?: string | number;
  offset?: string | number;
  include_admin_notes?: string;
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
  } = filters;

  const includeAdminNotes = include_admin_notes === 'true' && !!community_id;

  let queryText = `
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
      LEFT JOIN communities.communities c ON rc.community_id = c.id${includeAdminNotes ? '\n      LEFT JOIN requests.request_admin_notes ran ON ran.request_id = r.id AND ran.community_id = $1::uuid' : ''}
      WHERE r.expired = FALSE
    `;

  // When include_admin_notes is active, community_id is bound as $1 in the JOIN clause above.
  // We push it once here so the WHERE filter can reference the same $1 param — eliminating
  // a duplicate push. If community_id is absent, includeAdminNotes is always false (see above),
  // so this branch is only entered when community_id is defined.
  const params: any[] = [];
  let paramCount = 1;

  if (includeAdminNotes) {
    // community_id occupies $1 for the JOIN; the WHERE filter below will reuse $1.
    params.push(community_id);
    paramCount++;
  }

  if (status) {
    queryText += ` AND r.status = $${paramCount}`;
    params.push(status);
    paramCount++;
  }

  if (community_id) {
    if (includeAdminNotes) {
      // $1 is already bound to community_id for the JOIN above — reuse it for the WHERE filter.
      queryText += ` AND rc.community_id = $1`;
    } else {
      queryText += ` AND rc.community_id = $${paramCount}`;
      params.push(community_id);
      paramCount++;
    }
  }

  if (requester_id) {
    queryText += ` AND r.requester_id = $${paramCount}`;
    params.push(requester_id);
    paramCount++;
  }

  if (type) {
    queryText += ` AND r.category = $${paramCount}`;
    params.push(type);
    paramCount++;
  }

  const groupByExtra = includeAdminNotes ? ', ran.note' : '';
  queryText += `
      GROUP BY r.id, r.requester_id, r.title, r.description, r.category, r.urgency, r.status, r.created_at, r.updated_at, r.request_type, r.payload, r.requirements, r.visibility_scope, r.visibility_max_degrees, r.scheduled_for, u.name${groupByExtra}
      ORDER BY r.created_at DESC
      LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
  params.push(limit, offset);

  return { queryText, params };
}
