import { existsSync, readdirSync, statSync } from 'fs';
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
