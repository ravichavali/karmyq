/**
 * Sprint 131 D7 — the root `@swc/helpers` override must equal next's EXACT `@swc/helpers` pin.
 *
 * ADR-059 note 4: the override exists only to force npm to materialize the node (a Node 24 scratch
 * regen drops it). Its value tracks next: 0.5.15 under next 15, 0.5.23 under 16.3.6. A next bump
 * that moves the pin would otherwise be silently forced back to the old helpers, with no gate red.
 * Reads the installed next, the live arbiter, not a hand-written copy of its pin.
 */
import { read } from './helpers/workspaces';

describe('@swc/helpers override follows next (ADR-059 note 4)', () => {
  const override = JSON.parse(read('package.json')).overrides['@swc/helpers'];
  const nextPkg = require(require.resolve('next/package.json', { paths: [`${__dirname}/../../apps/frontend`] }));

  it("equals next's exact @swc/helpers dependency", () => {
    expect(override).toBe(nextPkg.dependencies['@swc/helpers']);
  });

  it('is the version actually installed', () => {
    const installed = require(require.resolve('@swc/helpers/package.json', { paths: [`${__dirname}/../..`] }));
    expect(installed.version).toBe(override);
  });
});
