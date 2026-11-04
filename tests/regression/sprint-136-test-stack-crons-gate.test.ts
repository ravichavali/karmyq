/**
 * Sprint 136 (BUG-087): the CI test stack (tests/docker-compose.test.yml) runs no wall-clock cron, so no scheduled job
 * fires in the middle of an integration run and races a test's rows.
 *
 * For every compose service built from services/<name>/Dockerfile whose src/ imports a node-cron VALUE (a type-only
 * import does not count):
 * - the compose service sets SCHEDULED_JOBS_DISABLED: "true";
 * - every such file imports scheduledJobsDisabled from ./scheduledJobs, and declares nothing else by that name;
 * - every use of a node-cron binding (`cron.schedule`, `cron.createTask`, `cron.default.schedule`, a destructure, an
 *   alias, a named `schedule` / `nodeCron` import...) sits inside a function, arrow function or method whose FIRST
 *   statement is `if (scheduledJobsDisabled()) { ... return; }`, and outside that guard. Any enclosing function counts,
 *   so a callback inside a guarded init is fine; a function defined after it is not;
 * - node-cron reached through require() or import() is a violation: the gate cannot follow that binding.
 * All of it is read from the TypeScript AST, not from text, so comments and strings never count.
 * The unit test services/reputation-service/tests/regression/sprint-136-scheduled-jobs-flag proves the return really
 * schedules nothing, and that only the exact string "true" disables (a production cron never turns off by accident).
 *
 * The check is a pure function over { compose, files }, so the negative fixtures below exercise the same code the live
 * assertion does. Most fixtures mutate the live compose and source, so they cannot drift from reality.
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
const NODE_CRON = 'node-cron';
const FLAG = 'scheduledJobsDisabled';
/** The guard's text, used only by the fixtures that edit it in live source. */
const EARLY_RETURN = /if\s*\(\s*scheduledJobsDisabled\(\)\s*\)\s*\{[^}]*\breturn\b[^}]*\}/;
const IMPORTS_FLAG_TEXT = /import\s*\{[^}]*\bscheduledJobsDisabled\b[^}]*\}\s*from\s*['"][^'"]*scheduledJobs['"];?/;
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

/** The guard statement when the function's first statement is `if (scheduledJobsDisabled()) { ... return ... }`. */
function guardOf(fn: ts.SignatureDeclaration): ts.IfStatement | null {
  const body = (fn as ts.FunctionLikeDeclaration).body;
  if (!body || !ts.isBlock(body)) return null;
  const first = body.statements[0];
  if (!first || !ts.isIfStatement(first)) return null;
  const cond = first.expression;
  const checksFlag = ts.isCallExpression(cond) && ts.isIdentifier(cond.expression)
    && cond.expression.text === FLAG && cond.arguments.length === 0;
  const then = first.thenStatement;
  const returns = ts.isReturnStatement(then) || (ts.isBlock(then) && then.statements.some(ts.isReturnStatement));
  return checksFlag && returns ? first : null;
}

const within = (node: ts.Node, ancestor: ts.Node) => {
  for (let p: ts.Node | undefined = node; p; p = p.parent) if (p === ancestor) return true;
  return false;
};

/** An identifier that reads its binding's value: not a declaration, a property name, or anything in a type position. */
function isValueUse(id: ts.Identifier): boolean {
  const parent = id.parent;
  if (ts.isPropertyAccessExpression(parent) && parent.name === id) return false;
  if ((ts.isPropertyAssignment(parent) || ts.isPropertyDeclaration(parent) || ts.isMethodDeclaration(parent)
    || ts.isPropertySignature(parent)) && parent.name === id) return false;
  for (let p: ts.Node | undefined = parent; p; p = p.parent) {
    if (ts.isImportDeclaration(p) || ts.isTypeNode(p)) return false;
    if (ts.isStatement(p)) break;
  }
  return true;
}

/** What the gate reads from one file: whether it uses node-cron as a value at all, and its violations. */
function analyse(file: SourceFile): { usesNodeCron: boolean; violations: string[] } {
  if (!file.source.includes(NODE_CRON)) return { usesNodeCron: false, violations: [] };
  const sf = ts.createSourceFile(file.path, file.source, ts.ScriptTarget.Latest, true);
  const line = (n: ts.Node) => sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1;
  const bindings = new Set<string>();
  let flagImported = false;
  for (const st of sf.statements) {
    if (!ts.isImportDeclaration(st) || !ts.isStringLiteral(st.moduleSpecifier)) continue;
    const clause = st.importClause;
    // `import type` (ImportClause.isTypeOnly is deprecated in TS 5.9, so read the keyword).
    if (!clause || /^import\s+type\b/.test(st.getText(sf))) continue;
    const named = clause.namedBindings && ts.isNamedImports(clause.namedBindings) ? clause.namedBindings.elements : [];
    if (st.moduleSpecifier.text === NODE_CRON) {
      if (clause.name) bindings.add(clause.name.text);
      if (clause.namedBindings && ts.isNamespaceImport(clause.namedBindings)) bindings.add(clause.namedBindings.name.text);
      for (const el of named) if (!el.isTypeOnly) bindings.add(el.name.text);
    }
    if (/(^|\/)scheduledJobs$/.test(st.moduleSpecifier.text)
      && named.some((el) => !el.isTypeOnly && !el.propertyName && el.name.text === FLAG)) flagImported = true;
  }

  const violations: string[] = [];
  const uses: ts.Identifier[] = [];
  let unreadable = false;
  const visit = (n: ts.Node) => {
    if (ts.isCallExpression(n) && n.arguments[0] && ts.isStringLiteral(n.arguments[0]) && n.arguments[0].text === NODE_CRON
      && (n.expression.kind === ts.SyntaxKind.ImportKeyword || (ts.isIdentifier(n.expression) && n.expression.text === 'require'))) {
      unreadable = true;
      const how = n.expression.kind === ts.SyntaxKind.ImportKeyword ? 'import()' : 'require()';
      violations.push(`${file.path}:${line(n)}: reaches node-cron through ${how}; use an import declaration the gate can read`);
    }
    if ((ts.isVariableDeclaration(n) || ts.isFunctionDeclaration(n) || ts.isParameter(n))
      && n.name && ts.isIdentifier(n.name) && n.name.text === FLAG) {
      violations.push(`${file.path}:${line(n)}: declares its own ${FLAG}, which shadows the shared flag`);
    }
    if (ts.isIdentifier(n) && bindings.has(n.text) && isValueUse(n)) uses.push(n);
    ts.forEachChild(n, visit);
  };
  visit(sf);

  const usesNodeCron = bindings.size > 0 || unreadable;
  if (!usesNodeCron) return { usesNodeCron, violations };
  if (!flagImported) violations.unshift(`${file.path}: does not import ${FLAG}`);
  for (const use of uses) {
    let guarded = false;
    for (let p: ts.Node | undefined = use.parent; p && !guarded; p = p.parent) {
      if (!ts.isFunctionLike(p)) continue;
      const guard = guardOf(p);
      guarded = guard !== null && !within(use, guard);
    }
    if (!guarded) {
      violations.push(`${file.path}:${line(use)}: ${use.text} (node-cron) is used outside a function whose first statement is ${GUARD}`);
    }
  }
  return { usesNodeCron, violations };
}

/** Every compose service whose own source uses node-cron, with the files that do. */
function cronServices(compose: Compose, filesFor: (service: string) => SourceFile[]) {
  const found: { composeKey: string; svc: ComposeService; files: SourceFile[] }[] = [];
  for (const [composeKey, svc] of Object.entries(compose.services ?? {})) {
    const m = SERVICE_DOCKERFILE.exec(svc.build?.dockerfile ?? '');
    if (!m) continue;
    const files = filesFor(m[1]).filter((f) => analyse(f).usesNodeCron);
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
    for (const file of files) violations.push(...analyse(file).violations);
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

const TRUST = 'services/reputation-service/src/cron/trustScoreRefresh.ts';
const HEALTH = 'services/reputation-service/src/cron/healthMetricsCalculator.ts';
const UNGUARDED = new RegExp(`is used outside a function whose first statement is ${GUARD.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`);

describe('Sprint 136 gate: the CI test stack runs no wall-clock cron (BUG-087)', () => {
  it('the live compose and source pass', () => {
    expect(evaluateTestStackCrons(liveCompose(), liveFiles)).toEqual([]);
  });

  it('finds exactly one stack service with crons, reputation-service, in exactly two files', () => {
    const found = cronServices(liveCompose(), liveFiles);
    expect(found.map((f) => f.composeKey)).toEqual(['reputation-service-test']);
    expect(found[0].files.map((f) => f.path).sort()).toEqual([HEALTH, TRUST]);
  });

  describe('negative fixtures', () => {
    const withFlag = (value: string | undefined): Compose => {
      const compose = liveCompose();
      const env = compose.services!['reputation-service-test'].environment as Record<string, unknown>;
      if (value === undefined) delete env.SCHEDULED_JOBS_DISABLED;
      else env.SCHEDULED_JOBS_DISABLED = value;
      return compose;
    };
    /** The live files with one file's source rewritten. */
    const editing = (path: string, edit: (source: string) => string) => (service: string) =>
      liveFiles(service).map((f) => (f.path === path ? { ...f, source: edit(f.source) } : f));
    /** The live files plus one synthetic reputation-service file. */
    const withFile = (path: string, source: string) => (service: string) =>
      service === 'reputation-service' ? [...liveFiles(service), { path, source }] : liveFiles(service);
    const EXTRA = 'services/reputation-service/src/cron/extra.ts';
    const GUARDED_IMPORT = "import { scheduledJobsDisabled } from './scheduledJobs';\n";

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
      const violations = evaluateTestStackCrons(liveCompose(), editing(TRUST, (s) => s.replace(EARLY_RETURN, '')));
      expect(violations).toHaveLength(1);
      expect(violations[0]).toMatch(new RegExp(`^${TRUST}:\\d+: cron \\(node-cron\\) ${UNGUARDED.source}`));
    });

    it('fails on a cron file that does not import the flag (a commented-out import does not count)', () => {
      const violations = evaluateTestStackCrons(liveCompose(),
        editing(HEALTH, (s) => s.replace(IMPORTS_FLAG_TEXT, "// import { scheduledJobsDisabled } from './scheduledJobs';")));
      expect(violations).toEqual([`${HEALTH}: does not import scheduledJobsDisabled`]);
    });

    it('fails on a second named function in a guarded file that schedules without the check', () => {
      const violations = evaluateTestStackCrons(liveCompose(), editing(TRUST,
        (s) => `${s}\nexport function initSomethingElse(): void {\n  cron.schedule('0 4 * * *', () => undefined);\n}\n`));
      expect(violations).toHaveLength(1);
      expect(violations[0]).toMatch(UNGUARDED);
    });

    // /code-review: a text scan for `function name(` let a cron in an arrow function or a method borrow the guard of the
    // named function before it; only `schedule` was recognised; type-only imports and comments counted as cron use.
    it.each([
      ['an arrow function', "export const initArrow = (): void => {\n  cron.schedule('0 5 * * *', () => undefined);\n};\n"],
      ['a class method', "export class Jobs {\n  start(): void {\n    cron.schedule('0 6 * * *', () => undefined);\n  }\n}\n"],
      ['createTask', "export function initTask(): void {\n  cron.createTask('0 7 * * *', () => undefined).start();\n}\n"],
      ['cron.default.schedule', "export const later = () => cron.default.schedule('0 8 * * *', () => undefined);\n"],
      ['a top-level destructure', "const { schedule } = cron;\nexport function initD(): void {\n  schedule('0 9 * * *', () => undefined);\n}\n"],
      ['a top-level alias', "const c = cron;\nexport function initC(): void {\n  c.schedule('0 10 * * *', () => undefined);\n}\n"],
      ['a call inside the guard itself', "export function initG(): void {\n  if (scheduledJobsDisabled()) {\n    cron.schedule('0 11 * * *', () => undefined);\n    return;\n  }\n}\n"],
    ])('fails on an unguarded use of node-cron in %s after a guarded function', (_label, extra) => {
      const violations = evaluateTestStackCrons(liveCompose(), editing(TRUST, (s) => `${s}\n${extra}`));
      expect(violations).toHaveLength(1);
      expect(violations[0]).toMatch(new RegExp(`^${TRUST}:\\d+: cron \\(node-cron\\) ${UNGUARDED.source}`));
    });

    it.each([
      ['a named schedule import, aliased', "import { schedule as every } from 'node-cron';\n", 'every'],
      ['the named nodeCron export', "import { nodeCron } from 'node-cron';\n", 'nodeCron'],
      ['a named default import', "import { default as nc } from 'node-cron';\n", 'nc'],
    ])('fails on %s used without the guard', (_label, importLine, name) => {
      const source = `${GUARDED_IMPORT}${importLine}export const start = (): void => {\n  ${name}${name === 'every' ? '' : '.schedule'}('0 7 * * *', () => undefined);\n};\n`;
      expect(evaluateTestStackCrons(liveCompose(), withFile(EXTRA, source))).toEqual([
        `${EXTRA}:4: ${name} (node-cron) is used outside a function whose first statement is ${GUARD}`,
      ]);
    });

    it('fails on node-cron reached by require, even beside an import declaration', () => {
      const source = `${GUARDED_IMPORT}import cron from 'node-cron';\nconst legacy = require('node-cron');\n` +
        "export function initLegacy(): void {\n  if (scheduledJobsDisabled()) return;\n  cron.schedule('0 8 * * *', () => undefined);\n  legacy.schedule('0 9 * * *', () => undefined);\n}\n";
      expect(evaluateTestStackCrons(liveCompose(), withFile(EXTRA, source))).toEqual([
        `${EXTRA}:3: reaches node-cron through require(); use an import declaration the gate can read`,
      ]);
    });

    it('fails on a file that declares its own scheduledJobsDisabled', () => {
      const violations = evaluateTestStackCrons(liveCompose(),
        editing(TRUST, (s) => `${s}\nconst scheduledJobsDisabled = (): boolean => false;\n`));
      expect(violations).toEqual([expect.stringMatching(new RegExp(`^${TRUST}:\\d+: declares its own scheduledJobsDisabled`))]);
    });

    it('does not require the flag of a stack service with no cron', () => {
      const compose = liveCompose();
      expect(environmentOf(compose.services!['auth-service-test']).SCHEDULED_JOBS_DISABLED).toBeUndefined();
      expect(cronServices(compose, liveFiles).map((f) => f.composeKey)).not.toContain('auth-service-test');
    });
  });

  describe('what is not cron use (no false red)', () => {
    const only = (source: string) => evaluateTestStackCrons(liveCompose(),
      (service: string) => (service === 'reputation-service'
        ? [...liveFiles(service), { path: 'services/reputation-service/src/cron/types.ts', source }]
        : liveFiles(service)));

    it('a type-only import and a comment that names node-cron', () => {
      expect(only("import type { ScheduledTask } from 'node-cron';\n// see 'node-cron' docs\nexport let task: ScheduledTask | null = null;\n"))
        .toEqual([]);
    });

    it('a schedule call inside a callback of a guarded init', () => {
      expect(only("import cron from 'node-cron';\nimport { scheduledJobsDisabled } from './scheduledJobs';\n" +
        "const JOBS = [{ spec: '0 1 * * *', run: () => undefined }];\nexport function initAll(): void {\n" +
        '  if (scheduledJobsDisabled()) return;\n  JOBS.forEach((j) => cron.schedule(j.spec, j.run));\n}\n')).toEqual([]);
    });
  });
});
