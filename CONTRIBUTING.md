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
npm ci
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

## Recording what you learn

Durable, repo-scoped operational facts live in [`docs/gotchas/`](docs/gotchas/) — the things that
are neither a decision (those are ADRs), a defect (a bug), nor a proposal (an idea). The reasoning
is in [How Karmyq Learns](https://karmyq.org/docs/concepts/how-karmyq-learns/).

Each entry is **a pair of files that must both exist** — an orphan of either kind is rejected:

- `docs/gotchas/<slug>.json` — the metadata sidecar
- `docs/gotchas/<slug>.md` — the prose, including the evidence that made you believe it

The sidecar carries `title`, `owner`, `created`, and `scope`, plus **exactly one** of `verify` or
`expires`:

```json
{
  "title": "Node 24 is gate-locked across images, engines and CI — they move as one",
  "owner": "your-github-handle",
  "created": "2026-09-04",
  "scope": ["package.json", ".github/workflows/ci.yml"],
  "verify": {
    "json_equals": { "path": "package.json", "key": "engines.node", "value": ">=24.0.0" }
  }
}
```

**`scope`** lists the paths the fact applies to. They must be **git-tracked** — a path that exists
only on your machine (`.husky/`, `node_modules/`, build output) fails on every fresh clone. A
trailing `/` means "directory prefix"; anything else must match exactly. Scope is also what
discovery matches against, so it works for files that do not exist yet.

**`verify`** is a declarative check — prefer it whenever the fact is machine-checkable. Four types:

| Type | Argument | Passes when |
|---|---|---|
| `path_exists` | a path string | the path exists |
| `file_matches` | `{ path, pattern }` | the file matches the regex |
| `file_not_matches` | `{ path, pattern }` | the file does **not** match |
| `json_equals` | `{ path, key, value }` | the dotted key holds that value |

There is deliberately no way to run a shell command. This repository accepts pull requests from
forks, and an executable check would be arbitrary code execution.

**`expires`** is for facts a machine cannot check — an ISO date by which a human re-confirms it.
To renew, add to `renewed` with **evidence**, not just a new date:

```json
"renewed": [{ "date": "2027-01-15", "evidence": "re-probed the endpoint 2027-01-15: still 503" }]
```

Reviews are capped at 400 days from the most recent review. Whether a long-lived expiring entry
should be *promoted* to a mechanically enforced check is a reviewer's judgment — the validator
does not decide it for you.

Before committing:

```bash
node scripts/gotcha-check.js                 # validate every entry
node scripts/gotcha-check.js --for <paths>   # which gotchas apply to these paths?
```

**Never put credentials in an entry.** This is a public repository and deletion does not remove
content from git history. A pre-commit hook screens staged entries, but do not rely on it.

## Reporting bugs / suggesting features

Use the GitHub issue templates in [`.github/ISSUE_TEMPLATE/`](.github/ISSUE_TEMPLATE/).

## License

By contributing, you agree your contributions are licensed under the AGPL-3.0-or-later License.
