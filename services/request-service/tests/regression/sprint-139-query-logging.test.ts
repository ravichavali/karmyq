/**
 * Sprint 139 — BUG-082: a successful SQL query logs at debug level, not unconditionally.
 *
 * The db wrapper printed `console.log('Executed query', ...)` for EVERY successful query, which
 * buried useful logs on the demo host. It now uses the shared structured logger at debug: silent at
 * the default (info) level, one structured record under LOG_LEVEL=debug carrying the same SQL text,
 * duration and row count — never the parameter values. Errors, connection logs and transaction
 * behaviour are unchanged.
 *
 * Only pg is faked. The logger is the real @karmyq/shared one, loaded fresh for each LOG_LEVEL
 * because it reads the level when it is constructed.
 */
export {};

const mockPoolQuery = jest.fn();
const mockConnect = jest.fn();
jest.mock('pg', () => ({
  Pool: class FakePool {
    query(...a: unknown[]) { return mockPoolQuery(...a); }
    connect(...a: unknown[]) { return mockConnect(...a); }
    on() { return this; }
  },
}));

const SERVICE = 'request-service';
const SQL = 'SELECT id, status FROM requests.help_requests WHERE id = $1';
const PARAMS = ['secret-param-value'];

type Db = typeof import('../../src/database/db');
function loadDb(level: string | undefined): Db {
  if (level === undefined) delete process.env.LOG_LEVEL;
  else process.env.LOG_LEVEL = level;
  let mod: Db | undefined;
  jest.isolateModules(() => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    mod = require('../../src/database/db');
  });
  return mod as Db;
}

const savedLevel = process.env.LOG_LEVEL;
let logSpy: jest.SpyInstance;
let errorSpy: jest.SpyInstance;
const result = { rows: [{ id: 'u1' }], rowCount: 1 };

beforeEach(() => {
  mockPoolQuery.mockReset();
  mockConnect.mockReset();
  mockPoolQuery.mockResolvedValue(result);
  logSpy = jest.spyOn(console, 'log').mockImplementation(() => undefined);
  errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
});
afterEach(() => {
  logSpy.mockRestore();
  errorSpy.mockRestore();
  if (savedLevel === undefined) delete process.env.LOG_LEVEL;
  else process.env.LOG_LEVEL = savedLevel;
});

/** Every console.log line that mentions a successful query, parsed when it is a JSON record. */
const queryLines = () =>
  logSpy.mock.calls
    .map((c) => c.map(String).join(' '))
    .filter((l) => l.includes('Executed query'));

describe(`${SERVICE} db.query success logging`, () => {
  it.each([['unset (default info)', undefined], ['info', 'info'], ['warn', 'warn']])(
    'LOG_LEVEL %s: no routine query line at all',
    async (_l, level) => {
      const db = loadDb(level);
      await db.query(SQL, PARAMS);
      expect(queryLines()).toEqual([]);
    },
  );

  it('LOG_LEVEL=debug: exactly one structured debug record with text, duration and rows — no params', async () => {
    const db = loadDb('debug');
    await db.query(SQL, PARAMS);
    const lines = queryLines();
    expect(lines).toHaveLength(1);
    const record = JSON.parse(lines[0]);
    expect(record).toEqual(expect.objectContaining({ level: 'debug', message: 'Executed query', service: SERVICE }));
    expect(Object.keys(record.context).sort()).toEqual(['duration', 'rows', 'text']);
    expect(record.context.text).toBe(SQL);
    expect(record.context.rows).toBe(1);
    expect(typeof record.context.duration).toBe('number');
    expect(lines[0]).not.toContain('secret-param-value');
  });

  it('honours a LOG_LEVEL set after the module was imported (index.ts imports db before dotenv.config())', async () => {
    const db = loadDb(undefined);
    process.env.LOG_LEVEL = 'debug'; // what dotenv.config() does, after the imports have run
    await db.query(SQL, PARAMS);
    expect(queryLines()).toHaveLength(1);
  });

  it('passes the same SQL and params through and returns the same result object', async () => {
    const db = loadDb('debug');
    await expect(db.query(SQL, PARAMS)).resolves.toBe(result);
    expect(mockPoolQuery).toHaveBeenCalledTimes(1);
    expect(mockPoolQuery.mock.calls[0][0]).toBe(SQL);
    expect(mockPoolQuery.mock.calls[0][1]).toBe(PARAMS);
  });

  it('a failing query rejects with the very same error and logs no success line', async () => {
    const db = loadDb('debug');
    const boom = new Error('relation does not exist');
    mockPoolQuery.mockRejectedValueOnce(boom);
    await expect(db.query(SQL, PARAMS)).rejects.toBe(boom);
    expect(queryLines()).toEqual([]);
  });

  it('initDatabase still logs a connection failure and rejects with it', async () => {
    const db = loadDb(undefined);
    const boom = new Error('ECONNREFUSED');
    mockConnect.mockRejectedValueOnce(boom);
    await expect(db.initDatabase()).rejects.toBe(boom);
    expect(errorSpy.mock.calls.some((c) => String(c[0]).includes('Database connection failed'))).toBe(true);
  });

  it('withTransaction still runs on its own client, commits, and rethrows the original error after a failed rollback', async () => {
    const db = loadDb('debug');
    const client = { query: jest.fn(), release: jest.fn() };
    mockConnect.mockResolvedValue(client);
    client.query.mockResolvedValue({ rows: [], rowCount: 0 });
    await db.withTransaction(async (q) => q('UPDATE requests.matches SET status = $1', ['x']));
    expect(client.query.mock.calls.map((c) => c[0])).toEqual(['BEGIN', 'UPDATE requests.matches SET status = $1', 'COMMIT']);
    expect(mockPoolQuery).not.toHaveBeenCalled();

    const boom = new Error('work failed');
    client.query.mockReset();
    client.query.mockImplementation(async (sql: string) => {
      if (sql === 'ROLLBACK') throw new Error('rollback failed');
      return { rows: [], rowCount: 0 };
    });
    await expect(db.withTransaction(async () => { throw boom; })).rejects.toBe(boom);
    expect(client.release).toHaveBeenCalledTimes(2);
  });
});
