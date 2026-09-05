const reg = require('../../scripts/gotcha-registry.js');

const TODAY = new Date('2026-09-04T00:00:00Z');

function e(data: object) {
  return { slug: 'a', jsonPath: 'docs/gotchas/a.json', bodyPath: 'docs/gotchas/a.md',
           data, body: '' };
}

describe('gotcha registry — dates and renewal', () => {
  it('accepts an unexpired entry inside the cap', () => {
    expect(reg.checkDates(e({ created: '2026-09-04', expires: '2027-01-01' }), TODAY)).toEqual([]);
  });

  // The span here is deliberately INSIDE the cap so this fixture isolates the expiry
  // failure. An earlier draft used created 2025-01-01, which is a 610-day span and
  // therefore produced two errors while asserting exactly one.
  it('FAILS an entry past its review date, and only for that reason', () => {
    expect(reg.checkDates(e({ created: '2026-08-01', expires: '2026-09-03' }), TODAY)).toEqual([
      expect.stringContaining('past its review date'),
    ]);
  });

  it('FAILS a malformed date', () => {
    expect(reg.checkDates(e({ created: '2026-13-45', expires: '2027-01-01' }), TODAY)).toEqual([
      expect.stringContaining('not a valid ISO date'),
    ]);
  });

  it('accepts a span of exactly the cap', () => {
    const created = '2026-09-04';
    const expires = new Date(Date.UTC(2026, 8, 4) + reg.REVIEW_CAP_DAYS * 86400000)
      .toISOString().slice(0, 10);
    expect(reg.checkDates(e({ created, expires }), TODAY)).toEqual([]);
  });

  it('FAILS a span one day beyond the cap', () => {
    const created = '2026-09-04';
    const expires = new Date(Date.UTC(2026, 8, 4) + (reg.REVIEW_CAP_DAYS + 1) * 86400000)
      .toISOString().slice(0, 10);
    expect(reg.checkDates(e({ created, expires }), TODAY)).toEqual([
      expect.stringContaining('exceeds the review cap'),
    ]);
  });

  // Expiry is measured from the LATEST review, not from creation.
  it('measures the cap from the most recent renewal, not from created', () => {
    expect(
      reg.checkDates(
        e({
          created: '2024-01-01',
          expires: '2027-06-01',
          renewed: [{ date: '2026-08-01', evidence: 're-probed 2026-08-01: still true' }],
        }),
        TODAY,
      ),
    ).toEqual([]);
  });

  it('accepts many evidenced renewals on an unverifiable entry', () => {
    expect(
      reg.checkDates(
        e({
          created: '2024-01-01',
          expires: '2027-06-01',
          renewed: [
            { date: '2025-01-01', evidence: 'probe A' },
            { date: '2025-09-01', evidence: 'probe B' },
            { date: '2026-08-01', evidence: 'probe C' },
          ],
        }),
        TODAY,
      ),
    ).toEqual([]);
  });

  it('FAILS a renewal with no evidence', () => {
    expect(
      reg.checkDates(
        e({ created: '2026-01-01', expires: '2027-01-01', renewed: [{ date: '2026-08-01' }] }),
        TODAY,
      ),
    ).toEqual([expect.stringContaining('evidence')]);
  });

  it('FAILS a renewal with a malformed date', () => {
    expect(
      reg.checkDates(
        e({ created: '2026-01-01', expires: '2027-01-01',
            renewed: [{ date: 'last tuesday', evidence: 'x' }] }),
        TODAY,
      ),
    ).toEqual([expect.stringContaining('not a valid ISO date')]);
  });
});
