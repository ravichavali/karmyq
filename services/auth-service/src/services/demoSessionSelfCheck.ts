/**
 * Sprint 129 (BUG-039) — boot-time health report for the guided Maria demo.
 *
 * The demo is two live stories whose IDs are stored in `DEMO_*` environment variables. Those rows
 * are deleted on a schedule by cleanup-service, so the configuration goes stale on a timer. Before
 * this check existed, a stale config announced itself nowhere: `karmyq.com/demo` simply rendered
 * "the live demo isn't available right now" and stayed that way until a human noticed. It stayed
 * broken for days.
 *
 * This runs once at startup so the failure surfaces in the deploy log instead of at first visitor.
 * It is a REPORT, not a gate — see the throw-safety contract below.
 */

import { createDemoSession, DemoSessionUnavailableError } from './demoSessionService';

/** The subset of the shared logger this module needs. Narrow on purpose, so tests can fake it. */
export interface DemoSelfCheckLogger {
  info(message: string, context?: Record<string, unknown>): void;
  warn(message: string, context?: Record<string, unknown>): void;
  error(message: string, error?: Error, context?: Record<string, unknown>): void;
}

export type DemoSelfCheckOutcome = 'disabled' | 'healthy' | 'unavailable' | 'error';

/** Injectable so the check can be tested without a database. */
export type IssueDemoSession = () => Promise<unknown>;

/**
 * Report whether a demo session can currently be issued.
 *
 * **This function never throws and never rejects.** auth-service is Critical with seven dependents,
 * and the call site sits inside the startup try/catch whose catch calls `process.exit(1)`. A
 * rejection here would turn a fault in an OPTIONAL demo feature into a platform-wide auth outage.
 * Every failure path, including a logger that throws, resolves to an outcome instead.
 *
 * It also never logs the issued token: a successful check mints a real demo JWT, and writing that
 * to the log would hand a live session to anyone who can read logs.
 */
export async function reportDemoSessionHealth(
  logger: DemoSelfCheckLogger,
  issue: IssueDemoSession = createDemoSession,
): Promise<DemoSelfCheckOutcome> {
  // Swallow logger faults so a broken transport cannot fail the boot either.
  const say = {
    info: (m: string, c?: Record<string, unknown>) => { try { logger.info(m, c); } catch { /* ignore */ } },
    warn: (m: string, c?: Record<string, unknown>) => { try { logger.warn(m, c); } catch { /* ignore */ } },
    error: (m: string, e?: Error, c?: Record<string, unknown>) => { try { logger.error(m, e, c); } catch { /* ignore */ } },
  };

  try {
    // Mirror `readConfig`'s strict comparison exactly (demoSessionService.ts). Anything other than
    // the literal 'true' — 'false', '1', 'TRUE' — is OFF there, so it must be OFF here too; a
    // self-check that disagreed with the code it checks would report health the endpoint lacks.
    if (process.env.DEMO_SESSION_ENABLED !== 'true') {
      say.info('Demo sessions are disabled (DEMO_SESSION_ENABLED is not "true"); skipping self-check');
      return 'disabled';
    }

    await issue();

    // Deliberately logs nothing from the result — no token, no story ids, no persona email.
    say.info('Demo session self-check passed: a session can be issued');
    return 'healthy';
  } catch (error) {
    if (error instanceof DemoSessionUnavailableError) {
      // There is no client here, so there is nothing to keep opaque: the whole point is the reason.
      say.warn('Demo session self-check FAILED — the guided demo is down', {
        reason: error.message,
        hint: 'Rotate the demo stories: npm --workspace @karmyq/simulation-service run rotate:demo-stories -- --apply --publish-config',
      });
      return 'unavailable';
    }

    say.error(
      'Demo session self-check failed unexpectedly',
      error instanceof Error ? error : new Error(String(error)),
    );
    return 'error';
  }
}
