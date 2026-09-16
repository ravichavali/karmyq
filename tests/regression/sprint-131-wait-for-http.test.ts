/**
 * Sprint 131 PR B (BUG-036): the readiness wait CI's "Test Docker Build" job relies on.
 *
 * `sleep 30` then a one-shot curl raced service startup on cold runners. The replacement must
 * (a) retry, (b) require every URL in the SAME attempt, (c) bound each request, not just the
 * attempt count, since a fixed attempt count with an unbounded request never times out, and
 * (d) give up with a non-zero exit. Each is proven here against real HTTP servers with scripted
 * outcomes, by running the real CLI. No regex over YAML stands in for behavior.
 */
import { spawn } from 'child_process';
import { createServer, IncomingMessage, ServerResponse } from 'http';
import { AddressInfo } from 'net';
import { join } from 'path';

const SCRIPT = join(__dirname, '..', '..', 'scripts', 'wait-for-http.js');

type Handler = (req: IncomingMessage, res: ServerResponse, hit: number) => void;
type Scripted = { url: string; hits: () => number; close: () => Promise<void> };

const open: Scripted[] = [];

async function scripted(handler: Handler): Promise<Scripted> {
  let hits = 0;
  const server = createServer((req, res) => {
    hits += 1;
    handler(req, res, hits);
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;
  const s: Scripted = {
    url: `http://127.0.0.1:${port}/health`,
    hits: () => hits,
    close: () =>
      new Promise<void>((resolve) => {
        server.closeAllConnections(); // a hanging handler would otherwise hold close() open
        server.close(() => resolve());
      }),
  };
  open.push(s);
  return s;
}

const status =
  (code: number): Handler =>
  (_req, res) => {
    res.writeHead(code);
    res.end();
  };

afterEach(async () => {
  await Promise.all(open.splice(0).map((s) => s.close()));
});

/**
 * Run the real CLI. Async spawn, never execFileSync: the scripted servers live in THIS process
 * and could not answer a single request while it blocked.
 */
function run(args: string[]): Promise<{ code: number | null; output: string; elapsedMs: number }> {
  return new Promise((resolve) => {
    const started = Date.now();
    const child = spawn(process.execPath, [SCRIPT, ...args]);
    let output = '';
    child.stdout.on('data', (d) => (output += d));
    child.stderr.on('data', (d) => (output += d));
    child.on('close', (code) => resolve({ code, output, elapsedMs: Date.now() - started }));
  });
}

/**
 * Generous per-request timeout by default. CI runs this under Turbo's parallel load, where a
 * healthy 200 from an in-process server can arrive late. With a short timeout that 200 would
 * count as a failed attempt and break the exact hit counts below. Only the hang case passes a
 * short timeout, because timing out is what it tests.
 */
const bounds = (attempts: number, timeoutMs = 5000) => [
  '--attempts', String(attempts),
  '--interval-ms', '50',
  '--timeout-ms', String(timeoutMs),
];

describe('scripts/wait-for-http.js (BUG-036)', () => {
  it('exits 0 on the first attempt when every URL is ready', async () => {
    const auth = await scripted(status(200));
    const web = await scripted(status(200));

    const { code, output } = await run([...bounds(5), auth.url, web.url]);

    expect(code).toBe(0);
    expect(auth.hits()).toBe(1);
    expect(web.hits()).toBe(1);
    expect(output).toContain('ready after 1 attempt(s)');
  }, 20_000);

  it('keeps retrying until a slow service comes up', async () => {
    const auth = await scripted((req, res, hit) => status(hit < 3 ? 503 : 200)(req, res, hit));
    const web = await scripted(status(200));

    const { code, output } = await run([...bounds(5), auth.url, web.url]);

    expect(code).toBe(0);
    expect(auth.hits()).toBe(3);
    expect(web.hits()).toBe(3); // every URL is re-probed each attempt
    expect(output).toContain(`attempt 2/5 not ready: ${auth.url} (HTTP 503)`);
    expect(output).toContain('ready after 3 attempt(s)');
  }, 20_000);

  it('requires every URL to succeed in the same attempt, then gives up', async () => {
    const auth = await scripted(status(200));
    const web = await scripted(status(500));

    const { code, output } = await run([...bounds(4), auth.url, web.url]);

    expect(code).toBe(1);
    expect(auth.hits()).toBe(4);
    expect(web.hits()).toBe(4);
    expect(output).toContain(`${web.url} (HTTP 500)`);
    expect(output).not.toContain(`${auth.url} (`);
    expect(output).toContain('gave up after 4 attempts');
  }, 20_000);

  it('bounds a request that never answers', async () => {
    const hang = await scripted(() => {
      /* accept the request, never respond */
    });

    const { code, output, elapsedMs } = await run([...bounds(3, 300), hang.url]);

    expect(code).toBe(1);
    // At least one request really reached the server and got no answer. Not an exact count: under
    // load, an aborted request may never reach the server before its 300ms timeout.
    expect(hang.hits()).toBeGreaterThanOrEqual(1);
    expect(output).toContain('attempt 3/3 not ready');
    expect(output).toContain('no response within 300ms');
    expect(output).toContain('gave up after 3 attempts');
    // Timers never fire early, so 3 × 300ms timeouts + 2 × 50ms pauses is a hard FLOOR: the script
    // really waited. There is no ceiling assertion, since load makes any fixed ceiling flaky.
    // The proof it cannot hang forever is this test's own 20s Jest timeout.
    expect(elapsedMs).toBeGreaterThanOrEqual(1000);
  }, 20_000);

  it('treats a refused connection as not ready', async () => {
    const gone = await scripted(status(200));
    await gone.close(); // port is now closed
    open.splice(open.indexOf(gone), 1);

    // 1000ms: Linux refuses instantly; Windows loopback may retry SYNs for ~2s. That is enough to
    // reach a verdict either way without stretching this case to 2 × 5000ms under CI load.
    const { code, output } = await run([...bounds(2, 1000), gone.url]);

    // Reason text is platform-dependent (ECONNREFUSED on Linux; Windows loopback may time out
    // first), so assert the verdict, the URL and the give-up, not the reason.
    expect(code).toBe(1);
    expect(output).toContain(`attempt 1/2 not ready: ${gone.url} (`);
    expect(output).toContain('gave up after 2 attempts');
  }, 20_000);

  it('counts a redirect as ready, matching the curl -f it replaces', async () => {
    const web = await scripted((_req, res) => {
      res.writeHead(307, { Location: '/login' });
      res.end();
    });

    const { code } = await run([...bounds(2), web.url]);

    expect(code).toBe(0);
    expect(web.hits()).toBe(1); // not followed
  }, 20_000);

  it('rejects invalid usage with exit 2 before probing anything', async () => {
    const auth = await scripted(status(200));

    const zero = await run(['--attempts', '0', '--interval-ms', '50', '--timeout-ms', '300', auth.url]);
    const noUrl = await run(bounds(2));
    const missingBound = await run(['--attempts', '2', '--interval-ms', '50', auth.url]);

    expect([zero.code, noUrl.code, missingBound.code]).toEqual([2, 2, 2]);
    expect(zero.output).toContain('--attempts must be a positive integer');
    expect(noUrl.output).toContain('at least one URL is required');
    expect(missingBound.output).toContain('--timeout-ms is required');
    expect(auth.hits()).toBe(0);
  }, 20_000);
});
