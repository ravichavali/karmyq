# [Sprint / PR name] — Handoff

**Date**: YYYY-MM-DD
**Outcome**: in progress | blocked | merged, deploy pending | shipped

> The handoff carries **state between sessions**. It is not a copy of the plan — link the plan
> and name the next unchecked task instead. It is branch-local, so it can reserve nothing; see
> `CLAUDE.md` → *Parallel Development* for how contended resources are actually allocated.

---

## Ownership and base

| Field | Value |
|---|---|
| **Branch** | `agent/<owner>/<slug>` |
| **Base** | `origin/master` at `<sha>` (fetched YYYY-MM-DD) |
| **Active editor** | who is writing right now — exactly one |
| **Reviewer role** | who reviews; a non-author. Reviewers read the diff, they do not co-edit |
| **Owned paths** | the paths this branch may change |
| **Shared resources needed** | ADR number / version bump / dependency lane / demo data op / merge slot — each needs its own maintainer authorization; none is reserved by writing it here |

## Links

- **Spec**: `docs/superpowers/specs/<file>.md`
- **Plan**: `docs/superpowers/plans/<file>.md`
- **PR**: #NNN (link)

## Next action

**Next unchecked task**: Task N — [one line, with the file path to start from]

Anyone should be able to read only this file and start, with no machine-local memory.

## Blockers and decisions

- **Blocker**: [what is stopping progress, and who unblocks it]
- **Decision**: [what was decided and **why**, so the next session does not re-debate it]

## Verification references

Cite evidence, not impressions — a command and its result, a run link, or a dated observation.

- `npm test` → exit 0, N unit / N regression (YYYY-MM-DD)
- CI run: [link] — observed <status> on YYYY-MM-DD
- Deploy verified: run link + health probe result

⚠️ **GitHub status goes stale.** Record it as a link or a dated observation, never as a standing
fact. Re-derive PR and deploy state with `gh pr view <N>` and `git log origin/master` before
trusting anything written here — a handoff saying "awaiting merge" for an already-merged PR is a
blocking defect.

⚠️ **Never record this document's own final commit SHA** — it cannot know it.
