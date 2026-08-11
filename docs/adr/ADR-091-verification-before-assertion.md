# ADR-091: Verification Before Assertion — the Sprint 122 review-loop retrospective

**Status**: Implemented
**Date**: 2026-08-05
**Sprint**: 122 (epilogue)

---

## Context

At the end of Sprint 122's PR 4, the maintainer flagged that **the correction cycles were too expensive** and asked for the review loop to be examined once the sprint closed, with data rather than impressions. This ADR is that review.

Sprint 122 was a six-PR dependency wave (jest 30, redis 6 + Node 24 floor, zustand 5, and consolidated safe groups). All six shipped and are live. The question is not whether the work landed; it is why it cost what it did.

### The data

| PR | Review rounds | CI rounds | Implementation defects | Notes |
|---|---:|---:|---:|---|
| 4 (jest 30) | ~5 | 2 | — | Every finding legitimate; ~3 rounds traceable to one wrong mechanism claim |
| 5 (redis 6 + Node 24) | 2 | 0 | 0 | CI green on the first run and every run after — **all five findings came from human review** |
| 6 (zustand 5) | ~2 | 1 | 0 | Cheapest PR of the sprint; produced its most serious finding |

**PR 5's five findings, classified:**

| # | Finding | Class |
|---|---|---|
| 1 | `redisSubscriber` had no `error` listener — `duplicate()` copies options, not EventEmitter registrations, and an unhandled `'error'` throws | untraced mechanism |
| 2 | `FROM` parser matched only column-zero uppercase, so `FROM --platform=… node:18-alpine` evaded the gate while it stayed green | assertion weaker than claimed |
| 3 | Attributed `subscribe()` rejections to the new 5s command timeout — false; pub/sub goes through `#addPubSubCommand`, which hardcodes `timeout: undefined` | untraced mechanism |
| 4 | Parser read physical lines, not logical instructions — a line-continued `FROM` false-failed | untraced mechanism |
| 5 | Comment named `--chmod` as a `FROM` option; it is `COPY`/`ADD` | untraced mechanism |

**Four of five were assertions about how something works that had not been traced to source** — not logic errors. `/simplify`, `/security-review`, a 26-case injection sweep and 21 CI checks were all green while every one of them was present, because none of those instruments reads a claim and asks whether it is true.

### The finding that reframed the sprint

PR 6's cross-agent verification pass found that the **ADR-060 code-scanning gate had never gated a pull request**. It queried `refs/pull/N/merge` while CodeQL publishes to `refs/pull/N/head`, so it fail-opened by construction on every PR — for roughly 46 sprints, reporting green each time. (Fixed in this same release; see [ADR-060 §6](ADR-060-code-scanning-gate.md).)

Notably, PR 5's *own* diagnosis of that gate — "a rescan race" — was itself an untraced mechanism claim that survived into the handoff. It was wrong, and reading `ci.yml:126` settled it in one look. **The failure mode reaches our post-mortems, not just our code.**

### The pattern

Three instruments this sprint reported success while inert or weaker than claimed: the `FROM` parser (evadable), the injection sweep (a string replacement matching nothing is a silent no-op), and ADR-060 (never fires). The common cause is not buggy gates. It is that **we verify gates by watching them pass, which is precisely the observation that cannot distinguish working from inert.**

An independent `/insights` analysis of 27 sessions over the same period converged on the same top friction from the opposite direction: unverified claims about the codebase, caught in maintainer review rounds rather than before them.

---

## Decision

**Do not conclude "fewer reviews".** The reviews caught real defects every round, and PR 6 shows the loop getting cheaper *and* finding more. The target is moving the same findings earlier and making each round cheaper — not removing the loop.

Four rules, each now enforced somewhere other than memory:

### 1. A mechanism claim ships with its reproducer

Any assertion about how something works — a dependency's behavior, an API's shape, a gate's effect — ships in the same commit as the command, source trace, or focused test that demonstrates it. If it cannot be measured, it is written as a hypothesis and labelled one.

This rule alone would have caught PR 4's headline failure and four of PR 5's five findings. In every case the answer was two functions further into a file already open.

*Enforced by:* `CLAUDE.md` Discipline 5 ("Verify before you assert"), mirrored in `AGENTS.md`.

### 2. A gate must be proven able to fail

A check is not trusted until it has been demonstrated going **red** on a seeded violation, and that demonstration belongs in a committed test rather than a one-off manual run. Corollaries:

- A gate that compares against a hand-written shadow map instead of the live arbiter is false-green by construction.
- An injection whose search text is absent is a silent no-op; injections must fail loudly when they match nothing.

*Enforced by:* `CLAUDE.md` Discipline 5; `tests/regression/sprint-122-adr-060-code-scanning-gate.test.ts` and `tests/regression/dependency-guard-hook.test.ts` are the worked examples — both assert the blocking direction, not just the passing one.

Both live in `regression/`, deliberately. Review of this very PR caught the guard test sitting in the root `tests/tdd/` tier: that tier never blocks a push, and `scripts/promote-tdd-tests.js` only walks `services/*` and `apps/*`, so it would never have been promoted either. **A rule "enforced" by a non-blocking test is not enforced** — the same class of gap this ADR is about, found in the ADR's own evidence.

### 3. Push early for CI signal; write durable docs after

ADR-089, its guide, `CONTEXT.md` and the handoff were all authored while CI had never run; CI then found two real defects and invalidated part of what was written. A draft PR costs nothing and surfaces those defects before the prose exists.

### 4. Reference state, don't duplicate it

The handoff went stale in four distinct ways during PR 4, including carrying its own commit SHA — structurally impossible, since the file ships inside the commit. Name the branch and let the reader run `git rev-parse HEAD` / `gh pr checks`.

*Enforced by:* `CLAUDE.md` Session Workflow — the handoff is reconciled against `gh pr list` / `git log` before any completion claim, and a stale handoff is a blocking defect.

### Supporting practices retained

- **Non-author review is where these surface.** PR 5's five findings and PR 6's gate finding all came from a reader who had not written the thing. Keep cross-agent review in the loop.
- **Smoke tests must hit real routes.** PR 5's smoke test found four wrong REST endpoints in a Critical service's `CONTEXT.md` that no test, gate or review had caught — because nothing else calls a real path. `/health` is not a smoke test.
- **Local green cannot prove CI green.** A stale `packages/shared/dist` made a full local cycle pass on a build CI rejects. Delete build artifacts and re-run the CI commands before pushing.

---

## Alternatives Considered

1. **Reduce review rounds directly** (fewer gates, lighter review). Rejected — every finding across PRs 4–6 was legitimate. Removing rounds removes detection, not cost.
2. **Add more gates.** Rejected as the primary answer: three of this sprint's gates were themselves green-while-inert. Gate *quality* — provable failure — is the lever, not gate count.
3. **Leave the rules in the handoff.** Rejected: the handoff is archived at sprint end. Rules that must outlive a sprint belong in `CLAUDE.md` and an ADR.

---

## Consequences

**Positive**
- The dominant defect class of the sprint (untraced assertions, four of PR 5's five) now has a rule aimed directly at it, in the file every session loads first.
- Two gates now carry proof they can fail; the pattern is reusable for the next one.
- The review loop is preserved rather than trimmed — PR 6's numbers (~2 review rounds, 1 CI round, 0 implementation defects) are the target shape.

**Negative / trade-offs**
- Verifying every claim before writing it makes planning slower up front. Accepted: PR 4 spent ~5 review rounds on defects that verification would have caught in one, and each round costs a full context reload.
- "Prove the gate can fail" adds a test per gate. Accepted for the same reason — the alternative is ADR-060, which cost 46 sprints of false assurance.

**Open**
- Whether these rules actually move the numbers is unmeasured. The next dependency-shaped PR should record its review-round and defect-class counts against PR 4–6's baseline.

---

## Related

- [ADR-060: Code Scanning Gate](ADR-060-code-scanning-gate.md) — §6 documents the inert-gate defect that reframed this review.
- [ADR-029: TDD Test Framework](ADR-029-tdd-test-framework.md) — the tier system these gates live in.
- [ADR-059: Dependency Security Gate](ADR-059-dependency-security-gate.md) — the sibling gate whose fail-closed design held up.
