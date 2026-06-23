// Unit test for the warn-first skipped-test detector in scripts/feedback-loop.js.
// Pure logic, injected readFile — no disk, no git.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { detectSkippedTests } = require('../../scripts/feedback-loop.js');

// Build an in-memory file map and a matching readFile fn.
function withFiles(files: Record<string, string>) {
  return (rel: string) => {
    if (!(rel in files)) throw new Error(`no such file: ${rel}`);
    return files[rel];
  };
}

describe('detectSkippedTests (warn-first gate)', () => {
  it('flags an undocumented skip with the exact file, line, and text', () => {
    const files = {
      'a.test.ts': ['describe("x", () => {', "  it.skip('does y', () => {});", '});'].join('\n'),
    };
    const hits = detectSkippedTests(['a.test.ts'], withFiles(files));
    expect(hits).toEqual([
      { file: 'a.test.ts', line: 2, text: "it.skip('does y', () => {});" },
    ]);
  });

  it('stays quiet when a comment justifies the skip on the same line', () => {
    const files = {
      'a.test.ts': "it.skip('flaky', () => {}); // skip: flaky, tracked in #123",
    };
    expect(detectSkippedTests(['a.test.ts'], withFiles(files))).toEqual([]);
  });

  it('stays quiet when the line directly above is a comment', () => {
    const files = {
      'a.test.ts': ['// disabled until the API lands', "it.skip('later', () => {});"].join('\n'),
    };
    expect(detectSkippedTests(['a.test.ts'], withFiles(files))).toEqual([]);
  });

  it('catches xit and xdescribe too', () => {
    const files = {
      'a.test.ts': ['xdescribe("group", () => {', '  xit("case", () => {});', '});'].join('\n'),
    };
    const hits = detectSkippedTests(['a.test.ts'], withFiles(files));
    expect(hits.map((h: { line: number }) => h.line)).toEqual([1, 2]);
  });

  it('does NOT flag a skip token that only appears inside a string literal (anti-heartburn)', () => {
    const files = {
      // a meta-test / fixture that merely *mentions* skipping — the token is inside quotes
      'a.test.ts': [
        "const fixture = \"it.skip('x', () => {})\";",
        "it('describes xit and xdescribe behavior', () => {});",
      ].join('\n'),
    };
    expect(detectSkippedTests(['a.test.ts'], withFiles(files))).toEqual([]);
  });

  it('ignores skips in non-test files (no false positives on source)', () => {
    const files = {
      'src/thing.ts': 'const test = { skip: true };\nit.skip;',
    };
    expect(detectSkippedTests(['src/thing.ts'], withFiles(files))).toEqual([]);
  });

  it('returns an empty array when nothing is skipped', () => {
    const files = { 'a.test.ts': "it('runs', () => { expect(1).toBe(1); });" };
    expect(detectSkippedTests(['a.test.ts'], withFiles(files))).toEqual([]);
  });

  it('skips unreadable/deleted files without throwing', () => {
    const read = () => {
      throw new Error('ENOENT');
    };
    expect(detectSkippedTests(['gone.test.ts'], read)).toEqual([]);
  });
});
