# next build type-checks the whole tsconfig program with plain tsc since next 16.3

**Observed:** Sprint 131 D7 (#246, next 15.5.24 → 16.3.6). `apps/landing`'s build failed with
*"Failed to type check"*: TS2802 in `tests/regression/sprint-95-routes.test.ts` and TS2540 in
`tests/submitFoundingCircle.test.ts`, both under landing's `target: es5`.

**Why:** next 16 defaults `useTypeScriptCli: true` (`dist/server/config-shared.js`). `next build`
then runs `tsc --project <tsconfig> --noEmit` (`dist/lib/typescript/runTypeCheckCli.js`). next 15's
API checker dropped diagnostics from `**/__tests__/**` and `*.(spec|test).*`
(`dist/lib/typescript/runTypeCheck.js`), but the CLI path never reaches that filter. So every file
the tsconfig's program contains is now checked, and test files included.

**What to do:** exclude test directories in each app's `tsconfig.json`. `apps/landing` and
`apps/frontend` both exclude `tests/**`. Remember that `exclude` filters only the **root** names: a
test file that source code imports still enters the program and still gets checked.

**Machine check:** `tests/regression/next16-typecheck-scope.test.ts` in each app. It builds
TypeScript's whole program (`createProgram(...).getSourceFiles()`), not `parsed.fileNames`, and
fails if any test file or anything under `tests/` is in it. Swapping in the root names lets an
imported test file pass. That was proven by mutation, which is why the test must not be
"simplified" back to root names.
