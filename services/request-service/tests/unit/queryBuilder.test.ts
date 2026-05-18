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
