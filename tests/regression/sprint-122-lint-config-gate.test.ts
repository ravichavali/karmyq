import { execFileSync } from 'child_process';
import { existsSync, readdirSync, statSync } from 'fs';
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
    // Scan the repo rather than comparing PROBES against a copy of itself.
    // The failure this gate exists to prevent is silent under-coverage, so a
    // NEW unprobed config must fail here — not only a REMOVED one.
    // Flat config resolves any of these four extensions; scanning only .js
    // would leave a future eslint.config.mjs/.cjs/.ts unprobed.
    const FLAT_CONFIG_NAMES = ['eslint.config.js', 'eslint.config.mjs', 'eslint.config.cjs', 'eslint.config.ts'];
    const hasFlatConfig = (dir: string) => FLAT_CONFIG_NAMES.some((name) => existsSync(join(dir, name)));

    const discovered: string[] = [];
    for (const root of ['apps', 'services', 'packages']) {
      const rootDir = join(ROOT, root);
      if (!existsSync(rootDir)) continue;
      for (const name of readdirSync(rootDir)) {
        if (name === 'node_modules') continue;
        const dir = join(rootDir, name);
        if (!statSync(dir).isDirectory()) continue;
        if (hasFlatConfig(dir)) discovered.push(`${root}/${name}`);
      }
    }
    if (hasFlatConfig(join(ROOT, 'tests'))) discovered.push('tests');

    expect(discovered.sort()).toEqual(PROBES.map((p) => p.workspace).sort());
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
