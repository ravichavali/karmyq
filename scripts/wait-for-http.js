#!/usr/bin/env node
'use strict';

/**
 * Bounded HTTP readiness wait (Sprint 131, BUG-036).
 *
 * Replaces CI's `sleep 30` + one-shot curl in "Test Docker Build". Each attempt probes every URL
 * concurrently, each request capped at --timeout-ms; the attempt succeeds only if ALL URLs answer
 * 2xx/3xx (the `curl -f` verdict, redirects not followed). Between failed attempts it pauses
 * --interval-ms. Worst case: attempts × timeout + (attempts − 1) × interval.
 *
 * Exit: 0 ready · 1 gave up · 2 invalid usage.
 * Proven by tests/regression/sprint-131-wait-for-http.test.ts against real servers.
 */

const USAGE =
  'usage: node scripts/wait-for-http.js --attempts <n> --interval-ms <ms> --timeout-ms <ms> <url> [url...]';

const FLAGS = { '--attempts': 'attempts', '--interval-ms': 'intervalMs', '--timeout-ms': 'timeoutMs' };

function parseArgs(argv) {
  const opts = { urls: [] };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const key = FLAGS[arg];
    if (key) {
      const value = Number(argv[++i]);
      if (!Number.isInteger(value) || value < 1) throw new Error(`${arg} must be a positive integer`);
      opts[key] = value;
    } else if (arg.startsWith('--')) {
      throw new Error(`unknown option ${arg}`);
    } else {
      opts.urls.push(arg);
    }
  }
  for (const [flag, key] of Object.entries(FLAGS)) {
    if (opts[key] === undefined) throw new Error(`${flag} is required`);
  }
  if (opts.urls.length === 0) throw new Error('at least one URL is required');
  return opts;
}

/** Resolves to null when ready, otherwise a short reason. Never throws. */
async function probe(url, timeoutMs) {
  try {
    const res = await fetch(url, { redirect: 'manual', signal: AbortSignal.timeout(timeoutMs) });
    await res.body?.cancel();
    return res.status >= 200 && res.status < 400 ? null : `HTTP ${res.status}`;
  } catch (err) {
    if (err.name === 'TimeoutError') return `no response within ${timeoutMs}ms`;
    return err.cause?.code || err.message;
  }
}

async function waitForHttp({ urls, attempts, intervalMs, timeoutMs }) {
  for (let attempt = 1; attempt <= attempts; attempt++) {
    const reasons = await Promise.all(urls.map((url) => probe(url, timeoutMs)));
    const failures = urls.map((url, i) => [url, reasons[i]]).filter(([, reason]) => reason);

    if (failures.length === 0) {
      console.log(`ready after ${attempt} attempt(s): ${urls.join(', ')}`);
      return { ok: true, attempts: attempt };
    }

    console.error(
      `attempt ${attempt}/${attempts} not ready: ${failures.map(([url, reason]) => `${url} (${reason})`).join('; ')}`,
    );
    if (attempt < attempts) await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  console.error(`gave up after ${attempts} attempts`);
  return { ok: false, attempts };
}

module.exports = { parseArgs, waitForHttp };

if (require.main === module) {
  let opts;
  try {
    opts = parseArgs(process.argv.slice(2));
  } catch (err) {
    console.error(`${err.message}\n${USAGE}`);
    process.exit(2);
  }
  waitForHttp(opts).then(
    ({ ok }) => {
      process.exitCode = ok ? 0 : 1;
    },
    (err) => {
      console.error(err);
      process.exitCode = 1;
    },
  );
}
