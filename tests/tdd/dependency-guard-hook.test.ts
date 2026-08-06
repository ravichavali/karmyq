// tests/tdd/dependency-guard-hook.test.ts
//
// Guards scripts/dependency-guard-hook.js — the PreToolUse hook that blocks lockfile-churning npm
// commands (CLAUDE.md -> Global Patterns / Workspace dependencies).
//
// This test exists because a gate proven only by "it blocked the bad thing" is exactly the
// false-green failure the sprint-122 methodology review names: the first version of this hook
// matched its own commit message, and the second misaligned segment indices when `&&` appeared
// inside quotes. Both directions are asserted here — it must block, AND it must not false-fire.

import { execFileSync } from 'child_process'
import * as path from 'path'

const HOOK = path.join(__dirname, '..', '..', 'scripts', 'dependency-guard-hook.js')
const BLOCK_EXIT = 2

/** Runs the hook exactly as Claude Code does: tool_input JSON on stdin. Returns the exit code. */
function runHook(command: string): number {
  try {
    execFileSync('node', [HOOK, 'pre'], {
      input: JSON.stringify({ tool_input: { command } }),
      stdio: ['pipe', 'pipe', 'pipe'],
    })
    return 0
  } catch (e) {
    return (e as { status: number }).status
  }
}

describe('dependency guard hook — blocks lockfile churn', () => {
  const blocked: Array<[string, string]> = [
    ['workspace install rewrites exact pins', 'npm install --workspace=apps/frontend'],
    ['short -w form', 'npm i lodash -w packages/shared'],
    ['--workspaces plural', 'npm install --workspaces'],
    ['dedupe churns unrelated packages', 'npm dedupe'],
    ['dedupe after a cd', 'cd /x && npm dedupe'],
    ['lockfile deletion forces a scratch regen', 'rm package-lock.json && npm install'],
    ['quoted lockfile filename still detected', 'rm -f "package-lock.json"'],
    ['quoted workspace value still detected', 'npm install --workspace="apps/frontend"'],
  ]

  it.each(blocked)('blocks: %s', (_label, command) => {
    expect(runHook(command)).toBe(BLOCK_EXIT)
  })
})

describe('dependency guard hook — does not false-fire', () => {
  const allowed: Array<[string, string]> = [
    ['npm run with --workspace is legitimate', 'npm run build --workspace=apps/frontend'],
    ['npm run across workspaces is legitimate', 'npm run test --workspaces'],
    ['strict install', 'npm ci'],
    ['plain root install', 'npm install'],
    ['test run', 'npm test'],
    ['read-only tree query', 'npm ls react'],
    ['prose in an echo', 'echo "do not run npm dedupe"'],
    ['prose in a commit message flag', 'git commit -m "note: avoid npm install --workspace"'],
    ['separator inside a quoted string', `node -e "console.log('npm dedupe && npm install --workspace')"`],
    [
      'commit message heredoc describing the blocked commands',
      "git commit -F - <<'EOF'\nfix: guard\n  npm install --workspace and npm dedupe are blocked\n  rm package-lock.json too\nEOF",
    ],
  ]

  it.each(allowed)('allows: %s', (_label, command) => {
    expect(runHook(command)).toBe(0)
  })
})
