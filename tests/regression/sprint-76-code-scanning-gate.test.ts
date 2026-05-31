import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

// Sprint 76 (ADR-060 / ADR-061): lock in the code-scanning gate + supply-chain
// hardening so they cannot silently regress. Config-only changes that live in
// repo SETTINGS (CodeQL suite, secret-scanning toggles) can't be asserted from a
// repo test — ADR-060/061 are their durable record; this test covers the
// file-committed half + the runtime gate job.
const ROOT = join(__dirname, '..', '..');
const read = (rel: string) => readFileSync(join(ROOT, rel), 'utf8');

describe('Sprint 76 — code-scanning gate + supply-chain hardening invariants', () => {
  const ci = read('.github/workflows/ci.yml');

  it('ci.yml defines the blocking code-scanning-gate job', () => {
    expect(ci).toMatch(/code-scanning-gate:/);
    // it must actually be able to fail (exit 1) on open findings
    expect(ci).toMatch(/exit 1/);
    // and it must gate the build (be a dependency of build-images)
    expect(ci).toMatch(/needs:.*code-scanning-gate/);
  });

  it('ci.yml runs OSV-Scanner and npm audit signatures', () => {
    expect(ci).toMatch(/osv-scanner/i);
    expect(ci).toMatch(/npm audit signatures/);
  });

  it('.npmrc enforces ignore-scripts (supply-chain worm vector blocked)', () => {
    expect(read('.npmrc')).toMatch(/^ignore-scripts=true/m);
  });

  it('dependabot config exists and does NOT enable auto-merge', () => {
    expect(existsSync(join(ROOT, '.github/dependabot.yml'))).toBe(true);
    expect(read('.github/dependabot.yml')).not.toMatch(/auto-?merge/i);
  });

  it('e2e workflow uses deterministic npm ci, not npm install', () => {
    expect(read('.github/workflows/e2e-tests.yml')).not.toMatch(/npm install/);
  });

  it('third-party GitHub Actions are pinned to a commit SHA', () => {
    // docker/* actions must be pinned to a 40-char SHA, not a floating @v tag
    expect(ci).toMatch(/docker\/build-push-action@[0-9a-f]{40}/);
    expect(ci).toMatch(/docker\/setup-buildx-action@[0-9a-f]{40}/);
  });

  it('the two real alerts are fixed: mailto + path-param encoding', () => {
    expect(read('apps/landing/src/lib/buildSubscribeMailto.ts')).toMatch(/encodeURIComponent/);
    expect(read('apps/frontend/src/lib/socialGraphUrls.ts')).toMatch(/encodeURIComponent/);
    // Movement.tsx must route through the encoding helper, not build the href inline
    expect(read('apps/landing/src/components/sections/Movement.tsx')).toMatch(/buildSubscribeMailto/);
  });
});
