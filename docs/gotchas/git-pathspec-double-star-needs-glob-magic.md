A gate that enumerates service source with `git ls-files 'services/*/src/**/*.ts'` scans **fewer
files than it claims**, and the files it drops are exactly the ones a mount-order or middleware
check needs.

Measured in this repo on 2026-09-22:

| Pathspec | Files | `src/index.ts` matched |
|---|---|---|
| `services/*/src/**/*.ts` | 184 | **0** |
| `:(glob)services/*/src/**/*.ts` | 200 | 9 |

Without pathspec magic git matches with wildmatch and **no** `WM_PATHNAME`, so `*` happily crosses
`/` and `**` carries no special meaning — it is just another `*`. The literal slash between `**`
and `*.ts` therefore still has to appear in the path, which means the pattern requires *at least
one directory under `src/`*. `services/auth-service/src/routes/login.ts` matches;
`services/auth-service/src/index.ts` cannot. Adding `:(glob)` switches to strict wildmatch, where
`**/` is special-cased to mean "zero or more directories", and the entrypoints come back.

This is repo-wide and silent. Nothing errors, no pattern looks wrong, and the scan returns a large
plausible number — 184 of 200 is 92% of the files, which reads like success. The 16 it drops are
every service entrypoint plus the handful of other direct children of `src/`, and
`services/*/src/index.ts` is where `app.use(...)` mounts live. A placement or ordering gate built
on that pathspec is blind to the exact file whose contents decide the answer.

Observed in Sprint 131: the BUG-049 middleware-placement check used this shape and reported a clean
result while never having read a single `index.ts`. Recorded in ADR-098 §3 alongside three sibling
defects from the same PR, all of the form "the discovery was narrower than the claim built on it".

**What to do instead**

- Prefer `:(glob)` explicitly whenever a pathspec contains `**`.
- Better, avoid the subtlety: list broadly and filter in code —
  `git ls-files services | filter(/\.ts$/)` — where the predicate is readable and testable.
- Whichever you choose, **assert the scan is non-vacuous**: pin the expected count, or assert a
  known file is present. `tests/regression/sprint-131-workspace-declarations.test.ts` does this with
  its "no scan is vacuous" case. A discovery step that silently returns a subset will otherwise pass
  every downstream assertion.

⚠️ Do not record this as "always count the files". Counting is how you *detect* it; the cause is the
pathspec's matching mode, and the fix belongs at the pattern.
