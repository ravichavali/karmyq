#!/usr/bin/env node
/**
 * Sprint 129 (BUG-040) — render the demo-health issue body.
 *
 * This lived inline in `.github/workflows/demo-health.yml` as a 38-line `node -e '...'`, which
 * contradicted the reason `check-demo-health.js` exists as a file at all: inline YAML cannot be
 * unit-tested, and this is the one code path a human reading the issue actually depends on. It was
 * also nested inside `$( )` inside a single-quoted shell string, so one apostrophe in any message
 * would have terminated the quote.
 *
 * Reads RESULT (base64 JSON from the check step) and OUTCOME (the check step's outcome) from the
 * environment. Always writes a body — an unreadable or absent payload is itself the story, and
 * emitting nothing would leave the notify step with an empty issue.
 *
 * Validation goes through `interpretPayload`, so the rules the regression suite proves are the
 * rules that run here. Before this, the workflow re-implemented weaker checks in bash and again in
 * the inline renderer, and neither was the tested one.
 */

'use strict';

const { interpretPayload } = require('../check-demo-health.js');

function renderIncomplete(outcome) {
  return [
    '### The demo-health check did not complete',
    '',
    'It produced no usable result payload, so the state of the demo is **unknown** — treat this as',
    'a failure until proven otherwise.',
    '',
    `- Check step outcome: \`${outcome || 'did not run'}\``,
    '',
    'Verify by hand: `POST https://karmyq.com/api/auth/demo-session` should return 200.',
  ].join('\n');
}

function renderStories(stories) {
  return (
    '### Story retention\n' +
    stories
      .map((s) => {
        const remaining = Number.isFinite(s.daysRemaining)
          ? `${s.daysRemaining.toFixed(1)} days`
          : 'not deletable by the cleanup job';
        const verdict = s.safe ? 'safe' : '**NOT safe**';
        return `- **${s.kind}** — ${remaining} from deletion (basis: ${s.basis}, ${verdict})`;
      })
      .join('\n')
  );
}

function render(raw, outcome) {
  if (typeof raw !== 'string' || raw.trim() === '') return renderIncomplete(outcome);

  let decoded;
  try {
    decoded = Buffer.from(raw, 'base64').toString('utf8');
  } catch (error) {
    return `### The demo-health payload could not be decoded\n\n- ${error.message}`;
  }

  // Same validator the regression suite exercises: empty, malformed, or structurally incomplete
  // payloads are all failures, not passes.
  const result = interpretPayload(decoded);

  const sections = [];
  if (result.errors.length > 0) {
    sections.push('### Findings\n' + result.errors.map((e) => `- ${e}`).join('\n'));
  }
  if (result.stories.length > 0) {
    sections.push(renderStories(result.stories));
  }
  if (sections.length === 0) {
    sections.push('### The check reported a problem but rendered no detail');
  }
  return sections.join('\n\n');
}

module.exports = { render };

if (require.main === module) {
  process.stdout.write(render(process.env.RESULT, process.env.OUTCOME));
}
