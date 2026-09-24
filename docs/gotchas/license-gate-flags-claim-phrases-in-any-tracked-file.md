# The license gate matches claim *phrases*, not just license names, in every tracked file

`tests/regression/sprint-123-license-consistency-gate.test.ts` runs `git grep -lIE` over **every
tracked text file** for its `CLAIM_VOCABULARY` (`:146`).

That vocabulary is wider than license names. Alongside `MIT`, `AGPL`, `GPL` and `Apache-2.0`, it
matches ordinary English phrases:

- "Internal use only"
- "Proprietary"
- "All rights reserved"
- "closed source"

The phrases are there for a reason. A real license claim in `services/simulation-service/README.md` once
read "Internal use only", and no search for license names found it.

A match fails the gate unless the file is one of these:

- an enumerated claim site;
- listed in `CLAIM_SCAN_ALLOWLIST` (`:117`);
- listed in `NOT_OUR_CLAIM`.

The gate runs in the pre-push hook, where it blocks the push, and again in CI.

## How it bites

On 2026-09-23 (Sprint 131 D4), BUG-052 in `docs/BUGS.md` quoted the landing page's truncated description
of `POST /notifications/push/send`. That description contains the phrase "Internal use only". It
describes the endpoint's visibility, not a license, but the phrase still matched. The pre-push hook
rejected the push:

```
FAIL regression/sprint-123-license-consistency-gate.test.ts
  ● … › every file mentioning a license token is either an enumerated site or allowlisted
    + Array [
    +   "docs/BUGS.md",
    + ]
```

## What to do instead

- **Paraphrase.** Describe the text instead of quoting a vocabulary phrase. For example: "the description
  stops mid-sentence at '…authenticated by the'".
- **Don't allowlist a whole file** such as `docs/BUGS.md` or `docs/IDEAS.md` to get past it. The allowlist
  works per path, so doing that blinds the gate for everything anyone ever writes in that file.
  - Each existing entry is deliberate and carries its reason. For example, `services/notification-service/CONTEXT.md`
    and `src/routes/push.ts` use "Internal use only" to describe endpoint visibility.
  - If a new path genuinely needs such a phrase, add it to `CLAIM_SCAN_ALLOWLIST` with a comment saying why,
    in the same PR.
- **Run the gate directly before pushing a docs change that mentions licensing or visibility:**

  ```bash
  npm exec --workspace=tests -- jest --runTestsByPath regression/sprint-123-license-consistency-gate.test.ts --runInBand
  ```

Quoting is fine in the paths `CLAIM_SCAN_ALLOWLIST` already exempts, including `docs/archive/`,
`docs/superpowers/`, `.claude/handoff/` and the generated `apps/landing/src/data/docs/`. Read the list at
`:117` rather than trusting this sentence; it changes when the gate does.
