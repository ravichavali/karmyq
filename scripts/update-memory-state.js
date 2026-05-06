#!/usr/bin/env node
/**
 * Auto-refreshes project_current_state.md in Claude memory from live git state.
 * Called by the Claude Code Stop hook at the end of every session.
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.join(__dirname, '..');
const MEMORY_DIR = path.join(
  process.env.USERPROFILE || process.env.HOME,
  '.claude', 'projects', 'c--Users-ravic-development-karmyq', 'memory'
);
const OUT_FILE = path.join(MEMORY_DIR, 'project_current_state.md');

function run(cmd) {
  try {
    return execSync(cmd, { cwd: REPO_ROOT, encoding: 'utf8' }).trim();
  } catch {
    return '';
  }
}

// Git state
const commitHash = run('git log --format="%h" -1');
const commitMsg  = run('git log --format="%s" -1');
const branch     = run('git branch --show-current');
const today      = new Date().toISOString().slice(0, 10);

// ADR count
const adrDir = path.join(REPO_ROOT, 'docs', 'adr');
const adrFiles = fs.readdirSync(adrDir).filter(f => /^ADR-\d+/.test(f));
const adrNumbers = adrFiles.map(f => parseInt(f.match(/ADR-(\d+)/)?.[1] ?? '0', 10)).filter(Boolean);
const highestAdr = Math.max(...adrNumbers);
const nextAdr = String(highestAdr + 1).padStart(3, '0');

// Registry updated date
let registryDate = 'unknown';
try {
  const registry = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'services', 'registry.json'), 'utf8'));
  registryDate = registry.updated ?? 'unknown';
} catch {}

// Latest feature sprint from git log
const sprintCommit = run('git log --format="%h %s" --grep="^feat" -1');

const content = `---
name: Current project state
description: Latest sprint, version, ADR count, and next sprint candidates — auto-refreshed by Stop hook
type: project
---

**Generated**: ${today}
**Latest commit**: \`${commitHash}\` — ${commitMsg}
**Branch**: ${branch}
**Registry updated**: ${registryDate}
**Latest feature**: ${sprintCommit || commitMsg}

**ADR count**: ${adrFiles.length} (highest: ADR-${String(highestAdr).padStart(3, '0')}). Next ADR is **${nextAdr}**.

**Sprint 52 candidates:**
1. Trust-path visibility — show why a dibs candidate was selected (social graph path in DibsPrompt)
2. Platform-scoped service requests — expose \`visibility_scope='platform'\` in request creation UI
3. UI facelift — Claude Design aesthetic; research-first sprint per feedback memory

**Note:** Git state above is auto-refreshed each session. Sprint candidates section updates when sprint planning happens.
`;

if (!fs.existsSync(MEMORY_DIR)) {
  console.error(`Memory dir not found: ${MEMORY_DIR}`);
  process.exit(0); // Don't fail the session
}

fs.writeFileSync(OUT_FILE, content, 'utf8');
console.log(`[memory] Updated project_current_state.md (ADR-${highestAdr}, ${today})`);
