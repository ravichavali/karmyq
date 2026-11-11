#!/usr/bin/env bash
# Final task/PR check. Metadata comes from the index; npm tests the working tree.
set -e

cd "$(git rev-parse --show-toplevel)"
check_tmp=$(mktemp -d)
trap 'rm -rf "$check_tmp"' EXIT

# Files, not process substitutions: a failed git command must stop the gate.
git diff --cached --name-only --no-renames -z > "$check_tmp/changed"
git diff --cached --name-only --diff-filter=ACMRT --no-renames -z > "$check_tmp/staged"
git diff --cached --name-only --diff-filter=A --no-renames -z > "$check_tmp/new"
git ls-files --cached -z > "$check_tmp/tracked"

staged=()
while IFS= read -r -d '' file; do staged+=("$file"); done < "$check_tmp/staged"
tests=()
while IFS= read -r -d '' file; do
  case "$file" in *.test.ts|*.spec.ts|*.test.tsx|*.spec.tsx) tests+=("${file##*/}");; esac
done < "$check_tmp/tracked"

failed=0
services=()
while IFS= read -r -d '' file; do
  if [[ "$file" =~ ^services/([^/]+)/src/ ]]; then
    service=${BASH_REMATCH[1]}
    seen=0
    for prior in "${services[@]}"; do [[ "$prior" != "$service" ]] || seen=1; done
    [[ "$seen" == 0 ]] || continue
    services+=("$service")
    context="services/$service/CONTEXT.md"
    found=0
    for candidate in "${staged[@]}"; do [[ "$candidate" != "$context" ]] || found=1; done
    if [[ "$found" == 0 ]]; then
      printf 'FAIL: Stage %s for changes under services/%s/src/.\n' "$context" "$service"
      failed=1
    fi
  fi
done < "$check_tmp/changed"

while IFS= read -r -d '' file; do
  [[ "$file" =~ ^services/[^/]+/src/.*\.tsx?$ ]] || continue
  name=${file##*/}
  case "$name" in *.test.ts|*.spec.ts|*.test.tsx|*.spec.tsx|*.d.ts|index.ts) continue;; esac
  base=${name%.*}
  found=0
  for candidate in "${tests[@]}"; do
    if [[ "$candidate" == "$base.test.ts" || "$candidate" == "$base.spec.ts" ||
          "$candidate" == "$base.test.tsx" || "$candidate" == "$base.spec.tsx" ]]; then
      found=1
      break
    fi
  done
  if [[ "$found" == 0 ]]; then
    printf 'FAIL: No tracked <base>.test|spec.ts(x) for new source %s.\n' "$file"
    failed=1
  fi
done < "$check_tmp/new"

[[ "$failed" == 0 ]] || exit 1

# Avoid testing unstaged contents while committing different bytes from the index.
if ! git diff --quiet; then
  printf 'FAIL: Unstaged tracked changes; stage or set aside changes before final verification.\n'
  exit 1
fi

# Never pipe npm: formatting commands must not replace the test exit status.
set +e
out=$(npm test 2>&1)
status=$?
set -e
if [[ "$status" != 0 ]]; then
  printf 'FAIL: npm test exited %s.\n' "$status"
  printf '%s\n' "$out" | awk '/FAIL|✕|failed|ERR!/ { if (n++ < 25) print }'
  printf '%s\n' "$out" | tail -15
fi
exit "$status"
