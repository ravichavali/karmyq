/**
 * Sprint 135 (BUG-075, BUG-078): a request's status is written in exactly the reviewed places.
 *
 * Scans every SQL literal that names help_requests across services/<service>/src, using the directed-surface scanner
 * over the untruncated tree. It finds each UPDATE of help_requests whose SET clause assigns status, or is built at run
 * time (a dynamic SET could carry status). Every such statement must match exactly one reviewed entry, and every entry
 * must match exactly one statement. A status write anywhere else fails here: route it through
 * src/db/requestStatus.ts.
 */
import fs from 'fs';
import path from 'path';
import { scanFile, scanServices, Surface } from '../helpers/directedSurfaceScan';

type Kind = 'status' | 'dynamic';
type Write = { file: string; line: number; kind: Kind; sql: string };

const flat = (sql: string) => sql.replace(/\s+/g, ' ');
const UPDATE_SET = /\bUPDATE\s+(?:requests\.)?help_requests\b(?:\s+(?:AS\s+)?\w+)?\s+SET\b/gi;

/** Each SET clause of an UPDATE of help_requests in `sql`. */
function setClauses(sql: string): string[] {
  return [...sql.matchAll(UPDATE_SET)].map((m) => {
    let rest = sql.slice((m.index ?? 0) + m[0].length);
    // Collapse groups completely, innermost first: nested calls must not leave a subquery's WHERE/FROM visible.
    // Preserve interpolation markers so a parenthesized dynamic SET still requires review.
    for (let prev = ''; prev !== rest;) {
      prev = rest;
      rest = rest.replace(/\([^()]*\)/g, (fragment) => fragment.includes('${') ? '${dynamic}' : ' ');
    }
    return rest.split(/\b(?:WHERE|RETURNING|FROM)\b/i)[0];
  });
}

/** UPDATEs of help_requests whose SET assigns status ('status') or is built at run time ('dynamic'). */
function statusWrites(hits: Surface[]): Write[] {
  return hits.flatMap((hit) => {
    const sql = flat(hit.sql);
    return setClauses(sql).flatMap((set): Write[] => {
      if (/\$\{/.test(set)) return [{ file: hit.file, line: hit.line, kind: 'dynamic', sql }];
      if (/(?:^|[\s,])status\s*=/i.test(set)) return [{ file: hit.file, line: hit.line, kind: 'status', sql }];
      return [];
    });
  });
}

/** The reviewed writers. `label` is a substring of the statement, distinct within its file and kind. */
const REVIEWED: Array<{ file: string; kind: Kind; label: string; why: string }> = [
  { file: 'services/request-service/src/db/requestStatus.ts', kind: 'status', label: 'SET status = CASE',
    why: 'reconcileRequestStatus: the derived status, under the request lock' },
  { file: 'services/request-service/src/db/requestStatus.ts', kind: 'status', label: "SET status = 'cancelled'",
    why: "markRequestCancelled: the requester's decision, guarded in the write" },
  { file: 'services/cleanup-service/src/jobs/expireDibs.ts', kind: 'status', label: "AND status = 'dibs_pending'",
    why: 'an expired dibs reopens only a request still dibs_pending' },
  { file: 'services/cleanup-service/src/jobs/memoryRetentionJob.ts', kind: 'dynamic', label: 'content_forgotten_at = NOW()',
    why: 'interpolates a constant sentinel into content columns; no status' },
  { file: 'services/request-service/src/routes/requests.ts', kind: 'dynamic', label: 'RETURNING *',
    why: 'PUT /requests/:id: title, description, urgency; a body status is refused with 400 STATUS_NOT_EDITABLE' },
  { file: 'services/request-service/src/routes/requests.ts', kind: 'dynamic', label: 'RETURNING id, is_pu',
    why: 'PUT /requests/:id/privacy: privacy fields only' },
];

const reviewedFor = (w: Write) => REVIEWED.filter((r) => r.file === w.file && r.kind === w.kind && w.sql.includes(r.label));
const unreviewed = (writes: Write[]) => writes.filter((w) => reviewedFor(w).length !== 1).map((w) => `${w.file}:${w.line} ${w.kind}`);

describe('Sprint 135: request-status writes', () => {
  const live = statusWrites(scanServices(path.resolve(__dirname, '../../../..')));

  it('every request-status write in services/*/src is a reviewed one', () => {
    expect(unreviewed(live)).toEqual([]);
  });

  it('every reviewed writer exists exactly once (identity, not a count)', () => {
    expect(REVIEWED.map((r) => live.filter((w) => w.file === r.file && w.kind === r.kind && w.sql.includes(r.label)).length))
      .toEqual(REVIEWED.map(() => 1));
  });

  describe('negative fixtures: the scan can fail', () => {
    const kinds = (source: string) => statusWrites(scanFile('services/example/src/x.ts', source)).map((w) => w.kind);

    it('flags a literal status write, with or without an alias, on one line or many', () => {
      expect(kinds("q(`UPDATE requests.help_requests SET status = 'open' WHERE id = $1`)")).toEqual(['status']);
      expect(kinds("q(`UPDATE requests.help_requests r\n  SET urgency = 'low',\n      status = 'matched'\n  WHERE r.id = $1`)"))
        .toEqual(['status']);
      expect(kinds("q('UPDATE help_requests SET status=$2 WHERE id=$1')")).toEqual(['status']);
    });

    it('a subquery neither hides a later status assignment nor ends the scan of a literal', () => {
      expect(kinds("q(`UPDATE requests.help_requests SET title = (SELECT x FROM y), status = 'open' WHERE id = $1`)"))
        .toEqual(['status']);
      expect(kinds("q(`UPDATE requests.help_requests SET title = (SELECT COALESCE(x, y) FROM z WHERE id = $1), status = 'matched' WHERE id = $2`)"))
        .toEqual(['status']);
      expect(kinds("q(`WITH a AS (UPDATE requests.help_requests SET title = $2 WHERE id = $1 RETURNING id) UPDATE requests.help_requests SET status = 'open' WHERE id = $1`)"))
        .toEqual(['status']);
    });

    it('flags a SET built at run time', () => {
      expect(kinds('q(`UPDATE requests.help_requests SET ${sets.join(", ")} WHERE id = $1`)')).toEqual(['dynamic']);
      expect(kinds('q(`UPDATE requests.help_requests SET (${columns}) = ROW($1) WHERE id = $2`)')).toEqual(['dynamic']);
      expect(kinds('q(`UPDATE requests.help_requests SET title = (SELECT ${column} FROM source WHERE status = $1) WHERE id = $2`)'))
        .toEqual(['dynamic']);
    });

    it('does not flag other columns, a status in the WHERE, or a status inside a subquery', () => {
      expect(kinds("q(`UPDATE requests.help_requests r SET urgency = $1 WHERE id = $2 AND ${notDirectedSql('r')}`)")).toEqual([]);
      expect(kinds("q(`UPDATE requests.help_requests SET expired = TRUE WHERE status = 'open'`)")).toEqual([]);
      expect(kinds("q(`UPDATE requests.help_requests SET title = (SELECT m.status FROM requests.matches m WHERE m.status = 'x') WHERE id = $1`)"))
        .toEqual([]);
      expect(kinds("q(`UPDATE requests.help_requests SET title = (SELECT COALESCE(m.status, 'x') FROM requests.matches m WHERE m.status = 'matched') WHERE id = $1`)"))
        .toEqual([]);
    });

    it('fails the live tree when a route writes a status itself (the pre-Sprint-135 finalize)', () => {
      const injected = statusWrites(scanFile('services/request-service/src/routes/matches.ts',
        "await q(`UPDATE requests.help_requests SET status = 'completed' WHERE id = $1`, [requestId]);"));
      expect(unreviewed([...live, ...injected])).toEqual(['services/request-service/src/routes/matches.ts:1 status']);
    });

    it('fails when the reviewed module gains a second, unreviewed status write', () => {
      const injected = statusWrites(scanFile('services/request-service/src/db/requestStatus.ts',
        "await q(`UPDATE requests.help_requests SET status = 'open' WHERE id = $1`, [id]);"));
      expect(unreviewed([...live, ...injected])).toEqual(['services/request-service/src/db/requestStatus.ts:1 status']);
    });
  });

  // A dynamic SET's columns live in its builder, not in the SQL literal, so the scan above cannot see a status pushed
  // into one. This catches the shape PUT /requests/:id used before Sprint 135; a builder that assigns its list some
  // other way is out of its reach, which is why the route test also pins the 400.
  const statusPushes = (source: string) => [...source.matchAll(/\.push\(\s*[`'"]\s*status\s*=/g)].length;

  it("no reviewed dynamic builder's source pushes a status assignment into its SET list", () => {
    const repo = path.resolve(__dirname, '../../../..');
    const builders = [...new Set(REVIEWED.filter((r) => r.kind === 'dynamic').map((r) => r.file))];
    expect(builders.map((file) => [file, statusPushes(fs.readFileSync(path.join(repo, file), 'utf8'))]))
      .toEqual(builders.map((file) => [file, 0]));
  });

  it("negative fixture: the pre-Sprint-135 PUT builder's status push is caught", () => {
    expect(statusPushes('if (status !== undefined) {\n  updates.push(`status = $${paramCount++}`);\n}')).toBe(1);
    expect(statusPushes("sets.push('status = $2')")).toBe(1);
    expect(statusPushes('updates.push(`title = $${paramCount++}`);')).toBe(0);
  });
});
