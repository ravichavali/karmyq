import { buildRequestsQuery } from '../../src/utils/queryBuilder';

describe('buildRequestsQuery', () => {
  it('returns a base query with no filters', () => {
    const { queryText, params } = buildRequestsQuery({});
    expect(queryText).toContain('FROM requests.help_requests');
    expect(queryText).toContain('r.expired = FALSE');
    expect(params).toHaveLength(2); // limit + offset
  });

  it('adds status filter when provided', () => {
    const { queryText, params } = buildRequestsQuery({ status: 'open' });
    expect(queryText).toContain('r.status = $1');
    expect(params).toContain('open');
  });

  it('adds community_id filter when provided', () => {
    const { queryText, params } = buildRequestsQuery({ community_id: 'abc-123' });
    expect(queryText).toContain('rc.community_id');
    expect(params).toContain('abc-123');
  });

  it('adds requester_id filter when provided', () => {
    const { queryText, params } = buildRequestsQuery({ requester_id: 'user-1' });
    expect(queryText).toContain('r.requester_id');
    expect(params).toContain('user-1');
  });

  it('adds type filter when provided', () => {
    const { queryText, params } = buildRequestsQuery({ type: 'borrow' });
    expect(queryText).toContain('r.category');
    expect(params).toContain('borrow');
  });

  // BUG-002: the generic browse route excludes the viewer's already-engaged requests.
  it('excludes the viewer\'s live proposed/matched requests when viewer_id is set', () => {
    const { queryText, params } = buildRequestsQuery({ viewer_id: 'viewer-9' });
    expect(queryText).toMatch(/NOT EXISTS\s*\(\s*SELECT 1 FROM requests\.matches m_self/);
    expect(queryText).toContain("m_self.status IN ('proposed', 'matched')");
    expect(queryText).toContain('m_self.responder_id = $1');
    expect(params).toContain('viewer-9');
  });

  it('does NOT add the self-engagement exclusion when viewer_id is absent', () => {
    const { queryText } = buildRequestsQuery({ status: 'open' });
    expect(queryText).not.toContain('m_self');
  });

  it('keeps params aligned when viewer_id follows other filters', () => {
    const { queryText, params } = buildRequestsQuery({ status: 'open', viewer_id: 'v1', limit: 5, offset: 0 });
    // status=$1, viewer=$2, then limit=$3 offset=$4
    expect(queryText).toContain('m_self.responder_id = $2');
    expect(queryText).toContain('LIMIT $3 OFFSET $4');
    expect(params).toEqual(['open', 'v1', 5, 0]);
  });

  it('includes admin note join when include_admin_notes is true and community_id given', () => {
    const { queryText, params } = buildRequestsQuery({
      include_admin_notes: 'true',
      community_id: 'comm-1',
    });
    expect(queryText).toContain('request_admin_notes');
    expect(queryText).toContain('ran.note');
    expect(params[0]).toBe('comm-1');
  });

  it('does not include admin note join without community_id', () => {
    const { queryText } = buildRequestsQuery({ include_admin_notes: 'true' });
    expect(queryText).not.toContain('request_admin_notes');
  });

  it('uses provided limit and offset', () => {
    const { params } = buildRequestsQuery({ limit: '10', offset: '20' });
    const lastTwo = params.slice(-2);
    expect(lastTwo).toEqual(['10', '20']);
  });

  it('param count increments correctly with multiple filters', () => {
    const { queryText, params } = buildRequestsQuery({
      status: 'open',
      community_id: 'comm-1',
      requester_id: 'user-1',
    });
    expect(queryText).toContain('$1'); // status
    expect(queryText).toContain('$2'); // community_id
    expect(queryText).toContain('$3'); // requester_id
    expect(params).toContain('open');
    expect(params).toContain('comm-1');
    expect(params).toContain('user-1');
  });
});
