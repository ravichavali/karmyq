/**
 * Sprint 137 (BUG-088/089): the offer-release SQL lives in four places that must stay in step.
 *  - request-service releaseOffer and closeProposals (src/db/requestStatus.ts)
 *  - cleanup-service D1 (expired ask's proposals) and D2 (stranded offers) (src/jobs/expirationJob.ts)
 * D1 must equal closeProposals' offer UPDATE text for text; all four share the hold-set predicate and the CTID
 * version predicate. Nothing else ties the copies together, so this reads the sources as text. Every extraction asserts
 * exactly one match and throws otherwise, and the comparator is proven able to fail on a mutated copy.
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import { ROOT } from './helpers/workspaces';

const REQUEST_SRC = 'services/request-service/src/db/requestStatus.ts';
const CLEANUP_SRC = 'services/cleanup-service/src/jobs/expirationJob.ts';
const read = (rel: string): string => readFileSync(join(ROOT, rel), 'utf8');
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

/** Every mismatch between the copies in the two sources; an empty list means in step. Throws if a statement is missing. */
export function parityProblems(requestSrc: string, cleanupSrc: string): string[] {
  const releaseOffer = statement('releaseOffer', requestSrc, 'o.id = $1');
  const closeProposals = statement('closeProposals', requestSrc, 'o.id IN (SELECT offer_id');
  const d1 = statement('D1', cleanupSrc, 'o.id IN (SELECT offer_id');
  const d2 = statement('D2', cleanupSrc, 'WHERE o.status = \'matched\'', 'o.id IN (SELECT offer_id');
  const problems: string[] = [];

  if (norm(closeProposals) !== norm(d1)) problems.push('D1 offer UPDATE differs from closeProposals');

  const copies: Array<[string, string]> = [['releaseOffer', releaseOffer], ['closeProposals', closeProposals], ['D1', d1], ['D2', d2]];
  for (const [re, what] of [[HOLD_SET, 'hold-set clause'], [VERSION, 'CTID predicate']] as const) {
    const reference = only(`releaseOffer ${what}`, releaseOffer, re);
    for (const [name, sql] of copies) {
      if (only(`${name} ${what}`, sql, re) !== reference) problems.push(`${name} ${what} differs from releaseOffer`);
    }
  }
  return problems;
}

describe('Sprint 137 release SQL parity (request-service <-> cleanup-service)', () => {
  const requestSrc = read(REQUEST_SRC);
  const cleanupSrc = read(CLEANUP_SRC);

  it('keeps D1 equal to closeProposals and the hold-set and CTID predicates identical in all four statements', () => {
    expect(parityProblems(requestSrc, cleanupSrc)).toEqual([]);
  });

  it('the shared hold set still counts completed matches (guards the reference itself)', () => {
    const releaseOffer = statement('releaseOffer', requestSrc, 'o.id = $1');
    expect(only('hold set', releaseOffer, HOLD_SET)).toContain("m.status IN ('proposed', 'matched', 'completed')");
  });

  it('the comparator can fail: a hold-set drift in either file is reported', () => {
    const dropped = (s: string) => s.replace(/m\.status IN \('proposed', 'matched', 'completed'\)/, "m.status IN ('proposed', 'matched')");
    expect(parityProblems(requestSrc, dropped(cleanupSrc)).length).toBeGreaterThan(0);
    expect(parityProblems(dropped(requestSrc), cleanupSrc).length).toBeGreaterThan(0);
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

  it('fails loudly instead of passing vacuously when a statement cannot be found', () => {
    expect(() => parityProblems(requestSrc, 'export const nothing = 1;')).toThrow(/expected exactly 1/);
    expect(() => parityProblems('', cleanupSrc)).toThrow(/expected exactly 1/);
  });
});
