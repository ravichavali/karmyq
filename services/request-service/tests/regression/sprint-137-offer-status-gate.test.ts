/**
 * Sprint 137 (BUG-088/089): review runtime help-offer status writers and gate B5's release invariant.
 * Setup-time seeders/fixtures are outside service src directories and cannot run alongside a deployed release.
 * releaseOffer and the expiration writers exist, so this gate runs in regression.
 */
import path from 'path';
import { scanFile, scanServices, Surface } from '../helpers/directedSurfaceScan';

type Kind = 'status' | 'dynamic';
type Write = Surface & { kind: Kind; set: string };
type Reviewed = { file: string; kind: Kind; label: string; why: string };
const OFFERS = /\b(?:requests\.)?help_offers\b/i;
const MATCHES = /\b(?:requests\.)?matches\b/i;
const flat = (sql: string) => sql.replace(/\s+/g, ' ').trim();
const UPDATE_SET = /\bUPDATE\s+(?:requests\.)?help_offers\b(?:\s+(?:AS\s+)?\w+)?\s+SET\b/gi;

function statusWrites(hits: Surface[]): Write[] {
  return hits.flatMap((hit) => {
    const updates = [...hit.sql.matchAll(UPDATE_SET)];
    return updates.flatMap((match, index): Write[] => {
      // Identity belongs to this UPDATE, even when a literal contains several statements.
      const end = updates[index + 1]?.index ?? hit.sql.length;
      const sql = flat(hit.sql.slice(match.index, end));
      let rest = hit.sql.slice(match.index! + match[0].length, end);
      // Collapse groups completely so nested calls cannot leave a subquery's WHERE/FROM visible.
      // Preserve interpolation markers: even a parenthesized dynamic SET must require review.
      for (let previous = ''; previous !== rest;) {
        previous = rest;
        rest = rest.replace(/\([^()]*\)/g, (fragment) => fragment.includes('${') ? '${dynamic}' : ' ');
      }
      const set = flat(rest.split(/\b(?:WHERE|RETURNING|FROM)\b|;/i)[0]);
      if (/\$\{/.test(set)) return [{ ...hit, sql, set, kind: 'dynamic' }];
      if (/(?:^|[\s,])status\s*=/i.test(set)) return [{ ...hit, sql, set, kind: 'status' }];
      return [];
    });
  });
}

// A label is distinct within its file and kind; identical extra statements fail the identity check.
const REVIEWED: Reviewed[] = [
  { file: 'services/request-service/src/db/requestStatus.ts', kind: 'status',
    label: "request_id = $1 AND status = 'proposed' AND offer_id IS NOT NULL",
    why: 'closeProposals: under the request lock; free only while matched and no other match holds it' },
  { file: 'services/request-service/src/routes/matches.ts', kind: 'status', label: "AND status = 'active'",
    why: 'POST /matches hold: active to matched, unexpired, under the request lock; the only matched setter' },
  { file: 'services/request-service/src/db/requestStatus.ts', kind: 'status',
    label: "o.id = $1 AND o.status = 'matched'",
    why: 'releaseOffer: reject/cancel/complete release only while matched and no proposed or matched match holds it (BUG-093)' },
  { file: 'services/request-service/src/routes/offers.ts', kind: 'dynamic', label: 'RETURNING *',
    why: 'PUT /offers/:id: title and description only; body status is refused by B1' },
  { file: 'services/request-service/src/routes/offers.ts', kind: 'status', label: "SET status = 'withdrawn'",
    why: "DELETE /offers/:id: the owner's withdrawal" },
  { file: 'services/request-service/src/routes/offers.ts', kind: 'dynamic', label: 'RETURNING id, offerer_visibility_consent',
    why: 'PUT /offers/:id/privacy: privacy fields only' },
  { file: 'services/cleanup-service/src/jobs/expirationJob.ts', kind: 'status',
    label: "request_id = $1 AND status = 'proposed' AND offer_id IS NOT NULL",
    why: "D1: free an expired ask's proposals only while matched and no other match holds the offer" },
  { file: 'services/cleanup-service/src/jobs/expirationJob.ts', kind: 'status',
    label: "WHERE o.status = 'matched' AND NOT EXISTS",
    why: 'D2: free a stranded offer only while no proposed or matched match holds it (BUG-093)' },
];

const matchesReview = (write: Write, reviewed: Reviewed) =>
  write.file === reviewed.file && write.kind === reviewed.kind && write.sql.includes(reviewed.label);
const unreviewed = (writes: Write[], reviewed = REVIEWED) => writes
  .filter((write) => reviewed.filter((entry) => matchesReview(write, entry)).length !== 1)
  .map((write) => `${write.file}:${write.line} ${write.kind}`);
const reviewProblems = (writes: Write[], reviewed = REVIEWED) => reviewed.flatMap((entry) => {
  const count = writes.filter((write) => matchesReview(write, entry)).length;
  return count === 1 ? [] : [{ file: entry.file, label: entry.label, count }];
});

function assertOnlyHoldSetsMatched(writes: Write[]) {
  expect(writes.filter((write) => /(?:^|[\s,])status\s*=\s*'matched'/i.test(write.set))
    .map((write) => ({ file: write.file, hold: write.sql.includes("AND status = 'active'") })))
    .toEqual([{ file: 'services/request-service/src/routes/matches.ts', hold: true }]);
}

const INSERT_MATCHES = /\bINSERT\s+INTO\s+(?:requests\.)?matches\b/gi;
function offerBackedInserts(hits: Surface[]): Surface[] {
  return hits.flatMap((hit) => {
    const anchors = [...hit.sql.matchAll(INSERT_MATCHES)];
    return anchors.flatMap((anchor, index): Surface[] => {
      const end = anchors[index + 1]?.index ?? hit.sql.length;
      const sql = hit.sql.slice(anchor.index, end);
      const afterTable = hit.sql.slice(anchor.index! + anchor[0].length, end)
        .replace(/^\s*(?:AS\s+[A-Za-z_]\w*\b\s*)?/i, '');
      // Positional VALUES/SELECT, dynamic lists, and unreadable lists fail closed.
      // Start HERE, never at a leading CTE's or comment's first parenthesis.
      if (!afterTable.startsWith('(')) return [{ ...hit, sql: flat(sql) }];
      let depth = 0, close = -1;
      for (let i = 0; i < afterTable.length; i++) {
        if (afterTable[i] === '(') depth++;
        if (afterTable[i] === ')' && --depth === 0) { close = i; break; }
      }
      if (close === -1) return [{ ...hit, sql: flat(sql) }];
      const columns = afterTable.slice(1, close);
      return /\boffer_id\b|\$\{/i.test(columns) ? [{ ...hit, sql: flat(sql) }] : [];
    });
  });
}

function assertOnlyPostMatchesInsertsOffer(inserts: Surface[]) {
  expect(inserts.map((insert) => ({ file: insert.file,
    postMatch: insert.sql.includes('(request_id, offer_id, responder_id, status)') })))
    .toEqual([{ file: 'services/request-service/src/routes/matches.ts', postMatch: true }]);
}

describe('Sprint 137: help-offer status writers and runtime release invariant', () => {
  const repo = path.resolve(__dirname, '../../../..');
  const live = statusWrites(scanServices(repo, OFFERS));
  const liveInserts = offerBackedInserts(scanServices(repo, MATCHES));

  it('every live status write is reviewed exactly once', () => {
    expect(unreviewed(live)).toEqual([]);
  });
  it('every reviewed writer exists exactly once (identity, not a count)', () => {
    expect(reviewProblems(live)).toEqual([]);
  });
  it('only the POST /matches hold sets an offer to matched', () => {
    assertOnlyHoldSetsMatched(live);
  });
  it('only POST /matches inserts an offer-backed match in services/*/src', () => {
    assertOnlyPostMatchesInsertsOffer(liveInserts);
  });

  describe('negative fixtures: the real scanner and gate can fail', () => {
    const file = 'services/example/src/x.ts';
    const writes = (source: string) => statusWrites(scanFile(file, source, OFFERS));
    const kinds = (source: string) => writes(source).map((write) => write.kind);
    const inserts = (sql: string) => offerBackedInserts(scanFile(file, 'q(`' + sql + '`)', MATCHES));

    it.each([
      ["q(`UPDATE requests.help_offers SET status = 'active' WHERE id = $1`)", ['status']],
      ["q(`UPDATE requests.help_offers o\n SET title = $2,\n status = 'matched'\n WHERE o.id = $1`)", ['status']],
      ["q('UPDATE help_offers AS o SET status=$2 WHERE o.id=$1')", ['status']],
      ['q(`UPDATE requests.help_offers SET ${sets.join(", ")} WHERE id = $1`)', ['dynamic']],
      ['q(`UPDATE requests.help_offers SET (${columns}) = ROW($1) WHERE id = $2`)', ['dynamic']],
      ['q(`UPDATE requests.help_offers SET title = (SELECT ${column} FROM source WHERE status = $1) WHERE id = $2`)', ['dynamic']],
      ["q(`UPDATE requests.help_offers SET expired = TRUE WHERE status = 'active'`)", []],
      ["q(`UPDATE requests.help_offers SET title = (SELECT m.status FROM requests.matches m WHERE m.status = 'x') WHERE id = $1`)", []],
      ["q(`UPDATE requests.help_offers SET title = (SELECT x FROM y), status = 'active' WHERE id = $1`)", ['status']],
      ["q(`UPDATE requests.help_offers SET title = (SELECT COALESCE(x, y) FROM z WHERE id = $1), status = 'matched' WHERE id = $2`)", ['status']],
      ["q(`UPDATE requests.help_offers SET title = (SELECT COALESCE(m.status, 'x') FROM requests.matches m WHERE m.status = 'matched') WHERE id = $1`)", []],
    ])('classifies SET assignments: %s', (source, expected) => {
      expect(kinds(source as string)).toEqual(expected);
    });

    it('rejects an unreviewed writer, including another writer inside a reviewed file', () => {
      const extra = writes("q(`UPDATE requests.help_offers SET status = 'active' WHERE id = $1`)");
      expect(unreviewed(extra)).toEqual([`${file}:1 status`]);
      expect(unreviewed(extra.map((write) => ({ ...write, file: 'services/request-service/src/db/requestStatus.ts' }))))
        .toEqual(['services/request-service/src/db/requestStatus.ts:1 status']);
    });

    it.each(['separate literals', 'one literal'])('rejects two byte-identical releases in %s', (shape) => {
      const sql = "UPDATE requests.help_offers SET status = 'active' WHERE id = $1 AND status = 'matched'";
      const source = shape === 'one literal' ? 'q(`' + sql + '; ' + sql + '`)' : 'q(`' + sql + '`); q(`' + sql + '`)';
      const duplicate = writes(source);
      const reviewed: Reviewed[] = [{ file, kind: 'status', label: "AND status = 'matched'", why: 'fixture release' }];
      expect(unreviewed(duplicate, reviewed)).toEqual([]);
      expect(reviewProblems(duplicate, reviewed)).toEqual([{ file, label: "AND status = 'matched'", count: 2 }]);
    });

    it('fails B5 when a second writer sets matched', () => {
      const extra = writes("q(`UPDATE requests.help_offers SET status = 'matched' WHERE id = $1`)");
      expect(extra.map((write) => write.kind)).toEqual(['status']);
      expect(() => assertOnlyHoldSetsMatched([...live, ...extra])).toThrow();
    });

    it.each([
      'INSERT INTO requests.matches (request_id, offer_id) VALUES ($1, $2)',
      'WITH x AS (SELECT 1) INSERT INTO requests.matches (request_id, offer_id) VALUES ($1, $2)',
      '/* (request_id) */ INSERT INTO requests.matches (request_id, offer_id) VALUES ($1, $2)',
      'INSERT INTO requests.matches AS m (request_id, offer_id) VALUES ($1, $2)',
      'INSERT INTO requests.matches VALUES ($1, $2)',
      'INSERT INTO requests.matches SELECT * FROM source',
      'INSERT INTO requests.matches (${cols}) VALUES ($1, $2)',
      'INSERT INTO requests.matches (request_id) VALUES ($1); INSERT INTO requests.matches (request_id, offer_id) VALUES ($1, $2)',
      'WITH x AS (INSERT INTO requests.matches (request_id) VALUES ($1) RETURNING *) INSERT INTO requests.matches (request_id, offer_id) VALUES ($1, $2)',
      'INSERT INTO requests.matches (request_id, offer_id',
      'INSERT INTO matches (request_id, offer_id) VALUES ($1, $2)',
    ])('fails B5 for another offer-backed insert: %s', (sql) => {
      const extra = inserts(sql);
      expect(extra.map((insert) => insert.file)).toEqual([file]);
      expect(() => assertOnlyPostMatchesInsertsOffer([...liveInserts, ...extra])).toThrow();
    });

    it.each([
      'INSERT INTO requests.matches (request_id) VALUES ($1) RETURNING offer_id',
      'INSERT INTO requests.matches (request_id) SELECT offer_id FROM source',
      'INSERT INTO requests.matches (request_id) VALUES (offer_id)',
    ])('ignores offer_id outside the column list: %s', (sql) => {
      expect(inserts(sql)).toEqual([]);
      assertOnlyPostMatchesInsertsOffer([...liveInserts, ...inserts(sql)]);
    });

    it('finds every offer-backed insert in one literal', () => {
      const extra = inserts('INSERT INTO requests.matches (offer_id) VALUES ($1); INSERT INTO requests.matches AS m (offer_id) VALUES ($2)');
      expect(extra.map((insert) => insert.file)).toEqual([file, file]);
      expect(() => assertOnlyPostMatchesInsertsOffer([...liveInserts, ...extra])).toThrow();
    });
  });
});
