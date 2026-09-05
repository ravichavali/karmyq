import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

const reg = require('../../scripts/gotcha-registry.js');

function root(files: Record<string, string>): string {
  const r = mkdtempSync(join(tmpdir(), 'gv-'));
  mkdirSync(join(r, 'docs', 'gotchas'), { recursive: true });
  for (const [rel, c] of Object.entries(files)) {
    mkdirSync(join(r, rel, '..'), { recursive: true });
    writeFileSync(join(r, rel), c, 'utf8');
  }
  return r;
}

function entryWith(verify: object) {
  return { slug: 'a', jsonPath: 'docs/gotchas/a.json', bodyPath: 'docs/gotchas/a.md',
           data: { verify }, body: '' };
}

describe('gotcha registry — verify executors', () => {
  it('path_exists passes when the path is present', () => {
    const r = root({ 'target.txt': 'x' });
    expect(reg.runVerify(r, entryWith({ path_exists: 'target.txt' }))).toEqual([]);
    rmSync(r, { recursive: true, force: true });
  });

  it('path_exists FAILS on a deleted path', () => {
    const r = root({ 'other.txt': 'x' });
    expect(reg.runVerify(r, entryWith({ path_exists: 'gone.txt' }))).toEqual([
      expect.stringContaining('gone.txt'),
    ]);
    rmSync(r, { recursive: true, force: true });
  });

  it('file_matches passes when the pattern is found', () => {
    const r = root({ 'a.sh': 'hooks_dir=".git/hooks"' });
    expect(
      reg.runVerify(r, entryWith({ file_matches: { path: 'a.sh', pattern: 'hooks_dir' } })),
    ).toEqual([]);
    rmSync(r, { recursive: true, force: true });
  });

  it('file_matches FAILS when the pattern no longer matches', () => {
    const r = root({ 'a.sh': 'something else' });
    expect(
      reg.runVerify(r, entryWith({ file_matches: { path: 'a.sh', pattern: 'hooks_dir' } })),
    ).toEqual([expect.stringContaining('no longer contains')]);
    rmSync(r, { recursive: true, force: true });
  });

  it('file_not_matches FAILS when the forbidden pattern appears', () => {
    const r = root({ 'a.sh': 'npm install' });
    expect(
      reg.runVerify(r, entryWith({ file_not_matches: { path: 'a.sh', pattern: 'npm install' } })),
    ).toEqual([expect.stringContaining('unexpectedly contains')]);
    rmSync(r, { recursive: true, force: true });
  });

  it('json_equals compares a dotted key path', () => {
    const r = root({ 'p.json': JSON.stringify({ engines: { node: '>=24.0.0' } }) });
    expect(
      reg.runVerify(r, entryWith({ json_equals: { path: 'p.json', key: 'engines.node', value: '>=24.0.0' } })),
    ).toEqual([]);
    expect(
      reg.runVerify(r, entryWith({ json_equals: { path: 'p.json', key: 'engines.node', value: '>=20' } })),
    ).toEqual([expect.stringContaining('expected')]);
    rmSync(r, { recursive: true, force: true });
  });

  // Fail-closed: mirrors ADR-060's refusal to treat an unreadable source as "nothing found".
  it('FAILS rather than skips when the target is unreadable', () => {
    const r = root({ 'a.sh': 'x' });
    const errs = reg.runVerify(r, entryWith({ file_matches: { path: 'missing.sh', pattern: 'x' } }));
    expect(errs).toEqual([expect.stringContaining('unreadable')]);
    rmSync(r, { recursive: true, force: true });
  });

  it('FAILS on an unknown check type instead of ignoring it', () => {
    const r = root({ 'a.sh': 'x' });
    expect(reg.runVerify(r, entryWith({ run_shell: 'rm -rf /' }))).toEqual([
      expect.stringContaining('unsupported check type'),
    ]);
    rmSync(r, { recursive: true, force: true });
  });
});
