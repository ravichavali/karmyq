#!/usr/bin/env node
'use strict';
const { execFileSync } = require('child_process');
const path = require('path');
const reg = require('./gotcha-registry.js');

const ROOT = path.join(__dirname, '..');

function tracked() {
  return execFileSync('git', ['ls-files'], { cwd: ROOT, encoding: 'utf8' })
    .split('\n').map((s) => s.trim()).filter(Boolean);
}

// Discovery entry point. Without this, discover() is reachable only from tests and the
// spec's central promise — "read the gotchas scoped to what you are about to change" —
// has no way to be acted on. Accepts paths that do NOT yet exist, which is the case
// directory-scoped knowledge exists for.
function runDiscovery(paths) {
  const { entries } = reg.loadRegistry(ROOT);
  // normalizePath is exported from gotcha-registry.js (Task 4) — do not re-implement the
  // separator fix inline. An earlier draft did, and shipped a SyntaxError that disabled
  // validation, discovery AND the pre-commit hook at once.
  const slugs = reg.discover(entries, paths.map(reg.normalizePath));
  if (!slugs.length) {
    console.log('No gotchas scoped to those paths.');
    return;
  }
  console.log(`${slugs.length} gotcha(s) apply to those paths — read them before changing:\n`);
  for (const slug of slugs) {
    const entry = entries.find((e) => e.slug === slug);
    console.log(`  ${entry.data.title}`);
    console.log(`    ${entry.bodyPath}`);
  }
}

function main() {
  const forIndex = process.argv.indexOf('--for');
  if (forIndex !== -1) {
    const paths = process.argv.slice(forIndex + 1).filter((a) => !a.startsWith('--'));
    if (!paths.length) {
      console.error('Usage: node scripts/gotcha-check.js --for <path> [<path>...]');
      process.exit(2);
    }
    runDiscovery(paths);
    process.exit(0); // discovery reports; it never fails
  }
  const stagedOnly = process.argv.includes('--staged');
  const { entries, errors } = reg.loadRegistry(ROOT);
  const all = [...errors];

  if (stagedOnly) {
    // Publication-preventing screen. Reads each staged BLOB from the index, never the
    // working tree: staging a credential and then editing it out WITHOUT staging the
    // removal would otherwise pass this screen while the commit still carries it.
    // Iterating loaded entries is also wrong — it would miss a staged .md with no .json.
    const statusLines = execFileSync(
      'git', ['diff', '--cached', '--name-status', '--', 'docs/gotchas'],
      { cwd: ROOT, encoding: 'utf8' },
    ).split('\n').map((s) => s.trim()).filter(Boolean);

    for (const line of statusLines) {
      const parts = line.split('\t');
      const status = parts[0][0];              // A, M, D, R...
      const file = parts[parts.length - 1];    // for renames, the destination path
      if (status === 'D') continue;            // a deletion publishes nothing
      let blob;
      try {
        blob = execFileSync('git', ['show', ':' + file], { cwd: ROOT, encoding: 'utf8' });
      } catch (e) {
        all.push(file + ': could not read the staged blob — failing closed');
        continue;
      }
      all.push(...reg.scanCredentials(blob, file));
    }
  } else {
    const t = tracked();
    const slugs = entries.map((e) => e.slug);
    const today = reg.todayUtc(); // compare against the UTC midnight these dates live on
    all.push(...reg.checkPairing(ROOT));
    for (const e of entries) {
      all.push(...reg.validateSchema(e));
      all.push(...reg.runVerify(ROOT, e));
      all.push(...reg.checkDates(e, today));
      all.push(...reg.checkScope(e, t));
      all.push(...reg.checkReferences(e, slugs));
      all.push(...reg.scanEntry(e)); // BOTH halves of the pair
    }
  }

  // Schema validation and execution are independent checks that legitimately reach the
  // same conclusion — an unsupported check type is reported by both, by design, so each
  // function is usable on its own. The operator should still see it once.
  const unique = [...new Set(all)];

  if (unique.length) {
    console.error('\n❌ Gotcha registry check failed:\n');
    for (const e of unique) console.error(`  ✗ ${e}`);
    console.error('\n  → Fix the entry, or delete it if it no longer applies.\n');
    process.exit(1);
  }
  console.log(`✅ Gotcha registry clean (${entries.length} entries).`);
}

main();
