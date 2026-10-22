/**
 * Sprint 134 PR D — `verify:demo` loads the demo env file itself.
 *
 * Runs against real temp files with an env object passed in (never the real `process.env`, except
 * where a CLI reads it). The path is `DEMO_ENV_FILE`, else `.env.demo`, anchored to the repo root as
 * the shell scripts anchor it. Only the published story keys are applied, and exported variables win;
 * a missing default file is not an error; a missing explicit `DEMO_ENV_FILE` is; values never reach
 * the result or a log.
 */

import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { loadDemoEnvFile, resolveDemoEnvPath } from '../../src/scripts/demoEnvFile';
import { buildRotationDeps } from '../../src/scripts/rotateMariaStories';
import { main } from '../../src/scripts/verifyDemoData';

// The rotate flow creates stories through the API; a fake client lets it reach publishConfig offline.
jest.mock('../../src/api-client', () => ({
  ApiClient: class {
    async login(email: string) {
      return { token: 't', user: { id: `id-${email}`, communities: [{ id: 'shared-community' }] } };
    }
    async createRequest(data: { request_type: string }) {
      return { id: `req-${data.request_type}` };
    }
    async offerHelp() {
      return { id: 'match-new' };
    }
    async submitProviderOffer() {
      return { id: 'offer-new' };
    }
  },
}));

// The real execFile, wrapped to record the options each host command is launched with.
const mockExecFileOptions: Array<{ env?: NodeJS.ProcessEnv } | undefined> = [];
jest.mock('node:child_process', () => {
  const actual = jest.requireActual('node:child_process');
  return {
    ...actual,
    execFile: (...args: unknown[]) => {
      mockExecFileOptions.push(args[2] as { env?: NodeJS.ProcessEnv });
      return actual.execFile(...args);
    },
  };
});

/** services/simulation-service/tests/tdd → the repo root. */
const REPO_ROOT = path.resolve(__dirname, '../../../..');

const STORY = {
  DEMO_ORDINARY_REQUEST_ID: 'file-ordinary-req-7f3a',
  DEMO_ORDINARY_MATCH_ID: 'file-ordinary-match-91c2',
  DEMO_PROVIDER_REQUEST_ID: 'file-provider-req-5d0e',
  DEMO_PROVIDER_OFFER_ID: 'file-provider-offer-2b8b',
};
const STORY_FILE = Object.entries(STORY).map(([key, value]) => `${key}=${value}\n`).join('');
const STORY_KEYS = Object.keys(STORY).sort();

/** The persona/connection env from `.env.demo.rotation`; never in `.env.demo`. */
const PERSONA_ENV = {
  API_BASE_URL: 'http://api.invalid',
  DEMO_MARIA_EMAIL: 'maria@example.test',
  DEMO_HELPER_EMAIL: 'helper@example.test',
  DEMO_PROVIDER_EMAIL: 'provider@example.test',
  DEMO_UNRELATED_EMAIL: 'unrelated@example.test',
  DEMO_PERSONA_PASSWORD: 'not-a-real-password',
};

/** Clear these `process.env` keys before each test of the enclosing describe; restore them after. */
function isolateProcessEnv(keys: string[]): void {
  const saved: Record<string, string | undefined> = {};
  beforeEach(() => {
    for (const key of keys) {
      saved[key] = process.env[key];
      delete process.env[key];
    }
  });
  afterEach(() => {
    for (const key of keys) {
      if (saved[key] === undefined) delete process.env[key];
      else process.env[key] = saved[key];
    }
  });
}

const tempDirs: string[] = [];

function tempDir(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'karmyq-demo-env-'));
  tempDirs.push(dir);
  return dir;
}

function writeFileIn(dir: string, name: string, content: string): string {
  const file = path.join(dir, name);
  fs.writeFileSync(file, content);
  return file;
}

afterEach(() => {
  while (tempDirs.length > 0) fs.rmSync(tempDirs.pop()!, { recursive: true, force: true });
});

describe('loadDemoEnvFile', () => {
  it('applies all four story IDs from the default .env.demo and reports its absolute path', () => {
    const root = tempDir();
    const file = writeFileIn(root, '.env.demo', STORY_FILE);
    const env: NodeJS.ProcessEnv = {};

    const result = loadDemoEnvFile(env, root);

    expect(result).toEqual({ loadedFrom: file, lookedFor: file, keys: Object.keys(STORY), shadowed: [] });
    expect(env).toEqual(STORY);
  });

  it('keeps a variable already in the environment and names it as shadowed only when it differs', () => {
    const root = tempDir();
    writeFileIn(root, '.env.demo', STORY_FILE);
    const env: NodeJS.ProcessEnv = {
      DEMO_ORDINARY_REQUEST_ID: 'stale-from-env',
      DEMO_ORDINARY_MATCH_ID: STORY.DEMO_ORDINARY_MATCH_ID,
    };

    const result = loadDemoEnvFile(env, root);

    expect(env).toEqual({ ...STORY, DEMO_ORDINARY_REQUEST_ID: 'stale-from-env' });
    expect(result.shadowed).toEqual(['DEMO_ORDINARY_REQUEST_ID']);
  });

  it('applies only the published story keys, never the compose secrets beside them', () => {
    const root = tempDir();
    writeFileIn(
      root,
      '.env.demo',
      `JWT_SECRET=compose-secret-1\nPOSTGRES_PASSWORD=compose-secret-2\nAPI_BASE_URL=http://internal:3001\n` +
        `DEMO_PERSONA_EMAIL=maria@test.karmyq.com\n${STORY_FILE}`,
    );
    const env: NodeJS.ProcessEnv = {};

    const result = loadDemoEnvFile(env, root);

    expect(env).toEqual({ DEMO_PERSONA_EMAIL: 'maria@test.karmyq.com', ...STORY });
    expect([...result.keys].sort()).toEqual(['DEMO_PERSONA_EMAIL', ...STORY_KEYS].sort());
  });

  it('treats a missing default file as no file: names the path it looked for, changes nothing', () => {
    const root = tempDir();
    const env: NodeJS.ProcessEnv = { DEMO_ORDINARY_REQUEST_ID: 'from-env' };

    const result = loadDemoEnvFile(env, root);

    expect(result).toEqual({ loadedFrom: null, lookedFor: path.join(root, '.env.demo'), keys: [], shadowed: [] });
    expect(env).toEqual({ DEMO_ORDINARY_REQUEST_ID: 'from-env' });
  });

  it('loads an explicit DEMO_ENV_FILE instead of the default', () => {
    const root = tempDir();
    writeFileIn(root, '.env.demo', 'DEMO_ORDINARY_REQUEST_ID=default-file\n');
    const explicit = writeFileIn(tempDir(), 'custom.env', STORY_FILE);
    const env: NodeJS.ProcessEnv = { DEMO_ENV_FILE: explicit };

    const result = loadDemoEnvFile(env, root);

    expect(result.loadedFrom).toBe(explicit);
    expect(env.DEMO_ORDINARY_REQUEST_ID).toBe(STORY.DEMO_ORDINARY_REQUEST_ID);
  });

  it('throws when an explicit DEMO_ENV_FILE is missing, naming the resolved path', () => {
    const root = tempDir();
    writeFileIn(root, '.env.demo', STORY_FILE);
    const env: NodeJS.ProcessEnv = { DEMO_ENV_FILE: 'missing.env' };

    expect(() => loadDemoEnvFile(env, root)).toThrow(
      new Error(`verify:demo unavailable — DEMO_ENV_FILE not found: ${path.join(root, 'missing.env')}`),
    );
    expect(env.DEMO_ORDINARY_REQUEST_ID).toBeUndefined();
  });

  it('parses a CRLF file and a quoted value to bare values', () => {
    const root = tempDir();
    writeFileIn(
      root,
      '.env.demo',
      'DEMO_ORDINARY_REQUEST_ID="quoted-req-44aa"\r\nDEMO_ORDINARY_MATCH_ID=crlf-match-88bb\r\n',
    );
    const env: NodeJS.ProcessEnv = {};

    loadDemoEnvFile(env, root);

    expect(env.DEMO_ORDINARY_REQUEST_ID).toBe('quoted-req-44aa');
    expect(env.DEMO_ORDINARY_MATCH_ID).toBe('crlf-match-88bb');
  });

  it('never returns or logs a value from the file', () => {
    const root = tempDir();
    writeFileIn(root, '.env.demo', `JWT_SECRET=compose-secret-1\n${STORY_FILE}`);
    const methods = ['log', 'info', 'warn', 'error', 'debug'] as const;
    const spies = methods.map(m => jest.spyOn(console, m).mockImplementation(() => undefined));
    const stdout = jest.spyOn(process.stdout, 'write').mockImplementation(() => true);
    try {
      const result = loadDemoEnvFile({ DEMO_ORDINARY_REQUEST_ID: 'stale-from-env' }, root);

      const emitted = JSON.stringify([result, ...spies.map(s => s.mock.calls), stdout.mock.calls]);
      for (const value of [...Object.values(STORY), 'compose-secret-1', 'stale-from-env']) {
        expect(emitted).not.toContain(value);
      }
      // Non-vacuity: the result does carry key names, so the scan above read a populated result.
      expect(emitted).toContain('DEMO_ORDINARY_REQUEST_ID');
    } finally {
      spies.forEach(s => s.mockRestore());
      stdout.mockRestore();
    }
  });
});

describe('resolveDemoEnvPath', () => {
  it('anchors the default to the repo root, whatever INIT_CWD and cwd say', () => {
    expect(resolveDemoEnvPath({ INIT_CWD: tempDir() })).toEqual({
      path: path.join(REPO_ROOT, '.env.demo'),
      explicit: false,
    });
  });

  it('resolves a relative DEMO_ENV_FILE against the root and keeps an absolute one', () => {
    const root = tempDir();
    const absolute = path.join(tempDir(), 'x.env');
    expect(resolveDemoEnvPath({ DEMO_ENV_FILE: 'sub/x.env' }, root)).toEqual({
      path: path.join(root, 'sub', 'x.env'),
      explicit: true,
    });
    expect(resolveDemoEnvPath({ DEMO_ENV_FILE: absolute }, root)).toEqual({ path: absolute, explicit: true });
  });

  it('treats an exported-but-empty DEMO_ENV_FILE as unset', () => {
    const root = tempDir();
    expect(resolveDemoEnvPath({ DEMO_ENV_FILE: '' }, root)).toEqual({
      path: path.join(root, '.env.demo'),
      explicit: false,
    });
  });
});

describe('verify:demo main() reports the env file', () => {
  isolateProcessEnv([...Object.keys(PERSONA_ENV), 'DEMO_PERSONA_EMAIL', 'DEMO_ENV_FILE', ...STORY_KEYS]);
  let log: jest.SpyInstance;

  beforeEach(() => {
    log = jest.spyOn(console, 'log').mockImplementation(() => undefined);
  });

  afterEach(() => {
    log.mockRestore();
  });

  function printedReport(): Record<string, unknown> {
    expect(log).toHaveBeenCalledTimes(1);
    return JSON.parse(log.mock.calls[0][0] as string);
  }

  it('loads the story IDs into the environment and names the file, never a value', async () => {
    const root = tempDir();
    const rootFile = writeFileIn(root, '.env.demo', STORY_FILE);

    await main(root);

    expect(process.env.DEMO_PROVIDER_OFFER_ID).toBe(STORY.DEMO_PROVIDER_OFFER_ID);
    expect(printedReport()).toEqual({
      ready: false,
      unavailable: true,
      reason: 'verify:demo unavailable — missing env: baseUrl, mariaEmail, helperEmail, providerEmail, unrelatedEmail, password',
      envFile: rootFile,
      envFileShadowed: [],
    });
    expect(log.mock.calls[0][0]).not.toContain(STORY.DEMO_PROVIDER_OFFER_ID);
  });

  it('names a stale exported story ID as shadowed, without its value', async () => {
    const root = tempDir();
    writeFileIn(root, '.env.demo', STORY_FILE);
    process.env.DEMO_ORDINARY_MATCH_ID = 'stale-export-31d9';

    await main(root);

    expect(printedReport().envFileShadowed).toEqual(['DEMO_ORDINARY_MATCH_ID']);
    expect(log.mock.calls[0][0]).not.toContain('stale-export-31d9');
  });

  it('names the default path it looked for when no file is there', async () => {
    const root = tempDir();
    Object.assign(process.env, PERSONA_ENV);

    await main(root);

    expect(printedReport()).toEqual({
      ready: false,
      unavailable: true,
      reason: 'verify:demo unavailable — missing story IDs: ordinaryRequestId, ordinaryMatchId, providerRequestId, providerOfferId',
      envFile: null,
      envFileLookedFor: path.join(root, '.env.demo'),
    });
  });

  it('reports a missing explicit DEMO_ENV_FILE through the unavailable path', async () => {
    const root = tempDir();
    process.env.DEMO_ENV_FILE = 'nope.env';

    await main(root);

    expect(printedReport()).toEqual({
      ready: false,
      unavailable: true,
      reason: `verify:demo unavailable — DEMO_ENV_FILE not found: ${path.join(root, 'nope.env')}`,
      envFile: null,
    });
    expect(process.exitCode).toBeFalsy();
  });
});

describe('rotate:demo-stories uses the file verify:demo reads', () => {
  isolateProcessEnv([...Object.keys(PERSONA_ENV), 'DEMO_ENV_FILE', 'DEMO_ENABLE_CMD', 'DEMO_RESTART_AUTH_CMD']);

  /** A temp env file named relative to the repo root, as a relative DEMO_ENV_FILE would be. */
  function rootRelativeEnvFile(): { file: string; relative: string } {
    const file = writeFileIn(tempDir(), '.env.demo', STORY_FILE);
    return { file, relative: path.relative(REPO_ROOT, file) };
  }

  it('publishes a relative DEMO_ENV_FILE against the repo root, not cwd', async () => {
    const { file, relative } = rootRelativeEnvFile();
    Object.assign(process.env, PERSONA_ENV, { DEMO_ENV_FILE: relative });

    const deps = buildRotationDeps(true);
    await deps.createStories();
    await deps.publishConfig();

    expect(resolveDemoEnvPath().path).toBe(file);
    const published = fs.readFileSync(file, 'utf8');
    expect(published).toContain('DEMO_ORDINARY_REQUEST_ID=req-generic');
    expect(published).toContain('DEMO_ORDINARY_MATCH_ID=match-new');
    expect(published).toContain('DEMO_PROVIDER_REQUEST_ID=req-service');
    expect(published).toContain('DEMO_PROVIDER_OFFER_ID=offer-new');
  });

  it('hands both host commands that same file as an absolute DEMO_ENV_FILE', async () => {
    const { file, relative } = rootRelativeEnvFile();
    // No paths in the command: runRequiredCommand splits on whitespace.
    Object.assign(process.env, PERSONA_ENV, {
      DEMO_ENV_FILE: relative,
      DEMO_ENABLE_CMD: 'node --version',
      DEMO_RESTART_AUTH_CMD: 'node --version',
    });
    mockExecFileOptions.length = 0;

    const deps = buildRotationDeps(true);
    await deps.enableDemo();
    await deps.restartAuth();

    expect(mockExecFileOptions.map(options => options?.env?.DEMO_ENV_FILE)).toEqual([file, file]);
  });
});
