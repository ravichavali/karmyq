#!/usr/bin/env node
// Claude Code command hooks receive JSON on stdin, not a per-tool path env var.
// https://code.claude.com/docs/en/hooks#pretooluse-decision-control
const fs = require('fs');
const path = require('path');

const input = JSON.parse(fs.readFileSync(0, 'utf8'));
const file = input.tool_input?.file_path;
if (typeof file !== 'string') process.exit(0);
const match = file.replace(/\\/g, '/').match(/(?:^|\/)services\/([^/]+)\//);
if (!match || match[1] === '.' || match[1] === '..') process.exit(0);
const readme = `services/${match[1]}/.claude/README.md`;
if (fs.existsSync(path.resolve(__dirname, '..', readme))) {
  console.log(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      additionalContext: `PROCESS REMINDER: Read ${readme} before editing this service. Use the Read tool first if you have not already consulted it.`,
    },
  }));
}
