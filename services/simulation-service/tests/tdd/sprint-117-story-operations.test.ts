import {
  DEMO_CONFIG_KEYS,
  publishDemoConfig,
  rotateStories,
  type ConfigFsDeps,
  type RotationDeps,
} from '../../src/fixtures/curatedDemo/storyLifecycle';

function rotationDeps(calls: string[], opts: { verifyReady?: boolean; sessionOk?: boolean } = {}): jest.Mocked<RotationDeps> {
  const { verifyReady = true, sessionOk = true } = opts;
  const storyIds = {
    ordinaryRequestId: 'r', ordinaryMatchId: 'm', providerRequestId: 'pr', providerOfferId: 'po',
  };
  return {
    createStories: jest.fn(async () => { calls.push('create'); return storyIds; }),
    verify: jest.fn(async () => { calls.push('verify'); return { ready: verifyReady, storyIds: verifyReady ? storyIds : undefined }; }),
    publishConfig: jest.fn(async () => { calls.push('backup-env'); calls.push('replace-env'); }),
    restartAuth: jest.fn(async () => { calls.push('restart-auth'); }),
    verifyDemoSession: jest.fn(async () => { calls.push('verify-demo-session'); return { ok: sessionOk }; }),
    retireOld: jest.fn(async () => { calls.push('retire-old'); }),
  } as unknown as jest.Mocked<RotationDeps>;
}

function fsDeps(existing = 'DEMO_PERSONA_EMAIL=old@example.com\nOTHER_SETTING=keep-me\n'): jest.Mocked<ConfigFsDeps> {
  const written: Record<string, string> = {};
  return {
    readFile: jest.fn(async () => existing),
    copyFile: jest.fn(async () => undefined),
    writeFile: jest.fn(async (path: string, content: string) => { written[path] = content; }),
    rename: jest.fn(async () => undefined),
    chmod: jest.fn(async () => undefined),
    __written: written,
  } as unknown as jest.Mocked<ConfigFsDeps> & { __written: Record<string, string> };
}

describe('Sprint 117 story rotation', () => {
  it('publishes only after replacement stories verify, then retires old stories', async () => {
    const calls: string[] = [];
    await rotateStories(rotationDeps(calls));
    expect(calls).toEqual(['create', 'verify', 'backup-env', 'replace-env', 'restart-auth', 'verify-demo-session', 'retire-old']);
  });

  it('does not touch env or old stories when verification fails', async () => {
    const deps = rotationDeps([], { verifyReady: false });
    await expect(rotateStories(deps)).rejects.toThrow(/not ready/i);
    expect(deps.publishConfig).not.toHaveBeenCalled();
    expect(deps.retireOld).not.toHaveBeenCalled();
  });

  it('does not retire old stories when the demo session re-check fails', async () => {
    const deps = rotationDeps([], { sessionOk: false });
    await expect(rotateStories(deps)).rejects.toThrow(/demo session/i);
    expect(deps.retireOld).not.toHaveBeenCalled();
  });
});

describe('Sprint 117 config publication', () => {
  const VALID = {
    DEMO_PERSONA_EMAIL: 'maria.reyes@test.karmyq.com',
    DEMO_ORDINARY_REQUEST_ID: 'ord-req',
    DEMO_ORDINARY_MATCH_ID: 'ord-match',
    DEMO_PROVIDER_REQUEST_ID: 'prov-req',
    DEMO_PROVIDER_OFFER_ID: 'prov-offer',
  };

  it('exposes exactly the five allowlisted keys', () => {
    expect([...DEMO_CONFIG_KEYS].sort()).toEqual([
      'DEMO_ORDINARY_MATCH_ID', 'DEMO_ORDINARY_REQUEST_ID', 'DEMO_PERSONA_EMAIL',
      'DEMO_PROVIDER_OFFER_ID', 'DEMO_PROVIDER_REQUEST_ID',
    ]);
  });

  it('rejects unknown or missing variable names', async () => {
    await expect(publishDemoConfig('.env.demo', { NOT_ALLOWED: 'x' } as never, fsDeps()))
      .rejects.toThrow(/unknown|not allowed|missing/i);
  });

  it('backs up first, replaces only allowlisted lines, keeps others, and renames atomically', async () => {
    const fs = fsDeps();
    await publishDemoConfig('.env.demo', VALID, fs);
    expect(fs.copyFile).toHaveBeenCalledTimes(1);
    const backupOrder = fs.copyFile.mock.invocationCallOrder[0];
    const writeOrder = fs.writeFile.mock.invocationCallOrder[0];
    expect(backupOrder).toBeLessThan(writeOrder);
    expect(fs.rename).toHaveBeenCalledTimes(1);
    const written = (fs as unknown as { __written: Record<string, string> }).__written;
    const content = Object.values(written)[0];
    expect(content).toContain('DEMO_PERSONA_EMAIL=maria.reyes@test.karmyq.com');
    expect(content).toContain('OTHER_SETTING=keep-me');
    expect(content).not.toContain('old@example.com');
  });
});
