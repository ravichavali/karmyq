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

// Each rule is scoped to the segment's HEAD command. Without that scoping, an `npm` invocation
// carrying an `rm …package-lock.json` argument (e.g. `npm test -- -t "rm package-lock.json"`)
// trips the rm rule, and vice versa.
const BLOCKED = [
  {
    head: 'npm',
    // `npm run <script> --workspace=x` is fine; only install/add churn pins.
    // `--workspaces=false` is a root-ONLY install — safe, and must not be blocked.
    test: /\bnpm\s+(install|i|add)\b[^|;&\n]*(--workspaces(?!=false)|--workspace\b|\s-w[\s=])/,
    why: '`npm install --workspace` silently rewrites exact pins to carets across the tree.',
  },
  {
    head: 'npm',
    test: /\bnpm\s+dedupe\b/,
    why: '`npm dedupe` churns unrelated packages (71 of them, last time).',
  },
  {
    head: 'rm',
    // Only this rule consults the unquoted text, so `rm "package-lock.json"` is still caught.
    matchUnquoted: true,
    test: /\brm\b[^|;&\n]*package-lock\.json/,
    why: 'Deleting package-lock.json forces a scratch regen — never do that on Windows.',
  },
];

/**
 * Which line indices belong to heredoc BODIES (a commit message describing `npm dedupe` is prose,
 * not an invocation). Opener lines are kept — they carry the real command.
 *
 * Detection runs on the QUOTE-BLANKED text: a `<<` inside a string is a left-shift or a quoted
 * pattern, not a heredoc opener. Reading it as one silently discarded every following line, which
 * made `node -e "1 << x"` + newline + `npm dedupe` sail straight through.
 */
function heredocBodyLines(raw, blanked) {
  const OPENER = /<<-?\s*(['"]?)([A-Za-z_][A-Za-z0-9_]*)\1/g;
  const rawLines = raw.split('\n');
  const blankedLines = blanked.split('\n');
  const drop = new Set();
  let terminator = null;

  rawLines.forEach((line, i) => {
    if (terminator !== null) {
      if (line.trim() === terminator) terminator = null;
      drop.add(i);
      return;
    }
    // The delimiter must be read from RAW (`<<'EOF'` has its EOF blanked out), but whether this
    // `<<` is a real opener must be judged from BLANKED — inside a string it is a left-shift or a
    // quoted pattern, not a heredoc. blankQuoted is length-preserving, so indices line up.
    OPENER.lastIndex = 0;
    let m;
    while ((m = OPENER.exec(line)) !== null) {
      if (blankedLines[i].slice(m.index, m.index + 2) === '<<') {
        terminator = m[2];
        break;
      }
    }
  });
  return drop;
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
  // Blank quotes FIRST, then find heredocs in the blanked text, then drop those lines from both.
  const blankedAll = blankQuoted(cmd);
  const drop = heredocBodyLines(cmd, blankedAll);
  const keep = (text) =>
    text
      .split('\n')
      .filter((_, i) => !drop.has(i))
      .join('\n');

  const raw = keep(cmd);
  const clean = keep(blankedAll);

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
    .map(([from, to]) => {
      const segment = clean.slice(from, to).trim();
      let tokens = segment.split(/\s+/).filter(Boolean);
      while (
        tokens.length &&
        (/^[A-Za-z_][A-Za-z0-9_]*=/.test(tokens[0]) || ['sudo', 'command'].includes(tokens[0]))
      ) {
        tokens = tokens.slice(1);
      }
      return {
        clean: segment,
        unquoted: raw.slice(from, to).replace(/['"]/g, '').trim(),
        head: (tokens[0] || '').replace(/^.*[\\/]/, ''),
      };
    })
    .filter(({ head }) => BLOCKED.some((rule) => rule.head === head));
}

const command = readCommand();

if (MODE === 'pre') {
  const candidates = riskySegments(command);
  for (const rule of BLOCKED) {
    const applicable = candidates.filter((s) => s.head === rule.head);
    if (
      applicable.some(
        (s) => rule.test.test(s.clean) || (rule.matchUnquoted && rule.test.test(s.unquoted))
      )
    ) {
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
  // `HEAD` (not a bare `git diff`) so STAGED lockfile churn counts too — `npm install` followed by
  // `git add` would otherwise show a clean worktree and warn about nothing.
  const out = execFileSync('git', ['diff', '--numstat', 'HEAD', '--', '*package-lock.json'], {
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
    // Exit 2 is what surfaces a PostToolUse hook's stderr back to the agent. Exiting 0 here wrote
    // the warning into the void — nobody saw it, which is the same as not having the check.
    process.exit(2);
  }
} catch {
  /* not a git repo / no lockfile — nothing to check */
}
process.exit(0);
