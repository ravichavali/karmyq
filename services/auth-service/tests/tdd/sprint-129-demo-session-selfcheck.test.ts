/**
 * Sprint 129 (BUG-039) — startup self-check for the guided demo.
 *
 * BUG-039 was invisible until a human visited karmyq.com/demo, because a misconfigured demo
 * announces itself nowhere. This check runs once at boot so the failure surfaces at deploy time
 * instead of at first visitor.
 *
 * Two properties are non-negotiable and are asserted here rather than assumed:
 *
 *  1. It NEVER throws. auth-service is Critical with seven dependents, and the call site sits
 *     inside the startup try/catch whose catch calls process.exit(1). A self-check that rejected
 *     would take down authentication for the whole platform over an OPTIONAL demo feature.
 *  2. It never logs the issued token. The check succeeds by minting a real demo JWT; writing that
 *     to the log would hand a session to anyone who can read logs.
 */

import {
  reportDemoSessionHealth,
  type DemoSelfCheckLogger,
} from '../../src/services/demoSessionSelfCheck';
import { DemoSessionUnavailableError } from '../../src/services/demoSessionService';

function buildLogger() {
  return {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  } satisfies DemoSelfCheckLogger & Record<string, jest.Mock>;
}

/** Everything the logger was handed, flattened, for leak assertions. */
function allLogged(logger: ReturnType<typeof buildLogger>): string {
  return JSON.stringify([
    ...logger.info.mock.calls,
    ...logger.warn.mock.calls,
    ...logger.error.mock.calls,
  ].map((args) => args.map((a) => (a instanceof Error ? `${a.name}: ${a.message}` : a))));
}

const ORIGINAL_ENV = process.env.DEMO_SESSION_ENABLED;

afterEach(() => {
  if (ORIGINAL_ENV === undefined) delete process.env.DEMO_SESSION_ENABLED;
  else process.env.DEMO_SESSION_ENABLED = ORIGINAL_ENV;
});

describe('reportDemoSessionHealth', () => {
  describe('when the demo is switched off', () => {
    it('reports "disabled" and never attempts a session', async () => {
      delete process.env.DEMO_SESSION_ENABLED;
      const logger = buildLogger();
      const issue = jest.fn();

      const outcome = await reportDemoSessionHealth(logger, issue);

      expect(outcome).toBe('disabled');
      // "Off" must be distinguishable from "broken" — that ambiguity is half of BUG-039.
      expect(issue).not.toHaveBeenCalled();
      expect(allLogged(logger)).toMatch(/disabled/i);
    });

    it('treats any value other than the exact string "true" as disabled', async () => {
      // readConfig uses a strict !== 'true', so 'false', '1' and 'TRUE' are all OFF. A self-check
      // that disagreed with the code it checks would report health the endpoint does not have.
      for (const value of ['false', '1', 'TRUE', 'yes', '']) {
        process.env.DEMO_SESSION_ENABLED = value;
        const logger = buildLogger();
        const issue = jest.fn();

        const outcome = await reportDemoSessionHealth(logger, issue);

        expect(outcome).toBe('disabled');
        expect(issue).not.toHaveBeenCalled();
      }
    });
  });

  describe('when the demo is enabled', () => {
    beforeEach(() => {
      process.env.DEMO_SESSION_ENABLED = 'true';
    });

    it('reports "healthy" when a session can be issued', async () => {
      const logger = buildLogger();
      const issue = jest.fn().mockResolvedValue({
        user: { id: 'u', email: 'maria.reyes@test.karmyq.com', name: 'Maria', communities: [] },
        token: 'demo.jwt.SUPERSECRET',
        demo: { expiresInMinutes: 30, stories: [] },
      });

      const outcome = await reportDemoSessionHealth(logger, issue);

      expect(outcome).toBe('healthy');
      expect(issue).toHaveBeenCalledTimes(1);
      expect(logger.info).toHaveBeenCalled();
    });

    it('NEVER logs the issued token', async () => {
      const logger = buildLogger();
      const issue = jest.fn().mockResolvedValue({
        user: { id: 'u', email: 'maria.reyes@test.karmyq.com', name: 'Maria', communities: [] },
        token: 'demo.jwt.SUPERSECRET',
        demo: { expiresInMinutes: 30, stories: [] },
      });

      await reportDemoSessionHealth(logger, issue);

      expect(allLogged(logger)).not.toContain('SUPERSECRET');
    });

    it('reports "unavailable" and logs the SPECIFIC reason, without throwing', async () => {
      const logger = buildLogger();
      const issue = jest
        .fn()
        .mockRejectedValue(new DemoSessionUnavailableError('Ordinary request is not owned by the persona'));

      const outcome = await reportDemoSessionHealth(logger, issue);

      expect(outcome).toBe('unavailable');
      // Same principle as the route: the operator gets the reason. There is no client here at all,
      // so there is nothing to keep opaque.
      expect(allLogged(logger)).toContain('Ordinary request is not owned by the persona');
    });

    it('reports "error" on an unexpected failure, without throwing', async () => {
      const logger = buildLogger();
      const issue = jest.fn().mockRejectedValue(new Error('db exploded'));

      const outcome = await reportDemoSessionHealth(logger, issue);

      expect(outcome).toBe('error');
      expect(logger.error).toHaveBeenCalled();
    });
  });

  describe('it never throws — auth-service must boot regardless', () => {
    it.each([
      ['a DemoSessionUnavailableError', () => Promise.reject(new DemoSessionUnavailableError('nope'))],
      ['an unexpected Error', () => Promise.reject(new Error('boom'))],
      ['a non-Error rejection', () => Promise.reject('a bare string')],
      ['a synchronous throw', () => { throw new Error('sync boom'); }],
    ])('survives %s', async (_label, issue) => {
      process.env.DEMO_SESSION_ENABLED = 'true';
      const logger = buildLogger();

      // The assertion is resolution itself: the startup catch calls process.exit(1), so a
      // rejection here would turn an optional demo fault into a platform-wide auth outage.
      await expect(reportDemoSessionHealth(logger, issue as any)).resolves.toBeDefined();
    });

    it('survives a logger that throws', async () => {
      process.env.DEMO_SESSION_ENABLED = 'true';
      const hostileLogger: DemoSelfCheckLogger = {
        info: () => { throw new Error('logger down'); },
        warn: () => { throw new Error('logger down'); },
        error: () => { throw new Error('logger down'); },
      };
      const issue = jest.fn().mockResolvedValue({ token: 't', user: {}, demo: {} });

      await expect(reportDemoSessionHealth(hostileLogger, issue)).resolves.toBeDefined();
    });
  });
});
