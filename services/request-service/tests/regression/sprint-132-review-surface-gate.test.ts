import { scanFile, unguarded } from '../helpers/directedSurfaceScan';
const file = 'services/example/src/list.ts';
it.each([
  'SELECT (SELECT title FROM requests.help_requests r2) FROM requests.help_requests r WHERE ${notDirectedSql("r")} AND ${notDirectedSql("r")}',
  'SELECT (SELECT title FROM requests.help_requests r) FROM requests.help_requests r WHERE ${notDirectedSql("r")} AND ${notDirectedSql("r")}',
  'SELECT r.title FROM requests.help_requests r WHERE ${notDirectedSql("r")} OR 1=1',
  'SELECT r.title FROM requests.help_requests r /* not-directed */ WHERE 1=1',
])('rejects a guard that does not constrain each read: %s', (sql) => {
  expect(unguarded(scanFile(file, `const sql = \`${sql}\`;`))).toHaveLength(1);
});
it('does not allow a widened query merely because an old allowlist substring survives', () => {
  const sql = 'SELECT requester_id FROM requests.help_requests WHERE id = $1 UNION SELECT title FROM requests.help_requests';
  expect(unguarded(scanFile('services/request-service/src/routes/requests.ts', `const sql = \`${sql}\`;`))).toHaveLength(1);
});
