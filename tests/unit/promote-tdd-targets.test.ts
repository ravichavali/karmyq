import { existsSync } from 'fs';
import { join } from 'path';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { collectTddTargets } = require('../../scripts/promote-tdd-tests.js');

/**
 * Sprint 122 PR 2 — the TDD promoter must walk apps/, not just services/ (ADR-088).
 *
 * scripts/promote-tdd-tests.js declared APPS_DIR at line 18 and never read it.
 * Root package.json runs this script as `posttest`, so an apps/* tdd test that
 * goes green was never promoted, and apps/mobile + apps/landing run every tier
 * on bare `jest` — meaning a red apps/* tdd test blocked pushes with no way out.
 */
const ROOT = join(__dirname, '..', '..');

describe('collectTddTargets', () => {
  const targets = collectTddTargets();
  const workspaces = targets.map((t: { workspace: string }) => t.workspace);

  it('includes apps/ workspaces that have a tests/tdd directory', () => {
    // Anchored on apps/frontend, not apps/landing: apps/landing/tests/tdd is
    // empty by construction (its only occupant was promoted out by this PR)
    // and tracked only via a .gitkeep, which is fragile to build a permanent
    // gate on. apps/frontend/tests/tdd carries 74 tracked files and is not
    // going empty.
    expect(existsSync(join(ROOT, 'apps', 'frontend', 'tests', 'tdd'))).toBe(true);
    expect(workspaces).toContain('apps/frontend');
  });

  it('also includes apps/landing when its tests/tdd directory exists', () => {
    // Secondary check: apps/landing/tests/tdd is currently empty (see above),
    // so this only asserts something when the directory is present at all.
    if (existsSync(join(ROOT, 'apps', 'landing', 'tests', 'tdd'))) {
      expect(workspaces).toContain('apps/landing');
    }
  });

  it('still includes services/ workspaces that have a tests/tdd directory', () => {
    expect(existsSync(join(ROOT, 'services', 'request-service', 'tests', 'tdd'))).toBe(true);
    expect(workspaces).toContain('services/request-service');
  });

  it('never returns a workspace whose tests/tdd directory does not exist', () => {
    const phantom = targets.filter((t: { tddDir: string }) => !existsSync(t.tddDir));
    expect(phantom).toEqual([]);
  });

  it('returns each workspace exactly once', () => {
    expect(workspaces.length).toBe(new Set(workspaces).size);
  });

  it('points cwd at the workspace root, not the tdd directory', () => {
    for (const t of targets as Array<{ dir: string; tddDir: string }>) {
      expect(t.tddDir).toBe(join(t.dir, 'tests', 'tdd'));
      expect(existsSync(join(t.dir, 'package.json'))).toBe(true);
    }
  });
});
