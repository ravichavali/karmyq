/**
 * Sprint 137 (BUG-088/089): the offer-release SQL lives in four places that must stay in step.
 *  - request-service releaseOffer and closeProposals (src/db/requestStatus.ts)
 *  - cleanup-service D1 (expired ask's proposals) and D2 (stranded offers) (src/jobs/expirationJob.ts)
 * D1 must equal closeProposals' offer UPDATE text for text, and D2 must equal releaseOffer with only its per-offer
 * scope (`o.id = $1 AND`) removed — whole statements, so nothing inside D2's NOT EXISTS can drift unseen. closeProposals'
 * full NOT EXISTS must be releaseOffer's plus exactly the same-request proposal exclusion. All four share the hold-set
 * and CTID version predicates, and the SET clause (status, expired flag, updated_at; BUG-093/094, Sprint 138).
 * Nothing else ties the copies together, so this reads the sources as text. Every
 * extraction asserts exactly one match and throws otherwise, and the comparator is proven able to fail on mutated copies.
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import { ROOT } from './helpers/workspaces';

const REQUEST_SRC = 'services/request-service/src/db/requestStatus.ts';
const CLEANUP_SRC = 'services/cleanup-service/src/jobs/expirationJob.ts';
const read = (rel: string): string => readFileSync(join(ROOT, rel), 'utf8');
const D2_DRIFT = 'D2 differs from releaseOffer without its per-offer scope';
const CLOSE_DRIFT = "closeProposals' NOT EXISTS differs from releaseOffer's plus the same-request proposal exclusion";
const norm = (s: string): string => s.replace(/\s+/g, ' ').trim();

/** Every template literal that opens as the offer-free UPDATE. Backticks never occur inside these statements. */
const OFFER_FREE = /`(UPDATE requests\.help_offers o SET status = 'active'[^`]*)`/g;
const HOLD_SET = /NOT EXISTS \(SELECT 1 FROM requests\.matches m WHERE m\.offer_id = o\.id AND m\.status IN \([^)]*\)/g;
const VERSION = /AND o\.ctid = \(SELECT visible_offer\.ctid FROM requests\.help_offers visible_offer WHERE visible_offer\.id = o\.id\)/g;

/** The one match of `re` in `text`, or a loud failure. */
function only(label: string, text: string, re: RegExp, group = 0): string {
  const hits = [...text.matchAll(new RegExp(re.source, re.flags))];
  if (hits.length !== 1) throw new Error(`${label}: expected exactly 1 match of ${re}, found ${hits.length}`);
  return norm(hits[0][group]);
}

/** The offer-free UPDATE literals of one file, keyed by a distinguishing fragment, each found exactly once. */
function statement(label: string, src: string, mustContain: string, mustNotContain?: string): string {
  const all = [...src.matchAll(OFFER_FREE)].map((m) => m[1]);
  const picked = all.filter((s) => s.includes(mustContain) && !(mustNotContain && s.includes(mustNotContain)));
  if (picked.length !== 1) {
    throw new Error(`${label}: expected exactly 1 offer-free UPDATE containing ${mustContain}, found ${picked.length} of ${all.length}`);
  }
  return norm(picked[0]);
}

/** The whole `NOT EXISTS (...)` clause of one normalized statement, parentheses balanced; exactly one per statement. */
function notExists(label: string, sql: string): string {
  const starts = [...sql.matchAll(/NOT EXISTS \(/g)];
  if (starts.length !== 1) throw new Error(`${label}: expected exactly 1 NOT EXISTS, found ${starts.length}`);
  const from = starts[0].index ?? 0;
  let depth = 0;
  for (let i = from + 'NOT EXISTS '.length; i < sql.length; i++) {
    if (sql[i] === '(') depth++;
    else if (sql[i] === ')' && --depth === 0) return sql.slice(from, i + 1);
  }
  throw new Error(`${label}: NOT EXISTS has no closing parenthesis`);
}

const PER_OFFER_SCOPE = 'WHERE o.id = $1 AND ';
const SET_CLAUSE = /SET .*? WHERE /g;
const SAME_REQUEST_EXCLUSION = " AND NOT (m.request_id = $1 AND m.status = 'proposed')";

/** Every mismatch between the copies in the two sources; an empty list means in step. Throws if a statement is missing. */
export function parityProblems(requestSrc: string, cleanupSrc: string): string[] {
  const releaseOffer = statement('releaseOffer', requestSrc, 'o.id = $1');
  const closeProposals = statement('closeProposals', requestSrc, 'o.id IN (SELECT offer_id');
  const d1 = statement('D1', cleanupSrc, 'o.id IN (SELECT offer_id');
  const d2 = statement('D2', cleanupSrc, 'WHERE o.status = \'matched\'', 'o.id IN (SELECT offer_id');
  const problems: string[] = [];

  if (norm(closeProposals) !== norm(d1)) problems.push('D1 offer UPDATE differs from closeProposals');

  if (releaseOffer.split(PER_OFFER_SCOPE).length !== 2) {
    throw new Error(`releaseOffer: expected its per-offer scope "${PER_OFFER_SCOPE}" exactly once`);
  }
  if (releaseOffer.replace(PER_OFFER_SCOPE, 'WHERE ') !== d2) problems.push(D2_DRIFT);

  const held = notExists('releaseOffer', releaseOffer);
  if (notExists('closeProposals', closeProposals) !== `${held.slice(0, -1)}${SAME_REQUEST_EXCLUSION})`) {
    problems.push(CLOSE_DRIFT);
  }

  const copies: Array<[string, string]> = [['releaseOffer', releaseOffer], ['closeProposals', closeProposals], ['D1', d1], ['D2', d2]];
  for (const [re, what] of [[HOLD_SET, 'hold-set clause'], [VERSION, 'CTID predicate']] as const) {
    const reference = only(`releaseOffer ${what}`, releaseOffer, re);
    for (const [name, sql] of copies) {
      if (only(`${name} ${what}`, sql, re) !== reference) problems.push(`${name} ${what} differs from releaseOffer`);
    }
  }
  // Sprint 138: the SET clause (statement text from SET up to WHERE) is one rule, so all four must carry releaseOffer's.
  const setOf = (name: string, sql: string): string => only(`${name} SET clause`, sql, SET_CLAUSE);
  const setReference = setOf('releaseOffer', releaseOffer);
  for (const [name, sql] of copies) {
    if (setOf(name, sql) !== setReference) problems.push(`${name} SET clause differs from releaseOffer`);
  }
  return problems;
}

describe('Sprint 137 release SQL parity (request-service <-> cleanup-service)', () => {
  const requestSrc = read(REQUEST_SRC);
  const cleanupSrc = read(CLEANUP_SRC);

  it('keeps D1 equal to closeProposals and the hold-set and CTID predicates identical in all four statements', () => {
    expect(parityProblems(requestSrc, cleanupSrc)).toEqual([]);
  });

  it("the shared hold set is proposed and matched only; a completed match holds nothing (BUG-093, Sprint 138; guards the reference itself)", () => {
    const releaseOffer = statement('releaseOffer', requestSrc, 'o.id = $1');
    const hold = only('hold set', releaseOffer, HOLD_SET);
    expect(hold).toContain("m.status IN ('proposed', 'matched')");
    expect(hold).not.toContain("'completed'");
  });

  it('the comparator can fail: a hold-set drift in either file is reported', () => {
    // Re-adding 'completed' to the hold set of one file at a time: each must be reported.
    const readded = (s: string): string => {
      const out = s.replace(/m\.status IN \('proposed', 'matched'\)/, "m.status IN ('proposed', 'matched', 'completed')");
      expect(out).not.toBe(s);
      return out;
    };
    expect(parityProblems(requestSrc, readded(cleanupSrc)).length).toBeGreaterThan(0);
    expect(parityProblems(readded(requestSrc), cleanupSrc).length).toBeGreaterThan(0);
  });

  it('the comparator can fail: a drifted D1 body or CTID predicate is reported', () => {
    const d1Drift = cleanupSrc.replace("AND offer_id IS NOT NULL", 'AND offer_id IS NOT NULL AND TRUE');
    expect(d1Drift).not.toBe(cleanupSrc);
    expect(parityProblems(requestSrc, d1Drift)).toContain('D1 offer UPDATE differs from closeProposals');
    const ctidDrift = cleanupSrc.replace(/visible_offer\.id = o\.id\)/, 'visible_offer.id = o.id AND TRUE)');
    expect(ctidDrift).not.toBe(cleanupSrc);
    // A changed CTID predicate no longer matches the anchored extraction, which fails loudly.
    expect(() => parityProblems(requestSrc, ctidDrift)).toThrow(/CTID predicate: expected exactly 1/);
  });

  // A predicate added inside a NOT EXISTS after its status list (Codex review of #330). Anchored on the hold-set
  // tail, which occurs once per file (requestStatus.ts's derive has a different `('matched', 'completed'))`).
  const HOLD_TAIL = "'proposed', 'matched'))";
  const widened = (s: string): string => {
    const out = s.replace(HOLD_TAIL, "'proposed', 'matched') AND m.request_id IS NOT NULL)");
    expect(out).not.toBe(s);
    return out;
  };

  it("the comparator can fail: a predicate added inside D2's NOT EXISTS, after the status list, is reported", () => {
    expect(parityProblems(requestSrc, widened(cleanupSrc))).toContain(D2_DRIFT);
  });

  it("the comparator can fail: the same addition inside releaseOffer's NOT EXISTS is reported against D2 and closeProposals", () => {
    expect(parityProblems(widened(requestSrc), cleanupSrc)).toEqual(expect.arrayContaining([D2_DRIFT, CLOSE_DRIFT]));
  });

  it('the comparator can fail: the same-request exclusion drifting in closeProposals and D1 together is reported', () => {
    const sibling = "AND NOT (m.request_id = $1 AND m.status = 'proposed')";
    const drift = (s: string): string => {
      const out = s.replace(sibling, 'AND NOT (m.request_id = $1)');
      expect(out).not.toBe(s);
      return out;
    };
    // D1 still equals closeProposals, so only the shape check against releaseOffer can catch this.
    expect(parityProblems(drift(requestSrc), drift(cleanupSrc))).toEqual([CLOSE_DRIFT]);
  });

  it('the comparator can fail: the SET clause drifting in closeProposals and D1 together is reported by the SET check alone', () => {
    const expiry = 'expired = (o.expired IS TRUE OR (o.expires_at IS NOT NULL AND o.expires_at <= clock_timestamp())), ';
    // Drop the expiry flag from the statement carrying the same-request exclusion (closeProposals in one file, D1 in the other).
    const drift = (s: string): string => {
      const at = s.indexOf('o.id IN (SELECT offer_id');
      const head = s.lastIndexOf(expiry, at);
      expect(head).toBeGreaterThan(-1);
      const out = s.slice(0, head) + s.slice(head + expiry.length);
      expect(out).not.toBe(s);
      return out;
    };
    // D1 still equals closeProposals and every other check is green, so only the SET check can catch this.
    expect(parityProblems(drift(requestSrc), drift(cleanupSrc))).toEqual([
      'closeProposals SET clause differs from releaseOffer',
      'D1 SET clause differs from releaseOffer',
    ]);
  });

  it('fails loudly instead of passing vacuously when a statement cannot be found', () => {
    expect(() => parityProblems(requestSrc, 'export const nothing = 1;')).toThrow(/expected exactly 1/);
    expect(() => parityProblems('', cleanupSrc)).toThrow(/expected exactly 1/);
  });
});
