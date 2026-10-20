# Sprint 134 PR D — `verify:demo` Reads `.env.demo` Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** `npm --workspace @karmyq/simulation-service run verify:demo` loads `DEMO_ENV_FILE ?? '.env.demo'` itself, so an operator
no longer exports the four story IDs by hand. Variables already in the environment win.

**Architecture:** A small injected-dependency loader, `loadDemoEnvFile`, is called once at the top of the CLI `main()` in
`verifyDemoData.ts`. `readEnv()` is unchanged and still reads `process.env` only, so the reset/rotate flows that share it are
unaffected.

**Tech Stack:** the canonical stack in `CLAUDE.md` → *System Architecture*.

**Spec:** `docs/superpowers/specs/2026-10-20-sprint-134-dated-obligations-design.md` → *PR D*.
**Branch:** `agent/claude/sprint-134-pr-d-verify-demo-env`, cut from `origin/master` when it is this PR's turn to merge.

---

## File Map

### New files to create
| File | Responsibility |
|------|---------------|
| `services/simulation-service/src/scripts/demoEnvFile.ts` | `loadDemoEnvFile(deps)`: resolve the path, apply it without overriding, and report which file loaded |
| `services/simulation-service/tests/tdd/sprint-134-demo-env-file.test.ts` | Unit tests (TDD) against real temp files |

### Existing files to modify
| File | Change |
|------|--------|
| `services/simulation-service/src/scripts/verifyDemoData.ts` | `main()` (`:233`) calls the loader first; the file header documents it |
| `docs/guides/demo-data.md` | Operator section: `verify:demo` reads `.env.demo`; the story-ID list at `:122` no longer needs a manual export |
| `services/simulation-service/CONTEXT.md` | `verify:demo` env contract |
| `package.json` | Version bump at merge time |

---

## ⚠️ Critical Implementation Notes (read before Task 2)

1. **`dotenv` 17 is already declared** (`services/simulation-service/package.json`: `"dotenv": "^17.4.2"`). Call
   `dotenv.config({ path, override: false, quiet: true })`. `quiet: true` is mandatory (gotcha
   `docs/gotchas/dotenv-config-must-pass-quiet.md`); `override: false` is the default, but state it explicitly because it is
   the contract.
2. **Load in `main()`, not in `readEnv()`.** `readEnv()` (`:45-70`) is shared with the reset/rotate flows
   (`rotateMariaStories.ts:105`), which create their own story IDs.
3. **Path:** `process.env.DEMO_ENV_FILE ?? '.env.demo'`, resolved against `process.cwd()`. That is the same expression as
   `rotateMariaStories.ts:120`, so both read and write the same file. Do not invent a second default.
4. **Missing file:** a missing default is not an error; the CLI falls back to the environment, as today. A missing **explicit**
   `DEMO_ENV_FILE` is reported through the existing unavailable path (`{ ready: false, unavailable: true, reason }`). Do not change
   that path's exit-code behaviour in this PR.
5. **Never print values.** The report may name the loaded path and the keys that came from the file; never their values
   (`DEMO_PERSONA_PASSWORD` lives there).
6. **The file is written by `configPublisher.ts`** as plain `KEY=value` lines (`replaceEnvLines`). Memory warns about CRLF and quoting
   on the demo host: the test must cover a CRLF file and a quoted value, and assert that dotenv parses both to the bare value.

---

## Task D1: Branch + failing tests (TDD)

**Files:**
- Create: `services/simulation-service/tests/tdd/sprint-134-demo-env-file.test.ts`

- [ ] `git fetch origin && git switch -c agent/claude/sprint-134-pr-d-verify-demo-env origin/master`
- [ ] Tests run against **real temp files** (`fs.mkdtempSync(os.tmpdir())`) with an env object passed in, not the real
  `process.env`. Assert exact values:
  1. A file with all four story IDs and an empty env → all four applied; `result.loadedFrom` equals the absolute path.
  2. The env already has `DEMO_ORDINARY_REQUEST_ID=from-env` → it stays `from-env`; the other three come from the file.
  3. No `DEMO_ENV_FILE` and no `.env.demo` in cwd → `{ loadedFrom: null }`, env unchanged, no throw.
  4. `DEMO_ENV_FILE` names a missing file → throws `verify:demo unavailable — DEMO_ENV_FILE not found: <path>`.
  5. A CRLF file and a `KEY="quoted"` value → bare values, with no `\r`.
  6. Nothing the loader returns or logs contains a value from the file (spy on `console.*`).
- [ ] Run and confirm it fails (module missing):

```bash
cd services/simulation-service && npx jest tests/tdd/sprint-134-demo-env-file.test.ts
```

## Task D2: The loader

**Files:**
- Create: `services/simulation-service/src/scripts/demoEnvFile.ts`

- [ ] `export function loadDemoEnvFile(env: NodeJS.ProcessEnv = process.env, cwd = process.cwd()): { loadedFrom: string | null; keys: string[] }`.
  Resolve the path from Note 3; if it is absent and was the default, return `{ loadedFrom: null, keys: [] }`; if it is absent and
  explicit, throw (Note 4). Otherwise `dotenv.config({ path, override: false, quiet: true, processEnv: env })`. dotenv 17 supports
  `processEnv`; **confirm it in `node_modules/dotenv/lib/main.d.ts` before relying on it** (a changelog is a hypothesis). Return the
  parsed keys only.
- [ ] Tests from D1 green.

## Task D3: Wire into `main()`

**Files:**
- Modify: `services/simulation-service/src/scripts/verifyDemoData.ts:233-241`, header comment `:1-13`

- [ ] Call `loadDemoEnvFile()` inside the existing `try` before `readEnv()`, so a throw lands in the unavailable report. Add
  `envFile: loadedFrom` to the printed JSON report (path only).
- [ ] Header: document the env-file contract in one sentence.
- [ ] `cd services/simulation-service && npx tsc --noEmit && npm test`

## Task D4: Docs

- [ ] `docs/guides/demo-data.md`: the operator steps around `:122` say `verify:demo` reads `.env.demo` (or `DEMO_ENV_FILE`) and that
  values already exported win. Remove any manual-export instruction for the story IDs.
- [ ] `services/simulation-service/CONTEXT.md`: the `verify:demo` env contract. No gotcha entry (maintainer, 2026-10-19). No registry change.

## Task D5: CONTEXT/registry check

- [ ] `npm run feedback:check`; read the diff against `origin/master...` by hand (feedback:check is false-green on a committed branch).

## Task D6: SDLC quality gates

- [ ] `/simplify`: one pass. Verification: noted in PR body.
- [ ] `/code-review` at **medium**. Verification: no open correctness finding.
- [ ] `/security-review`: secrets never printed; path handling (an operator-supplied path is fine; no traversal concern beyond that).
  Verification: written result.

## Task D7: Final verification + PR

- [ ] Root `npm test`; `npm test --workspace=tests`; revert landing-docs churn; restore unrelated files the TDD promoter moved.
- [ ] Version re-derived from `origin/master`; push; open the PR.

## Task D8: Merge + deploy (maintainer-authorized)

- [ ] Handoff landed first; "admin merge, yes/no?"
- [ ] **Human validation** (maintainer, on the demo host; a demo-host operation, so Claude asks before running it): with **no** story IDs
  exported, `npm --workspace @karmyq/simulation-service run verify:demo` reports `envFile: <path>` and `ready: true`. With one ID
  exported to a wrong value, the report fails on that ID, which proves the environment wins.
