import { execFileSync } from 'child_process';
import { existsSync } from 'fs';
import { join } from 'path';

/**
 * Sprint 122 PR 2 — the flat ESLint configs must actually load (ADR-088).
 *
 * ci.yml runs lint as `npm run lint --if-present || echo "..."`, so a config
 * that throws on load produces a warning and a green job. This gate proves
 * each config resolves to a real rule set, WITHOUT requiring the ~677
 * outstanding lint findings to be cleaned up first: `--print-config` reports
 * the resolved configuration and never inspects code.
 */
const ROOT = join(__dirname, '..', '..');

type Probe = { workspace: string; probeFile: string; minRules: number; sentinel: string };

const PROBES: Probe[] = [
  { workspace: 'apps/frontend', probeFile: 'src/pages/dashboard.tsx', minRules: 90, sentinel: '@next/next/no-html-link-for-pages' },
  { workspace: 'apps/landing', probeFile: 'src/app/page.tsx', minRules: 90, sentinel: '@next/next/no-html-link-for-pages' },
  { workspace: 'apps/mobile', probeFile: 'app/_layout.tsx', minRules: 350, sentinel: 'react-hooks/rules-of-hooks' },
  { workspace: 'services/cleanup-service', probeFile: 'src/index.ts', minRules: 70, sentinel: 'no-unused-vars' },
];

describe('every linted workspace has a loadable flat ESLint config', () => {
  it('covers exactly the workspaces that ship an eslint.config.js', () => {
    // If someone adds a config, they must add a probe — otherwise the new
    // workspace's config is unverified and this gate quietly under-covers.
    const configured = PROBES.map((p) => p.workspace).sort();
    expect(configured).toEqual([
      'apps/frontend',
      'apps/landing',
      'apps/mobile',
      'services/cleanup-service',
    ]);
    for (const p of PROBES) {
      expect(existsSync(join(ROOT, p.workspace, 'eslint.config.js'))).toBe(true);
    }
  });

  it.each(PROBES)('$workspace resolves a real rule set', ({ workspace, probeFile, minRules, sentinel }) => {
    const dir = join(ROOT, workspace);

    // A renamed probe would make --print-config meaningless, so assert it exists.
    expect(existsSync(join(dir, probeFile))).toBe(true);

    const raw = execFileSync('npx', ['eslint', '--print-config', probeFile], {
      cwd: dir,
      encoding: 'utf8',
      maxBuffer: 32 * 1024 * 1024,
      shell: process.platform === 'win32',
    });

    const config = JSON.parse(raw);
    const rules = Object.keys(config.rules || {});

    expect(rules.length).toBeGreaterThanOrEqual(minRules);
    expect(rules).toContain(sentinel);
  }, 120_000);
});
