#!/usr/bin/env node
/**
 * Sprint 129 (BUG-040) — demo-health gate for `.github/workflows/demo-health.yml`.
 *
 * BUG-039 left `karmyq.com/demo` — the one page a stranger can see without an account — dead for
 * days, because nothing watched it. Rotation is now a single command, but that only helps if
 * somebody runs it, which is exactly the assumption that already failed once. This gate answers
 * two questions daily:
 *
 *   1. Can a demo session actually be issued right now?
 *   2. Are the configured story rows still comfortably far from deletion?
 *
 * It is READ-ONLY. It never rotates, seeds or writes anything.
 *
 * The logic lives here rather than inline in the workflow YAML so it can be unit-tested: a gate
 * that has never been shown to FAIL is worse than no gate, and inline YAML cannot be tested at all.
 * See `tests/regression/sprint-129-demo-health-gate.test.ts`.
 *
 * ── The deletion deadline is not `expires_at + 7 days` ──────────────────────────────────────────
 * cleanup-service runs in two stages, and the second keys off a timestamp the first one writes
 * (`services/cleanup-service/src/jobs/expirationJob.ts`):
 *
 *   mark   (hourly, :18-22)  UPDATE ... SET expired = TRUE, updated_at = CURRENT_TIMESTAMP
 *                            WHERE expires_at <= now AND expired = FALSE AND status = 'open'
 *   delete (02:00,  :84-88)  DELETE ... WHERE expired = TRUE AND updated_at <= now - 7 days
 *
 * So: a marked row's clock runs from its own `updated_at`, any later write RESTARTS it, and a row
 * that was not `'open'` when it expired is never marked and therefore never deleted by this job.
 *
 * ── Nothing here may reach an issue body ────────────────────────────────────────────────────────
 * The workflow renders this result into a public GitHub issue. It therefore carries story KINDS,
 * never story UUIDs, never a token, never the persona email.
 */

'use strict';

/** Days of headroom required before deletion. Chosen so a warning leaves time to rotate. */
const WARN_DAYS = 14;

/** Grace period cleanup-service applies after marking, in days (expirationJob.ts:79). */
const DELETE_GRACE_DAYS = 7;

const DAY_MS = 24 * 60 * 60 * 1000;

function failed(errors) {
  return { ok: false, issue: 1, errors, stories: [] };
}

/**
 * Fields every well-formed payload must carry, DERIVED from the payload shape itself rather than
 * restated — adding a field to `failed()` without adding it here was the one way this could rot.
 *
 * This check is redundant for the VERDICT: the array guard and the final `ok` computation below
 * both already fail closed on everything it catches. What it adds is diagnosis — naming which
 * field is missing instead of a generic shape error — and a regression test pins exactly that, so
 * it is not dead weight to be deleted as duplicated logic.
 */
const REQUIRED_PAYLOAD_FIELDS = Object.keys(failed([]));

function toMs(value) {
  if (value === null || value === undefined) return NaN;
  const ms = typeof value === 'number' ? value : Date.parse(String(value));
  return Number.isFinite(ms) ? ms : NaN;
}

/**
 * When would cleanup-service delete this row, and how confident is that answer?
 *
 * `basis` is part of the contract, not decoration — the workflow prints it, so an operator can
 * tell a real running clock from an estimate without re-deriving the cleanup predicates.
 */
function deadlineFor(row, nowMs) {
  const kind = typeof row?.kind === 'string' ? row.kind : 'unknown';

  if (row?.expired === true) {
    // The clock is already running, from updated_at. This is the exact answer.
    const marked = toMs(row.updated_at);
    if (Number.isNaN(marked)) {
      return { kind, basis: 'unknown', error: `${kind}: expired row has an unreadable updated_at` };
    }
    const deadline = marked + DELETE_GRACE_DAYS * DAY_MS;
    return { kind, basis: 'marked', deadlineMs: deadline, daysRemaining: (deadline - nowMs) / DAY_MS };
  }

  if (row?.status !== 'open') {
    // Never marked, so this job never deletes it. Warning would be a false alarm.
    // Infinity is the honest value and makes `safe` fall out of the same comparison as every
    // other branch, rather than needing a stored flag the caller has to special-case.
    return { kind, basis: 'not-deletable', daysRemaining: Infinity };
  }

  const expires = toMs(row?.expires_at);
  if (Number.isNaN(expires)) {
    return { kind, basis: 'unknown', error: `${kind}: open row has an unreadable expires_at` };
  }

  // CONSERVATIVE, deliberately. Marking lags expiry by up to an hour and deletion by up to a day,
  // so the real deletion is always LATER than this. Warning early is the safe direction.
  const deadline = expires + DELETE_GRACE_DAYS * DAY_MS;
  return { kind, basis: 'conservative', deadlineMs: deadline, daysRemaining: (deadline - nowMs) / DAY_MS };
}

/**
 * Decide whether the demo is healthy.
 *
 * Never throws: a crashed gate is the loudest case, not the quietest (BUG-035). Any internal
 * failure is converted into `issue: 1` so the workflow still files an issue.
 *
 * @returns {{ok: boolean, issue: 0|1, errors: string[], stories: object[]}}
 */
function evaluate(input) {
  try {
    if (!input || typeof input !== 'object') {
      return failed(['demo-health check received no input']);
    }

    const nowMs = Number.isFinite(input.nowMs) ? input.nowMs : Date.now();
    const errors = [];

    // 1. Can a session be issued?
    const session = input.session;
    if (!session || typeof session !== 'object') {
      errors.push('demo-session probe returned no result');
    } else if (session.error) {
      errors.push(`demo-session unreachable: ${session.error}`);
    } else if (session.status !== 200) {
      errors.push(`demo-session returned HTTP ${session.status}, expected 200`);
    }

    // 2. Are the story rows far enough from deletion?
    const rows = input.stories;
    if (!Array.isArray(rows)) {
      return failed([...errors, 'demo-health check read no story rows']);
    }
    if (rows.length === 0) {
      errors.push('demo-health check read no story rows');
    }

    const stories = rows.map((row) => {
      const d = deadlineFor(row, nowMs);
      // One comparison covers every branch: Infinity > WARN_DAYS is true (not deletable),
      // undefined > WARN_DAYS is false (both unreadable-timestamp branches). `safe` is still
      // emitted so the JSON the workflow renders stays self-describing.
      const safe = !d.error && d.daysRemaining > WARN_DAYS;
      if (d.error) errors.push(d.error);
      else if (!safe) {
        errors.push(
          `${d.kind} story is ${d.daysRemaining.toFixed(1)} days from deletion ` +
            `(threshold ${WARN_DAYS}, basis ${d.basis}) — rotate the demo stories`,
        );
      }
      return {
        kind: d.kind,
        basis: d.basis,
        safe,
        daysRemaining: d.daysRemaining,
        deadline: Number.isFinite(d.deadlineMs) ? new Date(d.deadlineMs).toISOString() : null,
      };
    });

    const ok = errors.length === 0;
    return { ok, issue: ok ? 0 : 1, errors, stories };
  } catch (error) {
    return failed([`demo-health check crashed: ${error && error.message ? error.message : String(error)}`]);
  }
}

/**
 * Validate a payload emitted by a previous run of this check.
 *
 * An exit code of 0 is NOT evidence of a successful check. A step that exits 0 without writing to
 * GITHUB_OUTPUT leaves the payload empty, and a truncated write leaves it parseable but incomplete
 * — both of which an `=== ''` guard alone would wave through. Anything short of a complete,
 * well-formed payload is treated as a failure.
 */
function interpretPayload(raw) {
  if (typeof raw !== 'string' || raw.trim() === '') {
    return failed(['demo-health check produced an empty payload — no payload means no evidence']);
  }

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    return failed([`demo-health payload is malformed and could not be parsed: ${error.message}`]);
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return failed(['demo-health payload is not an object — wrong shape']);
  }

  const missing = REQUIRED_PAYLOAD_FIELDS.filter((f) => !(f in parsed));
  if (missing.length > 0) {
    return failed([`demo-health payload is missing required field(s): ${missing.join(', ')}`]);
  }
  if (!Array.isArray(parsed.stories) || !Array.isArray(parsed.errors)) {
    return failed(['demo-health payload has the wrong shape: stories and errors must be arrays']);
  }

  // Well-formed. Preserve its verdict rather than re-deciding — including a failing one.
  const ok = parsed.ok === true && parsed.issue === 0;
  return { ok, issue: ok ? 0 : 1, errors: parsed.errors, stories: parsed.stories };
}

/**
 * Probe `POST /auth/demo-session`. Resolves to a plain result rather than throwing, so a network
 * fault becomes a reported error instead of an unhandled rejection that skips notification.
 *
 * Never returns or logs the issued token.
 */
function probeDemoSession(baseUrl) {
  return new Promise((resolve) => {
    let url;
    try {
      url = new URL('/api/auth/demo-session', baseUrl);
    } catch (error) {
      resolve({ error: `invalid base URL: ${error.message}` });
      return;
    }

    const transport = url.protocol === 'http:' ? require('http') : require('https');
    const body = '{}';
    const req = transport.request(
      {
        hostname: url.hostname,
        port: url.port || undefined,
        path: url.pathname,
        method: 'POST',
        timeout: 15000,
        headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
      },
      (res) => {
        // Drain without retaining: the success body contains a live demo JWT.
        res.resume();
        res.on('end', () => resolve({ status: res.statusCode }));
      },
    );

    req.on('timeout', () => { req.destroy(); resolve({ error: 'demo-session probe timed out' }); });
    req.on('error', (error) => resolve({ error: error.code || error.message }));
    req.write(body);
    req.end();
  });
}

function readStdin() {
  return new Promise((resolve) => {
    let data = '';
    if (process.stdin.isTTY) { resolve(''); return; }
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (chunk) => { data += chunk; });
    process.stdin.on('end', () => resolve(data));
    process.stdin.on('error', () => resolve(''));
  });
}

/**
 * CLI: probe the demo, combine with story rows piped in from `scripts/demo/probe-story-rows.js`,
 * and emit the workflow contract on stdout:
 *
 *   result=<base64 JSON>
 *   issue=<0|1>
 *
 * Exits 0 when healthy and 1 otherwise, but the workflow must NOT rely on that exit code alone —
 * see `issue=` and the notify condition. A crashed gate is the loudest case, not the quietest.
 */
async function main() {
  const baseUrl = process.env.DEMO_BASE_URL || 'https://karmyq.com';
  let result;

  try {
    const raw = await readStdin();
    let probed = { stories: [], errors: ['no story rows were piped to the demo-health check'] };
    if (raw.trim() !== '') {
      try {
        const parsed = JSON.parse(raw);
        probed = {
          stories: Array.isArray(parsed.stories) ? parsed.stories : [],
          errors: Array.isArray(parsed.errors) ? parsed.errors : [],
        };
      } catch (error) {
        probed = { stories: [], errors: [`story probe output was unparseable: ${error.message}`] };
      }
    }

    const session = await probeDemoSession(baseUrl);
    result = evaluate({ session, stories: probed.stories, nowMs: Date.now() });

    // Errors raised by the probe itself (a missing row, an unreadable column) are real findings,
    // not noise — fold them in rather than letting a successful evaluate() mask them.
    if (probed.errors.length > 0) {
      result = { ...result, ok: false, issue: 1, errors: [...result.errors, ...probed.errors] };
    }
  } catch (error) {
    result = failed([`demo-health check crashed: ${(error && error.message) || String(error)}`]);
  }

  const encoded = Buffer.from(JSON.stringify(result), 'utf8').toString('base64');
  process.stdout.write(`result=${encoded}\n`);
  process.stdout.write(`issue=${result.issue}\n`);

  for (const error of result.errors) console.error(`DEMO-HEALTH: ${error}`);
  console.error(result.ok ? 'Demo health OK.' : 'Demo health FAILED.');

  process.exitCode = result.ok ? 0 : 1;
}

module.exports = {
  WARN_DAYS,
  DELETE_GRACE_DAYS,
  evaluate,
  interpretPayload,
  deadlineFor,
  probeDemoSession,
};

if (require.main === module) {
  main().catch((error) => {
    // Last-resort: still emit a well-formed payload so the workflow has something to report.
    const result = failed([`demo-health check crashed: ${(error && error.message) || String(error)}`]);
    process.stdout.write(`result=${Buffer.from(JSON.stringify(result), 'utf8').toString('base64')}\n`);
    process.stdout.write('issue=1\n');
    console.error('Demo health FAILED (crashed).');
    process.exitCode = 1;
  });
}
