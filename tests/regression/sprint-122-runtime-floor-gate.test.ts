import { execFileSync } from 'child_process';
import { readFileSync } from 'fs';
import { join } from 'path';
import semver from 'semver';

/**
 * Sprint 122 PR 5 — the container runtime must actually satisfy what we install
 * (ADR-090).
 *
 * WHAT WENT WRONG. Dependabot #169 proposed `redis` 4.7.1 → 6.2.0. node-redis 6
 * declares `engines.node: ">= 20.0.0"`; every backend Dockerfile built and ran on
 * `node:18-alpine`. npm does not enforce `engines` without `engine-strict` (this
 * repo's `.npmrc` does not set it), so the bump would have installed cleanly,
 * built cleanly, deployed cleanly, and shipped a package onto a runtime it
 * declares it does not support.
 *
 * Measured while writing this gate, and the reason it exists at all: redis was
 * NOT the first violation. 61 production packages in the lockfile already
 * declared a Node floor above 18. The images had been out of contract for a long
 * time, silently, because nothing compared the two numbers.
 *
 * WHAT THIS GATE PROVES: for every non-dev package in `package-lock.json` that
 * declares `engines.node`, the Node major every image runs is at least that
 * package's minimum major; the root `engines.node` says the same number; and CI
 * builds on that number too, so CI is testing the runtime we ship.
 *
 * WHAT IT DOES NOT PROVE — stated rather than glossed, per ADR-088:
 *   - It compares MAJORS. A package requiring `>= 24.9.0` would pass here on any
 *     Node 24 image even if that image shipped 24.0.0, because the exact patch
 *     inside `node:24-alpine` drifts and cannot be read without a Docker daemon.
 *     The `no floor lands inside the runtime major` assertion below exists to
 *     force that case to a human instead of letting it pass quietly.
 *   - It reads the lockfile, not a built image. It cannot see a package installed
 *     by something other than the workspace install, nor an `engines` field the
 *     lockfile omits (799 of 1835 entries declare none).
 */
const ROOT = join(__dirname, '..', '..');
const LOCK = join(ROOT, 'package-lock.json');
const ROOT_PKG = join(ROOT, 'package.json');
const CI_YML = join(ROOT, '.github', 'workflows', 'ci.yml');

/**
 * The Node major every image runs. Changing this is a platform decision (ADR-090)
 * and must move the Dockerfiles, root `engines`, and CI's NODE_VERSION together —
 * which is exactly what the assertions below enforce.
 */
const RUNTIME_MAJOR = 24;

/**
 * Node majors that have reached end-of-life, with the dates from
 * nodejs/Release `schedule.json` (read 2026-08-05). Listing them by number rather
 * than computing from today's date keeps this gate deterministic: a date
 * comparison would turn green today and red on a calendar boundary with no code
 * change, which is a flake, not a signal.
 *
 * 22 is deliberately absent — it is in Maintenance LTS until 2027-04-30 and is a
 * legitimate choice; it is simply not the one we made.
 */
const EOL_MAJORS: Record<number, string> = {
  18: '2025-04-30',
  20: '2026-04-30',
};

/** Every tracked Dockerfile. Pinned by identity so that DELETING one cannot shrink
 *  what this gate checks while leaving it green — counting is not identity. */
const EXPECTED_DOCKERFILES = [
  'apps/frontend/Dockerfile',
  'apps/frontend/Dockerfile.prod',
  'services/auth-service/Dockerfile',
  'services/cleanup-service/Dockerfile',
  'services/community-service/Dockerfile',
  'services/geocoding-service/Dockerfile',
  'services/messaging-service/Dockerfile',
  'services/notification-service/Dockerfile',
  'services/reputation-service/Dockerfile',
  'services/request-service/Dockerfile',
  'services/social-graph-service/Dockerfile',
  'tests/Dockerfile.test',
];

/**
 * Each scan below spawns a `git` process or parses the 1835-entry lockfile, and
 * every one is read by several assertions. Compute once per run — the tree cannot
 * change mid-suite, and jest gives each run a fresh module registry, so the
 * injection sweep still sees each mutation.
 */
function once<T>(compute: () => T): () => T {
  let cached: { value: T } | undefined;
  return () => (cached ??= { value: compute() }).value;
}

const trackedDockerfiles = once((): string[] => {
  const out = execFileSync('git', ['ls-files'], { cwd: ROOT, encoding: 'utf8' });
  return out
    .split(/\r?\n/)
    .filter((f) => /(^|\/)Dockerfile(\.|$)/i.test(f))
    .sort();
});

/** Every `FROM node:…` line in a Dockerfile, as `{ file, tag }`. */
const nodeBaseImages = once((): Array<{ file: string; tag: string }> => {
  const images: Array<{ file: string; tag: string }> = [];
  for (const file of trackedDockerfiles()) {
    const body = readFileSync(join(ROOT, file), 'utf8');
    for (const line of body.split(/\r?\n/)) {
      const m = line.match(/^FROM\s+(node:\S+)/);
      if (m) images.push({ file, tag: m[1] });
    }
  }
  return images;
});

const lockfile = once(() => JSON.parse(readFileSync(LOCK, 'utf8')));

/**
 * Non-dev lockfile packages that declare a Node floor.
 *
 * Workspace entries (keys not under `node_modules/`) are excluded on purpose:
 * they are our own manifests, not things we install into an image, and
 * `apps/mobile` legitimately declares `^22.13.0 || ^24.3.0 || >=25.0.0` while
 * never being containerised at all.
 */
const installedNodeFloors = once((): Array<{ name: string; range: string; min: semver.SemVer }> => {
  const lock = lockfile();
  const floors: Array<{ name: string; range: string; min: semver.SemVer }> = [];

  for (const [path, meta] of Object.entries<any>(lock.packages)) {
    if (!path.startsWith('node_modules/')) continue;
    if (meta.dev || meta.devOptional || meta.link) continue;
    const range = meta.engines?.node;
    if (!range) continue;

    const min = semver.minVersion(range);
    // A range npm accepts but semver cannot reduce is not something to skip
    // quietly — that is how a real floor goes unchecked.
    if (!min) throw new Error(`Unparseable engines.node for ${path}: ${range}`);
    floors.push({ name: path.replace(/^node_modules\//, ''), range, min });
  }

  return floors;
});

describe('container runtime satisfies every installed package (ADR-090)', () => {
  it('checks exactly the tracked Dockerfiles — deleting one cannot shrink this gate', () => {
    expect(trackedDockerfiles()).toEqual(EXPECTED_DOCKERFILES);
  });

  it('every Node base image is pinned to the agreed major, with no floating tag', () => {
    const images = nodeBaseImages();

    // Non-vacuity: if the parse ever finds nothing, every other assertion in this
    // block passes over an empty list.
    expect(images.length).toBeGreaterThan(0);

    // Identity, not "at least one is right": report the exact set of distinct tags
    // so a single stale stage in a single file is named in the failure.
    const distinct = [...new Set(images.map((i) => i.tag))].sort();
    expect(distinct).toEqual([`node:${RUNTIME_MAJOR}-alpine`]);

    // `node:latest` / `node:alpine` would satisfy a "starts with node:" check
    // while pinning nothing.
    const unpinned = images.filter((i) => !/^node:\d+-/.test(i.tag));
    expect(unpinned).toEqual([]);
  });

  it('the runtime major is not end-of-life', () => {
    expect(Object.keys(EOL_MAJORS).map(Number)).not.toContain(RUNTIME_MAJOR);

    // And no image sneaks back onto one behind RUNTIME_MAJOR's back.
    const onEol = nodeBaseImages().filter((i) => {
      const major = Number(i.tag.match(/^node:(\d+)-/)?.[1]);
      return major in EOL_MAJORS;
    });
    expect(onEol).toEqual([]);
  });

  it('THE PROPERTY: no installed package requires a newer Node major than the image runs', () => {
    const floors = installedNodeFloors();

    // Non-vacuity: the scan must actually be finding packages. If a lockfile
    // format change made `engines` unreadable, every assertion below would pass
    // over an empty list — which is precisely how this class of gate goes silently
    // inert.
    expect(floors.length).toBeGreaterThan(100);

    // Report offenders by IDENTITY (name + the range that broke it), not a count,
    // so the failure message names the package to fix.
    const violations = floors
      .filter((f) => f.min.major > RUNTIME_MAJOR)
      .map((f) => `${f.name} requires ${f.range}`)
      .sort();

    expect(violations).toEqual([]);
  });

  it('no floor lands inside the runtime major, where a major comparison stops being exact', () => {
    // Documented limitation made actionable: `>= 24.9.0` on a Node 24 image is
    // NOT proven safe by the assertion above, because the patch inside
    // `node:24-alpine` is not readable here. Rather than let that pass quietly,
    // force it to a human.
    const inside = installedNodeFloors()
      .filter((f) => f.min.major === RUNTIME_MAJOR && (f.min.minor > 0 || f.min.patch > 0))
      .map((f) => `${f.name} requires ${f.range} — verify the tag's actual Node patch`)
      .sort();

    expect(inside).toEqual([]);
  });

  it('root engines.node states the same runtime the images actually run', () => {
    const declared = JSON.parse(readFileSync(ROOT_PKG, 'utf8')).engines?.node;
    expect(declared).toBeTruthy();

    const min = semver.minVersion(declared);
    expect(min).not.toBeNull();
    // Equality, not `>=`: a floor of 18 while shipping 24 understates the
    // requirement, and a floor of 26 while shipping 24 is a lie in the other
    // direction. Both were reachable before this gate.
    expect(min!.major).toBe(RUNTIME_MAJOR);
  });

  it('CI builds on the runtime we ship, so a green CI is evidence about production', () => {
    // The root cause of this whole class: CI ran Node 24 while images ran Node 18,
    // so every green check described a runtime the demo never executed.
    const ci = readFileSync(CI_YML, 'utf8');
    const declared = ci.match(/^\s*NODE_VERSION:\s*'?([^'\s]+)'?/m)?.[1];
    expect(declared).toBeTruthy();

    const major = Number(String(declared).match(/^(\d+)/)?.[1]);
    expect(major).toBe(RUNTIME_MAJOR);
  });
});

describe('redis is declared by the workspace that imports it', () => {
  // The original violation this PR fixes: services/messaging-service imported
  // `redis` while declaring nothing, surviving purely on the root declaration
  // hoisting it. A bump in the workspaces that DO declare a package de-hoists it
  // out from under the ones that do not.
  const MESSAGING_PKG = join(ROOT, 'services', 'messaging-service', 'package.json');
  const messagingPkg = once(() => JSON.parse(readFileSync(MESSAGING_PKG, 'utf8')));

  it('services/messaging-service declares redis, the package it imports', () => {
    expect(messagingPkg().dependencies?.redis).toBeTruthy();
  });

  it('its declared range matches the version actually resolved in the lockfile', () => {
    const resolved = lockfile().packages['node_modules/redis']?.version;

    expect(resolved).toBeTruthy();
    // Identity against the resolved tree, not "a range exists": a declaration of
    // `^4.6.11` beside a resolved 6.2.0 is the half-resolution failure that has
    // bitten this repo repeatedly.
    expect(semver.satisfies(resolved, messagingPkg().dependencies.redis)).toBe(true);
  });

  it('the root declaration and the workspace declaration agree', () => {
    const root = JSON.parse(readFileSync(ROOT_PKG, 'utf8'));
    expect(messagingPkg().dependencies.redis).toBe(root.dependencies.redis);
  });
});
