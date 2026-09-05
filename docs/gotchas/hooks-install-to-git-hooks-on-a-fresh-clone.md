`git config core.hooksPath` is **empty on a fresh clone**, and that is correct. The installer reads
it and falls back to `.git/hooks`. It prints `.husky` only on a machine where husky previously ran
— and `.npmrc` sets `ignore-scripts=true`, so husky's `prepare` never runs on a new clone.

Verify at whichever path git actually resolves, not at a hardcoded one:

    HOOKS_DIR=$(git config --get core.hooksPath); [ -z "$HOOKS_DIR" ] && HOOKS_DIR=.git/hooks
    ls -l "$HOOKS_DIR/pre-push"

On macOS and Linux the installed hooks are **symlinks** (`lrwxr-xr-x`) by design; copies only on
Windows, where symlinks need privilege and silently dangle.

The real proof is at runtime: a push must print `🚀 Running pre-push checks...`. A push that
finishes silently and instantly means no hook ran.
