/**
 * Sprint 131 (maintainer, 2026-09-30): Dependabot proposes security fixes only.
 *
 * Every update entry sets `open-pull-requests-limit: 0`, which GitHub documents as disabling
 * version updates while "security update pull requests are not subject to this limit". A missing
 * or non-zero limit on any entry silently restores the weekly version-update stream.
 */
import { parse as parseYaml } from 'yaml';
import { read } from './helpers/workspaces';

type UpdateEntry = { 'package-ecosystem': string; directory: string; 'open-pull-requests-limit'?: number };

/** Entries that would open routine version-update PRs, as "ecosystem directory" labels. */
export function versionUpdateStreams(document: { updates: UpdateEntry[] }): string[] {
  return document.updates
    .filter((entry) => entry['open-pull-requests-limit'] !== 0)
    .map((entry) => `${entry['package-ecosystem']} ${entry.directory}`);
}

describe('Dependabot is security-only', () => {
  const config = parseYaml(read('.github/dependabot.yml'));

  it('the real config disables version updates on every entry', () => {
    expect(config.updates.map((entry: UpdateEntry) => entry['package-ecosystem']).sort()).toEqual(['github-actions', 'npm']);
    expect(versionUpdateStreams(config)).toEqual([]);
  });

  it.each([
    ['a missing limit', {}],
    ['the old limit of 10', { 'open-pull-requests-limit': 10 }],
  ])('rejects %s', (_label, limit) => {
    const doc = { updates: [
      { 'package-ecosystem': 'npm', directory: '/', 'open-pull-requests-limit': 0 },
      { 'package-ecosystem': 'github-actions', directory: '/', ...limit },
    ] };
    expect(versionUpdateStreams(doc)).toEqual(['github-actions /']);
  });
});
