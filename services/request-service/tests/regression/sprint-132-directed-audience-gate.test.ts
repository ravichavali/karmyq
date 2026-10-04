import path from 'path';
import { ALLOWLIST, scanFile, scanServices, unguarded } from '../helpers/directedSurfaceScan';
it('reports exact new unguarded file, including a second query in a file that already has a guard', () => {
  const source = 'const safe = `SELECT r.id FROM requests.help_requests r WHERE ${notDirectedSql("r")}`; const unsafe = `SELECT r.title FROM requests.help_requests r WHERE r.status=\'open\'`;';
  expect(unguarded(scanFile('services/example/src/list.ts', source)).map((h) => h.file)).toEqual(['services/example/src/list.ts']);
});
it('reports an unguarded nested read even when its outer query has a guard', () => {
  const source = 'const sql = `SELECT (SELECT title FROM requests.help_requests r2) FROM requests.help_requests r WHERE ${notDirectedSql("r")}`;';
  expect(unguarded(scanFile('services/example/src/nested.ts', source)).map((h) => h.file)).toEqual(['services/example/src/nested.ts']);
});
it('classifies every SQL literal from the live, untruncated service tree', () => {
  const hits = scanServices(path.resolve(__dirname, '../../../..'));
  expect(hits.some((h) => h.file === 'services/request-service/src/routes/requests.ts')).toBe(true);
  expect(unguarded(hits).map(({ file, line }) => `${file}:${line}`)).toEqual([]);
  for (const a of ALLOWLIST) {
    expect(a.reason.trim()).not.toBe('');
    expect(hits.some((h) => h.file === a.file && h.sql.includes(a.needle))).toBe(true);
  }
});
