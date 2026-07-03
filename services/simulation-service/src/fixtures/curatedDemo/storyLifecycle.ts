/**
 * Sprint 117 — Curated Demo Fixtures: live-story lifecycle and explicit rotation.
 *
 * Live Maria stories are finite: they are created through ordinary APIs, verified by authoritative
 * readback, and rotated explicitly before their request TTL becomes unsafe. Rotation publishes new
 * configuration ONLY after the replacement stories verify ready and a fresh demo session confirms
 * them, and only then retires the old stories. Any failure leaves the current stories in place.
 * Rotation never triggers a full reset.
 */

import type { VerifiedStoryIds } from './verifier';

export * from './configPublisher';

/** Injected steps of a rotation, so ordering and fail-closed behaviour are unit-testable. */
export interface RotationDeps {
  /** Create replacement live stories through ordinary APIs; returns their server-generated IDs. */
  createStories(): Promise<VerifiedStoryIds>;
  /** Authoritative readback verification of the replacement stories. */
  verify(): Promise<{ ready: boolean; storyIds?: VerifiedStoryIds }>;
  /** Back up and atomically replace the allowlisted demo config variables. */
  publishConfig(): Promise<void>;
  /** (Re-)enable public demo traffic BEFORE the demo-session re-check can pass. Idempotent. */
  enableDemo(): Promise<void>;
  /** Restart auth so the refreshed configuration AND enabled state take effect. */
  restartAuth(): Promise<void>;
  /** Confirm the published demo session resolves the new stories and is read-only. */
  verifyDemoSession(): Promise<{ ok: boolean }>;
  /** Retire the now-replaced old stories. */
  retireOld(): Promise<void>;
}

export interface RotationResult {
  storyIds?: VerifiedStoryIds;
}

/**
 * Rotate the finite live Maria stories. Order is fixed and fail-closed: create → verify (data
 * readback) → publish (backup + replace) → enable demo → restart auth → re-verify demo session →
 * retire old. Enabling BEFORE the restart+demo-session re-check is essential: during a full reset
 * the demo is disabled up front, so the session check can only pass once it is re-enabled.
 */
export async function rotateStories(deps: RotationDeps): Promise<RotationResult> {
  await deps.createStories();

  const report = await deps.verify();
  if (!report.ready) {
    throw new Error('Refusing rotation: replacement stories are not ready');
  }

  await deps.publishConfig();
  await deps.enableDemo();
  await deps.restartAuth();

  const session = await deps.verifyDemoSession();
  if (!session.ok) {
    throw new Error('Refusing rotation: published demo session re-check failed');
  }

  await deps.retireOld();
  return { storyIds: report.storyIds };
}
