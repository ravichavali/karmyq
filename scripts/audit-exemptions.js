#!/usr/bin/env node
/**
 * ADR-059 audit gate with time-boxed exemptions.
 *
 * WHY THIS EXISTS
 * ---------------
 * `npm audit --audit-level=high` is binary: an advisory with no published fix blocks every PR
 * indefinitely. Sprint 123 hit exactly that with `image-size` — every published version through
 * 2.0.2 is inside the advisory range, `metro@0.87.0` (newest) still declares `image-size: ^1.0.2`,
 * and 2.x drops the default export metro requires. There is no version to move to.
 *
 * The wrong answers are dropping the gate to `critical`, or `--no-verify`. Both silently give up
 * the whole gate. This gives up exactly one advisory, for a bounded window, in writing.
 * (That window was seven days through Sprint 124; Sprint 125 raised it to thirty and moved the
 * re-measurement obligation onto a weekly live monitor. See `MAX_EXEMPTION_DAYS` below.)
 *
 * DESIGN RULES (all enforced below, each with a RED test in
 * tests/regression/sprint-123-audit-exemption-gate.test.ts)
 *   1. One registry, shared by CI and the regression tier — never two lists that can disagree.
 *   2. Exact `package` + `advisory` GHSA id. No package-wide wildcard: a second, unrelated
 *      advisory on the same package must still block.
 *   3. `high` only. `critical` is never exemptible.
 *   4. Rationale, decision reference, owner, created, expires — all required.
 *   5. Expiry at most 7 days after creation, and not in the past.
 *   6. FAIL CLOSED on: malformed entry, expired entry, an exemption that matches nothing
 *      (upstream shipped a fix, or the id was mistyped), and any unexempted high/critical.
 *   7. A parent finding clears only when EVERY advisory reachable through its `via` graph is
 *      exempted. `metro` is high solely because of `image-size`; if metro later gains an advisory
 *      of its own, it blocks again despite the image-size exemption.
 *
 * The schema/expiry validator is deliberately separable (`validateRegistry`) so BUG-035 can reuse
 * it for the Expo drift workflow without importing any audit-specific logic.
 */

const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { validateRegistry: validateWithSpec } = require('./lib/exemption-registry');

const ROOT = path.join(__dirname, '..');
const REGISTRY_PATH = path.join(ROOT, 'security', 'audit-exemptions.json');

/**
 * Maximum lifetime of any exemption.
 *
 * Sprint 125 (2026-08-17) raised this from 7 to 30 by maintainer decision; ADR-059's amendment
 * "Renewal cadence (Sprint 125)" records the reasoning. It is no longer equal to the high-severity
 * SLA — that decoupling is the point of the change, and the SLA itself is unchanged.
 *
 * What kept the number honest at 7 was that a renewal forced someone to re-measure upstream. That
 * obligation has NOT been dropped; it moved to `.github/workflows/image-size-advisory-watch.yml`,
 * which re-takes the measurements weekly from live arbiters and files an issue the moment a fix,
 * a withdrawal, or a new advisory appears. The cap is the backstop now, not the trigger.
 *
 * ⚠️ Raising this further without an equivalent live monitor would return the registry to being a
 * place where findings are parked and forgotten — the exact failure ADR-059 was written against.
 */
const MAX_EXEMPTION_DAYS = 30;

const REQUIRED_FIELDS = [
  'package',
  'advisory',
  'severity',
  'rationale',
  'decision',
  'owner',
  'created',
  'expires',
];

const GHSA_ID = /^GHSA-[a-z0-9]{4}-[a-z0-9]{4}-[a-z0-9]{4}$/;

const MS_PER_DAY = 86400000;

const AUDIT_SPEC = {
  collection: 'exemptions',
  entryName: 'exemption',
  requiredFields: REQUIRED_FIELDS,
  dateFields: ['created'],
  identity: (entry) => `${entry.package}|${entry.advisory}`,
  fieldValidators: {
    advisory: (value, at) =>
      GHSA_ID.test(value)
        ? []
        : [`${at}: "advisory" must be an exact GHSA id (got "${value}")`],
    severity: (value, at) =>
      value === 'high'
        ? []
        : [
            `${at}: only "high" is exemptible — critical is never exemptible (got "${value}")`,
          ],
  },
  checkExpiry: (entry, { today, parseUtcDate }) => {
    const created = parseUtcDate(entry.created);
    const expires = parseUtcDate(entry.expires);

    if (Number.isNaN(expires.getTime())) {
      return [`"expires" must be a valid YYYY-MM-DD date (got "${entry.expires}")`];
    }
    if (Number.isNaN(created.getTime())) return [];

    const errors = [];

    // The cap below constrains the SPAN, which is only the ADR-059 SLA while `created` is real.
    // A future `created` keeps any span inside the cap while suppressing the finding from today
    // through to a far-future `expires` — a 7-day entry dated 2027-01-01 suppressed a high for 149
    // days and validated clean. With `created <= today` and span <= MAX, `expires` cannot exceed
    // today + MAX, which is the invariant ADR-059 actually claims.
    if (created > today) {
      errors.push(
        `"created" must not be in the future (got "${entry.created}") — a forward-dated exemption keeps its span inside the cap while suppressing the finding far longer`
      );
    }

    const days = (expires - created) / MS_PER_DAY;
    if (days <= 0) {
      errors.push('"expires" must be after "created"');
    } else if (days > MAX_EXEMPTION_DAYS) {
      errors.push(
        `exemption spans ${days} days — the maximum is ${MAX_EXEMPTION_DAYS} (ADR-059 SLA)`
      );
    }
    // `expires` is the first INVALID day, not the last valid one. With `<`, an entry created 08-11
    // and expiring 08-18 stayed live on 8 calendar days (11th through 18th) under a rule calling
    // itself a 7-day cap. `<=` makes the live window exactly MAX_EXEMPTION_DAYS days long.
    if (expires <= today) {
      errors.push(
        `EXPIRED on ${entry.expires} — re-check upstream and renew with a fresh decision, or fix`
      );
    }
    return errors;
  },
};

/**
 * The audit registry's one-argument validator: this module's own spec, bound.
 *
 * Used internally by `evaluateAudit` (below) and asserted directly by
 * `tests/regression/sprint-123-audit-exemption-gate.test.ts:67`. It is part of the public surface —
 * `.github/workflows/ci.yml` runs this script by path, and `sprint-75-security-gate.test.ts`
 * requires the module — so keep the signature stable rather than pushing `AUDIT_SPEC` onto callers.
 */
function validateRegistry(registry, now = new Date()) {
  return validateWithSpec(registry, AUDIT_SPEC, now);
}

/**
 * Every root advisory reachable from `name` through the `via` graph.
 *
 * `via` holds either advisory objects (a real finding on this package) or strings naming another
 * vulnerable package. The graph contains cycles in practice — metro ↔ metro-config ↔
 * metro-transform-worker all list each other — so this walks with an explicit `visiting` set and
 * contributes nothing on a back-edge; the advisory is still counted via the forward path.
 *
 * @returns {Map<string, {package: string, advisory: string, severity: string, title: string}>}
 */
function reachableAdvisories(vulns, name, visiting = new Set()) {
  const found = new Map();
  if (visiting.has(name)) return found;
  visiting.add(name);

  const entry = vulns[name];
  if (!entry || !Array.isArray(entry.via)) return found;

  for (const via of entry.via) {
    if (typeof via === 'object' && via !== null) {
      // `url` is the authoritative GHSA id; `source` is npm's numeric id, which we do not match on.
      const advisory = typeof via.url === 'string' ? via.url.split('/').pop() : null;
      if (!advisory) continue;
      found.set(`${name}|${advisory}`, {
        package: name,
        advisory,
        severity: via.severity,
        title: via.title,
      });
    } else if (typeof via === 'string') {
      for (const [k, v] of reachableAdvisories(vulns, via, visiting)) found.set(k, v);
    }
  }

  visiting.delete(name);
  return found;
}

/**
 * Apply the registry to an `npm audit --json` report.
 *
 * @returns {{ok: boolean, errors: string[], blocking: object[], cleared: object[], unused: object[]}}
 */
function evaluateAudit(report, registry, now = new Date()) {
  const errors = validateRegistry(registry, now);
  if (errors.length) return { ok: false, errors, blocking: [], cleared: [], unused: [] };

  const vulns = (report && report.vulnerabilities) || {};
  const exempt = new Map(registry.exemptions.map((e) => [`${e.package}|${e.advisory}`, e]));
  const matched = new Set();

  const blocking = [];
  const cleared = [];

  for (const [name, entry] of Object.entries(vulns)) {
    if (entry.severity !== 'high' && entry.severity !== 'critical') continue;

    const advisories = [...reachableAdvisories(vulns, name).values()];

    // No reachable advisory at all means the report is shaped in a way we do not understand.
    // Blocking is the safe reading — never treat "I could not tell" as "clean".
    if (advisories.length === 0) {
      blocking.push({ package: name, severity: entry.severity, reason: 'no advisory resolved' });
      continue;
    }

    const unexempted = advisories.filter((a) => {
      const hit = exempt.get(`${a.package}|${a.advisory}`);
      if (hit) matched.add(`${a.package}|${a.advisory}`);
      // Critical is never exemptible, whatever the registry says.
      return !hit || a.severity === 'critical';
    });

    if (unexempted.length === 0) {
      cleared.push({ package: name, severity: entry.severity, via: advisories.map((a) => a.advisory) });
    } else {
      blocking.push({
        package: name,
        severity: entry.severity,
        reason: unexempted.map((a) => `${a.package} ${a.advisory} (${a.severity})`).join(', '),
      });
    }
  }

  // An exemption that matches nothing is stale — upstream shipped a fix, or the id is wrong.
  // Either way it must be removed, so it fails the gate rather than lingering as dead config.
  const unused = registry.exemptions.filter((e) => !matched.has(`${e.package}|${e.advisory}`));
  for (const e of unused) {
    errors.push(
      `exemption ${e.package} ${e.advisory} matches no current advisory — upstream may be fixed; remove it`
    );
  }

  return { ok: blocking.length === 0 && errors.length === 0, errors, blocking, cleared, unused };
}

/**
 * Named fixtures the regression tier may select. Values are CONSTANTS — the environment picks a
 * key, never a path.
 *
 * A prefix check on an env-provided path was the first attempt and CodeQL rejected it, correctly:
 * the path still originated outside the program, so `fs` was reachable from the environment. An
 * allowlist removes the sink rather than guarding it, and it also documents exactly which
 * fixtures exist.
 */
const TEST_REGISTRIES = {
  empty: path.join(ROOT, 'tests', 'regression', 'fixtures', 'audit-exemptions-empty.json'),
};

function registryPath() {
  const key = process.env.KARMYQ_AUDIT_REGISTRY;
  if (!key) return REGISTRY_PATH;

  if (!Object.prototype.hasOwnProperty.call(TEST_REGISTRIES, key)) {
    throw new Error(
      `KARMYQ_AUDIT_REGISTRY must name a known fixture (${Object.keys(TEST_REGISTRIES).join(', ')}); got "${key}"`
    );
  }
  return TEST_REGISTRIES[key];
}

function readRegistry(file = registryPath()) {
  if (!fs.existsSync(file)) return { exemptions: [] };
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (err) {
    // Throws rather than returning a sentinel the caller must remember to check. A forgotten
    // sentinel check is a fail-OPEN; an exception cannot be forgotten. (It also removes the
    // `if (parseError) process.exit(1)` branch CodeQL flagged as a user-controlled guard on a
    // sensitive action.)
    throw new Error(`${file} is not valid JSON: ${err.message}`);
  }
}

function runAudit(cwd = ROOT) {
  // npm audit exits non-zero when findings exist; the JSON still arrives on stdout.
  try {
    return JSON.parse(
      // Windows: Node 24 refuses to execFile a `.cmd` directly (spawnSync npm.cmd EINVAL), and
      // `shell: true` both triggers DEP0190 and concatenates argv unescaped — the shape of the
      // js/command-line-injection finding this repo has already fixed once. Going through
      // cmd.exe with a real argv array avoids all three.
      execFileSync(...(process.platform === 'win32'
        ? ['cmd.exe', ['/c', 'npm', 'audit', '--package-lock-only', '--json']]
        : ['npm', ['audit', '--package-lock-only', '--json']]), {
        cwd,
        encoding: 'utf8',
        maxBuffer: 64 * 1024 * 1024,
      })
    );
  } catch (err) {
    const out = err.stdout ? err.stdout.toString() : '';
    if (!out) throw err;
    return JSON.parse(out);
  }
}

function main() {
  const result = evaluateAudit(runAudit(), readRegistry());

  for (const c of result.cleared) {
    console.log(`⚠️  EXEMPT (${c.severity}): ${c.package} — via ${c.via.join(', ')}`);
  }
  for (const e of result.errors) console.error(`❌ ${e}`);
  for (const b of result.blocking) {
    console.error(`❌ BLOCKING (${b.severity}): ${b.package} — ${b.reason}`);
  }

  if (!result.ok) {
    console.error('\nADR-059 gate FAILED.');
    process.exit(1);
  }

  const n = result.cleared.length;
  console.log(
    n === 0
      ? '✅ ADR-059 gate clean: 0 high/critical.'
      : `✅ ADR-059 gate clean: 0 unexempted high/critical (${n} finding(s) under time-boxed exemption).`
  );
}

module.exports = {
  AUDIT_SPEC,
  MAX_EXEMPTION_DAYS,
  REGISTRY_PATH,
  evaluateAudit,
  reachableAdvisories,
  readRegistry,
  runAudit,
  validateRegistry,
};

if (require.main === module) {
  try {
    main();
  } catch (err) {
    // Any failure to even evaluate the gate is a gate FAILURE, never a pass. This is the
    // fail-closed backstop for a malformed registry, an unknown fixture key, or an npm audit
    // that could not be parsed.
    console.error(`❌ ${err.message}`);
    console.error('\nADR-059 gate FAILED.');
    process.exit(1);
  }
}
