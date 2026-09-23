/**
 * Sprint 131 D4 — expo-server-sdk 6 → 7 (#230), exercised through the REAL SDK, loaded the way production loads it.
 *
 * `sprint-131-push-internal-auth.test.ts` mocks `sendPushToUsers`, so before this file no test touched the SDK.
 * Production reaches the SDK through Node's own require() (see the comment in src/lib/expoPush.ts), and Jest's
 * module loader is not Node's, so each case runs the real code in a plain `node` child
 * (tests/helpers/expo-push-child.cjs, whose header describes it) against a local stub of Expo's push API.
 * The child can dial nothing but loopback; the last case proves that guard is armed.
 */
import { execFile, type ChildProcess } from 'node:child_process';
import * as http from 'node:http';
import type { AddressInfo } from 'node:net';
import * as path from 'node:path';
import { buffer } from 'node:stream/consumers';
import * as zlib from 'node:zlib';

interface Message {
  to: string;
  title: string;
  body: string;
  data: Record<string, unknown>;
}

interface ExpoRequest {
  method: string;
  url: string;
  headers: http.IncomingHttpHeaders;
  messages: Message[];
}

interface ChildReport {
  sdkVersion: string;
  sdkLoadedByRequire: boolean;
  outcome: 'resolved' | 'rejected';
  error?: string;
  consoleErrors: unknown[][];
}

interface PushCall {
  tokens: string[];
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

const CHILD = path.resolve(__dirname, '..', 'helpers', 'expo-push-child.cjs');

const OFFER_RECEIVED = {
  title: 'Someone offered to help',
  body: 'You received an offer for $20. Tap to review.',
  data: { type: 'offer_received' },
};

let stub: http.Server;
let stubUrl: string;
let received: ExpoRequest[] = [];
let answer: (messages: Message[]) => { status: number; body: unknown };

const okTicket = (i: number) => ({ status: 'ok', id: `ticket-${i}` });
const okTickets = (messages: Message[]) => ({ status: 200, body: { data: messages.map((_, i) => okTicket(i)) } });

// Below Jest's 30 s testTimeout, so a stalled SDK request fails here, with the child's own output.
const CHILD_DEADLINE_MS = 20_000;
const liveChildren = new Set<ChildProcess>();

/** Run sendPushToUsers in a plain `node` child and return what it reports. */
function sendInChild(call: PushCall, { expoBaseUrl }: { expoBaseUrl?: string } = {}): Promise<ChildReport> {
  return new Promise((resolve, reject) => {
    // An undefined value is dropped from the child's environment, so no inherited EXPO_BASE_URL survives.
    const env = { ...process.env, EXPO_BASE_URL: expoBaseUrl };
    const child = execFile(process.execPath, [CHILD], { env, timeout: CHILD_DEADLINE_MS }, (err, stdout, stderr) => {
      liveChildren.delete(child);
      try {
        if (err) throw new Error(err.killed ? `still running after ${CHILD_DEADLINE_MS} ms; killed` : `exit code ${err.code}`);
        resolve(JSON.parse(stdout.trim().split('\n').pop() ?? '') as ChildReport);
      } catch (e) {
        reject(new Error(`push child did not finish (${(e as Error).message})\nstdout:\n${stdout}\nstderr:\n${stderr}`));
      }
    });
    liveChildren.add(child);
    child.stdin?.end(JSON.stringify({ userIds: ['user-1'], ...call }));
  });
}

beforeAll(async () => {
  stub = http.createServer(async (req, res) => {
    const raw = await buffer(req);
    // The SDK gzips any request body over 1 KiB, so 100 messages always arrive compressed.
    const json = (req.headers['content-encoding'] === 'gzip' ? zlib.gunzipSync(raw) : raw).toString('utf8');
    const messages = JSON.parse(json) as Message[];
    received.push({ method: req.method ?? '', url: req.url ?? '', headers: req.headers, messages });
    const { status, body } = answer(messages);
    res.writeHead(status, { 'content-type': 'application/json', connection: 'close' });
    res.end(JSON.stringify(body));
  });
  await new Promise<void>((resolve) => stub.listen(0, '127.0.0.1', resolve));
  stubUrl = `http://127.0.0.1:${(stub.address() as AddressInfo).port}`;
});

afterAll(async () => {
  // Backstop for a child Jest gave up on: kill it and drop its socket, or close() waits on that socket.
  for (const child of liveChildren) child.kill();
  stub.closeAllConnections();
  await new Promise<void>((resolve) => stub.close(() => resolve()));
});

beforeEach(() => {
  received = [];
  answer = okTickets;
});

describe('sendPushToUsers through the real expo-server-sdk (Sprint 131 D4)', () => {
  it('sends one message per valid token and logs each error ticket with its message and details', async () => {
    const unregistered = '"ExponentPushToken[aaa]" is not a registered push notification recipient';
    const details = { error: 'DeviceNotRegistered', expoPushToken: 'ExponentPushToken[aaa]' };
    answer = (messages) => ({
      status: 200,
      body: { data: messages.map((_, i) => (i === 0 ? { status: 'error', message: unregistered, details } : okTicket(i))) },
    });

    const report = await sendInChild(
      { tokens: ['ExponentPushToken[aaa]', 'not-a-token', 'ExponentPushToken[bbb]'], ...OFFER_RECEIVED },
      { expoBaseUrl: stubUrl },
    );

    expect(report.outcome).toBe('resolved');
    // How production loads it (see src/lib/expoPush.ts); changing this service's "module" setting fails here first.
    expect(report.sdkLoadedByRequire).toBe(true);
    expect(received).toHaveLength(1);
    expect(received[0].method).toBe('POST');
    expect(received[0].url).toBe('/--/api/v2/push/send');
    expect(received[0].headers['content-type']).toBe('application/json');
    // Built by the SDK's own code: v7 reads this version through its new JSON import.
    expect(received[0].headers['user-agent']).toBe(`expo-server-sdk-node/${report.sdkVersion}`);
    expect(received[0].messages).toEqual([
      { to: 'ExponentPushToken[aaa]', ...OFFER_RECEIVED },
      { to: 'ExponentPushToken[bbb]', ...OFFER_RECEIVED },
    ]);
    expect(report.consoleErrors).toEqual([['[expoPush] Push ticket error:', unregistered, details]]);
  });

  it('splits more than 100 recipients into chunks of at most 100, and sends data as {} when none is given', async () => {
    const tokens = Array.from({ length: 101 }, (_, i) => `ExponentPushToken[t${i}]`);
    const title = 'Offer accepted!';
    const body = 'Your offer was accepted. Check your commitments.';

    const report = await sendInChild({ tokens, title, body }, { expoBaseUrl: stubUrl });

    expect(report.outcome).toBe('resolved');
    expect(received.map((request) => request.messages.length)).toEqual([100, 1]);
    expect(received.flatMap((request) => request.messages)).toEqual(
      tokens.map((to) => ({ to, title, body, data: {} })),
    );
    expect(report.consoleErrors).toEqual([]);
  });

  it('sends nothing when no stored token is a valid Expo push token', async () => {
    const report = await sendInChild(
      { tokens: ['not-a-token', 'ExponentPushToken[unterminated'], ...OFFER_RECEIVED },
      { expoBaseUrl: stubUrl },
    );

    expect(report.outcome).toBe('resolved');
    expect(received).toHaveLength(0);
    expect(report.consoleErrors).toEqual([]);
  });

  it('rejects when the push API answers with an error, so the event handler that called it logs the failure', async () => {
    answer = () => ({ status: 500, body: { errors: [{ code: 'INTERNAL_SERVER_ERROR', message: 'stub outage' }] } });

    const report = await sendInChild({ tokens: ['ExponentPushToken[aaa]'], ...OFFER_RECEIVED }, { expoBaseUrl: stubUrl });

    expect(report.outcome).toBe('rejected');
    expect(report.error).toContain('stub outage');
    expect(received).toHaveLength(1); // not retried: the SDK retries only a 429
  });

  it('cannot reach the real Expo service: without EXPO_BASE_URL the SDK dials exp.host and the child blocks it', async () => {
    const report = await sendInChild({ tokens: ['ExponentPushToken[aaa]'], ...OFFER_RECEIVED });

    expect(report.outcome).toBe('rejected');
    expect(report.error).toContain('egress blocked: exp.host');
    expect(received).toHaveLength(0);
  });
});
