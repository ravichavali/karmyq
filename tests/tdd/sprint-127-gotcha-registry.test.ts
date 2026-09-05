import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

const reg = require('../../scripts/gotcha-registry.js');

function fixtureRoot(files: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), 'gotcha-'));
  mkdirSync(join(root, 'docs', 'gotchas'), { recursive: true });
  for (const [rel, content] of Object.entries(files)) {
    writeFileSync(join(root, rel), content, 'utf8');
  }
  return root;
}

const VALID = {
  title: 'npm status page is not a signal',
  owner: 'ravichavali',
  created: '2026-09-04',
  expires: '2027-03-04',
  scope: ['scripts/audit-exemptions.js'],
};

describe('gotcha registry — schema', () => {
  it('accepts a well-formed entry', () => {
    const root = fixtureRoot({
      'docs/gotchas/a.json': JSON.stringify(VALID),
      'docs/gotchas/a.md': 'body',
    });
    const { entries, errors } = reg.loadRegistry(root);
    expect(errors).toEqual([]);
    expect(entries).toHaveLength(1);
    expect(reg.validateSchema(entries[0])).toEqual([]);
    rmSync(root, { recursive: true, force: true });
  });

  it('FAILS when a required field is missing', () => {
    const { owner, ...noOwner } = VALID;
    const root = fixtureRoot({
      'docs/gotchas/a.json': JSON.stringify(noOwner),
      'docs/gotchas/a.md': 'body',
    });
    const { entries } = reg.loadRegistry(root);
    expect(reg.validateSchema(entries[0])).toEqual([expect.stringContaining('owner')]);
    rmSync(root, { recursive: true, force: true });
  });

  it('FAILS when both verify and expires are present', () => {
    const root = fixtureRoot({
      'docs/gotchas/a.json': JSON.stringify({
        ...VALID,
        verify: { path_exists: 'README.md' },
      }),
      'docs/gotchas/a.md': 'body',
    });
    const { entries } = reg.loadRegistry(root);
    expect(reg.validateSchema(entries[0])).toEqual([
      expect.stringContaining('exactly one of'),
    ]);
    rmSync(root, { recursive: true, force: true });
  });

  it('FAILS when neither verify nor expires is present', () => {
    const { expires, ...neither } = VALID;
    const root = fixtureRoot({
      'docs/gotchas/a.json': JSON.stringify(neither),
      'docs/gotchas/a.md': 'body',
    });
    const { entries } = reg.loadRegistry(root);
    expect(reg.validateSchema(entries[0])).toEqual([
      expect.stringContaining('exactly one of'),
    ]);
    rmSync(root, { recursive: true, force: true });
  });

  // These three all passed an earlier draft: an entry asserting nothing, with no
  // review date, satisfied "exactly one of". That defeats the whole invariant.
  it.each([null, false, {}, [], 'yes'])('FAILS when verify is %p (asserts nothing)', (bad) => {
    const { expires, ...noExpires } = VALID;
    const root = fixtureRoot({
      'docs/gotchas/a.json': JSON.stringify({ ...noExpires, verify: bad }),
      'docs/gotchas/a.md': 'body',
    });
    const { entries } = reg.loadRegistry(root);
    expect(reg.validateSchema(entries[0]).length).toBeGreaterThan(0);
    rmSync(root, { recursive: true, force: true });
  });

  it.each([
    ['renewed', 'not-an-array'],
    ['see_also', { a: 1 }],
  ])('FAILS when %s is malformed rather than silently treating it as empty', (field, bad) => {
    const root = fixtureRoot({
      'docs/gotchas/a.json': JSON.stringify({ ...VALID, [field as string]: bad }),
      'docs/gotchas/a.md': 'body',
    });
    const { entries } = reg.loadRegistry(root);
    expect(reg.validateSchema(entries[0])).toEqual([expect.stringContaining(field as string)]);
    rmSync(root, { recursive: true, force: true });
  });

  it('FAILS a check with malformed arguments', () => {
    const { expires, ...noExpires } = VALID;
    const root = fixtureRoot({
      'docs/gotchas/a.json': JSON.stringify({
        ...noExpires,
        verify: { file_matches: { path: 'a.sh', pattern: '[unclosed' } },
      }),
      'docs/gotchas/a.md': 'body',
    });
    const { entries } = reg.loadRegistry(root);
    expect(reg.validateSchema(entries[0])).toEqual([expect.stringContaining('not a valid regex')]);
    rmSync(root, { recursive: true, force: true });
  });

  it('loads a body whose path is repo-relative, not double-joined', () => {
    const root = fixtureRoot({
      'docs/gotchas/a.json': JSON.stringify(VALID),
      'docs/gotchas/a.md': 'the body text',
    });
    const { entries } = reg.loadRegistry(root);
    expect(entries[0].bodyPath).toBe('docs/gotchas/a.md');
    expect(entries[0].body).toBe('the body text');
    rmSync(root, { recursive: true, force: true });
  });

  it('reports malformed JSON as a load error rather than throwing', () => {
    const root = fixtureRoot({
      'docs/gotchas/a.json': '{ not json',
      'docs/gotchas/a.md': 'body',
    });
    const { errors } = reg.loadRegistry(root);
    expect(errors).toEqual([expect.stringContaining('a.json')]);
    rmSync(root, { recursive: true, force: true });
  });
});
