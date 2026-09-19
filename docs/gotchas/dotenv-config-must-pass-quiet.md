# dotenv 17 logs on every `config()` call — pass `quiet: true`

`dotenv.config()` with no options is **silent on 16 and noisy on 17**. Every call site in this repo
passes `{ quiet: true }` for that reason, and it is not cosmetic.

## What changed

dotenv **16.6.1** computed the flag so that omitting it meant silence:

```js
const quiet = options && 'quiet' in options ? options.quiet : true
```

dotenv **17.4.2** computes it so that omitting it means *logging*:

```js
let quiet = parseBoolean(processEnv.DOTENV_CONFIG_QUIET || (options && options.quiet))
// parseBoolean(undefined) -> Boolean(undefined) -> false
...
if (debug || !quiet) {
  _log(`injected env (${keysCount}) from ${shortPaths.join(',')} ${dim(`// tip: ${_getRandomTip()}`)}`)
}
```

Measured directly against both installed versions with the same `.env`, not read from a changelog:

```
17.4.2 → ◇ injected env (1) from .env // tip: ◈ secrets for agents [www.dotenvx.com]
16.6.1 → (no output)
```

`_getRandomTip()` draws from an 8-entry array that includes third-party promotional URLs
(`dotenvx.com`, `vestauth.com`). So a bare `config()` makes **every backend container print a
non-deterministic marketing line on each boot**, and any log assertion or diff over startup output
becomes flaky.

## What to do

Pass the flag at the call site:

```ts
dotenv.config({ quiet: true });
// or, destructured, alongside whatever options you already pass:
config({ path: envPath, quiet: true });
```

Prefer this over the `DOTENV_CONFIG_QUIET` environment variable. The env var works, but it lives
outside the code, has to be set in every compose file, Dockerfile and CI job, and silently stops
applying the moment one of them is missed.

## What enforces it

`tests/regression/sprint-131-dotenv-quiet.test.ts` (blocking). It discovers the call sites from
tracked source with a TypeScript AST walk rather than a hardcoded list, resolves both
`dotenv.config(...)` and a destructured `config(...)` imported from `dotenv`, and fails on any call
that omits `quiet`. A `config()` imported from somewhere else is ignored.

That discovery earned its keep immediately: it caught two calls in `tests/setup.ts` that a
hand-written list of call sites had missed.

## Scope note

Eight services call it (`auth`, `cleanup`, `community`, `messaging`, `notification`, `reputation`,
`request`, `simulation`), plus four files under `tests/`. `social-graph-service` does not use dotenv,
and `geocoding-service` is plain JS and does not either — so neither appears in the gate's expected
set. If a new service starts using dotenv, the gate's discovery picks it up and its non-vacuity
assertion, which pins the service list by identity, will need updating along with it.
