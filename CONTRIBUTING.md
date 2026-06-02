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
