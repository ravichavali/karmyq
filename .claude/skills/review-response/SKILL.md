---
name: review-response
description: Respond to code-review or plan-review findings by verifying each one against the repo before fixing. Use when the user relays review feedback ("here are the review findings", "reviewer says…", "/review-response"), or after /code-review, /security-review, or an external agent review returns findings.
disable-model-invocation: false
---

# Review Response

Findings arrive from three places here: the SDLC gates (`/simplify`, `/code-review`,
`/security-review`), CI (audit, CodeQL, drift gate), and the maintainer relaying an external
agent's review. **All three are hypotheses, not facts** — including the maintainer's. Verifying
each one against the repo before touching code is the whole point of this skill; it is the step
that has historically caught wrong claims on both sides.

Superpowers `receiving-code-review` covers the general posture (no performative agreement). This
skill is the Karmyq-specific procedure. Create a todo per finding before starting.

---

## Per finding, in order

**1. Quote it verbatim.** Never paraphrase into your own reading of it first — paraphrase drift
is how a finding gets "fixed" without being addressed.

**2. Verify against the repo.** Open the actual file. Paste `file:line` evidence. Do not trust
the reviewer, your own memory, a changelog, or an upgrade guide — the manifest, `node_modules`,
and the compiler are the evidence. For a claim about behavior, run it.

**3. Classify out loud:** `CONFIRMED` / `FALSE POSITIVE` / `PARTIAL` — with the evidence line
that decides it. A `FALSE POSITIVE` needs written justification (it goes in the PR body; CodeQL
dismissals go under "Security dismissals").

**4. Fix minimally, if CONFIRMED.** The smallest diff that resolves the stated problem. No
opportunistic refactors, no `npm install --workspace`, no `npm dedupe`, no lockfile regen, no new
root dependency (see `CLAUDE.md` → Workspace dependencies). If the minimal fix is architectural,
stop and raise it rather than growing the diff.

**5. Re-verify against the SYMPTOM, not the diff.** "I changed padding" is not "the elements no
longer overlap." Prove the original complaint is gone:
- UI/layout → Playwright: measure both bounding boxes, assert no intersection.
- Dependency → `npm ls <pkg>` before/after; confirm nothing new landed in production deps and the
  image surface didn't grow.
- Behavior/logic → the failing test that would have caught it, now passing.
- Gate/check → prove it can still **fail** (inject a violation); a green gate that cannot fail is
  worse than no gate.

If you cannot demonstrate the symptom is gone, say so — do not report the fix as complete.

---

## After all findings

1. `npm test` (unit + regression). After deletes/renames, bust the Turbo cache or run the suite
   directly — `cd tests && npx jest regression/<file>`.
2. `npm run feedback:check` — work its to-do list for this diff.
3. Re-run whichever gate produced the findings.
4. **Reconcile `CURRENT_HANDOFF.md`** against `gh pr list` and `git log` — a handoff contradicting
   real PR state is a blocking defect.

**Final output — one table, no prose padding:**

| # | Finding | Verdict | Evidence (`file:line`) | Fix | Symptom proof |

Then state explicitly what you are **less than fully confident about**. Never self-authorize a
merge; stop at the maintainer's authorization gate.
