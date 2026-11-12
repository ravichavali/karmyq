import { spawnSync } from 'child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { ROOT, scratchDirs } from './helpers/workspaces';

// Exercise the configured command with the documented Claude Code stdin contract.
// stderr-only output, an environment-only input, or broken settings wiring makes this fail.
const dirs = scratchDirs();
afterAll(dirs.cleanup);
const settings = JSON.parse(readFileSync(join(ROOT, '.claude/settings.json'), 'utf8'));
const commands = settings.hooks.PreToolUse.find((h: { matcher: string }) => h.matcher === 'Edit|Write').hooks;
const reminder = commands[1].command;

it('wires the reminder to the reviewed Node script', () => {
  expect(reminder).toBe('node scripts/service-context-hook.js');
});

function invoke(file_path: unknown, hasReadme = true, raw?: string) {
  const cwd = dirs.make('karmyq-context-hook-');
  if (hasReadme) {
    mkdirSync(join(cwd, 'services/example/.claude'), { recursive: true });
    writeFileSync(join(cwd, 'services/example/.claude/README.md'), 'context');
  }
  // The existing hooks use repo-relative commands. Supply their scripts at the fixture root.
  mkdirSync(join(cwd, 'scripts'));
  writeFileSync(join(cwd, 'scripts/service-context-hook.js'), readFileSync(join(ROOT, 'scripts/service-context-hook.js')));
  const r = spawnSync(process.execPath, [join(cwd, 'scripts/service-context-hook.js')], {
    cwd, input: raw ?? JSON.stringify({ cwd, tool_name: 'Edit', tool_input: { file_path } }),
    encoding: 'utf8', env: { ...process.env, CLAUDE_TOOL_INPUT_FILE_PATH: '' },
  });
  if (r.error) throw r.error;
  return r;
}

it.each(['services/example/src/logic.ts', 'C:\\repo\\services\\example\\src\\logic.ts'])('injects model-visible context for %s', (p) => {
  const r = invoke(p);
  expect(r.status).toBe(0);
  expect(r.stderr).toBe('');
  expect(r.stdout).not.toBe('');
  const output = JSON.parse(r.stdout);
  expect(output.hookSpecificOutput.hookEventName).toBe('PreToolUse');
  expect(output.hookSpecificOutput.additionalContext).toContain('services/example/.claude/README.md');
  expect(output.hookSpecificOutput.permissionDecision).toBeUndefined();
});

it.each(['apps/frontend/src/page.tsx', 'services/missing/src/logic.ts', null, 12])('stays silent for irrelevant/missing paths: %s', (p) => {
  const r = invoke(p);
  expect(r.status).toBe(0);
  expect(r.stdout + r.stderr).toBe('');
});

it.each(['', 'not json', '{"tool_input":', 'null'])('exits quietly on unusable stdin %j', (raw) => {
  const r = invoke('services/example/src/logic.ts', true, raw);
  expect(r.status).toBe(0);
  expect(r.stdout + r.stderr).toBe('');
});
