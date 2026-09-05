---
name: learned
description: Capture a durable, repo-scoped operational fact to docs/gotchas/ mid-session, so it reaches everyone who clones instead of dying in one agent's private memory. Use when the user says "we learned", "remember this for the repo", "/learned ...", or when a session produces a gotcha that is not a bug, an ADR, or an idea.
disable-model-invocation: false
---

Propose a gotcha entry in `docs/gotchas/`. **Propose — do not write it unasked.** An agent
authorised to add entries unprompted floods the directory.

## What belongs here

A durable, repo-scoped operational fact that is **not** a decision (ADR), a defect (bug), or a
proposal (idea). "Hooks land in `.git/hooks` on a fresh clone." "npm's status page does not reflect
advisory-endpoint health."

**Test for shareability:** would this still be true and useful if a stranger cloned the repo
tomorrow? If it is about the person, it stays in private memory. If it is about the repo, it ships.

**Never include credentials** — access details, passwords, tokens, connection strings. This is a
public repo and deletion does not remove content from git history. The pre-commit hook screens for
this, but do not rely on it.

## Steps

1. Pick a slug: lowercase, hyphenated, states the fact (`hooks-install-to-git-hooks-on-a-fresh-clone`).
   No numbers — slugs need no allocation.
2. Write `docs/gotchas/<slug>.json`:
   - `title`, `owner`, `created` (today, absolute date), `scope` (git-**tracked** paths this applies
     to; a trailing `/` means directory prefix)
   - **exactly one** of:
     - `verify` — a declarative check: `path_exists`, `file_matches`, `file_not_matches`, or
       `json_equals`. Prefer this whenever the fact is machine-checkable.
     - `expires` — an ISO review date, when it is not.
   - optional `see_also`: slugs of related entries (each must exist)
3. Write `docs/gotchas/<slug>.md` — the prose. Say what was observed, where, and what to do instead.
   Include the evidence that made you believe it.
4. Run `node scripts/gotcha-check.js` and fix anything it reports.
5. Show the user both files and ask before committing.

## Do NOT

- Do not write a shell command into `verify`. Only the four declarative types; the validator never
  executes strings from entry files.
- Do not scope to untracked paths (`.husky/`, `node_modules/`, build output) — the check uses
  `git ls-files` and will fail on every fresh clone.
- Do not summarise an entry anywhere. Discovery surfaces entries, never paraphrases; a summary layer
  drifts and looks authoritative while doing it.
