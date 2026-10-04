import { directedAudienceSql, notDirectedSql } from '../../src/db/directedAudience';
it('keeps the explicit switch and requester access when targets are null', () => {
  const sql = directedAudienceSql('r', '$7');
  expect(sql).toContain('NOT r.is_directed');
  expect(sql).toContain('r.requester_id = $7');
  expect(sql).toContain('r.directed_to_user_id = $7');
  expect(sql).toContain("status = 'active'");
  expect(sql).toContain("role = 'admin'");
  expect(sql).not.toContain('directed_to_user_id IS NULL');
  expect(sql).not.toContain('directed_to_community_id IS NULL');
  expect(notDirectedSql('hr')).toBe('/* not-directed */ NOT hr.is_directed');
});
