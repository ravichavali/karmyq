#!/usr/bin/env bash
# Final task/PR check. Compare the branch base to the index; npm tests the working tree.
set -e

cd "$(git rev-parse --show-toplevel)"
check_tmp=$(mktemp -d)
trap 'rm -rf "$check_tmp"' EXIT

# Files, not process substitutions: a failed git command must stop the gate.
if ! branch_base=$(git merge-base origin/master HEAD 2> "$check_tmp/base-error"); then
  printf 'FAIL: Cannot find branch base with origin/master; fetch origin/master before verification.\n'
  exit 1
fi
git diff --cached --name-only --no-renames -z "$branch_base" > "$check_tmp/changed"
git diff --cached --name-only --diff-filter=ACMRT --no-renames -z "$branch_base" > "$check_tmp/staged"
git diff --cached --name-only --diff-filter=A --no-renames -z "$branch_base" > "$check_tmp/new"
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
    # Literal suffixes avoid treating filename punctuation as a regex. Read staged test bytes,
    # including earlier branch commits and new index entries, never untracked/worktree imports.
    if git grep --cached -lF -e "/$base'" -e "/$base\"" -- \
        '*.test.ts' '*.test.tsx' '*.spec.ts' '*.spec.tsx' > /dev/null; then
      found=1
    else
      search_status=$?
      if [[ "$search_status" != 1 ]]; then
        printf 'FAIL: Could not search indexed tests for %s (git grep exited %s).\n' "$file" "$search_status"
        exit 1
      fi
    fi
  fi
  if [[ "$found" == 0 ]]; then
    printf 'FAIL: No tracked matching test filename or module import for new source %s.\n' "$file"
    failed=1
  fi
done < "$check_tmp/new"

[[ "$failed" == 0 ]] || exit 1

# npm tests the working tree, which must equal what will be committed: no unstaged tracked edits
# and no untracked files (a test can pass by importing a file that is never committed).
dirty_tree() {
  git diff --name-only -z > "$check_tmp/unstaged" || { printf 'FAIL: git diff failed.\n'; exit 1; }
  git ls-files --others --exclude-standard -z > "$check_tmp/untracked" ||
    { printf 'FAIL: git ls-files failed.\n'; exit 1; }
  [[ -s "$check_tmp/unstaged" || -s "$check_tmp/untracked" ]]
}
list_dirty() {
  tr '\0' '\n' < "$check_tmp/unstaged" | sed 's/^/  modified: /' | head -10
  tr '\0' '\n' < "$check_tmp/untracked" | sed 's/^/  untracked: /' | head -10
}

if dirty_tree; then
  printf 'FAIL: Unstaged or untracked changes; stage or set aside changes before final verification.\n'
  list_dirty
  exit 1
fi

# The checks above read this index. Snapshot it so npm cannot stage changes past them unseen.
index_tree=$(git write-tree) || { printf 'FAIL: git write-tree failed.\n'; exit 1; }

# Never pipe npm: formatting commands must not replace the test exit status.
set +e
out=$(npm test 2>&1)
status=$?
set -e
if [[ "$status" != 0 ]]; then
  printf 'FAIL: npm test exited %s.\n' "$status"
  printf '%s\n' "$out" | awk '/FAIL|✕|failed|ERR!/ { if (n++ < 25) print }'
  printf '%s\n' "$out" | tail -15
  exit "$status"
fi

# A passing run that staged or rewrote files (e.g. regenerated landing docs) no longer tested what
# will be committed. Exit 0 means "commit now", so that churn must not pass silently. Report the
# index and the tree together, so one re-run fixes both.
after_tree=$(git write-tree) || { printf 'FAIL: git write-tree failed.\n'; exit 1; }
git diff --name-only -z "$index_tree" "$after_tree" > "$check_tmp/restaged" ||
  { printf 'FAIL: git diff failed.\n'; exit 1; }
if dirty_tree || [[ -s "$check_tmp/restaged" ]]; then
  printf 'FAIL: npm test passed but changed the index or working tree:\n'
  tr '\0' '\n' < "$check_tmp/restaged" | sed 's/^/  staged: /' | head -10
  list_dirty
  # Restore from the pre-npm snapshot, never HEAD: work staged before the run must survive.
  printf 'Undo only what npm changed, then re-run. Delete each untracked path; for each staged or modified path:\n'
  printf '  git restore --source=%s --staged --worktree -- <path>\n' "$index_tree"
  exit 1
fi
