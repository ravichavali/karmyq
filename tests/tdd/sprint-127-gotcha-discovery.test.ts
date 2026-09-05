const reg = require('../../scripts/gotcha-registry.js');

function e(slug: string, scope: string[]) {
  return { slug, jsonPath: `docs/gotchas/${slug}.json`,
           bodyPath: `docs/gotchas/${slug}.md`, data: { scope }, body: '' };
}

const ENTRIES = [
  e('hooks-path', ['scripts/install-hooks.sh', 'scripts/git-hooks/']),
  e('audit-gate', ['scripts/audit-exemptions.js']),
  e('landing-generated', ['scripts/generate-docs.ts']),
];

describe('gotcha registry — discovery', () => {
  it('returns the exact expected entries for a changed file', () => {
    expect(reg.discover(ENTRIES, ['scripts/audit-exemptions.js'])).toEqual(['audit-gate']);
  });

  it('matches a directory prefix', () => {
    expect(reg.discover(ENTRIES, ['scripts/git-hooks/pre-push'])).toEqual(['hooks-path']);
  });

  // The case directory-scoped knowledge exists for: a file that does not exist yet.
  it('matches a NEW file not yet created or staged', () => {
    expect(reg.discover(ENTRIES, ['scripts/git-hooks/pre-merge'])).toEqual(['hooks-path']);
  });

  // Over-matching prefixes are a silent correctness bug a positive-only test cannot see.
  it('does NOT match an adjacent prefix', () => {
    expect(reg.discover(ENTRIES, ['scripts/git-hooks-old/pre-push'])).toEqual([]);
  });

  it('returns nothing for an unrelated path', () => {
    expect(reg.discover(ENTRIES, ['apps/frontend/src/pages/index.tsx'])).toEqual([]);
  });

  it('deduplicates when several changed paths hit one entry', () => {
    expect(
      reg.discover(ENTRIES, ['scripts/install-hooks.sh', 'scripts/git-hooks/pre-push']),
    ).toEqual(['hooks-path']);
  });
});
