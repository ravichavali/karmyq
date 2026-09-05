import { execFileSync } from 'child_process';
import { join } from 'path';
import { readFileSync, mkdtempSync, mkdirSync, writeFileSync, rmSync, existsSync } from 'fs';
import { tmpdir } from 'os';

const reg = require('../../scripts/gotcha-registry.js');
const ROOT = join(__dirname, '..', '..');

const tracked = execFileSync('git', ['ls-files'], { cwd: ROOT, encoding: 'utf8' })
  .split('\n').map((s) => s.trim()).filter(Boolean);

describe('Sprint 127 — gotcha registry gate', () => {
  const { entries, errors } = reg.loadRegistry(ROOT);
  const slugs = entries.map((e: any) => e.slug);

  it('every sidecar parses', () => {
    expect(errors).toEqual([]);
  });

  it('every entry satisfies the schema', () => {
    expect(entries.flatMap((e: any) => reg.validateSchema(e))).toEqual([]);
  });

  it('every verify claim still holds', () => {
    expect(entries.flatMap((e: any) => reg.runVerify(ROOT, e))).toEqual([]);
  });

  it('no entry is past its review date, and every renewal carries evidence', () => {
    expect(entries.flatMap((e: any) => reg.checkDates(e, new Date()))).toEqual([]);
  });

  it('every scope anchor is git-tracked', () => {
    expect(entries.flatMap((e: any) => reg.checkScope(e, tracked))).toEqual([]);
  });

  it('every see_also resolves', () => {
    expect(entries.flatMap((e: any) => reg.checkReferences(e, slugs))).toEqual([]);
  });

  it('every sidecar has its body and vice versa', () => {
    expect(reg.checkPairing(ROOT)).toEqual([]);
  });

  // BOTH halves. An earlier draft asserted over bodies only, so a credential in a
  // sidecar passed this blocking gate and would have been caught only later, by the
  // clean-room CLI, after the content was already committed.
  it('no entry contains credential-shaped content, in either half of the pair', () => {
    expect(
      entries.flatMap((e: any) => [
        ...reg.scanCredentials(e.body, e.bodyPath),
        ...reg.scanCredentials(JSON.stringify(e.data, null, 1), e.jsonPath),
      ]),
    ).toEqual([]);
  });

  it('the credential scan catches a QUOTED JSON key, not just a bare assignment', () => {
    expect(reg.scanCredentials('{"password":"synthetic-example-value"}', 'x.json')).toEqual([
      expect.stringContaining('x.json'),
    ]);
  });

  it('the credential scan still ignores descriptive prose', () => {
    expect(reg.scanCredentials('The runbook explains where the password is stored.', 'x.md')).toEqual([]);
  });

  // The CLI is the entry point for the hook and the clean room. A syntax error in it
  // disables all three at once, and every probe that asserts only "exit 1" would still
  // look like it passed.
  // At this task the registry is EMPTY — the seeds land in Task 9. So assert the
  // empty-registry response, which still proves the script parses and runs. The
  // positive discovery assertion belongs in Task 9, where entries exist. An earlier
  // draft asserted "gotcha(s) apply" here and could never have gone green.
  it('the CLI parses and answers, even with an empty registry', () => {
    const out = execFileSync(
      process.execPath,
      ['scripts/gotcha-check.js', '--for', 'scripts/install-hooks.sh'],
      { cwd: ROOT, encoding: 'utf8' },
    );
    expect(out).toMatch(/No gotchas scoped to those paths\.|gotcha\(s\) apply/);
  });

  it('the CLI rejects --for with no paths rather than doing something surprising', () => {
    let status = 0;
    try {
      execFileSync(process.execPath, ['scripts/gotcha-check.js', '--for'], {
        cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
      });
    } catch (e: any) {
      status = e.status;
    }
    expect(status).toBe(2);
  });

  // Hermeticity: the module must not reach the network, directly or transitively.
  it('the validator makes no network calls', () => {
    const src = readFileSync(join(ROOT, 'scripts', 'gotcha-registry.js'), 'utf8');
    expect(src).not.toMatch(/require\(['"](https?|net|dns|tls)['"]\)/);
    expect(src).not.toMatch(/\bfetch\s*\(/);
    expect(src).not.toMatch(/child_process/);
  });
});

describe('negative fixtures — the gate must be able to FAIL', () => {
  describe('schema', () => {
    function fixtureRoot(files: Record<string, string>): string {
      const root = mkdtempSync(join(tmpdir(), 'gotcha-'));
      mkdirSync(join(root, 'docs', 'gotchas'), { recursive: true });
      for (const [rel, content] of Object.entries(files)) {
        writeFileSync(join(root, rel), content, 'utf8');
      }
      return root;
    }

    const VALID = {
      title: 'npm status page is not a signal',
      owner: 'ravichavali',
      created: '2026-09-04',
      expires: '2027-03-04',
      scope: ['scripts/audit-exemptions.js'],
    };

    it('accepts a well-formed entry', () => {
      const root = fixtureRoot({
        'docs/gotchas/a.json': JSON.stringify(VALID),
        'docs/gotchas/a.md': 'body',
      });
      const { entries, errors } = reg.loadRegistry(root);
      expect(errors).toEqual([]);
      expect(entries).toHaveLength(1);
      expect(reg.validateSchema(entries[0])).toEqual([]);
      rmSync(root, { recursive: true, force: true });
    });

    it('FAILS when a required field is missing', () => {
      const { owner, ...noOwner } = VALID;
      const root = fixtureRoot({
        'docs/gotchas/a.json': JSON.stringify(noOwner),
        'docs/gotchas/a.md': 'body',
      });
      const { entries } = reg.loadRegistry(root);
      expect(reg.validateSchema(entries[0])).toEqual([expect.stringContaining('owner')]);
      rmSync(root, { recursive: true, force: true });
    });

    it('FAILS when both verify and expires are present', () => {
      const root = fixtureRoot({
        'docs/gotchas/a.json': JSON.stringify({ ...VALID, verify: { path_exists: 'README.md' } }),
        'docs/gotchas/a.md': 'body',
      });
      const { entries } = reg.loadRegistry(root);
      expect(reg.validateSchema(entries[0])).toEqual([expect.stringContaining('exactly one of')]);
      rmSync(root, { recursive: true, force: true });
    });

    it('FAILS when neither verify nor expires is present', () => {
      const { expires, ...neither } = VALID;
      const root = fixtureRoot({
        'docs/gotchas/a.json': JSON.stringify(neither),
        'docs/gotchas/a.md': 'body',
      });
      const { entries } = reg.loadRegistry(root);
      expect(reg.validateSchema(entries[0])).toEqual([expect.stringContaining('exactly one of')]);
      rmSync(root, { recursive: true, force: true });
    });

    // These all passed an earlier draft: an entry asserting nothing, with no
    // review date, satisfied "exactly one of". That defeats the whole invariant.
    it.each([null, false, {}, [], 'yes'])('FAILS when verify is %p (asserts nothing)', (bad) => {
      const { expires, ...noExpires } = VALID;
      const root = fixtureRoot({
        'docs/gotchas/a.json': JSON.stringify({ ...noExpires, verify: bad }),
        'docs/gotchas/a.md': 'body',
      });
      const { entries } = reg.loadRegistry(root);
      expect(reg.validateSchema(entries[0]).length).toBeGreaterThan(0);
      rmSync(root, { recursive: true, force: true });
    });

    it.each([
      ['renewed', 'not-an-array'],
      ['see_also', { a: 1 }],
    ])('FAILS when %s is malformed rather than silently treating it as empty', (field, bad) => {
      const root = fixtureRoot({
        'docs/gotchas/a.json': JSON.stringify({ ...VALID, [field as string]: bad }),
        'docs/gotchas/a.md': 'body',
      });
      const { entries } = reg.loadRegistry(root);
      expect(reg.validateSchema(entries[0])).toEqual([expect.stringContaining(field as string)]);
      rmSync(root, { recursive: true, force: true });
    });

    it('FAILS a check with malformed arguments', () => {
      const { expires, ...noExpires } = VALID;
      const root = fixtureRoot({
        'docs/gotchas/a.json': JSON.stringify({
          ...noExpires,
          verify: { file_matches: { path: 'a.sh', pattern: '[unclosed' } },
        }),
        'docs/gotchas/a.md': 'body',
      });
      const { entries } = reg.loadRegistry(root);
      expect(reg.validateSchema(entries[0])).toEqual([expect.stringContaining('not a valid regex')]);
      rmSync(root, { recursive: true, force: true });
    });

    it('loads a body whose path is repo-relative, not double-joined', () => {
      const root = fixtureRoot({
        'docs/gotchas/a.json': JSON.stringify(VALID),
        'docs/gotchas/a.md': 'the body text',
      });
      const { entries } = reg.loadRegistry(root);
      expect(entries[0].bodyPath).toBe('docs/gotchas/a.md');
      expect(entries[0].body).toBe('the body text');
      rmSync(root, { recursive: true, force: true });
    });

    it('reports malformed JSON as a load error rather than throwing', () => {
      const root = fixtureRoot({
        'docs/gotchas/a.json': '{ not json',
        'docs/gotchas/a.md': 'body',
      });
      const { errors } = reg.loadRegistry(root);
      expect(errors).toEqual([expect.stringContaining('a.json')]);
      rmSync(root, { recursive: true, force: true });
    });
  });

  describe('verify executors', () => {
    function root(files: Record<string, string>): string {
      const r = mkdtempSync(join(tmpdir(), 'gv-'));
      mkdirSync(join(r, 'docs', 'gotchas'), { recursive: true });
      for (const [rel, c] of Object.entries(files)) {
        mkdirSync(join(r, rel, '..'), { recursive: true });
        writeFileSync(join(r, rel), c, 'utf8');
      }
      return r;
    }

    function entryWith(verify: object) {
      return { slug: 'a', jsonPath: 'docs/gotchas/a.json', bodyPath: 'docs/gotchas/a.md',
               data: { verify }, body: '' };
    }

    it('path_exists passes when the path is present', () => {
      const r = root({ 'target.txt': 'x' });
      expect(reg.runVerify(r, entryWith({ path_exists: 'target.txt' }))).toEqual([]);
      rmSync(r, { recursive: true, force: true });
    });

    it('path_exists FAILS on a deleted path', () => {
      const r = root({ 'other.txt': 'x' });
      expect(reg.runVerify(r, entryWith({ path_exists: 'gone.txt' }))).toEqual([
        expect.stringContaining('gone.txt'),
      ]);
      rmSync(r, { recursive: true, force: true });
    });

    it('file_matches passes when the pattern is found', () => {
      const r = root({ 'a.sh': 'hooks_dir=".git/hooks"' });
      expect(
        reg.runVerify(r, entryWith({ file_matches: { path: 'a.sh', pattern: 'hooks_dir' } })),
      ).toEqual([]);
      rmSync(r, { recursive: true, force: true });
    });

    it('file_matches FAILS when the pattern no longer matches', () => {
      const r = root({ 'a.sh': 'something else' });
      expect(
        reg.runVerify(r, entryWith({ file_matches: { path: 'a.sh', pattern: 'hooks_dir' } })),
      ).toEqual([expect.stringContaining('no longer contains')]);
      rmSync(r, { recursive: true, force: true });
    });

    it('file_not_matches FAILS when the forbidden pattern appears', () => {
      const r = root({ 'a.sh': 'npm install' });
      expect(
        reg.runVerify(r, entryWith({ file_not_matches: { path: 'a.sh', pattern: 'npm install' } })),
      ).toEqual([expect.stringContaining('unexpectedly contains')]);
      rmSync(r, { recursive: true, force: true });
    });

    it('json_equals compares a dotted key path', () => {
      const r = root({ 'p.json': JSON.stringify({ engines: { node: '>=24.0.0' } }) });
      expect(
        reg.runVerify(r, entryWith({ json_equals: { path: 'p.json', key: 'engines.node', value: '>=24.0.0' } })),
      ).toEqual([]);
      expect(
        reg.runVerify(r, entryWith({ json_equals: { path: 'p.json', key: 'engines.node', value: '>=20' } })),
      ).toEqual([expect.stringContaining('expected')]);
      rmSync(r, { recursive: true, force: true });
    });

    // Fail-closed: mirrors ADR-060's refusal to treat an unreadable source as "nothing found".
    it('FAILS rather than skips when the target is unreadable', () => {
      const r = root({ 'a.sh': 'x' });
      const errs = reg.runVerify(r, entryWith({ file_matches: { path: 'missing.sh', pattern: 'x' } }));
      expect(errs).toEqual([expect.stringContaining('unreadable')]);
      rmSync(r, { recursive: true, force: true });
    });

    it('FAILS on an unknown check type instead of ignoring it', () => {
      const r = root({ 'a.sh': 'x' });
      expect(reg.runVerify(r, entryWith({ run_shell: 'rm -rf /' }))).toEqual([
        expect.stringContaining('unsupported check type'),
      ]);
      rmSync(r, { recursive: true, force: true });
    });
  });

  describe('dates and renewal', () => {
    const TODAY = new Date('2026-09-04T00:00:00Z');

    function e(data: object) {
      return { slug: 'a', jsonPath: 'docs/gotchas/a.json', bodyPath: 'docs/gotchas/a.md',
               data, body: '' };
    }

    it('accepts an unexpired entry inside the cap', () => {
      expect(reg.checkDates(e({ created: '2026-09-04', expires: '2027-01-01' }), TODAY)).toEqual([]);
    });

    // The span here is deliberately INSIDE the cap so this fixture isolates the expiry
    // failure. An earlier draft used created 2025-01-01, which is a 610-day span and
    // therefore produced two errors while asserting exactly one.
    it('FAILS an entry past its review date, and only for that reason', () => {
      expect(reg.checkDates(e({ created: '2026-08-01', expires: '2026-09-03' }), TODAY)).toEqual([
        expect.stringContaining('past its review date'),
      ]);
    });

    it('FAILS a malformed date', () => {
      expect(reg.checkDates(e({ created: '2026-13-45', expires: '2027-01-01' }), TODAY)).toEqual([
        expect.stringContaining('not a valid ISO date'),
      ]);
    });

    it('accepts a span of exactly the cap', () => {
      const created = '2026-09-04';
      const expires = new Date(Date.UTC(2026, 8, 4) + reg.REVIEW_CAP_DAYS * 86400000)
        .toISOString().slice(0, 10);
      expect(reg.checkDates(e({ created, expires }), TODAY)).toEqual([]);
    });

    it('FAILS a span one day beyond the cap', () => {
      const created = '2026-09-04';
      const expires = new Date(Date.UTC(2026, 8, 4) + (reg.REVIEW_CAP_DAYS + 1) * 86400000)
        .toISOString().slice(0, 10);
      expect(reg.checkDates(e({ created, expires }), TODAY)).toEqual([
        expect.stringContaining('exceeds the review cap'),
      ]);
    });

    // Expiry is measured from the LATEST review, not from creation.
    it('measures the cap from the most recent renewal, not from created', () => {
      expect(
        reg.checkDates(
          e({
            created: '2024-01-01',
            expires: '2027-06-01',
            renewed: [{ date: '2026-08-01', evidence: 're-probed 2026-08-01: still true' }],
          }),
          TODAY,
        ),
      ).toEqual([]);
    });

    it('accepts many evidenced renewals on an unverifiable entry', () => {
      expect(
        reg.checkDates(
          e({
            created: '2024-01-01',
            expires: '2027-06-01',
            renewed: [
              { date: '2025-01-01', evidence: 'probe A' },
              { date: '2025-09-01', evidence: 'probe B' },
              { date: '2026-08-01', evidence: 'probe C' },
            ],
          }),
          TODAY,
        ),
      ).toEqual([]);
    });

    it('FAILS a renewal with no evidence', () => {
      expect(
        reg.checkDates(
          e({ created: '2026-01-01', expires: '2027-01-01', renewed: [{ date: '2026-08-01' }] }),
          TODAY,
        ),
      ).toEqual([expect.stringContaining('evidence')]);
    });

    it('FAILS a renewal with a malformed date', () => {
      expect(
        reg.checkDates(
          e({ created: '2026-01-01', expires: '2027-01-01',
              renewed: [{ date: 'last tuesday', evidence: 'x' }] }),
          TODAY,
        ),
      ).toEqual([expect.stringContaining('not a valid ISO date')]);
    });
  });

  describe('scope, references, pairing', () => {
    const TRACKED = ['scripts/install-hooks.sh', 'scripts/git-hooks/pre-push', 'README.md'];

    function e(data: object) {
      return { slug: 'a', jsonPath: 'docs/gotchas/a.json', bodyPath: 'docs/gotchas/a.md',
               data, body: '' };
    }

    it('accepts an exact tracked file', () => {
      expect(reg.checkScope(e({ scope: ['scripts/install-hooks.sh'] }), TRACKED)).toEqual([]);
    });

    it('accepts a directory prefix covering a tracked file', () => {
      expect(reg.checkScope(e({ scope: ['scripts/git-hooks/'] }), TRACKED)).toEqual([]);
    });

    // .husky/ exists on a dev machine but is gitignored — this is the exact defect
    // that made an earlier draft of the spec fail on every fresh clone.
    it('FAILS an untracked-but-present path', () => {
      expect(reg.checkScope(e({ scope: ['.husky/'] }), TRACKED)).toEqual([
        expect.stringContaining('.husky/'),
      ]);
    });

    it('FAILS a see_also pointing at a non-existent slug', () => {
      expect(reg.checkReferences(e({ see_also: ['no-such-entry'] }), ['a', 'b'])).toEqual([
        expect.stringContaining('no-such-entry'),
      ]);
    });

    it('accepts a see_also that resolves', () => {
      expect(reg.checkReferences(e({ see_also: ['b'] }), ['a', 'b'])).toEqual([]);
    });

    it('FAILS an orphaned .json and an orphaned .md', () => {
      const r = mkdtempSync(join(tmpdir(), 'gp-'));
      mkdirSync(join(r, 'docs', 'gotchas'), { recursive: true });
      writeFileSync(join(r, 'docs/gotchas/lonely-json.json'), '{}', 'utf8');
      writeFileSync(join(r, 'docs/gotchas/lonely-md.md'), 'body', 'utf8');
      const errs = reg.checkPairing(r);
      expect(errs).toEqual(
        expect.arrayContaining([
          expect.stringContaining('lonely-json'),
          expect.stringContaining('lonely-md'),
        ]),
      );
      rmSync(r, { recursive: true, force: true });
    });
  });

  describe('discovery', () => {
    function e(slug: string, scope: string[]) {
      return { slug, jsonPath: `docs/gotchas/${slug}.json`,
               bodyPath: `docs/gotchas/${slug}.md`, data: { scope }, body: '' };
    }

    const ENTRIES = [
      e('hooks-path', ['scripts/install-hooks.sh', 'scripts/git-hooks/']),
      e('audit-gate', ['scripts/audit-exemptions.js']),
      e('landing-generated', ['scripts/generate-docs.ts']),
    ];

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

  describe('credential screening', () => {
    it('passes ordinary prose', () => {
      expect(reg.scanCredentials('Diagnose the endpoint with a direct probe.', 'a.md')).toEqual([]);
    });

    it('FLAGS a password assignment', () => {
      expect(reg.scanCredentials('password: hunter2seventeen', 'a.md')).toEqual([
        expect.stringContaining('a.md'),
      ]);
    });

    it('FLAGS a private key block', () => {
      expect(reg.scanCredentials('-----BEGIN OPENSSH PRIVATE KEY-----', 'a.md')).toEqual([
        expect.stringContaining('a.md'),
      ]);
    });

    it('FLAGS a postgres connection string with credentials', () => {
      expect(
        reg.scanCredentials('postgresql://karmyq_prod:s3cr3tvalue@karmyq.com:5432/db', 'a.md'),
      ).toEqual([expect.stringContaining('a.md')]);
    });

    it('FLAGS a bearer token', () => {
      expect(reg.scanCredentials('Authorization: Bearer ghp_ABCDEFGHIJKLMNOPQRSTUVWXYZ0123', 'a.md'))
        .toEqual([expect.stringContaining('a.md')]);
    });

    // High recall is the safer failure direction here: a false positive costs a
    // rewording, a false negative publishes a secret irreversibly.
    it('does not flag the word "password" used descriptively', () => {
      expect(reg.scanCredentials('The runbook explains where the password is stored.', 'a.md')).toEqual([]);
    });
  });
});
