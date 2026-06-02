# Enforced Multi-Agent PR Process — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the PR the enforced cross-agent contract — a PR template, a `pr-contract` CI check, branch protection, and reconciled `CONTRIBUTING.md`/`AGENTS.md` — so agents follow one consistent, gate-enforced process.

**Architecture:** Approach A from the spec. Two new files (`.github/pull_request_template.md`, `.github/workflows/pr-contract.yml`), two doc rewrites/additions (`CONTRIBUTING.md`, `AGENTS.md`), and one settings change (master branch protection via `gh api`). Enforcement teeth = required `pr-contract` check + required review + green required checks. Judgment stays with the human reviewer; CI enforces the mechanical contract. Spec: [docs/superpowers/specs/2026-06-01-multi-agent-pr-process-design.md](../specs/2026-06-01-multi-agent-pr-process-design.md).

**Tech Stack:** GitHub Actions (`actions/github-script@v7`), `gh` CLI / GitHub REST branch-protection API, Markdown. Host is Windows/PowerShell — use the Bash tool for `gh api` heredocs/JSON-file input.

**Branch:** `feature/multi-agent-pr-process` (already created off master; spec already committed here).

---

## File Structure

| File | Responsibility | Action |
|------|----------------|--------|
| `.github/pull_request_template.md` | The standing PR contract the web UI auto-loads and agents copy into `gh pr create --body` | Create |
| `.github/workflows/pr-contract.yml` | CI check: fail PR if body empty / required sections missing; pass-through for dependabot | Create |
| `AGENTS.md` | Add "Lanes & Merge Authority" section + concurrency escalation playbook + memory-advisory rule | Modify |
| `CONTRIBUTING.md` | Rewrite stale OSS boilerplate to match the real branch-based agent+maintainer process | Replace |
| master branch protection | Require PR + 1 review + green required checks; admin bypass on | Settings (gh api) |

---

## Task 1: PR template (the contract)

**Files:**
- Create: `.github/pull_request_template.md`

- [ ] **Step 1: Create the template file**

```markdown
<!--
Karmyq PR contract. Agents opening PRs via `gh pr create`/API: GitHub does NOT
auto-apply this template — copy it into your --body and fill every section.
The `pr-contract` CI check fails the PR if the required headers are missing.
-->

## Summary

<!-- What changed and why, in 2-4 sentences. -->

## Validation

<!-- Evidence: the commands you ran and their results. -->
- [ ] `npx tsc --noEmit` on affected packages — result:
- [ ] `npm run test:unit` / `npm run test:regression` — result:
- [ ] `npm run feedback:check` (if behavior/docs changed) — result:

## Docs updated

<!-- Tie to the CLAUDE.md feedback loops. Check what applies; "N/A" is a valid answer. -->
- [ ] Service `CONTEXT.md`
- [ ] `services/registry.json` (endpoints/events)
- [ ] ADR created/updated (if architectural)
- [ ] `apps/landing/` docs site (guide/concept/ADR/service JSON + nav.json)
- [ ] N/A — no behavior/doc change

## Quality gates

- [ ] Tests pass (unit + regression)
- [ ] `/simplify` run on the diff
- [ ] `/code-review` run on the diff
- [ ] `/security-review` run on the diff

## Security dismissals

<!--
Any CodeQL/dependency-audit alert dismissed for this change MUST be recorded here
with a one-line justification + link to the alert. Write "None" if there are none.
-->
None

## Follow-ups / known issues

<!-- Anything deferred, or "None". -->

## Lane

<!-- Who authored this PR: codex / claude / human -->
```

- [ ] **Step 2: Verify the file renders as Markdown (no broken HTML comments)**

Run: `git add .github/pull_request_template.md && git diff --cached --stat`
Expected: shows `.github/pull_request_template.md | NN ++++` with no errors.

- [ ] **Step 3: Commit**

```bash
git add .github/pull_request_template.md
git commit -m "feat(process): add PR contract template

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 2: `pr-contract` CI check

**Files:**
- Create: `.github/workflows/pr-contract.yml`

**Design note:** The job must ALWAYS run (never `if:`-skip at job level), because a *skipped* required status check leaves a PR un-mergeable forever. Dependabot exemption happens INSIDE the script via an early `return` so a passing status is still posted.

- [ ] **Step 1: Create the workflow**

```yaml
name: PR Contract

on:
  pull_request:
    types: [opened, edited, synchronize, reopened]

permissions:
  pull-requests: read
  contents: read

jobs:
  pr-contract:
    name: pr-contract
    runs-on: ubuntu-latest
    steps:
      - name: Verify PR body satisfies the contract
        uses: actions/github-script@v7
        with:
          script: |
            const pr = context.payload.pull_request;
            const author = pr.user.login;
            if (author === 'dependabot[bot]') {
              core.info('Dependabot PR — contract check not required. Passing.');
              return;
            }
            const body = (pr.body || '').trim();
            if (body.length === 0) {
              core.setFailed('PR body is empty. Copy .github/pull_request_template.md into the PR description and fill it in.');
              return;
            }
            const required = ['## Summary', '## Validation', '## Quality gates', '## Security dismissals'];
            const missing = required.filter((h) => !body.includes(h));
            if (missing.length > 0) {
              core.setFailed(`PR body is missing required section(s): ${missing.join(', ')}. Populate from .github/pull_request_template.md.`);
              return;
            }
            core.info('PR contract sections present.');
```

- [ ] **Step 2: Lint the YAML locally**

Run: `npx --yes js-yaml .github/workflows/pr-contract.yml > /dev/null && echo OK`
Expected: prints `OK` (valid YAML). If `js-yaml` is unavailable, visually confirm 2-space indentation and that `script: |` is a literal block.

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/pr-contract.yml
git commit -m "feat(process): add pr-contract CI check for PR body

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 3: `AGENTS.md` — Lanes & Merge Authority + escalation + memory rule

**Files:**
- Modify: `AGENTS.md` — insert a new top-level section immediately BEFORE the final `---` that precedes the closing "**At session start, confirm...**" paragraph.

- [ ] **Step 1: Find the insertion anchor**

Run: `grep -n "At session start, confirm" AGENTS.md`
Expected: one match near the end of the file. The `---` line directly above that paragraph is the insertion point — the new section goes BEFORE that `---`.

- [ ] **Step 2: Insert this section before that `---`**

```markdown
## Lanes & Merge Authority

This repo runs an **enforced multi-agent PR process**. The PR is the contract between
agents; shared state lives in the repo, never in an agent-private memory store.

### Roles
- **Admin (maintainer):** owns scope approval, **merge authority**, and deploy. The merge
  decision and deploy authorization are the Admin's.
- **Claude (orchestrator):** assigns scoped work, validates gates, owns **merge-readiness
  validation and the merge recommendation**, and may *execute* a merge only once the Admin has
  authorized it (e.g. "pull it in"). Claude is the **only** agent that marks a sprint complete.
- **Contributor agents (Codex / others):** implement scoped tasks only; open PRs; never
  self-merge; never resolve cross-agent conflicts independently.

### Branch ownership (non-overlap)
- One agent per branch. No agent pushes to another agent's branch. No direct commits to `master`.
- Agent lane: `agent/<agent-name>/<slug>` (e.g. `agent/codex/dashboard-retry`).
- Human lanes: `feature/`, `fix/`, `docs/`, `refactor/`, `chore/`.

### The PR contract — templates are known
- Every task = one branch = one PR carrying the contract in [`.github/pull_request_template.md`](.github/pull_request_template.md).
- **GitHub only auto-injects the template in the web "create PR" UI.** When you open a PR with
  `gh pr create` or the API, the template is **NOT** applied — you MUST copy
  `.github/pull_request_template.md` into your `--body` and fill every section. The
  `pr-contract` CI check fails the PR if the required headers are missing.
- Issue templates live under [`.github/ISSUE_TEMPLATE/`](.github/ISSUE_TEMPLATE/).
- **Out-of-band actions** (e.g. dismissing a CodeQL/audit alert) MUST be recorded in the PR
  body's "Security dismissals" section with a justification + link.
- **No merge without all gates green:** `tsc --noEmit`, unit/regression tests, docs updates,
  `/code-review`, `/security-review`, and the required status checks.

### Handoff vs PR body (no duplication)
- The **PR body** carries per-task detail (what changed, files, tests, risks).
- **`CURRENT_HANDOFF.md`** carries rolling cross-session state + the active branch/ownership.
- Do not copy the full PR contract into the handoff — they drift.

### Shared state lives in-repo
- Claude's persistent memory is **advisory only** (maintainer-local convenience). Any decision
  or process state another agent must honor MUST be written to repo docs, `CURRENT_HANDOFF.md`,
  an ADR, or the PR body.

### Conflict policy
- If two agents need the same file area, the second agent **pauses and requests reassignment**.
  Claude re-scopes/rebases; contributor agents do not resolve cross-agent conflicts themselves.

### Concurrency escalation (documented, NOT active)
While work is **serial** (one agent at a time) the default is direct contributor-PR-to-`master`
with required review. Activate the following ONLY when **2+ agents work the same sprint
concurrently**:
- **File-ownership manifest per task:** orchestrator posts a per-task file-ownership list in the
  PR/handoff; contributors edit only listed files; new files need a lock-update request first.
- **PR layering:** contributor PRs target a Claude-maintained integration branch; Claude owns
  the final integration PR to `master`. The integration branch needs its own branch protection
  (else it becomes a second unprotected mainline).
```

- [ ] **Step 3: Verify the section landed and the file still ends with the confirm paragraph**

Run: `grep -n "Lanes & Merge Authority" AGENTS.md && grep -n "At session start, confirm" AGENTS.md`
Expected: the new heading line number is SMALLER than the confirm-paragraph line number.

- [ ] **Step 4: Commit**

```bash
git add AGENTS.md
git commit -m "docs(process): add Lanes & Merge Authority to AGENTS.md

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 4: `CONTRIBUTING.md` reconciliation

**Files:**
- Replace: `CONTRIBUTING.md` (full rewrite — current content is stale fork-based boilerplate that contradicts the real process).

- [ ] **Step 1: Replace the file with this content**

```markdown
# Contributing to Karmyq

Karmyq uses an **enforced multi-agent PR process**. AI agents (Claude, Codex) and the
maintainer work on branches in this repo; external contributors fork. Either way, the PR is
the contract and nothing merges to `master` without review + green checks.

**Canonical process:** [`AGENTS.md`](AGENTS.md) (entry point for every contributor, human or
agent). **Source of truth for rules:** [`CLAUDE.md`](CLAUDE.md). If the two disagree,
`CLAUDE.md` wins.

## Quick start

```bash
git clone https://github.com/ravichavali/karmyq.git
cd karmyq
npm install
npm run hooks:install   # wire up git hooks (not auto-installed; see CLAUDE.md)
```

External contributors: fork first, then clone your fork.

## Workflow

1. Branch off `master`. Naming:
   - Humans: `feature/`, `fix/`, `docs/`, `refactor/`, `chore/`
   - Agents: `agent/<agent-name>/<slug>` (e.g. `agent/codex/dashboard-retry`)
2. Make scoped changes. One agent per branch; no direct commits to `master`.
3. Follow the **Pre-Merge Checklist** in [`CLAUDE.md`](CLAUDE.md): tests, docs feedback loop,
   `/simplify`, `/code-review`, `/security-review`.
4. Open a PR. The PR body MUST follow
   [`.github/pull_request_template.md`](.github/pull_request_template.md) — agents using
   `gh pr create`/API must copy it into `--body` (GitHub only auto-injects it in the web UI).
   The `pr-contract` check fails the PR if required sections are missing.
5. A reviewer (maintainer/Claude) verifies the contract and merges. Contributor agents never
   self-merge.

## Tests

`master` requires unit + regression green. See the Testing section in [`CLAUDE.md`](CLAUDE.md).

```bash
npm test            # unit + regression (must pass)
npm run test:tdd    # WIP tests (informational)
```

## Reporting bugs / suggesting features

Use the GitHub issue templates in [`.github/ISSUE_TEMPLATE/`](.github/ISSUE_TEMPLATE/).

## License

By contributing, you agree your contributions are licensed under the MIT License.
```

- [ ] **Step 2: Verify no stale references remain**

Run: `grep -niE "CHANGELOG|YOUR-USERNAME|YOUR_USERNAME|fork the repository" CONTRIBUTING.md || echo "clean"`
Expected: prints `clean`.

- [ ] **Step 3: Commit**

```bash
git add CONTRIBUTING.md
git commit -m "docs(process): rewrite CONTRIBUTING.md to match agent PR process

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 5: Open the PR (dogfood the template) and let checks run

**Files:** none (uses the branch built in Tasks 1-4).

- [ ] **Step 1: Push the branch**

Run: `git push -u origin feature/multi-agent-pr-process`
Expected: branch pushed; pre-push hook runs unit+regression (this branch touches only docs/.github, so tests are unaffected and should pass).

- [ ] **Step 2: Write the PR body to a file using the new template, then open the PR**

Create `pr-body.md` (gitignored scratch — delete after) filled from the template, then:

```bash
gh pr create --base master --head feature/multi-agent-pr-process \
  --title "Process: enforced multi-agent PR contract + branch protection" \
  --body-file pr-body.md
```

The body MUST include `## Summary`, `## Validation`, `## Quality gates`, `## Security dismissals` so `pr-contract` passes on its own introducing PR.

- [ ] **Step 3: Wait for checks, then capture EXACT required-check context names**

Run: `gh pr checks <PR#> --watch`
Then: `gh pr checks <PR#>`
Expected: all green. **Copy the exact check names verbatim** — note how CodeQL reports (e.g. `CodeQL` AND/OR `Analyze (javascript-typescript)`, `Analyze (actions)`). These exact strings feed Task 6.

- [ ] **Step 4: Delete the scratch body file**

```bash
rm pr-body.md
```

---

## Task 6: Apply master branch protection (via `gh api`)

**Files:** none (GitHub settings; token has `admin: true`).

**CRITICAL:** Use the EXACT context names captured in Task 5 Step 3. A required check whose name
does not match a reported context blocks every future merge.

- [ ] **Step 1: Write the protection payload to a temp JSON file**

Replace the `contexts` array with the exact names from Task 5. Example skeleton:

```bash
cat > protection.json <<'JSON'
{
  "required_status_checks": {
    "strict": true,
    "contexts": [
      "pr-contract",
      "Lint & Type Check",
      "Test Frontend",
      "Test Backend Services (Unit + Regression)",
      "Code Scanning Gate (ADR-060)",
      "Security Audit",
      "Analyze (javascript-typescript)"
    ]
  },
  "enforce_admins": false,
  "required_pull_request_reviews": {
    "required_approving_review_count": 1,
    "dismiss_stale_reviews": true
  },
  "restrictions": null,
  "required_linear_history": false,
  "allow_force_pushes": false,
  "allow_deletions": false
}
JSON
```

- [ ] **Step 2: Apply via the REST API (use the Bash tool, not PowerShell)**

```bash
gh api -X PUT repos/ravichavali/karmyq/branches/master/protection \
  -H "Accept: application/vnd.github+json" \
  --input protection.json
```

Expected: JSON response echoing the protection settings (HTTP 200). Then `rm protection.json`.

- [ ] **Step 3: Confirm protection is active**

Run: `gh api repos/ravichavali/karmyq/branches/master/protection --jq '{checks: .required_status_checks.contexts, reviews: .required_pull_request_reviews.required_approving_review_count, admins: .enforce_admins.enabled}'`
Expected: shows your contexts, `reviews: 1`, `admins: false`.

---

## Task 7: Verification (the acceptance tests)

**Files:** none.

- [ ] **Step 1: Verify `pr-contract` fails an empty-body PR**

Create a throwaway branch with a trivial change, push it, and open a PR with an empty body:

```bash
git checkout -b chore/verify-pr-contract origin/master
git commit --allow-empty -m "test: verify pr-contract"
git push -u origin chore/verify-pr-contract
gh pr create --base master --head chore/verify-pr-contract --title "verify pr-contract" --body ""
gh pr checks <throwaway-PR#> --watch
```

Expected: `pr-contract` reports **failure** with the "PR body is empty" message.

- [ ] **Step 2: Verify it passes once the body is filled**

```bash
gh pr edit <throwaway-PR#> --body-file .github/pull_request_template.md
gh pr checks <throwaway-PR#> --watch
```

Expected: `pr-contract` flips to **pass** (template headers present).

- [ ] **Step 3: Verify a direct push to master is rejected**

```bash
git checkout master && git pull
git commit --allow-empty -m "test: direct push should be rejected"
git push origin master
```

Expected: push **rejected** by branch protection (required PR / required checks). Then undo the local empty commit: `git reset --hard origin/master`.

- [ ] **Step 4: Verify dependabot PRs are unaffected**

Run: `gh pr checks <an-open-dependabot-PR#, e.g. 41>` (after re-running its checks, or on its next push)
Expected: `pr-contract` reports **pass** (pass-through for `dependabot[bot]`).

- [ ] **Step 5: Clean up the throwaway PR/branch**

```bash
gh pr close <throwaway-PR#> --delete-branch
git checkout feature/multi-agent-pr-process
```

- [ ] **Step 6: Merge the process PR (Admin-authorized)**

Once the maintainer authorizes ("pull it in"), the process PR from Task 5 is reviewed, approved, and merged. From this point the process is live and self-enforcing.

---

## Self-Review

**Spec coverage:**
- Artifact 1 (PR template) → Task 1 ✓
- Artifact 2 (pr-contract check) → Task 2 ✓
- Artifact 3 (branch protection) → Task 6, with exact-name validation from Task 5 ✓
- Artifact 4 (CONTRIBUTING rewrite) → Task 4 ✓
- Artifact 5 (AGENTS lanes/merge authority/templates-known/handoff-split/memory-advisory/conflict) → Task 3 ✓
- Artifact 6 (concurrency escalation, documented not active) → Task 3 escalation subsection ✓
- Success criteria (empty-body PR fails; direct push rejected; dependabot unaffected; one consistent process) → Task 7 ✓

**Placeholder scan:** No TBD/TODO. The `contexts` array in Task 6 is intentionally an example skeleton — Task 5 Step 3 produces the real values and Task 6 Step 1 says to substitute them. The `<PR#>` placeholders are runtime values, not unfilled plan content.

**Type/name consistency:** Required section headers are identical across Task 1 (template), Task 2 (check: `## Summary`, `## Validation`, `## Quality gates`, `## Security dismissals`), and Task 7 verification. Branch name `feature/multi-agent-pr-process` consistent throughout. Repo slug `ravichavali/karmyq` consistent with the gh commands used this session.
