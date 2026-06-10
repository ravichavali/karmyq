/**
 * Sprint 92 — BUG-002: a request the viewer already has a live offer/match on must
 * not reappear as browsable on reload (e.g. when nothing else is open).
 *
 * The leak: a help_request stays `status='open'` until its match is accepted, so a
 * request the viewer already offered on (their match is `proposed`) still matched the
 * browsable feed queries — every one filtered only on `r.status='open'` +
 * `r.requester_id != $1`, never on the viewer's own engagement.
 *
 * Fix: every browsable open-request query excludes requests where the viewer ($1) already has
 * a `proposed`/`matched` match as responder. In requests.ts these are the skill-matched feed
 * (`/matched/for-user`), the curated feed, and the sister-community feed; the generic
 * `GET /requests` route builds its SQL via `buildRequestsQuery` (utils/queryBuilder.ts), covered
 * behaviorally in tests/unit/queryBuilder.test.ts. Non-open statuses remain excluded by the
 * existing `r.status='open'`.
 *
 * Server-side only — no client-side filter (CLAUDE.md bug-fix rule). This locks the SQL
 * contract the way community-membership-feed.test.ts locks feed columns (behavioral
 * filtering needs a live DB / integration tier).
 */

import * as fs from 'fs';
import * as path from 'path';

const ROUTES_FILE = path.join(__dirname, '..', '..', 'src', 'routes', 'requests.ts');

describe('Sprint 92 BUG-002: browsable feed excludes the viewer’s already-engaged requests', () => {
  const source = fs.readFileSync(ROUTES_FILE, 'utf-8');

  // Normalize whitespace so the multi-line SQL fragment matches regardless of indentation.
  const flat = source.replace(/\s+/g, ' ');

  // The self-engagement exclusion: NOT EXISTS a proposed/matched match by this viewer.
  const exclusionRe =
    /NOT EXISTS \( SELECT 1 FROM requests\.matches m_self WHERE m_self\.request_id = r\.id AND m_self\.responder_id = \$1 AND m_self\.status IN \('proposed', 'matched'\) \)/g;

  it('applies the self-engagement exclusion to every browsable requests.ts feed query', () => {
    const matches = flat.match(exclusionRe) ?? [];
    // /matched/for-user, curated feed, sister-community feed = 3 surfaces in requests.ts.
    // (The generic GET /requests route is covered in tests/unit/queryBuilder.test.ts.)
    expect(matches.length).toBe(3);
  });

  it('still scopes the exclusion to live (proposed/matched) engagement, not terminal states', () => {
    // A completed/cancelled/rejected match must NOT hide a freshly reopened request.
    expect(exclusionRe.test(flat)).toBe(true);
    expect(flat).not.toContain("m_self.status IN ('completed'");
  });
});
