import * as path from 'path';
import * as ts from 'typescript';

const APP = path.resolve(__dirname, '../..');
const rel = (f: string) => path.relative(APP, f).split(path.sep).join('/');

// The program `next build` hands to `tsc --project` since next 16.3 (useTypeScriptCli default).
// `exclude` filters only the ROOT names, so a test file that source imports still enters the
// program and is type-checked. Hence the whole program, not parsed.fileNames.
function loadProgram() {
  const cfgPath = path.join(APP, 'tsconfig.json');
  const read = ts.readConfigFile(cfgPath, ts.sys.readFile);
  const parsed = read.error ? undefined : ts.parseJsonConfigFileContent(read.config, ts.sys, APP);
  const configErrors = [read.error, ...(parsed?.errors ?? [])]
    .filter((d): d is ts.Diagnostic => Boolean(d))
    .map((d) => ts.flattenDiagnosticMessageText(d.messageText, '\n'));
  const program = parsed ? ts.createProgram(parsed.fileNames, parsed.options) : undefined;
  const files = (program?.getSourceFiles() ?? [])
    .map((s) => s.fileName)
    .filter((f) => !/\/node_modules\//.test(f))
    .map(rel)
    .filter((f) => !f.startsWith('..'));
  return { configErrors, files };
}
// next 15's API checker dropped these (runTypeCheck.js ignoreRegex); the CLI does not.
const TEST_FILE = /(^|\/)__(tests|mocks)__\/|(^|[/.])(spec|test)\.[^/]+$/;

describe('next build type-check scope (Sprint 131 D7)', () => {
  let configErrors: string[] = [];
  let files: string[] = [];
  // Built once per file, only when a test runs; ~3 s alone, ~20 s under a parallel Turbo run.
  beforeAll(() => {
    ({ configErrors, files } = loadProgram());
  }, 60_000);
  it('tsconfig has no configuration errors', () => {
    expect(configErrors).toEqual([]);
  });
  it('the program is non-empty', () => {
    expect(files.length).toBeGreaterThan(10);
  });
  it('the program contains no test file (roots or imports)', () => {
    expect(files.filter((f) => TEST_FILE.test(f))).toEqual([]);
  });
  it('the program contains nothing under tests/', () => {
    expect(files.filter((f) => f.startsWith('tests/'))).toEqual([]);
  });
});
