# Sprint 128 PR A: Framework refinement — Implementation Plan

> **For agentic workers:** Use `superpowers:executing-plans` task-by-task, with one active editor.

**Goal:** Make the existing workflow accurate for one stream and ready for a later second machine.
**Architecture:** Reconcile instructions, add one falsifiable assertion to the existing doc drift gate, and use walkthroughs for dynamic handoff behavior. No coordinator service or new CI job.
**Tech stack:** Markdown; existing Node/Jest documentation checks.
**Spec:** `docs/superpowers/specs/2026-09-07-sprint-128-single-stream-design.md`, PR A.
**Branch:** `agent/codex/sprint-128-framework`, created after PR B deploy verification; A is second.
**Global constraints:** All ten Critical implementation notes in the sprint index apply verbatim.

## File map

Modify `.claude/skills/sprint-planning/SKILL.md`, `.claude/skills/handoff/SKILL.md`,
`.claude/skills/update-handoff/SKILL.md`, `.claude/skills/ship/SKILL.md`,
`.claude/skills/deploy/SKILL.md`, `.claude/agents/process-reviewer.md`,
`.claude/handoff/README.md`, `.claude/handoff/TEMPLATE.md`, `.claude/handoff/CURRENT_HANDOFF.md`,
`CONTRIBUTING.md`, `docs/concepts/how-karmyq-learns.md`, and
`tests/regression/doc-context-drift-gate.test.ts` (one workflow-recipe assertion with fixtures).
Modify `claude.md` and `AGENTS.md` only for agreed bootstrap/activation clarifications, in sync.
Root `package.json` and the two root lockfile version fields change only under the existing release convention at merge time.
No service, registry endpoint, dependency or migration change is needed.

## Task 1: Establish the branch and reconcile current instructions

**Files:** Read `claude.md`, `AGENTS.md`, the file map, the spec and sprint index.

- [ ] Confirm PR B merged/deployed, clean tree and ownership before execution; read `uname -s` through Git Bash on Windows.
- [ ] On this Windows checkout, verify Bash resolves to Git for Windows and its Unix tools are
  on the test process PATH. Planning verification observed WSL's `bash` selected with no installed
  distribution and hook fixtures failing on missing `basename`/`tr`. The CodeQL fixture invokes
  `bash` through PATH (`tests/regression/sprint-122-adr-060-code-scanning-gate.test.ts:207`).
  Use a Git Bash session or prepend the verified Git `usr/bin` to this PowerShell process's PATH;
  do not install WSL or edit machine-wide settings for this task.
- [ ] Refresh remote state and create the framework branch once from `origin/master`:

```powershell
git fetch origin
git switch -c agent/codex/sprint-128-framework origin/master
git branch --show-current
git status --short
gh pr list
git log -3 --oneline origin/master
```

- [ ] Run `node scripts/gotcha-check.js --for .claude/ CONTRIBUTING.md claude.md AGENTS.md` and read matches.
- [ ] Compare each skill's instructions to canonical rules. Write the concrete contradictions into
  the PR review evidence, including deploy's local-master recipe and process-reviewer's piped test command.
- [ ] Read `tests/claude.md` before extending the existing root doc drift gate.
- [ ] Verification: owner, base, write paths and next action are explicit in the handoff; no second lane is marked active.

## Task 2: Correct planning and handoff routing

**Files:** Planning/handoff skills and handoff README/TEMPLATE from the map; canonical bootstrap files if necessary;
`tests/regression/doc-context-drift-gate.test.ts`.

- [ ] **TDD for the known recipe regression:** first add a pure
  `workflowRecipeIssues(docs: Record<string, string>): string[]` predicate in the existing doc gate,
  then a real-files assertion discovering `.claude/skills/**/SKILL.md` recursively. Inspect executable
  fenced blocks and inline command examples, including ship's prose-embedded command. Reject
  literal `git push origin master` and refspec `git push origin HEAD:master` (including force-flag
  variants); report file and line. This is a guard for recognizable command recipes, not a complete
  shell interpreter or proof against variable/alias-based pushes.
- [ ] Pin the failure independently of unrelated policy changes:

```typescript
it('rejects the historical deploy recipe even when PR guidance is present', () => {
  const docs = {
    'deploy/SKILL.md': 'Use reviewed PRs.\n```bash\ngit push origin master\n```\n',
  };
  expect(workflowRecipeIssues(docs)).toEqual([
    expect.stringContaining('deploy/SKILL.md'),
  ]);
});
it('accepts a feature-branch push', () => {
  expect(workflowRecipeIssues({ 'ship/SKILL.md': '```bash\ngit push origin agent/codex/task\n```' })).toEqual([]);
});
```

- [ ] Add separate inline-command, forced push and `HEAD:master` fixtures. The real-files assertion
  must fail on current deploy/ship recipes before Task 3 changes them. Run directly from `tests/`:
  `npx jest regression/doc-context-drift-gate.test.ts --runInBand`.

- [ ] Read the skill-creator playbook before editing skills. Preserve existing entry points.
- [ ] Replace unconditional router rewrites with this decision procedure in each applicable skill:

```text
Read current branch and CURRENT_HANDOFF.
Single stream: update CURRENT_HANDOFF as the active state.
Router mode + matching branch: read/update only the indicated lane file.
Router mode + missing branch: reconcile assignment with maintainer; do not adopt another lane.
Resource request: consult canonical allocation rules, never infer ownership from a file or PR list.
```

- [ ] Template fields: outcome, branch/base, active editor and reviewer role, owned paths, shared
  resource needs, spec/plan links, next unchecked task, blockers/decisions, verification references.
  GitHub status is a link or dated observation; omit a handoff's own supposed final commit SHA.
- [ ] Branch instructions must reuse an existing task branch or create from fetched `origin/master`.
  Fresh chat per PR; planning artifacts remain on that PR's branch.
- [ ] Replace stale Next.js 14 example, root-unit placement and per-task simplify prescription with
  references to canonical stack, changed-workspace TDD/root-invariant exception and calibrated gates.
- [ ] Verification: manually instantiate the template for this PR and the next PR without creating
  a second active lane or copying their full plans into the handoff.

## Task 3: Correct review, merge and future activation instructions

**Files:** `.claude/skills/ship/SKILL.md`, `.claude/skills/deploy/SKILL.md`, `.claude/agents/process-reviewer.md`, handoff README and `CONTRIBUTING.md`.

- [ ] Replace deploy's local merge/direct-push steps with: branch checks → all four gates → complete
  PR template → independent review → Claude readiness recommendation → explicit maintainer merge
  authorization → authorized PR merge → CI/deploy/health verification. Admin override requires its own authorization.
- [ ] Ship must delegate to the corrected deploy procedure without restating an obsolete master push.
- [ ] Replace the process-reviewer test pipeline with `npm test`, retaining its actual exit status.
  Read cached/staged feedback limitations: `npm run feedback:check` is advisory and reads the staged
  diff (`scripts/claude.md`, feedback entry). Do not call an empty staged diff proof of complete docs.
- [ ] Add the future activation checklist from the spec. Include host/bootstrap/hook verification,
  explicit file ownership, shared-package consumer conflicts, dependency/ADR allocation, and
  serialized deploys. Treat the current single-stream handoff as the default until activation.
- [ ] Verification: search all changed playbooks for instructions to `git push origin master`,
  create a worktree, blindly overwrite the router, or pipe test output while losing status. Any
  retained example must explicitly be a prohibited example; review context, not just string presence.
- [ ] Make the new real-files drift assertion pass after removing direct-master command examples
  from workflow skills. Describe prohibitions in prose without retaining a runnable forbidden
  recipe. Reinject the historical snippet through the negative fixture and verify it still fails.

## Task 4: Complete contributor and landing documentation

**Files:** `CONTRIBUTING.md`, `docs/concepts/how-karmyq-learns.md`.

- [ ] Explain the one-editor workflow and portable handoff/knowledge distinction in the existing pages.
  Keep GitHub status out of durable concepts and avoid describing a successful two-machine pilot.
- [ ] Regenerate using `npm --workspace apps/landing run generate-docs`; inspect the concept page.
- [ ] Run `node scripts/gotcha-check.js` and direct Jest for `regression/doc-context-drift-gate.test.ts`
  from `tests/`. Inspect generated changes; revert only timestamp/HEAD-only churn.
- [ ] Verification: the existing learning concept remains navigable; no service CONTEXT/registry
  update is claimed necessary for process-only changes, and no new ADR is minted.

## Task 5: Validate workflow scenarios

**Files:** `.claude/handoff/CURRENT_HANDOFF.md` (short evidence/next action only), full changed diff.

- [ ] Walk through fresh single-stream startup: exact branch/plan/task found with no machine-local memory.
- [ ] Walk through clean author-to-reviewer transfer: reviewer reads the diff without co-editing or pushing the author's branch.
- [ ] Walk through a PR already merged while handoff says awaiting merge: live PR/commit evidence wins; no duplicate merge or docs-only master push.
- [ ] Walk through unmatched router branch, simultaneous hypothetical ADR requests, and queued Dependabot PR versus active dependency holder.
- [ ] Verification: record each scenario's expected action and observed instruction path. This is
  manual validation for dynamic state; the direct-master recipe regression is separately enforced
  by the negative-fixture assertion from Task 2.

## Task 6: Run all SDLC gates on PR A

**Files:** Branch diff and PR template.

- [ ] **Testing:** confirm the direct doc gate result and run `npm test`; verify exit 0, actual suite results and no hidden pipe failure. Repeat prior checks only after relevant changes.
- [ ] **`/simplify`:** one pass on the PR diff; verify unnecessary duplicated policy and conflicting aliases are removed.
- [ ] **`/code-review`:** have Claude/non-author review the spec, plans and framework changes; verify findings are resolved or explicitly justified.
- [ ] **`/security-review`:** verify no weakened audit/merge/data-operation authority, fake lock or credential-copy instructions; record disposition.
- [ ] Use pre-commit-check before commits. Retain all four gates for this small process/test diff.

## Task 7: Final verification and PR preparation

**Files:** Handoff, root release fields if required, full PR template body.

- [ ] Run `git diff --check`, staged `npm run feedback:check`, and type-check the changed root test
  with the workspace configuration. Reuse Task 6's passing test result if tested inputs are unchanged.
- [ ] Remove generated metadata churn and verify only owned paths changed.
- [ ] Re-derive release version from `origin/master`; do not bump dependencies for a docs change.
- [ ] Commit with pre-commit-check satisfied; push with normal hooks and open/update PR A using every section of `.github/pull_request_template.md`.
- [ ] Verification: CI gates are green, review evidence is linked, handoff points to PR C as next only after actual merge/deploy verification.

## Task 8: Authorized merge, deploy and clean role handoff

**Files:** Handoff and GitHub PR/run state.

- [ ] Follow the corrected deploy skill. Claude recommends readiness; maintainer explicitly authorizes
  the merge. Contributor does not self-merge or push master.
- [ ] Verify CI/deploy success for the merged SHA and public health using host-appropriate probes.
  Prepare the handoff reconciliation instruction before merge; record post-merge state in the next
  task branch when work continues, not through a separate master push.
- [ ] Verification: tree is clean, PR is merged, deploy is verified, and PR C can start from current `origin/master`.
- [ ] Next fresh chat: open `2026-09-07-sprint-128-c-standing-preview.md`; its first hard gate is
  the authorized isolated DB/Redis setup and baseline, before preview implementation.
