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
// CHECK_TYPES is derived from the CHECKS table below — never a second hand-written list.

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
    // `null`, `[]` and `"text"` are all valid JSON but are not entries. Without this the
    // sidecar loads with no error and every later check dereferences it — the shared
    // registry core guards the same shape for the same reason.
    if (!isPlainObject(data)) {
      errors.push(`${jsonPath}: must be a JSON object describing one entry`);
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
  // loadRegistry rejects this shape, but validateSchema is exported and called directly
  // by the gate, so it must not assume a well-formed Entry reached it.
  if (!isPlainObject(d)) {
    return [`${entry.jsonPath}: must be a JSON object describing one entry`];
  }
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

/**
 * Resolve a check's target inside the repository, or refuse.
 *
 * Entries arrive by pull request, including from forks, so the `path` in a check is
 * attacker-supplied. A check result is an oracle — pass/fail reports whether a pattern
 * occurs in the target — and on a public repo those results are visible in CI logs.
 * ADR-097 §3 removes arbitrary code execution; this closes the arbitrary READ beside it.
 *
 * Three separate defences, because the first one alone was not a security boundary:
 *
 *  1. Lexical containment — `../../../.ssh/id_rsa` resolves outside and is refused.
 *  2. `.git` is refused even though it is INSIDE the root. On a GitHub Actions runner
 *     `.git/config` holds the checkout credential that actions/checkout persists, so
 *     "inside the repository" is not the same as "safe to read".
 *  3. Symlink resolution. Containment by path.resolve + startsWith is purely lexical, and
 *     git happily stores a symlink whose target is absolute. A committed
 *     `docs/gotchas/evidence.txt -> /proc/self/environ` passes a lexical check and then
 *     reads whatever the link points at, defeating (1) entirely.
 */
const REFUSED_SEGMENTS = new Set(['.git']);

function resolveInsideRoot(rootDir, rel) {
  const root = path.resolve(rootDir);
  const target = path.resolve(root, rel);
  const prefix = root.endsWith(path.sep) ? root : root + path.sep;
  const contained = (p) => p === root || p.startsWith(prefix);

  if (!contained(target)) return null;

  // Refuse by path segment, on the RELATIVE path, so `.git`, `x/.git` and `./.git/config`
  // are all caught regardless of how the entry spelled it.
  const segments = normalizePath(path.relative(root, target)).split('/');
  if (segments.some((s) => REFUSED_SEGMENTS.has(s))) return null;

  // Follow symlinks and re-apply containment to where they actually land. realpathSync
  // throws when the target does not exist, which is legitimate for path_exists — fall
  // back to the deepest existing ancestor so a missing file still reports "does not
  // exist" rather than being refused, while a symlinked ANCESTOR is still caught.
  let probe = target;
  for (;;) {
    try {
      const real = fs.realpathSync(probe);
      const realRoot = fs.realpathSync(root);
      const realPrefix = realRoot.endsWith(path.sep) ? realRoot : realRoot + path.sep;
      if (!(real === realRoot || real.startsWith(realPrefix))) return null;
      return target;
    } catch (e) {
      const parent = path.dirname(probe);
      if (parent === probe || !contained(parent)) return target; // nothing resolvable; let the read fail closed
      probe = parent;
    }
  }
}

// Read a file, or fail closed. Never a skip: an unreadable target is exactly when a
// check must speak, mirroring ADR-060's refusal to treat an API error as "nothing found".
function readOrFailClosed(rootDir, rel, entry, type, errs) {
  const abs = resolveInsideRoot(rootDir, rel);
  if (abs === null) {
    errs.push(`${entry.jsonPath}: ${type} path "${rel}" escapes the repository root — refused`);
    return null;
  }
  try {
    return fs.readFileSync(abs, 'utf8');
  } catch (e) {
    errs.push(`${entry.jsonPath}: ${type} target "${rel}" is unreadable — failing closed`);
    return null;
  }
}

/**
 * Reject regex shapes that backtrack catastrophically.
 *
 * A fork PR supplies BOTH the pattern and the file it runs against. `(a+)+$` against 31
 * characters takes ~108 seconds here — measured, not theoretical — so a single entry can
 * hang CI indefinitely. Node has no regex timeout, and the validator may not spawn a
 * process (hermeticity), so the pattern itself is where this has to be stopped.
 *
 * This is a conservative HEURISTIC, not a proof of linear-time matching: it rejects a
 * quantifier applied to a group that already contains one, which is the classic
 * exponential shape. Patterns needing that construction should be rewritten; every seed
 * entry here is a plain literal or character class.
 */
const NESTED_QUANTIFIER = /\([^)]*[+*][^)]*\)\s*[+*{]/;
const MAX_PATTERN_LENGTH = 200;

function patternSafetyErrors(pattern, entry, type) {
  if (pattern.length > MAX_PATTERN_LENGTH) {
    return [`${entry.jsonPath}: ${type} "pattern" exceeds ${MAX_PATTERN_LENGTH} characters`];
  }
  if (NESTED_QUANTIFIER.test(pattern)) {
    return [
      `${entry.jsonPath}: ${type} "pattern" nests a quantifier inside a quantified group ` +
        `(/${pattern}/), which can backtrack catastrophically — rewrite it without the nesting`,
    ];
  }
  return [];
}

/**
 * The four declarative check types, each with its argument validator and its executor.
 *
 * One table rather than two parallel if-chains: a type that exists in one chain but not
 * the other would either validate without running or run without validating, and nothing
 * structurally prevented that when these were separate. Adding a type is now one entry.
 *
 * There is deliberately no check type that executes a string from an entry file — this is
 * a public repo accepting fork PRs, and that would be arbitrary code execution (ADR-097).
 */
const CHECKS = {
  path_exists: {
    validateArgs: (arg, entry) =>
      typeof arg === 'string' && arg !== ''
        ? []
        : [`${entry.jsonPath}: path_exists takes a non-empty path string`],
    run: (rootDir, arg, entry) => {
      const abs = resolveInsideRoot(rootDir, arg);
      if (abs === null) {
        return [`${entry.jsonPath}: path_exists "${arg}" escapes the repository root — refused`];
      }
      return fs.existsSync(abs) ? [] : [`${entry.jsonPath}: path_exists "${arg}" does not exist`];
    },
  },

  file_matches: {
    validateArgs: (arg, entry) => patternArgErrors(arg, entry, 'file_matches'),
    run: (rootDir, arg, entry) => {
      const errs = [];
      const text = readOrFailClosed(rootDir, arg.path, entry, 'file_matches', errs);
      if (text === null) return errs;
      if (!new RegExp(arg.pattern).test(text)) {
        errs.push(`${entry.jsonPath}: ${arg.path} no longer contains /${arg.pattern}/`);
      }
      return errs;
    },
  },

  file_not_matches: {
    validateArgs: (arg, entry) => patternArgErrors(arg, entry, 'file_not_matches'),
    run: (rootDir, arg, entry) => {
      const errs = [];
      const text = readOrFailClosed(rootDir, arg.path, entry, 'file_not_matches', errs);
      if (text === null) return errs;
      if (new RegExp(arg.pattern).test(text)) {
        errs.push(`${entry.jsonPath}: ${arg.path} unexpectedly contains /${arg.pattern}/`);
      }
      return errs;
    },
  },

  json_equals: {
    validateArgs: (arg, entry) => {
      const errs = objectArgErrors(arg, entry, 'json_equals');
      if (errs.length && !isPlainObject(arg)) return errs;
      if (typeof arg.key !== 'string' || arg.key === '') {
        errs.push(`${entry.jsonPath}: json_equals requires a non-empty "key"`);
      }
      if (!('value' in arg)) {
        errs.push(`${entry.jsonPath}: json_equals requires a "value"`);
      }
      return errs;
    },
    run: (rootDir, arg, entry) => {
      const errs = [];
      const text = readOrFailClosed(rootDir, arg.path, entry, 'json_equals', errs);
      if (text === null) return errs;
      let cur;
      try {
        cur = arg.key.split('.').reduce((o, k) => (o == null ? undefined : o[k]), JSON.parse(text));
      } catch (e) {
        errs.push(`${entry.jsonPath}: ${arg.path} is not valid JSON — failing closed`);
        return errs;
      }
      if (cur !== arg.value) {
        // Deliberately does NOT echo the value that was read. Echoing it turned
        // json_equals into a direct exfiltration channel: an entry pointing at any JSON
        // file in the workspace printed its contents into a public CI log, no oracle
        // search required. The expected value is the entry author's own input, so
        // reporting that is safe and still says which claim broke.
        errs.push(
          `${entry.jsonPath}: ${arg.path} ${arg.key} does not equal the expected ` +
            `${JSON.stringify(arg.value)}`,
        );
      }
      return errs;
    },
  },
};

const CHECK_TYPES = Object.keys(CHECKS);

function isPlainObject(v) {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function objectArgErrors(arg, entry, type) {
  if (!isPlainObject(arg)) return [`${entry.jsonPath}: ${type} takes an object`];
  return typeof arg.path === 'string' && arg.path !== ''
    ? []
    : [`${entry.jsonPath}: ${type} requires a non-empty "path"`];
}

function patternArgErrors(arg, entry, type) {
  const errs = objectArgErrors(arg, entry, type);
  if (!isPlainObject(arg)) return errs;
  if (typeof arg.pattern !== 'string' || arg.pattern === '') {
    errs.push(`${entry.jsonPath}: ${type} requires a non-empty "pattern"`);
    return errs;
  }
  try {
    new RegExp(arg.pattern);
  } catch (e) {
    errs.push(`${entry.jsonPath}: ${type} "pattern" is not a valid regex (${e.message})`);
    return errs;
  }
  errs.push(...patternSafetyErrors(arg.pattern, entry, type));
  return errs;
}

// One home for this message, so validation and execution can never disagree about
// which types exist — and so the CLI, which concatenates both, cannot print it twice.
function unsupportedType(entry, type) {
  return `${entry.jsonPath}: unsupported check type "${type}" (allowed: ${CHECK_TYPES.join(', ')})`;
}

// Each check type's arguments are validated up front, so a typo fails as a schema
// error naming the field rather than as a confusing runtime failure.
function validateCheckArgs(entry) {
  const v = entry.data.verify;
  if (!isPlainObject(v)) return [];
  const errs = [];
  for (const [type, arg] of Object.entries(v)) {
    // Object.hasOwn, not a truthiness test: a verify key of "constructor" or
    // "toString" resolves through the prototype chain, so CHECKS[type] is truthy and
    // check.validateArgs is undefined — which threw instead of reporting an
    // unsupported type. Same defect class as the parseUtcDate guard above.
    const check = Object.hasOwn(CHECKS, type) ? CHECKS[type] : null;
    if (!check) {
      errs.push(unsupportedType(entry, type));
      continue;
    }
    errs.push(...check.validateArgs(arg, entry));
  }
  return errs;
}

function runVerify(rootDir, entry) {
  const v = entry.data.verify;
  if (!isPlainObject(v)) return [];
  const errs = [];
  for (const [type, arg] of Object.entries(v)) {
    // Object.hasOwn, not a truthiness test: a verify key of "constructor" or
    // "toString" resolves through the prototype chain, so CHECKS[type] is truthy and
    // check.validateArgs is undefined — which threw instead of reporting an
    // unsupported type. Same defect class as the parseUtcDate guard above.
    const check = Object.hasOwn(CHECKS, type) ? CHECKS[type] : null;
    if (!check) {
      errs.push(unsupportedType(entry, type));
      continue;
    }
    // Arguments are validated BEFORE the executor touches them. runVerify is a public
    // entry point — the gate and the CLI both call it directly — so it cannot assume
    // validateSchema ran first. Without this, `{"path_exists": null}` threw an unhandled
    // TypeError and took down the whole check with a stack trace instead of reporting
    // the schema error. An unusable argument is a failure, never a skip.
    const argErrors = check.validateArgs(arg, entry);
    if (argErrors.length) {
      errs.push(...argErrors);
      continue;
    }
    errs.push(...check.run(rootDir, arg, entry));
  }
  return errs;
}

// Date primitives come from the shared registry core (ADR-094), which exports them
// precisely so callers do not re-implement them — a hand-rolled copy in
// check-image-size-upstream.js once dropped the shape check and the rollover guard.
// The core has zero requires and reaches neither the network nor a subprocess, so this
// stays runnable under bare `node` in the clean-room clone and keeps hermeticity intact.
const { parseUtcDate, todayUtc } = require('./lib/exemption-registry');

// Local adapter: this module signals "not a date" with null rather than a NaN-bearing Date.
function parseIso(s) {
  const d = parseUtcDate(s);
  return Number.isNaN(d.getTime()) ? null : d;
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

// One home for the scope coercion, shared by checkScope and discover.
function scopeOf(entry) {
  return Array.isArray(entry.data.scope) ? entry.data.scope : [];
}

function checkScope(entry, trackedPaths) {
  const errs = [];
  for (const s of scopeOf(entry)) {
    // Normalize the anchor ONCE, not once per candidate. This scan is
    // O(scopes x repo size) — ~2,200 tracked files here, and the registry is meant to
    // grow — so re-normalizing a loop-invariant string inside it is pure waste.
    // Candidates come from `git ls-files`, which always emits forward slashes.
    const normalized = normalizePath(s);
    const isPrefix = normalized.endsWith('/');
    const hit = trackedPaths.some((t) =>
      isPrefix ? t.startsWith(normalized) : t === normalized,
    );
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

function discover(entries, changedPaths) {
  const hits = new Set();
  for (const entry of entries) {
    for (const s of scopeOf(entry)) {
      if (changedPaths.some((c) => scopeMatches(s, c))) {
        hits.add(entry.slug);
        break;
      }
    }
  }
  return [...hits].sort();
}

// The optional quote group is load-bearing. Without it a JSON sidecar containing
// {"password":"..."} produced NO findings — the character after the key is a quote,
// not a colon. Confirmed against the earlier pattern set during review, which is why
// both halves of every pair are now screened in every mode.
const CREDENTIAL_PATTERNS = [
  { name: 'private key block', re: /-----BEGIN [A-Z ]*PRIVATE KEY-----/ },
  {
    name: 'credential assignment',
    re: /["']?\b(password|passwd|pwd|secret|token|api[_-]?key|private[_-]?key)\b["']?\s*[:=]\s*["']?\S{6,}/i,
  },
  { name: 'bearer token', re: /\bBearer\s+[A-Za-z0-9._-]{20,}/ },
  { name: 'connection string with credentials', re: /\b[a-z+]+:\/\/[^\s:@/]+:[^\s:@/]+@/i },
];

function scanCredentials(text, label) {
  return CREDENTIAL_PATTERNS.filter((p) => p.re.test(text)).map(
    (p) => `${label}: possible ${p.name} — never commit credentials to a public repo`,
  );
}

/**
 * Screen BOTH halves of an entry pair.
 *
 * This exists as a function rather than a convention because scanning only the body was
 * a real defect: a credential in a sidecar passed the blocking gate. Expressed as two
 * call sites, the gate could only ever prove the copy it wrote itself — a third caller
 * screening one half would go unnoticed.
 */
function scanEntry(entry) {
  return [
    ...scanCredentials(entry.body, entry.bodyPath),
    ...scanCredentials(JSON.stringify(entry.data, null, 1), entry.jsonPath),
  ];
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
  discover,
  scanCredentials,
  scanEntry,
  // Re-exported so callers compare against the same UTC-midnight boundary these dates
  // live on, rather than a wall-clock Date.
  todayUtc,
};
