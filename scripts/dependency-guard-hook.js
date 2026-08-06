#!/usr/bin/env node
/**
 * Claude Code hook: keep dependency edits surgical.
 *
 * Modes (argv[2]):
 *   pre   PreToolUse/Bash  — BLOCKS commands that rewrite exact pins or churn the lockfile
 *                            (`npm install --workspace`, `npm dedupe`, deleting package-lock.json).
 *   post  PostToolUse/Bash — WARNS when package-lock.json churned beyond a surgical diff.
 *
 * See CLAUDE.md → "Global Patterns / Workspace dependencies". Exit 2 = block (stderr goes to Claude).
 */
const { execFileSync } = require('child_process');

const MODE = process.argv[2] === 'post' ? 'post' : 'pre';
const LOCKFILE_CHURN_LINES = 60;

/** Hook input arrives as JSON on stdin; fall back to the CLAUDE_TOOL_INPUT_* env vars. */
function readCommand() {
  let raw = '';
  try {
    raw = require('fs').readFileSync(0, 'utf8');
  } catch {
    /* no stdin */
  }
  if (raw.trim()) {
    try {
      const parsed = JSON.parse(raw);
      const cmd = parsed?.tool_input?.command;
      if (typeof cmd === 'string') return cmd;
    } catch {
      /* not JSON — fall through */
    }
  }
  return process.env.CLAUDE_TOOL_INPUT_COMMAND || '';
}

const BLOCKED = [
  {
    // `npm run <script> --workspace=x` is fine; only install/add churn pins.
    test: /\bnpm\s+(install|i|add)\b[^|;&\n]*(--workspace\b|--workspaces\b|\s-w[\s=])/,
    why: '`npm install --workspace` silently rewrites exact pins to carets across the tree.',
  },
  {
    test: /\bnpm\s+dedupe\b/,
    why: '`npm dedupe` churns unrelated packages (71 of them, last time).',
  },
  {
    test: /\brm\b[^|;&\n]*package-lock\.json/,
    why: 'Deleting package-lock.json forces a scratch regen — never do that on Windows.',
  },
];

/**
 * Drop heredoc bodies: a commit message describing `npm dedupe` is prose, not an invocation.
 * The opener line is kept — it carries the real command.
 */
function stripHeredocBodies(cmd) {
  const kept = [];
  let terminator = null;
  for (const line of cmd.split('\n')) {
    if (terminator !== null) {
      if (line.trim() === terminator) terminator = null;
      continue;
    }
    kept.push(line);
    const opener = line.match(/<<-?\s*(['"]?)([A-Za-z_][A-Za-z0-9_]*)\1/);
    if (opener) terminator = opener[2];
  }
  return kept.join('\n');
}

/**
 * Blank out quoted literals: a command that *mentions* `&& npm dedupe` inside a string (test data,
 * a doc, a commit message) is not running it. Quotes are replaced, not deleted, so `rm "lock"`
 * still tokenizes — the rm rule re-checks the raw segment to keep quoted filenames detectable.
 */
function blankQuoted(cmd) {
  return cmd.replace(/'[^']*'|"[^"]*"/g, (match) => match[0] + ' '.repeat(match.length - 2) + match[0]);
}

const SPLIT = /\|\||&&|\||;|\n/;

/**
 * Only judge a segment whose HEAD token is the tool itself — `echo "npm dedupe"` is not a dedupe.
 * Returns `{ clean, unquoted }`: `clean` has quoted content blanked (what the rules match against),
 * `unquoted` keeps the content with the quote marks removed (so `rm "package-lock.json"` is still
 * detectable). `blankQuoted` is length-preserving, so both splits stay index-aligned.
 */
function riskySegments(cmd) {
  const raw = stripHeredocBodies(cmd);
  const clean = blankQuoted(raw);

  // Find separators in the BLANKED text, then slice both strings at those offsets — splitting each
  // independently would misalign, since a `&&` inside quotes is a separator in one and not the other.
  const ranges = [];
  const separator = new RegExp(SPLIT.source, 'g');
  let start = 0;
  let match;
  while ((match = separator.exec(clean)) !== null) {
    ranges.push([start, match.index]);
    start = match.index + match[0].length;
  }
  ranges.push([start, clean.length]);

  return ranges
    .map(([from, to]) => ({
      clean: clean.slice(from, to).trim(),
      unquoted: raw.slice(from, to).replace(/['"]/g, '').trim(),
    }))
    .filter(({ clean }) => {
      let tokens = clean.split(/\s+/).filter(Boolean);
      while (
        tokens.length &&
        (/^[A-Za-z_][A-Za-z0-9_]*=/.test(tokens[0]) || ['sudo', 'command'].includes(tokens[0]))
      ) {
        tokens = tokens.slice(1);
      }
      const head = (tokens[0] || '').replace(/^.*[\\/]/, '');
      return head === 'npm' || head === 'rm';
    });
}

const command = readCommand();

if (MODE === 'pre') {
  const candidates = riskySegments(command);
  for (const rule of BLOCKED) {
    if (candidates.some((s) => rule.test.test(s.clean) || rule.test.test(s.unquoted))) {
      console.error(
        `\n🚫 BLOCKED: ${rule.why}\n` +
          '   Dependency edits are SURGICAL: edit package.json, splice package-lock.json in place,\n' +
          '   then prove it with strict `npm ci`. (CLAUDE.md → Workspace dependencies)\n'
      );
      process.exit(2);
    }
  }
  process.exit(0);
}

// post: surgical-diff check on the lockfile
try {
  // argv form, not a shell string: cmd.exe does not strip the quotes off a globbed pathspec.
  const out = execFileSync('git', ['diff', '--numstat', '--', '*package-lock.json'], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  }).trim();
  const noisy = out
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      const [added, removed, file] = line.split(/\s+/);
      return { file, churn: (Number(added) || 0) + (Number(removed) || 0) };
    })
    .filter((entry) => entry.churn > LOCKFILE_CHURN_LINES);

  if (noisy.length) {
    console.error(
      `\n⚠️  Lockfile churn beyond the surgical threshold (${LOCKFILE_CHURN_LINES} lines):\n` +
        noisy.map((e) => `     ${e.file} — ${e.churn} lines`).join('\n') +
        '\n   Confirm every changed package is an intended target of this change, and that no exact\n' +
        '   pin became a range. Verify with strict `npm ci` before pushing.\n'
    );
  }
} catch {
  /* not a git repo / no lockfile — nothing to check */
}
process.exit(0);
