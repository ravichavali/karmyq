'use strict';
const fs = require('fs');
const path = require('path');

// Deliberately longer than ADR-059's security-exemption cap. A stale gotcha is
// unhelpful; a stale security exemption is an active risk. Reusing that cap would
// impose security-grade churn on low-risk content.
const REVIEW_CAP_DAYS = 400;

// Posix-separated on every platform: compared directly against git output.
const GOTCHA_DIR = 'docs/gotchas';
const REQUIRED = ['title', 'owner', 'created', 'scope'];
const CHECK_TYPES = ['path_exists', 'file_matches', 'file_not_matches', 'json_equals'];

function loadRegistry(rootDir) {
  const dir = path.join(rootDir, GOTCHA_DIR);
  const entries = [];
  const errors = [];
  if (!fs.existsSync(dir)) return { entries, errors };

  for (const file of fs.readdirSync(dir).sort()) {
    if (!file.endsWith('.json')) continue;
    const slug = file.replace(/\.json$/, '');
    // Entry paths are ALWAYS repository-relative, posix-separated. They are compared
    // against `git ls-files` and `git diff --cached` output, which is relative and
    // posix. Resolve to disk exactly once, at read time — never store an absolute
    // path in an Entry.
    const jsonPath = `${GOTCHA_DIR}/${file}`;
    const bodyPath = `${GOTCHA_DIR}/${slug}.md`;
    let data;
    try {
      data = JSON.parse(fs.readFileSync(path.join(rootDir, jsonPath), 'utf8'));
    } catch (e) {
      errors.push(`${jsonPath}: not valid JSON (${e.message})`);
      continue;
    }
    const bodyAbs = path.join(rootDir, bodyPath);
    const body = fs.existsSync(bodyAbs) ? fs.readFileSync(bodyAbs, 'utf8') : '';
    entries.push({ slug, jsonPath, bodyPath, data, body });
  }
  return { entries, errors };
}

function validateSchema(entry) {
  const errs = [];
  const d = entry.data;
  for (const field of REQUIRED) {
    if (d[field] === undefined || d[field] === null || d[field] === '') {
      errs.push(`${entry.jsonPath}: missing required field "${field}"`);
    }
  }
  if (d.scope !== undefined && (!Array.isArray(d.scope) || d.scope.length === 0)) {
    errs.push(`${entry.jsonPath}: "scope" must be a non-empty array`);
  }

  // `verify` counts as present only if it is a NON-EMPTY plain object. Without this,
  // `verify: null`, `verify: false` and `verify: {}` all satisfy "exactly one of" while
  // asserting nothing and carrying no review date — bypassing the invariant that makes
  // the collection self-pruning. Verified: all three passed an earlier draft.
  const verifyPresent = d.verify !== undefined;
  const verifyUsable =
    verifyPresent &&
    typeof d.verify === 'object' &&
    d.verify !== null &&
    !Array.isArray(d.verify) &&
    Object.keys(d.verify).length > 0;
  if (verifyPresent && !verifyUsable) {
    errs.push(`${entry.jsonPath}: "verify" must be a non-empty object of declarative checks`);
  }
  const hasExpires = d.expires !== undefined;
  if (verifyUsable === hasExpires) {
    errs.push(
      `${entry.jsonPath}: exactly one of "verify" or "expires" is required (found ${
        verifyUsable ? 'both' : 'neither'
      })`,
    );
  }

  // Malformed containers must fail loudly. Treating a string or object as an empty
  // array silently drops the very data these fields exist to carry.
  if (d.renewed !== undefined && !Array.isArray(d.renewed)) {
    errs.push(`${entry.jsonPath}: "renewed" must be an array of {date, evidence} objects`);
  }
  if (d.see_also !== undefined && !Array.isArray(d.see_also)) {
    errs.push(`${entry.jsonPath}: "see_also" must be an array of slugs`);
  }

  errs.push(...validateCheckArgs(entry));
  return errs;
}

// Each check type's arguments are validated up front, so a typo fails as a schema
// error naming the field rather than as a confusing runtime failure.
function validateCheckArgs(entry) {
  const v = entry.data.verify;
  if (!v || typeof v !== 'object' || Array.isArray(v)) return [];
  const errs = [];
  for (const [type, arg] of Object.entries(v)) {
    if (!CHECK_TYPES.includes(type)) {
      errs.push(`${entry.jsonPath}: unsupported check type "${type}" (allowed: ${CHECK_TYPES.join(', ')})`);
      continue;
    }
    if (type === 'path_exists') {
      if (typeof arg !== 'string' || arg === '') {
        errs.push(`${entry.jsonPath}: path_exists takes a non-empty path string`);
      }
      continue;
    }
    if (typeof arg !== 'object' || arg === null) {
      errs.push(`${entry.jsonPath}: ${type} takes an object`);
      continue;
    }
    if (typeof arg.path !== 'string' || arg.path === '') {
      errs.push(`${entry.jsonPath}: ${type} requires a non-empty "path"`);
    }
    if (type === 'file_matches' || type === 'file_not_matches') {
      if (typeof arg.pattern !== 'string' || arg.pattern === '') {
        errs.push(`${entry.jsonPath}: ${type} requires a non-empty "pattern"`);
      } else {
        try {
          new RegExp(arg.pattern);
        } catch (e) {
          errs.push(`${entry.jsonPath}: ${type} "pattern" is not a valid regex (${e.message})`);
        }
      }
    }
    if (type === 'json_equals') {
      if (typeof arg.key !== 'string' || arg.key === '') {
        errs.push(`${entry.jsonPath}: json_equals requires a non-empty "key"`);
      }
      if (!('value' in arg)) {
        errs.push(`${entry.jsonPath}: json_equals requires a "value"`);
      }
    }
  }
  return errs;
}

function readOr(rootDir, rel) {
  try {
    return fs.readFileSync(path.join(rootDir, rel), 'utf8');
  } catch (e) {
    return null; // caller turns this into a failure, never a skip
  }
}

function runVerify(rootDir, entry) {
  const v = entry.data.verify;
  if (!v) return [];
  const errs = [];
  for (const type of Object.keys(v)) {
    if (!CHECK_TYPES.includes(type)) {
      errs.push(`${entry.jsonPath}: unsupported check type "${type}" (allowed: ${CHECK_TYPES.join(', ')})`);
      continue;
    }
    const arg = v[type];
    if (type === 'path_exists') {
      if (!fs.existsSync(path.join(rootDir, arg))) {
        errs.push(`${entry.jsonPath}: path_exists "${arg}" does not exist`);
      }
      continue;
    }
    const text = readOr(rootDir, arg.path);
    if (text === null) {
      errs.push(`${entry.jsonPath}: ${type} target "${arg.path}" is unreadable — failing closed`);
      continue;
    }
    if (type === 'file_matches' && !new RegExp(arg.pattern).test(text)) {
      errs.push(`${entry.jsonPath}: ${arg.path} no longer contains /${arg.pattern}/`);
    }
    if (type === 'file_not_matches' && new RegExp(arg.pattern).test(text)) {
      errs.push(`${entry.jsonPath}: ${arg.path} unexpectedly contains /${arg.pattern}/`);
    }
    if (type === 'json_equals') {
      let cur;
      try {
        cur = arg.key.split('.').reduce((o, k) => (o == null ? undefined : o[k]), JSON.parse(text));
      } catch (e) {
        errs.push(`${entry.jsonPath}: ${arg.path} is not valid JSON — failing closed`);
        continue;
      }
      if (cur !== arg.value) {
        errs.push(`${entry.jsonPath}: ${arg.path} ${arg.key} expected ${JSON.stringify(arg.value)}, found ${JSON.stringify(cur)}`);
      }
    }
  }
  return errs;
}

const ISO = /^\d{4}-\d{2}-\d{2}$/;

function parseIso(s) {
  if (typeof s !== 'string' || !ISO.test(s)) return null;
  const d = new Date(`${s}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return null;
  if (d.toISOString().slice(0, 10) !== s) return null; // rejects 2026-13-45
  return d;
}

function checkDates(entry, today) {
  const errs = [];
  const d = entry.data;
  const created = parseIso(d.created);
  if (d.created !== undefined && !created) {
    errs.push(`${entry.jsonPath}: "created" (${d.created}) is not a valid ISO date`);
  }

  const renewals = Array.isArray(d.renewed) ? d.renewed : [];
  let latestReview = created;
  for (const r of renewals) {
    const rd = parseIso(r && r.date);
    if (!rd) {
      errs.push(`${entry.jsonPath}: renewal date "${r && r.date}" is not a valid ISO date`);
      continue;
    }
    if (!r.evidence || String(r.evidence).trim() === '') {
      errs.push(`${entry.jsonPath}: renewal ${r.date} is missing "evidence" — say how the fact was re-confirmed`);
    }
    if (!latestReview || rd > latestReview) latestReview = rd;
  }

  if (d.expires !== undefined) {
    const expires = parseIso(d.expires);
    if (!expires) {
      errs.push(`${entry.jsonPath}: "expires" (${d.expires}) is not a valid ISO date`);
    } else {
      if (expires < today) {
        errs.push(`${entry.jsonPath}: past its review date (${d.expires}) — renew with evidence, or delete it`);
      }
      if (latestReview) {
        const span = Math.round((expires - latestReview) / 86400000);
        if (span > REVIEW_CAP_DAYS) {
          errs.push(`${entry.jsonPath}: review span ${span}d exceeds the review cap of ${REVIEW_CAP_DAYS}d`);
        }
      }
    }
  }
  return errs;
}

function normalizePath(p) {
  return String(p).replace(/\\/g, '/');
}

// A trailing slash means "directory prefix"; anything else must match exactly.
function scopeMatches(scopeEntry, candidatePath) {
  const s = normalizePath(scopeEntry);
  const c = normalizePath(candidatePath);
  return s.endsWith('/') ? c.startsWith(s) : c === s;
}

function checkScope(entry, trackedPaths) {
  const errs = [];
  const scope = Array.isArray(entry.data.scope) ? entry.data.scope : [];
  for (const s of scope) {
    const hit = trackedPaths.some((t) => scopeMatches(s, t));
    if (!hit) {
      errs.push(
        `${entry.jsonPath}: scope "${s}" matches no git-tracked path — stale, misfiled, or machine-local`,
      );
    }
  }
  return errs;
}

function checkReferences(entry, allSlugs) {
  const refs = Array.isArray(entry.data.see_also) ? entry.data.see_also : [];
  return refs
    .filter((r) => !allSlugs.includes(r))
    .map((r) => `${entry.jsonPath}: see_also "${r}" has no matching entry`);
}

function checkPairing(rootDir) {
  const dir = path.join(rootDir, GOTCHA_DIR);
  if (!fs.existsSync(dir)) return [];
  const files = fs.readdirSync(dir);
  const jsons = new Set(files.filter((f) => f.endsWith('.json')).map((f) => f.slice(0, -5)));
  const mds = new Set(files.filter((f) => f.endsWith('.md')).map((f) => f.slice(0, -3)));
  const errs = [];
  for (const s of jsons) if (!mds.has(s)) errs.push(`docs/gotchas/${s}.json has no matching ${s}.md`);
  for (const s of mds) if (!jsons.has(s)) errs.push(`docs/gotchas/${s}.md has no matching ${s}.json`);
  return errs.sort();
}

module.exports = {
  REVIEW_CAP_DAYS,
  GOTCHA_DIR,
  loadRegistry,
  validateSchema,
  runVerify,
  checkDates,
  normalizePath,
  scopeMatches,
  checkScope,
  checkReferences,
  checkPairing,
};
