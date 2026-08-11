import { execFileSync } from 'child_process';
import { existsSync, readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

/**
 * Workspace enumeration shared by the repo-wide gates in tests/regression/.
 *
 * Extracted in Sprint 122 PR 4: the tier-parity gate (PR 2) and the jest
 * toolchain gate had byte-identical copies of this scan. Two gates disagreeing
 * about what "every workspace" means is exactly how one of them goes quietly
 * vacuous, so there is one definition.
 *
 * Not a `*.test.ts` file, so jest's `testMatch` never collects it as a suite.
 */
export const ROOT = join(__dirname, '..', '..', '..');

export type Workspace = { ws: string; dir: string };

/** Every npm workspace: services/*, apps/*, packages/* with a package.json, plus `tests`. */
export function allWorkspaces(): Workspace[] {
  const out: Workspace[] = [];
  for (const root of ['services', 'apps', 'packages']) {
    const rootDir = join(ROOT, root);
    if (!existsSync(rootDir)) continue;
    for (const name of readdirSync(rootDir)) {
      if (name === 'node_modules') continue;
      const dir = join(rootDir, name);
      if (!statSync(dir).isDirectory()) continue;
      if (existsSync(join(dir, 'package.json'))) out.push({ ws: `${root}/${name}`, dir });
    }
  }
  out.push({ ws: 'tests', dir: join(ROOT, 'tests') });
  return out;
}

/** Read a repo-relative path. */
export const read = (rel: string): string => readFileSync(join(ROOT, rel), 'utf8');

/**
 * Tracked paths matching git pathspecs — the live arbiter, never a directory glob.
 *
 * `execFileSync`, not `execSync`: on Windows `execSync` routes through `cmd.exe`, which does not
 * strip single quotes, so a quoted glob reaches git as a literal and matches nothing. A silently
 * empty list is how a discovery-based gate goes vacuously green.
 */
export function tracked(...pathspecs: string[]): string[] {
  return execFileSync('git', ['ls-files', ...pathspecs], { cwd: ROOT, encoding: 'utf8' })
    .split(/\r?\n/)
    .filter((p) => p && !p.includes('node_modules'));
}

/**
 * Every service directory, from `services/registry.json` — the documented single source of truth.
 * A hand-written list here is the false-green shape CLAUDE.md Discipline 5 forbids: a service
 * added later would simply not be checked, and no assertion would notice.
 */
export function allServicePaths(): string[] {
  const registry = JSON.parse(read('services/registry.json'));
  return Object.values(registry.services as Record<string, { path: string }>).map((s) => s.path);
}
