import { scanFile, unguarded } from '../helpers/directedSurfaceScan';
it.each([
  'SELECT r.title FROM requests.help_requests r LEFT JOIN auth.users u ON NOT r.is_directed AND u.id=r.requester_id',
  'SELECT r.title FROM auth.users u RIGHT JOIN requests.help_requests r ON NOT r.is_directed AND u.id=r.requester_id',
  'SELECT r.title FROM requests.help_requests r FULL JOIN auth.users u ON NOT r.is_directed AND u.id=r.requester_id',
  'SELECT r.title FROM requests.help_requests r WHERE NOT r.is_directed AND ${dynamicClause}',
])('rejects ON guards that preserve private rows: %s', sql => {
  expect(unguarded(scanFile('services/example/src/list.ts', `const sql = \`${sql}\`;`))).toHaveLength(1);
});
