/**
 * Sprint 129 (BUG-040) — the demo-health gate must be able to FAIL.
 *
 * BUG-039 left karmyq.com/demo dead for days because nothing watched it. The monitor added in
 * Sprint 129 is the thing that prevents a recurrence, so a green run proves nothing on its own —
 * what matters is that every unhealthy shape is detected. These fixtures are the evidence.
 *
 * Two of the shapes are non-obvious and were missed in the first draft of the plan:
 *   - the deletion deadline is NOT `expires_at + 7 days` (see the deadline block below);
 *   - a check that exits 0 while emitting nothing must still raise, or the monitor is silent
 *     precisely when it is most broken.
 */

import * as fs from 'fs';
import * as path from 'path';

const {
  evaluate,
  interpretPayload,
  WARN_DAYS,
  DELETE_GRACE_DAYS,
} = require('../../scripts/check-demo-health.js');

const { render } = require('../../scripts/demo/render-health-issue.js');

const DAY = 24 * 60 * 60 * 1000;
const BASE_MS = Date.parse('2026-09-13T12:00:00.000Z');

/** A story row as the probe reads it out of requests.help_requests. */
function story(kind: string, over: Record<string, unknown> = {}) {
  return {
    kind,
    // Healthy default: open, unexpired, expiry far away.
    expired: false,
    status: 'open',
    expires_at: new Date(BASE_MS + 60 * DAY).toISOString(),
    updated_at: new Date(BASE_MS - 1 * DAY).toISOString(),
    ...over,
  };
}

function input(over: Record<string, unknown> = {}) {
  return {
    nowMs: BASE_MS,
    session: { status: 200 },
    stories: [story('ordinary'), story('provider')],
    ...over,
  };
}

describe('demo-health gate — the grace period is not a shadow of cleanup-service', () => {
  // DELETE_GRACE_DAYS re-derives a number that actually lives in cleanup-service's SQL. The
  // gotcha entry pins the predicate SHAPE ("expired = TRUE AND updated_at <=") but that regex
  // still matches after someone changes 7 to 30 — presence checked, identity not, which is the
  // exact weakness this repo keeps finding in its own gates.
  //
  // So read the live arbiter instead of trusting a comment: if cleanup's grace changes and this
  // constant does not, the monitor computes headroom against the wrong number and stays green
  // while the stories are deleted.
  const cleanupSource = fs.readFileSync(
    path.join(__dirname, '..', '..', 'services', 'cleanup-service', 'src', 'jobs', 'expirationJob.ts'),
    'utf8',
  );

  it('agrees with every grace period cleanup-service actually applies', () => {
    const graces = [...cleanupSource.matchAll(/getDate\(\)\s*-\s*(\d+)\s*\)/g)].map((m) => Number(m[1]));

    // Guard against the assertion passing vacuously if the source is refactored past this regex.
    expect(graces.length).toBeGreaterThan(0);
    for (const grace of graces) {
      expect(grace).toBe(DELETE_GRACE_DAYS);
    }
  });

  it('still describes the predicate cleanup actually uses', () => {
    expect(cleanupSource).toMatch(/expired = TRUE AND updated_at <=/);
    // Marking is gated on status = 'open'; the "not-deletable" branch depends on that staying true.
    expect(cleanupSource).toMatch(/expired = FALSE AND status = 'open'/);
  });
});

describe('demo-health gate — the healthy case', () => {
  it('is ok and raises no issue when the demo works and the stories are far from deletion', () => {
    const r = evaluate(input());
    expect(r.ok).toBe(true);
    expect(r.issue).toBe(0);
    expect(r.errors).toEqual([]);
  });
});

describe('demo-health gate — the demo itself is broken', () => {
  it('FAILS when demo-session returns 503', () => {
    const r = evaluate(input({ session: { status: 503 } }));
    expect(r.ok).toBe(false);
    expect(r.issue).toBe(1);
    expect(JSON.stringify(r.errors)).toMatch(/503/);
  });

  it('FAILS when karmyq.com is unreachable', () => {
    const r = evaluate(input({ session: { error: 'ECONNREFUSED' } }));
    expect(r.ok).toBe(false);
    expect(r.issue).toBe(1);
    expect(JSON.stringify(r.errors)).toMatch(/unreachable|ECONNREFUSED/i);
  });

  it('FAILS when the session probe result is missing entirely', () => {
    const r = evaluate(input({ session: undefined }));
    expect(r.ok).toBe(false);
    expect(r.issue).toBe(1);
  });
});

describe('demo-health gate — the deletion deadline', () => {
  /**
   * cleanup-service is TWO stages and the second keys off a timestamp the first writes:
   *   mark   (hourly): SET expired = TRUE, updated_at = CURRENT_TIMESTAMP
   *                    WHERE expires_at <= now AND expired = FALSE AND status = 'open'
   *   delete (02:00):  WHERE expired = TRUE AND updated_at <= now - 7 days
   * So the real deadline is mark-time + 7 days, not expires_at + 7 days.
   */

  it('FAILS when an unexpired story is inside the warning window', () => {
    // 9 days from deletion => expires_at is 2 days out, +7 days grace.
    const near = story('ordinary', { expires_at: new Date(BASE_MS + 2 * DAY).toISOString() });
    const r = evaluate(input({ stories: [near, story('provider')] }));
    expect(r.ok).toBe(false);
    expect(r.issue).toBe(1);
  });

  it('uses updated_at, NOT expires_at, once a row has been marked expired', () => {
    // Marked 3 days ago => 4 days left, well inside the window. expires_at is deliberately
    // ancient: a check keyed on expires_at would compute a deadline in the past and could
    // just as easily conclude "already gone" or "safe" depending on how it rounded.
    const marked = story('ordinary', {
      expired: true,
      expires_at: new Date(BASE_MS - 90 * DAY).toISOString(),
      updated_at: new Date(BASE_MS - 3 * DAY).toISOString(),
    });
    const r = evaluate(input({ stories: [marked, story('provider')] }));

    expect(r.ok).toBe(false);
    expect(r.issue).toBe(1);
    const ordinary = r.stories.find((s: any) => s.kind === 'ordinary');
    expect(ordinary.basis).toBe('marked');
    expect(ordinary.daysRemaining).toBeCloseTo(4, 5);
  });

  it('moves the deadline LATER when updated_at is bumped after marking', () => {
    // Any later write restarts the seven days. A check that ignored this would warn early
    // and, worse, would report a deadline the database does not agree with.
    const bumped = story('ordinary', {
      expired: true,
      updated_at: new Date(BASE_MS - 1 * DAY).toISOString(),
    });
    const stale = story('provider', {
      expired: true,
      updated_at: new Date(BASE_MS - 6 * DAY).toISOString(),
    });

    const bumpedDays = evaluate(input({ stories: [bumped] })).stories[0].daysRemaining;
    const staleDays = evaluate(input({ stories: [stale] })).stories[0].daysRemaining;

    expect(bumpedDays).toBeGreaterThan(staleDays);
    expect(bumpedDays).toBeCloseTo(6, 5);
    expect(staleDays).toBeCloseTo(1, 5);
  });

  it('does NOT warn for a row that is past expiry but not "open" — it is never marked', () => {
    // The marking UPDATE filters on status = 'open'. A completed/matched request whose expiry
    // has passed is never marked, so this job never deletes it. Warning here would be a false
    // alarm that trains people to ignore the monitor.
    const safe = story('ordinary', {
      status: 'completed',
      expired: false,
      expires_at: new Date(BASE_MS - 30 * DAY).toISOString(),
    });
    const r = evaluate(input({ stories: [safe, story('provider')] }));

    expect(r.ok).toBe(true);
    expect(r.issue).toBe(0);
    expect(r.stories.find((s: any) => s.kind === 'ordinary').basis).toBe('not-deletable');
  });

  it('labels the unexpired estimate as conservative rather than exact', () => {
    const r = evaluate(input());
    expect(r.stories.every((s: any) => s.basis === 'conservative')).toBe(true);
  });

  it('treats exactly WARN_DAYS as unsafe — the boundary falls on the cautious side', () => {
    // safe requires daysRemaining > WARN_DAYS, so exactly 14 raises. Warning a day early is
    // recoverable; warning a day late means the demo is already gone.
    const exact = story('ordinary', {
      expires_at: new Date(BASE_MS + (WARN_DAYS - 7) * DAY).toISOString(),
    });
    const r = evaluate(input({ stories: [exact, story('provider')] }));

    expect(r.stories.find((s: any) => s.kind === 'ordinary').daysRemaining).toBeCloseTo(WARN_DAYS, 5);
    expect(r.ok).toBe(false);
    expect(r.issue).toBe(1);
  });

  it('FAILS when no stories were read at all', () => {
    const r = evaluate(input({ stories: [] }));
    expect(r.ok).toBe(false);
    expect(r.issue).toBe(1);
  });
});

describe('demo-health gate — a silent success is the loudest failure', () => {
  // BUG-035's lesson, and the gap the plan review caught: a check that exits 0 while emitting
  // nothing must not be read as "nothing to report".

  it('raises on an EMPTY payload', () => {
    const r = interpretPayload('');
    expect(r.ok).toBe(false);
    expect(r.issue).toBe(1);
    expect(JSON.stringify(r.errors)).toMatch(/empty|no payload/i);
  });

  it('raises on a whitespace-only payload', () => {
    const r = interpretPayload('   \n  ');
    expect(r.ok).toBe(false);
    expect(r.issue).toBe(1);
  });

  it('raises on an unparseable payload', () => {
    const r = interpretPayload('{not json');
    expect(r.ok).toBe(false);
    expect(r.issue).toBe(1);
    expect(JSON.stringify(r.errors)).toMatch(/parse|malformed/i);
  });

  it('raises on a TRUNCATED but parseable payload missing required fields', () => {
    // The dangerous shape: valid JSON, non-empty, so an `=== ''` guard passes it through.
    const r = interpretPayload(JSON.stringify({ ok: true }));
    expect(r.ok).toBe(false);
    expect(r.issue).toBe(1);
    expect(JSON.stringify(r.errors)).toMatch(/missing|shape|field/i);
  });

  it('raises when ok is true but the stories array is absent', () => {
    const r = interpretPayload(JSON.stringify({ ok: true, issue: 0, errors: [] }));
    expect(r.ok).toBe(false);
    expect(r.issue).toBe(1);
  });

  it('NAMES the missing fields rather than reporting a generic shape error', () => {
    // The required-field check is deliberately redundant for the VERDICT — the array guard and the
    // final ok computation both already fail closed, which an injection test confirmed. What it
    // adds is diagnosis: an operator reading the issue should learn WHICH field was absent, not
    // just that something was wrong. Pinning that here is what keeps the check from being dead
    // weight someone later deletes as duplicated logic.
    const r = interpretPayload(JSON.stringify({ stories: [], errors: [] }));
    expect(r.ok).toBe(false);
    expect(r.issue).toBe(1);
    const message = JSON.stringify(r.errors);
    expect(message).toMatch(/missing required field/i);
    expect(message).toContain('ok');
    expect(message).toContain('issue');
  });

  it('accepts a well-formed payload and preserves its verdict', () => {
    const good = evaluate(input());
    const r = interpretPayload(JSON.stringify(good));
    expect(r.ok).toBe(true);
    expect(r.issue).toBe(0);
  });

  it('preserves a well-formed FAILING verdict rather than overriding it', () => {
    const bad = evaluate(input({ session: { status: 503 } }));
    const r = interpretPayload(JSON.stringify(bad));
    expect(r.ok).toBe(false);
    expect(r.issue).toBe(1);
  });
});

describe('demo-health gate — the crashed case', () => {
  it('raises rather than throwing when handed nonsense input', () => {
    // A crashed gate is the loudest case, not the quietest: evaluate must convert its own
    // internal failure into issue=1, never propagate an exception that skips notification.
    for (const bad of [undefined, null, 42, 'nope', { stories: 'not-an-array' }]) {
      const r = evaluate(bad as any);
      expect(r.ok).toBe(false);
      expect(r.issue).toBe(1);
    }
  });
});

describe('demo-health gate — it leaks nothing into the issue body', () => {
  it('carries no story UUIDs, tokens or persona email in the result', () => {
    const uuid = '54645df7-66be-4e22-8972-13ecfc938edd';
    const r = evaluate(
      input({
        stories: [
          story('ordinary', { id: uuid, token: 'demo.jwt.SUPERSECRET' }),
          story('provider', { id: uuid }),
        ],
      }),
    );

    const serialized = JSON.stringify(r);
    expect(serialized).not.toContain(uuid);
    expect(serialized).not.toContain('SUPERSECRET');
    expect(serialized).not.toContain('@test.karmyq.com');
  });
});

describe('demo-health issue body — the one thing a human actually reads', () => {
  // This renderer used to be 38 lines of JavaScript inside a `node -e '...'` inside `$( )` inside a
  // single-quoted shell string in the workflow YAML — untestable, and one apostrophe in any message
  // away from terminating the quote. It was extracted so these assertions could exist.

  const encode = (obj: unknown) => Buffer.from(JSON.stringify(obj), 'utf8').toString('base64');

  it('renders the findings and the retention table for a real failure', () => {
    const result = evaluate(input({ session: { status: 503 } }));
    const body = render(encode(result), 'success');

    expect(body).toMatch(/### Findings/);
    expect(body).toMatch(/503/);
    expect(body).toMatch(/### Story retention/);
    expect(body).toMatch(/\*\*ordinary\*\*/);
    expect(body).toMatch(/basis: conservative/);
  });

  it('says the state is UNKNOWN when there is no payload — never an empty issue', () => {
    for (const empty of ['', '   ', undefined as unknown as string]) {
      const body = render(empty, 'failure');
      expect(body).toMatch(/did not complete/i);
      expect(body).toMatch(/unknown/i);
      expect(body.trim().length).toBeGreaterThan(0);
    }
  });

  it('names the check outcome so an operator knows the step never ran', () => {
    expect(render('', '')).toMatch(/did not run/);
    expect(render('', 'failure')).toMatch(/failure/);
  });

  it('treats a structurally incomplete payload as a failure, via the tested validator', () => {
    // The whole point of routing through interpretPayload: the rules the suite proves are the
    // rules that run. A truncated-but-parseable payload must not render as if it were healthy.
    const body = render(encode({ ok: true }), 'success');
    expect(body).toMatch(/### Findings/);
    expect(body).toMatch(/missing required field/i);
  });

  it('never renders a story UUID, a token or the persona email', () => {
    const result = evaluate(
      input({
        stories: [
          { kind: 'ordinary', expired: false, status: 'open', id: '54645df7-66be-4e22-8972-13ecfc938edd',
            expires_at: new Date(BASE_MS + 2 * DAY).toISOString(), updated_at: new Date(BASE_MS).toISOString() },
        ],
      }),
    );
    const body = render(encode(result), 'success');

    expect(body).not.toContain('54645df7');
    expect(body).not.toContain('@test.karmyq.com');
    expect(body).not.toMatch(/token/i);
  });
});
