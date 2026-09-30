/** Sprint 131 D9: exercise the cache's real ioredis client against a local RESP server. */
import { createServer, Server, Socket } from 'node:net';
import { dirname, resolve } from 'node:path';

const mockGetUserEffectiveParams = jest.fn();
jest.mock('../../src/services/trustEvolutionService', () => ({
  getUserEffectiveParams: (...args: unknown[]) => mockGetUserEffectiveParams(...args),
}));

type CacheModule = typeof import('../../src/services/effectiveParamsCache');
type RedisClient = ReturnType<CacheModule['createCacheClient']>;
type FakeRedis = {
  server: Server;
  sockets: Set<Socket>;
  commands: string[][];
  port: number;
};

const params = { depth_weight: 0.6, breadth_weight: 0.4, cross_community_prior: 0.5 };
const key = 'trust_params:u1:c1';
const workspace = resolve(__dirname, '../..');
let cache: CacheModule | undefined;
let fake: FakeRedis | undefined;
let originalRedisUrl: string | undefined;
let restoreConnect: (() => void) | undefined;
const trackedClients = new Set<RedisClient>();

/** Return one complete array-of-bulk-strings command, retaining incomplete network frames. */
function readCommand(buffer: Buffer): { command: string[]; used: number } | undefined {
  const firstEnd = buffer.indexOf('\r\n');
  if (firstEnd < 0) return;
  const header = buffer.subarray(0, firstEnd).toString();
  if (!/^\*\d+$/.test(header)) throw new Error(`Unexpected RESP command header: ${header}`);
  const count = Number(header.slice(1));
  const command: string[] = [];
  let offset = firstEnd + 2;
  for (let i = 0; i < count; i++) {
    const lengthEnd = buffer.indexOf('\r\n', offset);
    if (lengthEnd < 0) return;
    const lengthHeader = buffer.subarray(offset, lengthEnd).toString();
    if (!/^\$\d+$/.test(lengthHeader)) throw new Error(`Unexpected RESP argument: ${lengthHeader}`);
    const length = Number(lengthHeader.slice(1));
    offset = lengthEnd + 2;
    if (buffer.length < offset + length + 2) return;
    if (buffer.toString('utf8', offset + length, offset + length + 2) !== '\r\n') {
      throw new Error('RESP bulk argument missing terminator');
    }
    command.push(buffer.toString('utf8', offset, offset + length));
    offset += length + 2;
  }
  command[0] = command[0].toUpperCase();
  return { command, used: offset };
}

async function startFakeRedis(helloUnsupported = false): Promise<FakeRedis> {
  const commands: string[][] = [];
  const store = new Map<string, string>();
  const sockets = new Set<Socket>();
  const server = createServer((socket: Socket) => {
    sockets.add(socket);
    socket.on('close', () => sockets.delete(socket));
    let pending = Buffer.alloc(0);
    let resp3 = false;
    socket.on('data', chunk => {
      pending = Buffer.concat([pending, chunk]);
      for (;;) {
        const parsed = readCommand(pending);
        if (!parsed) break;
        pending = pending.subarray(parsed.used);
        const command = parsed.command;
        commands.push(command);
        switch (command[0]) {
          case 'HELLO':
            if (helloUnsupported) socket.write("-ERR unknown command 'HELLO'\r\n");
            else {
              resp3 = true;
              socket.write('%3\r\n+server\r\n+redis\r\n+version\r\n+7.4.0\r\n+proto\r\n:3\r\n');
            }
            break;
          case 'GET': {
            const value = store.get(command[1]);
            socket.write(value === undefined
              ? (resp3 ? '_\r\n' : '$-1\r\n')
              : `$${Buffer.byteLength(value)}\r\n${value}\r\n`);
            break;
          }
          case 'SETEX':
            store.set(command[1], command[3]);
            socket.write('+OK\r\n');
            break;
          case 'DEL':
            socket.write(`:${store.delete(command[1]) ? 1 : 0}\r\n`);
            break;
          case 'QUIT':
            socket.end('+OK\r\n');
            break;
          case 'CLIENT':
          case 'SELECT':
            socket.write('+OK\r\n');
            break;
          case 'INFO':
            socket.write('$11\r\nloading:0\r\n\r\n');
            break;
          default:
            socket.write(`-ERR unknown command '${command[0]}'\r\n`);
        }
      }
    });
  });
  await new Promise<void>(done => server.listen(0, '127.0.0.1', done));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('No loopback port');
  return { server, sockets, commands, port: address.port };
}

async function within<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`Cleanup exceeded ${ms} ms`)), ms);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function loadCache(port: number): CacheModule {
  process.env.REDIS_URL = `redis://127.0.0.1:${port}`;
  let loaded: CacheModule | undefined;
  jest.isolateModules(() => {
    const Redis = require('ioredis') as typeof import('ioredis').default;
    const originalConnect = Redis.prototype.connect;
    const spy = jest.spyOn(Redis.prototype, 'connect').mockImplementation(function (this: RedisClient, ...args) {
      trackedClients.add(this);
      return originalConnect.apply(this, args);
    });
    restoreConnect = () => spy.mockRestore();
    loaded = require('../../src/services/effectiveParamsCache') as CacheModule;
  });
  if (!loaded) throw new Error('Cache module did not load');
  cache = loaded;
  return loaded;
}

beforeEach(() => {
  originalRedisUrl = process.env.REDIS_URL;
  mockGetUserEffectiveParams.mockResolvedValue(params);
});

afterEach(async () => {
  try {
    try {
      if (cache) await within(cache.disconnectEffectiveParamsCache(), 2000);
    } finally {
      // A stalled handshake can leave QUIT queued after the bounded wait above.
      // Disconnect the actual clients even when the cache has cleared its singleton reference.
      for (const client of trackedClients) {
        if (client.status !== 'end') client.disconnect();
      }
      if (fake) {
        for (const socket of fake.sockets) socket.destroy();
        await within(new Promise<void>(done => fake!.server.close(() => done())), 2000);
      }
    }
  } finally {
    restoreConnect?.();
    restoreConnect = undefined;
    trackedClients.clear();
    cache = undefined;
    fake = undefined;
    if (originalRedisUrl === undefined) delete process.env.REDIS_URL;
    else process.env.REDIS_URL = originalRedisUrl;
  }
});

describe('ioredis 6 cache upgrade gate', () => {
  it('resolves ioredis 6 inside reputation while Bull keeps ioredis 5', () => {
    const reputationPath = require.resolve('ioredis/package.json', { paths: [workspace] });
    const bullPath = require.resolve('bull/package.json', { paths: [workspace] });
    const bullRedisPath = require.resolve('ioredis/package.json', { paths: [dirname(bullPath)] });
    expect(require(reputationPath).version.split('.')[0]).toBe('6');
    expect(require(bullRedisPath).version.split('.')[0]).toBe('5');
    expect(reputationPath.replace(/\\/g, '/')).toContain('services/reputation-service/node_modules/ioredis');
    expect(bullRedisPath.replace(/\\/g, '/')).not.toContain('services/reputation-service/node_modules/ioredis');
  }, 30000);

  it('sends the exact RESP3 cache miss, hit, invalidation and disconnect sequence', async () => {
    fake = await startFakeRedis();
    const client = loadCache(fake.port);
    expect(await client.getCachedEffectiveParams('u1', 'c1')).toEqual(params);
    expect(await client.getCachedEffectiveParams('u1', 'c1')).toEqual(params);
    await client.invalidateEffectiveParamsCache('u1', 'c1');
    await client.disconnectEffectiveParamsCache();
    expect(mockGetUserEffectiveParams).toHaveBeenCalledTimes(1);
    const readyCheckIndex = fake.commands.findIndex(command => command[0] === 'INFO');
    expect(readyCheckIndex).toBeGreaterThanOrEqual(0);
    // Client metadata can precede INFO on either side of HELLO; keep every command thereafter.
    const commands = fake.commands.filter((command, index) =>
      !(index < readyCheckIndex && command[0] === 'CLIENT'));
    expect(commands).toEqual([
      ['HELLO', '3'],
      ['INFO'],
      ['GET', key],
      ['SETEX', key, '14400', '{"depth_weight":0.6,"breadth_weight":0.4,"cross_community_prior":0.5}'],
      ['GET', key],
      ['DEL', key],
      ['QUIT'],
    ]);
  }, 30000);

  it('keeps v5 retry delays for a refused loopback connection', async () => {
    const free = await startFakeRedis();
    const port = free.port;
    await new Promise<void>(done => free.server.close(() => done()));
    const client = loadCache(port).createCacheClient(`redis://127.0.0.1:${port}`);
    const delays: number[] = [];
    client.on('error', () => { /* refused connection is expected */ });
    try {
      await new Promise<void>((done, reject) => {
        const timer = setTimeout(() => reject(new Error('Five reconnects did not arrive')), 10000);
        client.on('reconnecting', delay => {
          delays.push(delay);
          if (delays.length === 5) {
            clearTimeout(timer);
            done();
          }
        });
      });
    } finally {
      // Let the already-scheduled fifth reconnect attempt finish, then stop retrying.
      // disconnect() on its already-closed socket leaves
      // ioredis's 2-second connector grace timer alive after Jest reports the test complete.
      client.options.retryStrategy = () => null;
      await within(new Promise<void>(done => client.once('end', () => done())), 2000)
        .catch(error => {
          client.disconnect();
          throw error;
        });
    }
    expect(delays).toEqual([50, 100, 150, 200, 250]);
  }, 30000);

  it('falls back to RESP2 when HELLO is unsupported', async () => {
    fake = await startFakeRedis(true);
    const client = loadCache(fake.port);
    expect(await client.getCachedEffectiveParams('u1', 'c1')).toEqual(params);
    expect(await client.getCachedEffectiveParams('u1', 'c1')).toEqual(params);
    await client.disconnectEffectiveParamsCache();
    expect(mockGetUserEffectiveParams).toHaveBeenCalledTimes(1);
    const relevant = fake.commands.filter(command => ['HELLO', 'GET', 'SETEX'].includes(command[0]));
    expect(relevant).toEqual([
      ['HELLO', '3'],
      ['GET', key],
      ['SETEX', key, '14400', '{"depth_weight":0.6,"breadth_weight":0.4,"cross_community_prior":0.5}'],
      ['GET', key],
    ]);
  }, 30000);
});
