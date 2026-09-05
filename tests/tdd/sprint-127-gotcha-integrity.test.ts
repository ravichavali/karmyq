import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

const reg = require('../../scripts/gotcha-registry.js');

const TRACKED = ['scripts/install-hooks.sh', 'scripts/git-hooks/pre-push', 'README.md'];

function e(data: object) {
  return { slug: 'a', jsonPath: 'docs/gotchas/a.json', bodyPath: 'docs/gotchas/a.md',
           data, body: '' };
}

describe('gotcha registry — scope, references, pairing', () => {
  it('accepts an exact tracked file', () => {
    expect(reg.checkScope(e({ scope: ['scripts/install-hooks.sh'] }), TRACKED)).toEqual([]);
  });

  it('accepts a directory prefix covering a tracked file', () => {
    expect(reg.checkScope(e({ scope: ['scripts/git-hooks/'] }), TRACKED)).toEqual([]);
  });

  // .husky/ exists on a dev machine but is gitignored — this is the exact defect
  // that made an earlier draft of the spec fail on every fresh clone.
  it('FAILS an untracked-but-present path', () => {
    expect(reg.checkScope(e({ scope: ['.husky/'] }), TRACKED)).toEqual([
      expect.stringContaining('.husky/'),
    ]);
  });

  it('FAILS a see_also pointing at a non-existent slug', () => {
    expect(reg.checkReferences(e({ see_also: ['no-such-entry'] }), ['a', 'b'])).toEqual([
      expect.stringContaining('no-such-entry'),
    ]);
  });

  it('accepts a see_also that resolves', () => {
    expect(reg.checkReferences(e({ see_also: ['b'] }), ['a', 'b'])).toEqual([]);
  });

  it('FAILS an orphaned .json and an orphaned .md', () => {
    const r = mkdtempSync(join(tmpdir(), 'gp-'));
    mkdirSync(join(r, 'docs', 'gotchas'), { recursive: true });
    writeFileSync(join(r, 'docs/gotchas/lonely-json.json'), '{}', 'utf8');
    writeFileSync(join(r, 'docs/gotchas/lonely-md.md'), 'body', 'utf8');
    const errs = reg.checkPairing(r);
    expect(errs).toEqual(
      expect.arrayContaining([
        expect.stringContaining('lonely-json'),
        expect.stringContaining('lonely-md'),
      ]),
    );
    rmSync(r, { recursive: true, force: true });
  });
});
