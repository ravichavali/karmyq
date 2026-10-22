/**
 * Sprint 134 PR D — `verify:demo` loads `DEMO_ENV_FILE ?? '.env.demo'` itself.
 *
 * Runs against real temp files with an env object passed in (never the real `process.env`, except
 * where the rotate flow reads it). Variables already in the environment win; a missing default file
 * is not an error; a missing explicit `DEMO_ENV_FILE` is; values never reach the result or a log.
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
    const env: NodeJS.ProcessEnv = { INIT_CWD: root };

    const result = loadDemoEnvFile(env, tempDir());

    expect(result.loadedFrom).toBe(file);
    expect(result.lookedFor).toBe(file);
    expect([...result.keys].sort()).toEqual(STORY_KEYS);
    expect(env).toEqual({ INIT_CWD: root, ...STORY });
  });

  it('keeps a variable already in the environment; the file fills only the rest', () => {
    const root = tempDir();
    writeFileIn(root, '.env.demo', STORY_FILE);
    const env: NodeJS.ProcessEnv = { INIT_CWD: root, DEMO_ORDINARY_REQUEST_ID: 'from-env' };

    loadDemoEnvFile(env, root);

    expect(env.DEMO_ORDINARY_REQUEST_ID).toBe('from-env');
    expect(env.DEMO_ORDINARY_MATCH_ID).toBe('file-ordinary-match-91c2');
    expect(env.DEMO_PROVIDER_REQUEST_ID).toBe('file-provider-req-5d0e');
    expect(env.DEMO_PROVIDER_OFFER_ID).toBe('file-provider-offer-2b8b');
  });

  it('treats a missing default file as no file: names the path it looked for, changes nothing', () => {
    const root = tempDir();
    const env: NodeJS.ProcessEnv = { INIT_CWD: root, DEMO_ORDINARY_REQUEST_ID: 'from-env' };

    const result = loadDemoEnvFile(env, tempDir());

    expect(result).toEqual({ loadedFrom: null, lookedFor: path.join(root, '.env.demo'), keys: [] });
    expect(env).toEqual({ INIT_CWD: root, DEMO_ORDINARY_REQUEST_ID: 'from-env' });
  });

  it('resolves the default against INIT_CWD (the npm --workspace case), not cwd', () => {
    const repoRoot = tempDir();
    const workspaceCwd = tempDir();
    const rootFile = writeFileIn(repoRoot, '.env.demo', STORY_FILE);
    writeFileIn(workspaceCwd, '.env.demo', 'DEMO_ORDINARY_REQUEST_ID=wrong-cwd-file\n');
    const env: NodeJS.ProcessEnv = { INIT_CWD: repoRoot };

    const result = loadDemoEnvFile(env, workspaceCwd);

    expect(result.loadedFrom).toBe(rootFile);
    expect(env.DEMO_ORDINARY_REQUEST_ID).toBe('file-ordinary-req-7f3a');
  });

  it('falls back to cwd when INIT_CWD is unset', () => {
    const cwd = tempDir();
    const cwdFile = writeFileIn(cwd, '.env.demo', STORY_FILE);
    const env: NodeJS.ProcessEnv = {};

    const result = loadDemoEnvFile(env, cwd);

    expect(result.loadedFrom).toBe(cwdFile);
    expect(env.DEMO_PROVIDER_OFFER_ID).toBe('file-provider-offer-2b8b');
  });

  it('loads an explicit DEMO_ENV_FILE instead of the default', () => {
    const root = tempDir();
    writeFileIn(root, '.env.demo', 'DEMO_ORDINARY_REQUEST_ID=default-file\n');
    const explicit = writeFileIn(tempDir(), 'custom.env', STORY_FILE);
    const env: NodeJS.ProcessEnv = { INIT_CWD: root, DEMO_ENV_FILE: explicit };

    const result = loadDemoEnvFile(env, root);

    expect(result.loadedFrom).toBe(explicit);
    expect(env.DEMO_ORDINARY_REQUEST_ID).toBe('file-ordinary-req-7f3a');
  });

  it('throws when an explicit DEMO_ENV_FILE is missing, naming the resolved path', () => {
    const root = tempDir();
    writeFileIn(root, '.env.demo', STORY_FILE);
    const env: NodeJS.ProcessEnv = { INIT_CWD: root, DEMO_ENV_FILE: 'missing.env' };

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
    const env: NodeJS.ProcessEnv = { INIT_CWD: root };

    loadDemoEnvFile(env, root);

    expect(env.DEMO_ORDINARY_REQUEST_ID).toBe('quoted-req-44aa');
    expect(env.DEMO_ORDINARY_MATCH_ID).toBe('crlf-match-88bb');
  });

  it('never returns or logs a value from the file', () => {
    const root = tempDir();
    writeFileIn(root, '.env.demo', STORY_FILE);
    const methods = ['log', 'info', 'warn', 'error', 'debug'] as const;
    const spies = methods.map(m => jest.spyOn(console, m).mockImplementation(() => undefined));
    const stdout = jest.spyOn(process.stdout, 'write').mockImplementation(() => true);
    try {
      const result = loadDemoEnvFile({ INIT_CWD: root }, root);

      const emitted = JSON.stringify([result, ...spies.map(s => s.mock.calls), stdout.mock.calls]);
      for (const value of Object.values(STORY)) {
        expect(emitted).not.toContain(value);
      }
      // Non-vacuity: the result does carry the keys, so the scan above read a populated result.
      expect(emitted).toContain('DEMO_ORDINARY_REQUEST_ID');
    } finally {
      spies.forEach(s => s.mockRestore());
      stdout.mockRestore();
    }
  });
});

describe('resolveDemoEnvPath', () => {
  it('marks the default as implicit and DEMO_ENV_FILE as explicit, both absolute', () => {
    const root = tempDir();
    expect(resolveDemoEnvPath({ INIT_CWD: root }, '/elsewhere')).toEqual({
      path: path.join(root, '.env.demo'),
      explicit: false,
    });
    expect(resolveDemoEnvPath({ INIT_CWD: root, DEMO_ENV_FILE: 'sub/x.env' }, '/elsewhere')).toEqual({
      path: path.join(root, 'sub', 'x.env'),
      explicit: true,
    });
  });

  it('treats an exported-but-empty DEMO_ENV_FILE or INIT_CWD as unset', () => {
    const cwd = tempDir();
    expect(resolveDemoEnvPath({ INIT_CWD: '', DEMO_ENV_FILE: '' }, cwd)).toEqual({
      path: path.join(cwd, '.env.demo'),
      explicit: false,
    });
  });
});

describe('verify:demo main() reports the env file', () => {
  isolateProcessEnv([...Object.keys(PERSONA_ENV), 'DEMO_PERSONA_EMAIL', 'INIT_CWD', 'DEMO_ENV_FILE', ...STORY_KEYS]);
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
    process.env.INIT_CWD = root;

    await main();

    expect(process.env.DEMO_PROVIDER_OFFER_ID).toBe('file-provider-offer-2b8b');
    const report = printedReport();
    expect(report).toEqual({
      ready: false,
      unavailable: true,
      reason: 'verify:demo unavailable — missing env: baseUrl, mariaEmail, helperEmail, providerEmail, unrelatedEmail, password',
      envFile: rootFile,
    });
    expect(log.mock.calls[0][0]).not.toContain('file-provider-offer-2b8b');
  });

  it('names the default path it looked for when no file is there', async () => {
    const root = tempDir();
    Object.assign(process.env, PERSONA_ENV, { INIT_CWD: root });

    await main();

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
    process.env.INIT_CWD = root;
    process.env.DEMO_ENV_FILE = 'nope.env';

    await main();

    expect(printedReport()).toEqual({
      ready: false,
      unavailable: true,
      reason: `verify:demo unavailable — DEMO_ENV_FILE not found: ${path.join(root, 'nope.env')}`,
      envFile: null,
    });
    expect(process.exitCode).toBeFalsy();
  });
});

describe('rotate:demo-stories publishes to the file verify:demo reads', () => {
  isolateProcessEnv([...Object.keys(PERSONA_ENV), 'INIT_CWD', 'DEMO_ENV_FILE', 'DEMO_ENABLE_CMD', 'DEMO_RESTART_AUTH_CMD']);

  it('writes the INIT_CWD-resolved .env.demo, the same path loadDemoEnvFile looks for', async () => {
    const repoRoot = tempDir();
    const rootFile = writeFileIn(repoRoot, '.env.demo', STORY_FILE);
    Object.assign(process.env, PERSONA_ENV, { INIT_CWD: repoRoot });

    const deps = buildRotationDeps(true);
    await deps.createStories();
    await deps.publishConfig();

    expect(resolveDemoEnvPath({ INIT_CWD: repoRoot }).path).toBe(rootFile);
    const published = fs.readFileSync(rootFile, 'utf8');
    expect(published).toContain('DEMO_ORDINARY_REQUEST_ID=req-generic');
    expect(published).toContain('DEMO_ORDINARY_MATCH_ID=match-new');
    expect(published).toContain('DEMO_PROVIDER_REQUEST_ID=req-service');
    expect(published).toContain('DEMO_PROVIDER_OFFER_ID=offer-new');
  });

  it('hands the host commands that same absolute file, so the shell scripts cannot re-anchor elsewhere', async () => {
    // enable-demo.sh / restart-auth.sh resolve a relative or unset DEMO_ENV_FILE against the repo
    // root; INIT_CWD can differ. The probe records the DEMO_ENV_FILE each command receives.
    const repoRoot = tempDir();
    const probeDir = tempDir();
    const probe = writeFileIn(
      probeDir,
      'probe.js',
      "require('fs').writeFileSync(process.argv[2], String(process.env.DEMO_ENV_FILE));\n",
    );
    const enableOut = path.join(probeDir, 'enable.txt');
    const restartOut = path.join(probeDir, 'restart.txt');
    Object.assign(process.env, PERSONA_ENV, {
      INIT_CWD: repoRoot,
      DEMO_ENABLE_CMD: `node ${probe} ${enableOut}`,
      DEMO_RESTART_AUTH_CMD: `node ${probe} ${restartOut}`,
    });

    const deps = buildRotationDeps(true);
    await deps.enableDemo();
    await deps.restartAuth();

    const expected = path.join(repoRoot, '.env.demo');
    expect(fs.readFileSync(enableOut, 'utf8')).toBe(expected);
    expect(fs.readFileSync(restartOut, 'utf8')).toBe(expected);
  });
});
