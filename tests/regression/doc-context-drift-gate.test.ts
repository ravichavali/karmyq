import { existsSync, readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { tracked } from './helpers/workspaces';

/**
 * Doc / context drift gate.
 *
 * Periodic context-hygiene review (2026-06-22) found that the agent-facing docs
 * drift silently between sprints — CLAUDE.md was ~18 sprints stale, the ADR index
 * was missing 5 ADRs, etc. Each was hand-fixed; nothing *detected* the drift, so
 * it recurred. This gate turns the manual drift-hunt into a blocking CI check:
 * the invariants below must hold, or the build fails.
 *
 * Scope: only invariants that are cheap, deterministic, and file-committed (so they
 * work in a fresh CI checkout). Soft/handoff-status drift is out of scope here.
 */
const ROOT = join(__dirname, '..', '..');

const read = (rel: string) => readFileSync(join(ROOT, rel), 'utf8');

// claude.md is git-tracked lowercase (Windows quirk — see feedback_git_add_windows);
// read case-tolerantly so this passes on case-sensitive CI runners too.
function readRootDoc(name: string): string {
  for (const c of [name, name.toLowerCase()]) {
    const p = join(ROOT, c);
    if (existsSync(p)) return readFileSync(p, 'utf8');
  }
  throw new Error(`root doc not found (tried ${name} / ${name.toLowerCase()})`);
}

/**
 * Duplicate ADR numbers, as a PURE predicate over filenames.
 *
 * Extracted so it can be proven to FAIL. Asserting only against the real docs/adr/
 * directory would be unfalsifiable in practice — the suite would pass forever without
 * anyone knowing whether the check works. Two parallel checkouts deriving "the next ADR
 * number" from the same open-PR list can both mint ADR-097; that collision is the
 * scenario this exists for.
 */
export function duplicateAdrNumbers(filenames: string[]): string[] {
  const byNumber = new Map<string, string[]>();
  for (const f of filenames) {
    const m = /^ADR-(\d+)/.exec(f);
    if (!m) continue;
    const n = m[1];
    byNumber.set(n, [...(byNumber.get(n) ?? []), f]);
  }
  return [...byNumber.entries()]
    .filter(([, files]) => files.length > 1)
    .map(([n, files]) => `ADR-${n}: ${files.sort().join(', ')}`)
    .sort();
}

describe('doc/context drift gate', () => {
  it('CLAUDE.md "Services (N total)" matches services/registry.json', () => {
    const claudeMd = readRootDoc('CLAUDE.md');
    const claimed = claudeMd.match(/Services \((\d+) total\)/);
    expect(claimed).not.toBeNull();

    const registry = JSON.parse(read('services/registry.json'));
    const actual = Array.isArray(registry.services)
      ? registry.services.length
      : Object.keys(registry.services).length;

    expect(Number(claimed![1])).toBe(actual);
  });

  it('CLAUDE.md version line points to package.json (no hard-coded semver that re-stales)', () => {
    // The version was hard-coded (10.11.0) while package.json had moved to 11.17.0.
    // Fixed by referencing package.json; lock that in so a literal version can't creep back.
    const versionLine = readRootDoc('CLAUDE.md')
      .split('\n')
      .find((l) => /\*\*Version\*\*/.test(l));
    expect(versionLine).toBeDefined();
    expect(versionLine).toMatch(/package\.json/);
    expect(versionLine).not.toMatch(/\d+\.\d+\.\d+/); // no frozen x.y.z to drift
  });

  it('every docs/adr/ADR-*.md is linked in the docs/adr/README.md index', () => {
    const adrDir = join(ROOT, 'docs', 'adr');
    const adrFiles = readdirSync(adrDir).filter((f) => /^ADR-\d+.*\.md$/.test(f));
    const index = read('docs/adr/README.md');

    const missing = adrFiles.filter((f) => !index.includes(`](${f})`));
    expect(missing).toEqual([]);
  });

  it('no two ADRs share a number (parallel lanes can both mint the next one)', () => {
    const adrFiles = readdirSync(join(ROOT, 'docs', 'adr')).filter((f) => /^ADR-\d+.*\.md$/.test(f));
    expect(duplicateAdrNumbers(adrFiles)).toEqual([]);
  });

  it('the duplicate-ADR check actually FAILS on a collision (indexing alone would not catch it)', () => {
    // Both files are well-formed and would both be linked in the index, so the
    // "every ADR is indexed" assertion passes on this input. Uniqueness must be
    // its own check.
    expect(
      duplicateAdrNumbers([
        'ADR-096-something.md',
        'ADR-097-lane-a-feature.md',
        'ADR-097-lane-b-feature.md',
      ]),
    ).toEqual(['ADR-097: ADR-097-lane-a-feature.md, ADR-097-lane-b-feature.md']);
  });

  it('every landing concepts/guides doc has a nav.json entry (the "nav.json silently reverts" gotcha)', () => {
    const navPath = 'apps/landing/src/data/docs/nav.json';
    if (!existsSync(join(ROOT, navPath))) {
      // landing docs are generated; if absent in this checkout, skip rather than false-fail.
      return;
    }
    const nav = read(navPath);
    const missing: string[] = [];

    for (const dir of ['concepts', 'guides']) {
      const abs = join(ROOT, 'apps/landing/src/data/docs', dir);
      if (!existsSync(abs)) continue;
      for (const f of readdirSync(abs).filter((x) => x.endsWith('.json'))) {
        let slug = f.replace(/\.json$/, '');
        try {
          slug = JSON.parse(readFileSync(join(abs, f), 'utf8')).slug ?? slug;
        } catch {
          /* fall back to filename stem */
        }
        if (!nav.includes(slug)) missing.push(`${dir}/${f}`);
      }
    }
    expect(missing).toEqual([]);
  });

  it('frontend jest.setup mocks next/router (prevents the 8-suite useRouter regression)', () => {
    // Making a widely-rendered component use useRouter broke every suite mounting it
    // (S100). The fix was a global next/router mock in jest.setup — lock it in.
    const setup = read('apps/frontend/jest.setup.js');
    expect(setup).toMatch(/next\/router/);
    expect(setup).toMatch(/useRouter/);
  });
});

// Extracts every `npm install|ci` invocation WITH its flags, so the check compares
// actual commands rather than asserting that two independent strings are present
// somewhere in the file. An earlier draft passed `npm install --legacy-peer-deps`
// whenever "npm ci" appeared anywhere else in the document.
export function extractInstallCommands(text: string): string[] {
  return [...text.matchAll(/^\s*(npm (?:install|ci)[^\n]*)$/gm)]
    .map((m) => m[1].trim())
    .filter((c) => !/--workspace/.test(c)); // workspace examples are illustrative, not the policy
}

const IS_NPM_CI = /^npm ci\b/;

export function onboardingDocIssues(docs: Record<string, string>): string[] {
  const issues: string[] = [];
  const ciCommands = new Set<string>();

  for (const [name, text] of Object.entries(docs)) {
    const cmds = extractInstallCommands(text);
    // 1. POLICY: no forbidden command, regardless of flags.
    for (const c of cmds) {
      if (/^npm install\b/.test(c)) {
        issues.push(`${name}: uses "${c}"; the policy is "npm ci"`);
      }
    }
    // 2. POLICY: the required commands are present.
    const ci = cmds.find((c) => IS_NPM_CI.test(c));
    if (ci) ciCommands.add(ci);
    else issues.push(`${name}: has no "npm ci" install command`);

    if (!/npm run hooks:install/.test(text)) {
      issues.push(`${name}: does not mention "npm run hooks:install"`);
    }
  }

  // 3. CONSISTENCY: the install command must be identical across documents, flags
  //    included — this catches divergence the policy check alone would miss.
  if (ciCommands.size > 1) {
    issues.push(
      `onboarding docs disagree on the install command: ${[...ciCommands].join(' | ')}`,
    );
  }

  return issues.sort();
}

describe('onboarding docs state the policy, not merely agree', () => {
  const docs = {
    'README.md': read('README.md'),
    'CONTRIBUTING.md': read('CONTRIBUTING.md'),
    'claude.md': readRootDoc('CLAUDE.md'),
  };

  it('all three state npm ci and hooks:install', () => {
    expect(onboardingDocIssues(docs)).toEqual([]);
  });

  // Each failure gets its OWN fixture. An earlier draft used a single fixture that
  // also removed "npm ci" and "hooks:install", so it fired three different errors and
  // could not prove the forbidden-command check worked at all.
  const OK = 'npm ci\nnpm run hooks:install\n';

  it('FAILS the forbidden command even when npm ci is also present', () => {
    const docs = {
      'README.md': 'npm install\nnpm ci\nnpm run hooks:install\n',
      'CONTRIBUTING.md': OK,
      'claude.md': OK,
    };
    expect(onboardingDocIssues(docs)).toEqual([expect.stringContaining('uses "npm install"')]);
  });

  // Flags must not launder a forbidden command past the check.
  it('FAILS "npm install --legacy-peer-deps" even with npm ci elsewhere', () => {
    const docs = {
      'README.md': 'npm install --legacy-peer-deps\nnpm ci\nnpm run hooks:install\n',
      'CONTRIBUTING.md': OK,
      'claude.md': OK,
    };
    expect(onboardingDocIssues(docs)).toEqual([expect.stringContaining('--legacy-peer-deps')]);
  });

  it('FAILS a missing hooks:install on its own', () => {
    const docs = { 'README.md': 'npm ci\n', 'CONTRIBUTING.md': OK, 'claude.md': OK };
    expect(onboardingDocIssues(docs)).toEqual([expect.stringContaining('hooks:install')]);
  });

  // Uniform regression is perfectly consistent and uniformly wrong — consistency alone
  // cannot catch it, which is why the policy is asserted explicitly.
  it('FAILS when all three agree on the wrong command', () => {
    const wrong = {
      'README.md': 'npm install\nnpm run hooks:install\n',
      'CONTRIBUTING.md': 'npm install\nnpm run hooks:install\n',
      'claude.md': 'npm install\nnpm run hooks:install\n',
    };
    const issues = onboardingDocIssues(wrong);
    expect(issues.filter((i) => i.includes('uses "npm install"'))).toHaveLength(3);
  });

  it('FAILS when documents disagree on the install command flags', () => {
    const docs = {
      'README.md': 'npm ci --no-audit\nnpm run hooks:install\n',
      'CONTRIBUTING.md': OK,
      'claude.md': OK,
    };
    expect(onboardingDocIssues(docs)).toEqual([
      expect.stringContaining('disagree on the install command'),
    ]);
  });
});


/**
 * Direct-to-master push recipes in agent-facing playbooks, as a PURE predicate.
 *
 * Sprint 128: `.claude/skills/deploy/SKILL.md` carried a literal `git push origin master`
 * recipe, `ship/SKILL.md` repeated it inside prose, and `docs/GITHUB_ACTIONS_SETUP.md` — which
 * CLAUDE.md names as the deployment reference — gave it twice, once as the *fix* for a workflow
 * that did not trigger. Meanwhile CLAUDE.md's merge discipline says never direct-push master.
 * Every master push is a full deploy, so a playbook-following agent would have deployed straight
 * past the PR gates. Prose alone never detected the contradiction across four documents.
 *
 * Two shapes are caught, because naming master is not required to push to it:
 *   1. An argument names master — `git push origin master`, `HEAD:master`, and their force,
 *      quoted and `refs/heads/` variants.
 *   2. The push has NO refspec (`git push`, `git push origin`) while the recipe has master
 *      checked out. This is the shape the original defect actually had — `git checkout master`
 *      in one step and the push several steps later — and it names master nowhere. An earlier
 *      draft of this gate missed it entirely, which is why the branch is tracked across the
 *      whole document rather than per fenced block.
 *
 * Scope: it recognises command RECIPES, in fenced blocks or inline prose, including a push
 * hidden behind a git global option (`git -C <dir> push`). It is NOT a shell interpreter: a
 * push behind a variable, an alias, a generated refspec, or split across a line continuation
 * is out of reach. Nor is it the only thing standing in the way — it governs what the playbooks
 * TELL an agent to do, not what git permits. A prohibition therefore belongs in prose; keeping
 * a runnable forbidden recipe "as an example" is what this gate exists to reject.
 */
/** Shell quoting must not launder a branch name or a refspec. */
const unquote = (token: string): string => token.replace(/["']/g, '');

/** Does this `git push` argument name master? Handles quoting, `+force`, and full refspecs. */
function namesMaster(token: string): boolean {
  const ref = unquote(token)
    .replace(/^\+/, '') // +master is a force refspec
    .replace(/refs\/heads\//g, ''); // fully-qualified refspec, before or after a colon
  return ref === 'master' || ref.endsWith(':master');
}

/**
 * ONE pattern for both subcommands, so `matchAll` yields them in TEXTUAL order.
 * Scanning all checkouts before all pushes reorders `git checkout master && git push`
 * into something that looks safe, and falsely flags a feature push followed by a checkout.
 *
 * `git` accepts global options before the subcommand, some taking a separate value
 * (`git -C <dir> push`, `git -c k=v push`); without that a recipe hides behind `-C`.
 * The argument capture stops at a shell separator, which is also what splits a `&&` chain
 * into the separate commands this relies on.
 */
const GIT_CMD =
  /\bgit\s+(?:-C\s+\S+\s+|-c\s+\S+\s+|-{1,2}\S+\s+)*(push|checkout|switch)\b([^`;|&]*)/g;

/**
 * Arguments after the subcommand: trailing shell comment removed, then flags dropped.
 * A comment does not change where git pushes, so counting its words as arguments would let
 * `git push origin # deploy` masquerade as having an explicit refspec.
 */
/** Arguments after the subcommand, with flags dropped. Comments are removed before discovery. */
const nonFlagArgs = (raw: string): string[] =>
  raw.split(/\s+/).filter((t) => t && !t.startsWith('-'));

/**
 * Remove a shell comment from a line, respecting token boundaries and quoting.
 *
 * `#` only opens a comment at a token boundary and outside quotes, so a branch name that
 * legitimately contains one (`feature/#123`) keeps the refspec that follows it. Truncating at
 * every `#` silently dropped a trailing `master`.
 *
 * A line-leading `#` outside a fence is a markdown HEADING, not a comment — a heading can carry
 * a recipe in its text, so discarding the line would throw away what the gate is meant to read.
 */
function stripShellComment(line: string, inFence: boolean): string {
  const firstNonSpace = line.search(/\S/);
  let single = false;
  let double = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === "'" && !double) single = !single;
    else if (c === '"' && !single) double = !double;
    else if (c === '#' && !single && !double && (i === 0 || /\s/.test(line[i - 1]))) {
      // Outside a fence, a line-leading `#` is a markdown HEADING, and a heading can carry a
      // recipe in its text. Keep scanning rather than discarding the line.
      if (!inFence && i === firstNonSpace) continue;
      return line.slice(0, i);
    }
  }
  return line;
}

/**
 * `git checkout -- <path>` (and `git checkout <ref> -- <path>`) restores files; it does NOT
 * switch branches. Recording the pathname as the current branch would silently clear master
 * attribution and let the following push through.
 */
const isPathCheckout = (raw: string): boolean =>
  raw.split(/\s+/).some((t) => t === '--') || nonFlagArgs(raw)[0] === '.';

export function workflowRecipeIssues(docs: Record<string, string>): string[] {
  const issues: string[] = [];

  for (const [name, text] of Object.entries(docs)) {
    // Track the branch the recipe has checked out, ACROSS the whole document — the original
    // defect spread `git checkout master` (Step 1) and the push (Step 3) over two separate
    // fenced blocks, so resetting per block would have missed it.
    let branch: string | null = null;
    let inFence = false;

    const lines = text.split(/\r?\n/);
    for (let i = 0; i < lines.length; i++) {
      if (/^\s*```/.test(lines[i])) {
        inFence = !inFence;
        continue;
      }
      // Comments are removed BEFORE discovery: a commented-out `git switch` is not a command,
      // and must not update the tracked branch.
      const line = stripShellComment(lines[i], inFence);

      for (const m of line.matchAll(GIT_CMD)) {
        const subcommand = m[1];
        const args = nonFlagArgs(m[2]);

        if (subcommand !== 'push') {
          if (isPathCheckout(m[2])) continue; // restores files; branch is unchanged
          // `-b`/`-c` are filtered as flags, so the first bare word is the branch either way.
          branch = args[0] ? unquote(args[0]) : branch;
          continue;
        }

        const recipe = m[0].trim();
        if (args.some(namesMaster)) {
          issues.push(`${name}:${i + 1}: direct-to-master push recipe "${recipe}"`);
          continue;
        }
        // No refspec means "push the current branch". `git push` and `git push <remote>` are
        // the most natural way to write the forbidden recipe, and name master nowhere.
        if (args.length <= 1 && branch === 'master') {
          issues.push(`${name}:${i + 1}: pushes the checked-out master branch — "${recipe}"`);
        }
      }
    }
  }

  return issues.sort();
}

/**
 * The LIVE agent-facing playbook set — the documents that tell an agent what to do.
 *
 * Enumerated from git (`tracked`), never a directory glob: an untracked or gitignored file is not
 * something CI would ever see, and a silently-empty scan is how a discovery gate goes vacuously
 * green. Historical records are deliberately excluded — `docs/superpowers/plans/**` and the
 * archives contain ~40 accurate accounts of what was done at the time, and rewriting history to
 * satisfy a gate would be worse than the drift it prevents.
 */
const PLAYBOOK_PATHSPECS = [
  // NB: a git pathspec `*` already crosses directory separators. `dir/**/*.md` matches only files
  // BELOW a subdirectory, so it would have scanned .claude/handoff/archive/ while missing the live
  // CURRENT_HANDOFF.md — backwards. Use `dir/*.md` plus an explicit exclude.
  '.claude/skills/*.md',
  '.claude/agents/*.md',
  '.claude/PROMPTS.md',
  '.claude/handoff/*.md',
  ':(exclude).claude/handoff/archive/*',
  'docs/guides/*.md',
  'docs/gotchas/*.md',
  'docs/GITHUB_ACTIONS_SETUP.md',
  'CONTRIBUTING.md',
  'AGENTS.md',
  'README.md',
  'claude.md',
];

describe('agent-facing playbooks carry no direct-to-master push recipe', () => {
  const playbooks = Object.fromEntries(
    tracked(...PLAYBOOK_PATHSPECS).map((p) => [p, read(p)]),
  );

  // A silently-empty or too-narrow scan would make the assertion below vacuously true. Assert
  // IDENTITY of the documents that actually carried the defect, not a count.
  it('discovers the live playbooks it claims to guard, and excludes historical records', () => {
    const keys = Object.keys(playbooks);
    // IDENTITY, not a count: every document that has actually carried this defect, plus the
    // live handoff — an earlier pathspec matched only .claude/handoff/archive/ and missed
    // CURRENT_HANDOFF.md entirely, which a count-based assertion would not have caught.
    expect(keys).toEqual(
      expect.arrayContaining([
        '.claude/skills/deploy/SKILL.md',
        '.claude/skills/ship/SKILL.md',
        '.claude/agents/process-reviewer.md',
        '.claude/handoff/CURRENT_HANDOFF.md',
        '.claude/handoff/TEMPLATE.md',
        'docs/GITHUB_ACTIONS_SETUP.md',
        'claude.md',
      ]),
    );
    // Archived handoffs are accurate records of what was done at the time. Rewriting history to
    // satisfy a gate would be worse than the drift, so they are deliberately out of scope.
    expect(keys.filter((k) => k.includes('/archive/'))).toEqual([]);
  });

  it('no live playbook contains a direct-to-master push recipe', () => {
    expect(workflowRecipeIssues(playbooks)).toEqual([]);
  });

  it('rejects the historical deploy recipe even when PR guidance is present', () => {
    const docs = {
      'deploy/SKILL.md': 'Use reviewed PRs.\n```bash\ngit push origin master\n```\n',
    };
    expect(workflowRecipeIssues(docs)).toEqual([
      expect.stringContaining('deploy/SKILL.md'),
    ]);
  });

  it('accepts a feature-branch push', () => {
    expect(
      workflowRecipeIssues({
        'ship/SKILL.md': '```bash\ngit push origin agent/codex/task\n```',
      }),
    ).toEqual([]);
  });

  // ship's recipe was never in a fenced block — a fenced-block-only scan would miss it.
  it('rejects an inline prose command, not only a fenced block', () => {
    expect(
      workflowRecipeIssues({
        'ship/SKILL.md': 'Then run `deploy` end-to-end (merge -> `git push origin master` -> watch).',
      }),
    ).toEqual([expect.stringContaining('ship/SKILL.md:1')]);
  });

  it('rejects the HEAD:master refspec', () => {
    expect(workflowRecipeIssues({ 'd/SKILL.md': 'git push origin HEAD:master' })).toEqual([
      expect.stringContaining('HEAD:master'),
    ]);
  });

  it('rejects force variants, which flags alone would otherwise hide', () => {
    expect(
      workflowRecipeIssues({
        'a/SKILL.md': 'git push --force-with-lease origin master',
        'b/SKILL.md': 'git push -f origin master',
        'c/SKILL.md': 'git push origin +master',
      }),
    ).toHaveLength(3);
  });

  it('reports file and line exactly, so the recipe can be found', () => {
    expect(workflowRecipeIssues({ 'x/SKILL.md': 'intro\n\ngit push origin master\n' })).toEqual([
      'x/SKILL.md:3: direct-to-master push recipe "git push origin master"',
    ]);
  });

  it('rejects a quoted target', () => {
    expect(workflowRecipeIssues({ 'x/SKILL.md': 'git push "origin" "master"' })).toEqual([
      expect.stringContaining('direct-to-master push recipe'),
    ]);
  });

  it('rejects a fully-qualified refs/heads/master refspec', () => {
    expect(workflowRecipeIssues({ 'x/SKILL.md': 'git push origin HEAD:refs/heads/master' })).toEqual(
      [expect.stringContaining('refs/heads/master')],
    );
  });

  // Proves the check is not merely "contains the word master".
  it('does not flag a branch whose name merely contains "master"', () => {
    expect(workflowRecipeIssues({ 'x/SKILL.md': 'git push origin fix/master-recipe' })).toEqual([]);
  });

  // The ORIGINAL deploy recipe was `git checkout master` + merge + push. Rewriting its last
  // line as a bare `git push` names master nowhere, and is the most natural way to write it.
  it('rejects a bare push while master is the checked-out branch', () => {
    expect(
      workflowRecipeIssues({
        'x/SKILL.md': 'git checkout master\ngit merge feature/x\ngit push\n',
      }),
    ).toEqual([expect.stringContaining('pushes the checked-out master branch')]);
  });

  it('rejects a remote-only push while on master (no refspec means current branch)', () => {
    expect(
      workflowRecipeIssues({ 'x/SKILL.md': 'git switch master\ngit push origin\n' }),
    ).toEqual([expect.stringContaining('pushes the checked-out master branch')]);
  });

  // The tracking must span fenced blocks: the real defect had checkout in Step 1 and the push
  // in Step 3, several blocks apart.
  it('tracks the checked-out branch across separate fenced blocks', () => {
    const doc = '## Step 1\n```bash\ngit checkout master\n```\n## Step 3\n```bash\ngit push\n```\n';
    expect(workflowRecipeIssues({ 'x/SKILL.md': doc })).toEqual([
      expect.stringContaining('pushes the checked-out master branch'),
    ]);
  });

  // False-positive guard: a bare push on a feature branch is the CORRECT workflow.
  it('accepts a bare push after checking out a feature branch', () => {
    expect(
      workflowRecipeIssues({
        'x/SKILL.md': 'git switch -c agent/codex/task origin/master\ngit push\n',
      }),
    ).toEqual([]);
  });

  // With no checkout in the document, a bare push is unattributable — do not guess.
  it('does not flag a bare push when no branch was checked out', () => {
    expect(workflowRecipeIssues({ 'x/SKILL.md': 'git push\n' })).toEqual([]);
  });

  it('rejects a recipe hiding behind a git global option', () => {
    expect(workflowRecipeIssues({ 'x/SKILL.md': 'git -C /repo push origin master' })).toEqual([
      expect.stringContaining('direct-to-master push recipe'),
    ]);
  });

  // A trailing comment does not change git's push destination, so its words must not be
  // counted as arguments and read as an explicit refspec.
  it('rejects a bare push whose only "argument" is a trailing comment', () => {
    expect(
      workflowRecipeIssues({
        'x/SKILL.md': 'git checkout master\ngit push origin # deploy the release\n',
      }),
    ).toEqual([expect.stringContaining('pushes the checked-out master branch')]);
  });

  // Commands must be read in textual order: scanning every checkout on a line before any push
  // would let the switch at the END of this chain retroactively excuse the push in the middle.
  it('rejects a master push in a && chain that later switches away', () => {
    expect(
      workflowRecipeIssues({
        'x/SKILL.md': 'git checkout master && git push && git switch -c feature/foo\n',
      }),
    ).toEqual([expect.stringContaining('pushes the checked-out master branch')]);
  });

  // The same ordering bug in reverse: this is a correct feature push and must stay clean.
  it('accepts a feature-branch push followed by switching to master', () => {
    expect(
      workflowRecipeIssues({
        'x/SKILL.md': 'git switch -c feature/x origin/master\ngit push && git checkout master\n',
      }),
    ).toEqual([]);
  });

  it('rejects a bare push after a QUOTED master checkout', () => {
    expect(
      workflowRecipeIssues({ 'x/SKILL.md': 'git checkout "master"\ngit push\n' }),
    ).toEqual([expect.stringContaining('pushes the checked-out master branch')]);
  });

  // A commented-out command is not a command. Discovery must exclude comments, not merely
  // strip them from the arguments of a command it has already matched.
  it('ignores a commented-out checkout when tracking the branch', () => {
    expect(
      workflowRecipeIssues({
        'x/SKILL.md': '```bash\ngit checkout master\n# git switch -c feature/foo\ngit push\n```\n',
      }),
    ).toEqual([expect.stringContaining('pushes the checked-out master branch')]);
  });

  // `git checkout -- <path>` restores files; it does not switch branches, so it must not
  // clear master attribution by recording the pathname as the current branch.
  it('does not treat a path checkout as a branch switch', () => {
    expect(
      workflowRecipeIssues({
        'x/SKILL.md': '```bash\ngit checkout master\ngit checkout -- README.md\ngit push\n```\n',
      }),
    ).toEqual([expect.stringContaining('pushes the checked-out master branch')]);
  });

  // `#` only starts a shell comment at a token boundary. Truncating at every `#` would drop
  // the real refspec that follows a branch name legitimately containing one.
  it('does not treat a # inside a refspec as a comment', () => {
    expect(
      workflowRecipeIssues({
        'x/SKILL.md': '```bash\ngit push origin feature/#123 master\n```\n',
      }),
    ).toEqual([expect.stringContaining('direct-to-master push recipe')]);
  });

  // Markdown prose is not shell: a heading must not be mistaken for a comment and dropped.
  it('still scans a recipe that appears inside a markdown heading', () => {
    expect(
      workflowRecipeIssues({ 'x/SKILL.md': '## Step 3: run git push origin master to deploy\n' }),
    ).toEqual([expect.stringContaining('direct-to-master push recipe')]);
  });

  // An EXPLICIT non-master refspec is safe even while master is checked out — the refspec, not
  // the checked-out branch, decides the destination.
  it('accepts an explicit feature refspec pushed from master', () => {
    expect(
      workflowRecipeIssues({
        'x/SKILL.md': '```bash\ngit checkout master\ngit push origin feature/x\n```\n',
      }),
    ).toEqual([]);
  });
});
