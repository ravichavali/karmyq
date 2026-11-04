/**
 * Sprint 136 (BUG-087): the CI test stack (tests/docker-compose.test.yml) runs no wall-clock cron, so no scheduled job
 * fires in the middle of an integration run and races a test's rows.
 *
 * For every compose service built from services/<name>/Dockerfile whose src/ calls `cron.schedule(`:
 * - the compose service sets SCHEDULED_JOBS_DISABLED: "true";
 * - every such file imports scheduledJobsDisabled;
 * - every `cron.schedule(` sits in a function that first returns on `if (scheduledJobsDisabled())`.
 * The unit test services/reputation-service/tests/.../sprint-136-scheduled-jobs-flag proves the return really schedules
 * nothing, and that only the exact string "true" disables (a production cron never turns off by accident).
 *
 * The check is a pure function over { compose, files }, so the negative fixtures below exercise the same code the live
 * assertion does. The fixtures are built by mutating the live compose and source, so they cannot drift from reality.
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'fs';
import { join } from 'path';
import { parse as parseYaml } from 'yaml';
import { ROOT, read } from './helpers/workspaces';

export interface SourceFile {
  path: string;
  source: string;
}
type ComposeService = { build?: { dockerfile?: string }; environment?: Record<string, unknown> | string[] };
export type Compose = { services?: Record<string, ComposeService> };

const SERVICE_DOCKERFILE = /^(?:\.\/)?services\/([^/]+)\/Dockerfile$/;
const CRON_CALL = 'cron.schedule(';
const IMPORTS_FLAG = /import\s*\{[^}]*\bscheduledJobsDisabled\b[^}]*\}\s*from\s*['"][^'"]*scheduledJobs['"]/;
const EARLY_RETURN = /if\s*\(\s*scheduledJobsDisabled\(\)\s*\)\s*\{[^}]*\breturn\b[^}]*\}/;
const FUNCTION_START = /\bfunction\s+\w+\s*\(/g;

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

/** The source text from the start of the function enclosing `index` up to `index`. */
function enclosingFunctionPrefix(source: string, index: number): string {
  let start = 0;
  for (const m of source.matchAll(FUNCTION_START)) {
    if (m.index! >= index) break;
    start = m.index!;
  }
  return source.slice(start, index);
}

/** Every compose service whose own source schedules a cron, with the files that do. */
export function cronServices(compose: Compose, filesFor: (service: string) => SourceFile[]) {
  const found: { composeKey: string; service: string; files: SourceFile[] }[] = [];
  for (const [composeKey, svc] of Object.entries(compose.services ?? {})) {
    const m = SERVICE_DOCKERFILE.exec(svc.build?.dockerfile ?? '');
    if (!m) continue;
    const files = filesFor(m[1]).filter((f) => f.source.includes(CRON_CALL));
    if (files.length) found.push({ composeKey, service: m[1], files });
  }
  return found;
}

/** The violations; an empty list means the test stack runs no wall-clock cron. */
export function evaluateTestStackCrons(compose: Compose, filesFor: (service: string) => SourceFile[]): string[] {
  const violations: string[] = [];
  for (const { composeKey, files } of cronServices(compose, filesFor)) {
    const svc = compose.services![composeKey];
    if (environmentOf(svc).SCHEDULED_JOBS_DISABLED !== 'true') {
      violations.push(`${composeKey}: its source schedules crons, so it must set SCHEDULED_JOBS_DISABLED: "true"`);
    }
    for (const file of files) {
      if (!IMPORTS_FLAG.test(file.source)) violations.push(`${file.path}: does not import scheduledJobsDisabled`);
      for (let at = file.source.indexOf(CRON_CALL); at >= 0; at = file.source.indexOf(CRON_CALL, at + 1)) {
        if (!EARLY_RETURN.test(enclosingFunctionPrefix(file.source, at))) {
          const line = file.source.slice(0, at).split('\n').length;
          violations.push(`${file.path}:${line}: cron.schedule( is not preceded in its function by if (scheduledJobsDisabled()) { ... return; }`);
        }
      }
    }
  }
  return violations;
}

function tsFilesUnder(dir: string, rel: string): SourceFile[] {
  if (!existsSync(dir)) return [];
  const out: SourceFile[] = [];
  for (const name of readdirSync(dir)) {
    const abs = join(dir, name);
    const relPath = `${rel}/${name}`;
    if (statSync(abs).isDirectory()) out.push(...tsFilesUnder(abs, relPath));
    else if (name.endsWith('.ts')) out.push({ path: relPath, source: readFileSync(abs, 'utf8') });
  }
  return out;
}

const liveFiles = (service: string) => tsFilesUnder(join(ROOT, 'services', service, 'src'), `services/${service}/src`);
const liveCompose = (): Compose => parseYaml(read('tests/docker-compose.test.yml'));

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
      expect(violations[0]).toMatch(/^services\/reputation-service\/src\/cron\/trustScoreRefresh\.ts:\d+: cron\.schedule\( is not preceded/);
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
      expect(violations[0]).toMatch(/trustScoreRefresh\.ts:\d+: cron\.schedule\( is not preceded/);
    });

    it('does not require the flag of a stack service with no cron', () => {
      const compose = liveCompose();
      expect(environmentOf(compose.services!['auth-service-test']).SCHEDULED_JOBS_DISABLED).toBeUndefined();
      expect(cronServices(compose, liveFiles).map((f) => f.composeKey)).not.toContain('auth-service-test');
    });
  });
});
