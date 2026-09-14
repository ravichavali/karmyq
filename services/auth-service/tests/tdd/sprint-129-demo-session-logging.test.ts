/**
 * Sprint 129 (BUG-039) — the demo-session failure reason must reach the OPERATOR
 * without changing anything the CLIENT sees.
 *
 * ADR-084 collapses every demo-session failure into one opaque 503 so resource existence is never
 * leaked. That opacity is a property of the HTTP response. It was accidentally applied to the
 * server log as well: `auth.ts` logs only failures that are NOT `DemoSessionUnavailableError`, so
 * every *expected* cause — disabled flag, missing config, persona absent, story rows no longer
 * owned by the persona — was silent by construction. BUG-039 therefore sat open for days while
 * its own bug report advised checking `pm2 logs`, which could never have worked.
 *
 * These tests assert BOTH halves together, because either one alone passes a broken design:
 *   - asserting only the log would pass a version that leaks the reason to the client;
 *   - asserting only the response is exactly what let the current silence ship.
 */

import request from 'supertest';
import express from 'express';

// Mock the service so these tests only exercise the route's HTTP + logging behaviour.
jest.mock('../../src/services/demoSessionService', () => {
  const actual = jest.requireActual('../../src/services/demoSessionService');
  return {
    ...actual,
    createDemoSession: jest.fn(),
  };
});

import authRoutes from '../../src/routes/auth';
import {
  createDemoSession,
  DemoSessionUnavailableError,
} from '../../src/services/demoSessionService';

const mockCreate = createDemoSession as jest.MockedFunction<typeof createDemoSession>;

interface FakeLogger {
  warn: jest.Mock;
  error: jest.Mock;
  info: jest.Mock;
  debug: jest.Mock;
}

function buildLogger(): FakeLogger {
  return {
    warn: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
  };
}

/**
 * Mirrors what `requestLoggingMiddleware` does in production (`packages/shared/utils/logger.ts:267`)
 * — attach a logger to the request — without pulling in real transports.
 */
function buildApp(logger: FakeLogger) {
  const app = express();
  app.use(express.json());
  app.use((req: any, _res, next) => {
    req.logger = logger;
    next();
  });
  app.use('/auth', authRoutes);
  return app;
}

/**
 * The client-visible contract. `meta.timestamp` and `meta.requestId` are deliberately excluded:
 * they vary per request by design, so "byte-identical" means the stable envelope. `meta` is
 * asserted separately for shape, so dropping it here cannot hide a leak moving into it.
 */
function clientVisibleEnvelope(body: any) {
  const { meta, ...stable } = body ?? {};
  return stable;
}

/**
 * Serialises the WHOLE logged call — message plus structured context — not just `args[0]`.
 * The reason belongs in a structured field rather than interpolated into the message, so an
 * assertion that only read the message would fail against the better implementation.
 */
function reasonsFrom(calls: unknown[][]): string[] {
  return calls.map((args) =>
    args
      .map((a) => (a instanceof Error ? `${a.name}: ${a.message}` : typeof a === 'string' ? a : JSON.stringify(a)))
      .join(' '),
  );
}

/** Every string a caller could see or a log could carry, flattened for leak assertions. */
function allText(value: unknown): string {
  return JSON.stringify(value ?? null);
}

describe('POST /auth/demo-session — opaque to the client, legible to the operator', () => {
  let logger: FakeLogger;
  let app: express.Express;

  beforeEach(() => {
    jest.clearAllMocks();
    logger = buildLogger();
    app = buildApp(logger);
  });

  describe('the operator channel', () => {
    it('logs the SPECIFIC reason when the demo is disabled', async () => {
      mockCreate.mockRejectedValue(new DemoSessionUnavailableError('Demo sessions are disabled'));

      const res = await request(app).post('/auth/demo-session').send({});

      expect(res.status).toBe(503);
      // The reason must reach the operator. Today nothing is logged for this error class at all,
      // which is the defect: `auth.ts` logs only non-DemoSessionUnavailableError failures.
      const logged = reasonsFrom(logger.warn.mock.calls).join(' | ');
      expect(logged).toContain('Demo sessions are disabled');
    });

    it('logs the SPECIFIC reason when a story row is no longer owned by the persona', async () => {
      mockCreate.mockRejectedValue(
        new DemoSessionUnavailableError('Ordinary request is not owned by the persona'),
      );

      const res = await request(app).post('/auth/demo-session').send({});

      expect(res.status).toBe(503);
      const logged = reasonsFrom(logger.warn.mock.calls).join(' | ');
      expect(logged).toContain('Ordinary request is not owned by the persona');
    });

    it('still logs unexpected failures at error level, and does not downgrade them to warn', async () => {
      mockCreate.mockRejectedValue(new Error('db exploded'));

      await request(app).post('/auth/demo-session').send({});

      // The pre-existing behaviour must survive: an unexpected failure is an error, not a warning.
      expect(logger.error).toHaveBeenCalled();
      expect(reasonsFrom(logger.error.mock.calls).join(' | ')).toContain(
        'Demo session issuance failed unexpectedly',
      );
    });
  });

  describe('the client contract is unchanged', () => {
    it('returns the exact ADR-084 / ADR-074 envelope', async () => {
      mockCreate.mockRejectedValue(new DemoSessionUnavailableError('Persona not found'));

      const res = await request(app).post('/auth/demo-session').send({});

      expect(res.status).toBe(503);
      expect(clientVisibleEnvelope(res.body)).toEqual({
        success: false,
        message: 'Demo session is unavailable',
        error: 'DEMO_UNAVAILABLE',
      });
    });

    it('is BYTE-IDENTICAL across two different causes while the logs differ', async () => {
      // This is the whole design in one assertion. Two genuinely different failures must be
      // indistinguishable to the caller and distinguishable to the operator.
      mockCreate.mockRejectedValue(new DemoSessionUnavailableError('Demo sessions are disabled'));
      const first = await request(app).post('/auth/demo-session').send({});
      const firstReasons = reasonsFrom(logger.warn.mock.calls).join(' | ');

      logger.warn.mockClear();

      mockCreate.mockRejectedValue(new DemoSessionUnavailableError('Persona not found'));
      const second = await request(app).post('/auth/demo-session').send({});
      const secondReasons = reasonsFrom(logger.warn.mock.calls).join(' | ');

      // Indistinguishable to the client...
      expect(second.status).toBe(first.status);
      expect(clientVisibleEnvelope(second.body)).toEqual(clientVisibleEnvelope(first.body));

      // ...and distinguishable to the operator.
      expect(firstReasons).toContain('Demo sessions are disabled');
      expect(secondReasons).toContain('Persona not found');
      expect(secondReasons).not.toEqual(firstReasons);
    });

    it('leaks no reason text into the response body, including via meta', async () => {
      const secret = 'Ordinary request is not owned by the persona';
      mockCreate.mockRejectedValue(new DemoSessionUnavailableError(secret));

      const res = await request(app).post('/auth/demo-session').send({});

      // The entire body, meta included — dropping meta from the equality check above must not
      // become a hiding place for the reason.
      expect(allText(res.body)).not.toContain(secret);
      expect(allText(res.body)).not.toContain('persona');
      expect(allText(res.body)).not.toContain('Persona');
    });
  });

  describe('secrets never reach the operator channel either', () => {
    it('does not log a token when issuance succeeds', async () => {
      mockCreate.mockResolvedValue({
        user: { id: 'u', email: 'maria.reyes@test.karmyq.com', name: 'Maria', communities: [] },
        token: 'demo.jwt.SUPERSECRET',
        demo: {
          expiresInMinutes: 30,
          stories: [
            { kind: 'ordinary', requestId: 'r1', matchId: 'm1' },
            { kind: 'provider', requestId: 'r2', offerId: 'o1' },
          ],
        },
      } as any);

      const res = await request(app).post('/auth/demo-session').send({});

      expect(res.status).toBe(200);
      const everythingLogged = [
        ...logger.warn.mock.calls,
        ...logger.error.mock.calls,
        ...logger.info.mock.calls,
        ...logger.debug.mock.calls,
      ];
      expect(allText(everythingLogged)).not.toContain('SUPERSECRET');
    });
  });
});
