#!/usr/bin/env node
/**
 * Simulation integrity checker
 *
 * Invoked by a Claude Code PostToolUse hook when backend route files
 * or frontend pages change.
 *
 * Checks whether the change could affect simulation workflows and,
 * if so, prints a warning with the specific files to review.
 *
 * Usage: node simulation/maintenance/check-integrity.js <changed-file-path>
 */

const fs = require('fs');
const path = require('path');

const changedFile = process.argv[2] || process.env.CLAUDE_TOOL_INPUT_FILE_PATH || '';
const normalized = changedFile.replace(/\\/g, '/');

if (!normalized) process.exit(0);

// Only care about route files and frontend pages
const isRoutefile = /services\/[^/]+\/src\/routes\/[^/]+\.ts$/.test(normalized);
const isFrontendPage = /apps\/frontend\/src\/pages\/[^/]+\.(tsx|ts)$/.test(normalized);

if (!isRoutefile && !isFrontendPage) process.exit(0);

// Map changed files to potentially affected simulation files
const WORKFLOW_MAP = {
  'auth.ts':          ['simulation/api/client.ts (register/login)', 'simulation/scripts/seed-founders.ts'],
  'communities.ts':   ['simulation/api/client.ts (createCommunity, joinCommunity)', 'simulation/workflows/index.ts (joinCommunity, createCommunity)'],
  'members.ts':       ['simulation/api/client.ts (joinCommunity)', 'simulation/workflows/index.ts (joinCommunity)'],
  'requests.ts':      ['simulation/api/client.ts (createRequest, browseRequests)', 'simulation/workflows/index.ts (createRequest, offerHelp)'],
  'matches.ts':       ['simulation/api/client.ts (offerHelp, acceptMatch, completeMatch)', 'simulation/workflows/index.ts (offerHelp, acceptOffer, completeMatch)'],
  'conversations.ts': ['simulation/api/client.ts (getConversations, sendMessage)', 'simulation/workflows/index.ts (sendMessage)'],
  'messages.ts':      ['simulation/api/client.ts (getMessages, sendMessage)', 'simulation/workflows/index.ts (sendMessage)'],
  'invitations.ts':   ['simulation/api/client.ts (generateInvite, acceptInvite)', 'simulation/scripts/seed-founders.ts', 'simulation/scripts/run.ts'],
  'feed.ts':          ['simulation/api/client.ts (getDashboard)', 'simulation/social-graph/propagation.ts'],
};

const basename = path.basename(normalized);
const affected = WORKFLOW_MAP[basename];

if (!affected) {
  // Changed file not in map — generic warning for route files
  if (isRoutefile) {
    console.warn(`\n⚠️  SIMULATION INTEGRITY CHECK`);
    console.warn(`   Changed: ${normalized}`);
    console.warn(`   This is a backend route file. If the API signature changed,`);
    console.warn(`   review simulation/api/client.ts and relevant workflow files.\n`);
  }
  process.exit(0);
}

console.warn(`\n⚠️  SIMULATION INTEGRITY CHECK`);
console.warn(`   Changed: ${normalized}`);
console.warn(`   The following simulation files may need updating:`);
affected.forEach(f => console.warn(`     → ${f}`));
console.warn(`\n   Things to check:`);
console.warn(`   1. Did any required POST body fields change?`);
console.warn(`   2. Did any endpoint paths change?`);
console.warn(`   3. Was a new workflow step added (e.g., new validation, new required step)?`);
console.warn(`   4. Does this add a feature simulation personas should naturally use?`);
console.warn(`\n   Review these files before the next simulation run.\n`);
