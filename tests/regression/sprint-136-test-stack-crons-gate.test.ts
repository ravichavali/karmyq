/**
 * Sprint 136 (BUG-087): the CI test stack (tests/docker-compose.test.yml) runs no wall-clock cron, so no scheduled job
 * fires in the middle of an integration run and races a test's rows.
 *
 * For every compose service built from services/<name>/Dockerfile whose src/ uses node-cron:
 * - the compose service sets SCHEDULED_JOBS_DISABLED: "true";
 * - every such file imports scheduledJobsDisabled, and imports node-cron with an import declaration;
 * - every call to node-cron's `schedule` (`cron.schedule(`, a namespace import, or a named `schedule` import, aliased or
 *   not) sits in a function, arrow function or method whose FIRST statement is `if (scheduledJobsDisabled()) { return }`.
 *   This is read from the TypeScript AST, not from text, so a cron cannot borrow the guard of the function before it.
 * The unit test services/reputation-service/tests/.../sprint-136-scheduled-jobs-flag proves the return really schedules
 * nothing, and that only the exact string "true" disables (a production cron never turns off by accident).
 *
 * The check is a pure function over { compose, files }, so the negative fixtures below exercise the same code the live
 * assertion does. The fixtures are built by mutating the live compose and source, so they cannot drift from reality.
 */
import ts from 'typescript';
import { parse as parseYaml } from 'yaml';
import { read, tracked } from './helpers/workspaces';

interface SourceFile {
  path: string;
  source: string;
}
type ComposeService = { build?: { dockerfile?: string }; environment?: Record<string, unknown> | string[] };
type Compose = { services?: Record<string, ComposeService> };

const SERVICE_DOCKERFILE = /^(?:\.\/)?services\/([^/]+)\/Dockerfile$/;
/** A file uses node-cron when the module name appears as a string literal (an import or a require). */
const USES_NODE_CRON = /['"]node-cron['"]/;
const IMPORTS_FLAG = /import\s*\{[^}]*\bscheduledJobsDisabled\b[^}]*\}\s*from\s*['"][^'"]*scheduledJobs['"]/;
/** The guard's text, used only by the fixture that deletes it from live source. */
const EARLY_RETURN = /if\s*\(\s*scheduledJobsDisabled\(\)\s*\)\s*\{[^}]*\breturn\b[^}]*\}/;
const GUARD = 'if (scheduledJobsDisabled()) { ... return; }';

function environmentOf(svc: ComposeService): Record<string, string> {
  const env = svc.environment;
  if (!env) return {};
  if (Array.isArray(env)) {
    return Object.fromEntries(env.map((entry) => {
      const at = entry.indexOf('=');
      return at < 0 ? [entry, ''] : [entry.slice(0, at), entry.slice(at + 1)];
    }));
  }
  return Object.fromEntries(Object.entries(env).map(([k, v]) => [k, String(v)]));
}

/** True when the function's first statement is `if (scheduledJobsDisabled()) { ... return ... }` (or a bare return). */
function returnsFirstWhenDisabled(fn: ts.SignatureDeclaration): boolean {
  const body = (fn as ts.FunctionLikeDeclaration).body;
  if (!body || !ts.isBlock(body)) return false;
  const first = body.statements[0];
  if (!first || !ts.isIfStatement(first)) return false;
  const cond = first.expression;
  const checksFlag = ts.isCallExpression(cond) && ts.isIdentifier(cond.expression)
    && cond.expression.text === 'scheduledJobsDisabled' && cond.arguments.length === 0;
  const then = first.thenStatement;
  const returns = ts.isReturnStatement(then) || (ts.isBlock(then) && then.statements.some(ts.isReturnStatement));
  return checksFlag && returns;
}

/** Every call to node-cron's schedule that is not the work of a guarded function, plus unreadable node-cron use. */
function unguardedSchedules(file: SourceFile): string[] {
  const sf = ts.createSourceFile(file.path, file.source, ts.ScriptTarget.Latest, true);
  const namespaces = new Set<string>(); // `import cron from` / `import * as cron from` → cron.schedule(
  const direct = new Set<string>(); // `import { schedule }` / `import { schedule as every }` → schedule( / every(
  let declared = false;
  for (const st of sf.statements) {
    if (!ts.isImportDeclaration(st) || !ts.isStringLiteral(st.moduleSpecifier) || st.moduleSpecifier.text !== 'node-cron') continue;
    declared = true;
    const clause = st.importClause;
    if (clause?.name) namespaces.add(clause.name.text);
    const bindings = clause?.namedBindings;
    if (bindings && ts.isNamespaceImport(bindings)) namespaces.add(bindings.name.text);
    if (bindings && ts.isNamedImports(bindings)) {
      for (const el of bindings.elements) if ((el.propertyName ?? el.name).text === 'schedule') direct.add(el.name.text);
    }
  }
  if (!declared) return [`${file.path}: uses node-cron without an import declaration the gate can read`];

  const out: string[] = [];
  const isSchedule = (call: ts.CallExpression) => {
    const callee = call.expression;
    if (ts.isPropertyAccessExpression(callee)) {
      return callee.name.text === 'schedule' && ts.isIdentifier(callee.expression) && namespaces.has(callee.expression.text);
    }
    return ts.isIdentifier(callee) && direct.has(callee.text);
  };
  const visit = (node: ts.Node) => {
    if (ts.isCallExpression(node) && isSchedule(node)) {
      let fn: ts.Node | undefined = node.parent;
      while (fn && !ts.isFunctionLike(fn)) fn = fn.parent;
      if (!fn || !returnsFirstWhenDisabled(fn)) {
        const line = sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1;
        out.push(`${file.path}:${line}: ${node.expression.getText(sf)}( is not in a function whose first statement is ${GUARD}`);
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return out;
}

/** Every compose service whose own source uses node-cron, with the files that do. */
function cronServices(compose: Compose, filesFor: (service: string) => SourceFile[]) {
  const found: { composeKey: string; svc: ComposeService; files: SourceFile[] }[] = [];
  for (const [composeKey, svc] of Object.entries(compose.services ?? {})) {
    const m = SERVICE_DOCKERFILE.exec(svc.build?.dockerfile ?? '');
    if (!m) continue;
    const files = filesFor(m[1]).filter((f) => USES_NODE_CRON.test(f.source));
    if (files.length) found.push({ composeKey, svc, files });
  }
  return found;
}

/** The violations; an empty list means the test stack runs no wall-clock cron. */
function evaluateTestStackCrons(compose: Compose, filesFor: (service: string) => SourceFile[]): string[] {
  const violations: string[] = [];
  for (const { composeKey, svc, files } of cronServices(compose, filesFor)) {
    if (environmentOf(svc).SCHEDULED_JOBS_DISABLED !== 'true') {
      violations.push(`${composeKey}: its source schedules crons, so it must set SCHEDULED_JOBS_DISABLED: "true"`);
    }
    for (const file of files) {
      if (!IMPORTS_FLAG.test(file.source)) violations.push(`${file.path}: does not import scheduledJobsDisabled`);
      violations.push(...unguardedSchedules(file));
    }
  }
  return violations;
}

// The tracked source (git is the arbiter, as for the other root gates), read once per service; the compose file is
// parsed once and each caller gets its own copy, so a fixture's mutation never leaks into another case.
const sourceCache = new Map<string, SourceFile[]>();
const liveFiles = (service: string): SourceFile[] => {
  if (!sourceCache.has(service)) {
    sourceCache.set(service, tracked(`:(glob)services/${service}/src/**/*.ts`).map((path) => ({ path, source: read(path) })));
  }
  return sourceCache.get(service)!;
};
const COMPOSE: Compose = parseYaml(read('tests/docker-compose.test.yml'));
const liveCompose = (): Compose => structuredClone(COMPOSE);

describe('Sprint 136 gate: the CI test stack runs no wall-clock cron (BUG-087)', () => {
  it('the live compose and source pass', () => {
    expect(evaluateTestStackCrons(liveCompose(), liveFiles)).toEqual([]);
  });

  it('finds exactly one stack service with crons, reputation-service, in exactly two files', () => {
    const found = cronServices(liveCompose(), liveFiles);
    expect(found.map((f) => f.composeKey)).toEqual(['reputation-service-test']);
    expect(found[0].files.map((f) => f.path).sort()).toEqual([
      'services/reputation-service/src/cron/healthMetricsCalculator.ts',
      'services/reputation-service/src/cron/trustScoreRefresh.ts',
    ]);
  });

  describe('negative fixtures (mutations of the live compose and source)', () => {
    const withFlag = (value: string | undefined): Compose => {
      const compose = liveCompose();
      const env = compose.services!['reputation-service-test'].environment as Record<string, unknown>;
      if (value === undefined) delete env.SCHEDULED_JOBS_DISABLED;
      else env.SCHEDULED_JOBS_DISABLED = value;
      return compose;
    };

    it('fails when the compose service drops the flag', () => {
      expect(evaluateTestStackCrons(withFlag(undefined), liveFiles)).toEqual([
        'reputation-service-test: its source schedules crons, so it must set SCHEDULED_JOBS_DISABLED: "true"',
      ]);
    });

    it('fails when the flag is "false"', () => {
      expect(evaluateTestStackCrons(withFlag('false'), liveFiles)).toEqual([
        'reputation-service-test: its source schedules crons, so it must set SCHEDULED_JOBS_DISABLED: "true"',
      ]);
    });

    it('accepts the list form of environment', () => {
      const compose = liveCompose();
      const env = compose.services!['reputation-service-test'].environment as Record<string, unknown>;
      compose.services!['reputation-service-test'].environment = Object.entries(env).map(([k, v]) => `${k}=${v}`);
      expect(evaluateTestStackCrons(compose, liveFiles)).toEqual([]);
    });

    it('fails on a cron file that never checks the flag', () => {
      const unguarded = (service: string) => liveFiles(service).map((f) =>
        f.path.endsWith('trustScoreRefresh.ts') ? { ...f, source: f.source.replace(EARLY_RETURN, '') } : f);
      const violations = evaluateTestStackCrons(liveCompose(), unguarded);
      expect(violations).toHaveLength(1);
      expect(violations[0]).toMatch(/^services\/reputation-service\/src\/cron\/trustScoreRefresh\.ts:\d+: cron\.schedule\( is not in a function/);
    });

    it('fails on a cron file that does not import the flag', () => {
      const noImport = (service: string) => liveFiles(service).map((f) =>
        f.path.endsWith('healthMetricsCalculator.ts') ? { ...f, source: f.source.replace(IMPORTS_FLAG, '') } : f);
      expect(evaluateTestStackCrons(liveCompose(), noImport)).toEqual([
        'services/reputation-service/src/cron/healthMetricsCalculator.ts: does not import scheduledJobsDisabled',
      ]);
    });

    it('fails on a second function in a guarded file that schedules without the check', () => {
      const extra = (service: string) => liveFiles(service).map((f) => f.path.endsWith('trustScoreRefresh.ts')
        ? { ...f, source: `${f.source}\nexport function initSomethingElse(): void {\n  cron.schedule('0 4 * * *', () => undefined);\n}\n` }
        : f);
      const violations = evaluateTestStackCrons(liveCompose(), extra);
      expect(violations).toHaveLength(1);
      expect(violations[0]).toMatch(/trustScoreRefresh\.ts:\d+: cron\.schedule\( is not in a function/);
    });

    // /code-review: a text scan for `function name(` let a cron in an arrow function or a method borrow the guard of the
    // named function before it, and a named `schedule` import was not seen at all.
    const appended = (extraSource: string) => (service: string) => liveFiles(service).map((f) =>
      f.path.endsWith('trustScoreRefresh.ts') ? { ...f, source: `${f.source}\n${extraSource}` } : f);
    const withFile = (path: string, source: string) => (service: string) =>
      service === 'reputation-service' ? [...liveFiles(service), { path, source }] : liveFiles(service);

    it('fails on an unguarded cron in an arrow function after a guarded function', () => {
      const violations = evaluateTestStackCrons(liveCompose(),
        appended("export const initArrow = (): void => {\n  cron.schedule('0 5 * * *', () => undefined);\n};\n"));
      expect(violations).toHaveLength(1);
      expect(violations[0]).toMatch(/trustScoreRefresh\.ts:\d+: cron\.schedule\( is not in a function/);
    });

    it('fails on an unguarded cron in a class method after a guarded function', () => {
      const violations = evaluateTestStackCrons(liveCompose(),
        appended("export class Jobs {\n  start(): void {\n    cron.schedule('0 6 * * *', () => undefined);\n  }\n}\n"));
      expect(violations).toHaveLength(1);
      expect(violations[0]).toMatch(/trustScoreRefresh\.ts:\d+: cron\.schedule\( is not in a function/);
    });

    it('fails on a named schedule import (import { schedule } from node-cron)', () => {
      const path = 'services/reputation-service/src/cron/extra.ts';
      const violations = evaluateTestStackCrons(liveCompose(), withFile(path,
        "import { schedule as every } from 'node-cron';\nexport function initExtra(): void {\n  every('0 7 * * *', () => undefined);\n}\n"));
      expect(violations).toEqual([
        `${path}: does not import scheduledJobsDisabled`,
        `${path}:3: every( is not in a function whose first statement is if (scheduledJobsDisabled()) { ... return; }`,
      ]);
    });

    it('fails on node-cron reached by require, which the gate cannot read', () => {
      const path = 'services/reputation-service/src/cron/legacy.ts';
      const violations = evaluateTestStackCrons(liveCompose(), withFile(path,
        "const cron = require('node-cron');\nexport function initLegacy(): void {\n  cron.schedule('0 8 * * *', () => undefined);\n}\n"));
      expect(violations).toEqual([
        `${path}: does not import scheduledJobsDisabled`,
        `${path}: uses node-cron without an import declaration the gate can read`,
      ]);
    });

    it('does not require the flag of a stack service with no cron', () => {
      const compose = liveCompose();
      expect(environmentOf(compose.services!['auth-service-test']).SCHEDULED_JOBS_DISABLED).toBeUndefined();
      expect(cronServices(compose, liveFiles).map((f) => f.composeKey)).not.toContain('auth-service-test');
    });
  });
});
