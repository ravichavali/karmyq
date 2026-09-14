# Four traps when a script has to run on the demo host

All four were hit in one sitting on 2026-09-12 wiring `rotate:demo-stories` so it could actually be
run (Sprint 129, BUG-039). Each fails *quietly* — a misresolved path, an unset variable, or a
container recreated without its production overrides all look like success until something
downstream is wrong.

## 1. `npm --workspace` sets cwd to the workspace, not the repo root

```bash
npm --workspace @karmyq/simulation-service run rotate:demo-stories
```

runs with cwd `services/simulation-service/`. A relative path handed to it through an environment
variable — `DEMO_ENABLE_CMD="bash scripts/demo/enable-demo.sh"` — therefore resolves to
`services/simulation-service/scripts/demo/enable-demo.sh` and is not found.

Use absolute paths in those variables, **and** have the scripts re-anchor themselves so cwd stops
mattering:

```bash
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR/../.."
```

## 2. A shell-sourced env file is not a compose env file

`.env.demo.rotation` is read with `set -a; . ./.env.demo.rotation; set +a`. Under those rules an
unquoted value containing spaces is not an assignment — it is a command:

```bash
DEMO_ENABLE_CMD=bash scripts/demo/enable-demo.sh   # RUNS the script with DEMO_ENABLE_CMD=bash
DEMO_ENABLE_CMD="bash scripts/demo/enable-demo.sh" # assigns, as intended
```

Keep secrets out of any file compose reads. `.env.demo` is injected into **every** service
container, so `DEMO_PERSONA_PASSWORD` lives in a separate, chmod-600, untracked file.

## 3. CRLF breaks a sourced file on every line

A file written on Windows fails as `$'\r': command not found` once per line, and silently appends
`\r` to values that do parse. Python's `io.open(p, 'w')` on Windows introduces it, and so does a
heredoc that eats a backslash. `.gitattributes` now pins `.env*` to LF for this reason — the rule is
load-bearing, not cosmetic, because no extension rule matched `.env*` before.

⚠️ **`grep -q $'\r' file` is not a reliable check.** It reported a file clean that contained 59 CR
bytes. Count bytes instead:

```bash
python -c "import io,sys; print(io.open(sys.argv[1],'rb').read().count(b'\r'))" path
```

## 4. Compose reads the process environment, across two files

There is no `.env` on the demo host. `scripts/deploy.sh` does `set -a; source .env.demo` and the
compose files interpolate `${VAR}` from the exported environment. It also passes **two** files —
the base plus `docker-compose.prod.yml`.

So a script that recreates a container must reproduce both, or it will:

- interpolate **empty** values (deploying, for example, an auth-service with the demo silently
  disabled), if it forgets to source first; or
- drop every production override, if it passes only the base compose file.

Assert the critical variables are non-empty after sourcing and refuse rather than deploy a silently
misconfigured service. And note that a plain `docker restart` re-runs the container with its
*original* environment — recreating (`up -d --force-recreate`) is what picks up republished values.
