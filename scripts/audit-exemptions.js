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
 * the whole gate. This gives up exactly one advisory, for at most seven days, in writing.
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

const ROOT = path.join(__dirname, '..');
const REGISTRY_PATH = path.join(ROOT, 'security', 'audit-exemptions.json');

/** Maximum lifetime of any exemption. Deliberately equal to the ADR-059 high-severity SLA. */
const MAX_EXEMPTION_DAYS = 7;

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

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const GHSA_ID = /^GHSA-[a-z0-9]{4}-[a-z0-9]{4}-[a-z0-9]{4}$/;

const MS_PER_DAY = 86400000;

/** Parse a YYYY-MM-DD as UTC midnight. Returns NaN-bearing Date for anything else. */
function parseUtcDate(s) {
  if (typeof s !== 'string' || !ISO_DATE.test(s)) return new Date(NaN);
  const d = new Date(`${s}T00:00:00Z`);
  // Rejects real-looking but invalid dates such as 2026-02-31, which Date would roll over.
  return d.toISOString().slice(0, 10) === s ? d : new Date(NaN);
}

function todayUtc(now = new Date()) {
  return new Date(`${now.toISOString().slice(0, 10)}T00:00:00Z`);
}

/**
 * Schema + expiry validation, independent of npm audit. Reusable (BUG-035).
 * @returns {string[]} human-readable errors; empty means valid.
 */
function validateRegistry(registry, now = new Date()) {
  const errors = [];

  if (registry === null || typeof registry !== 'object' || Array.isArray(registry)) {
    return ['registry must be a JSON object'];
  }
  if (!Array.isArray(registry.exemptions)) {
    return ['registry.exemptions must be an array'];
  }

  const today = todayUtc(now);
  const seen = new Set();

  registry.exemptions.forEach((e, i) => {
    const at = `exemptions[${i}]`;

    if (e === null || typeof e !== 'object' || Array.isArray(e)) {
      errors.push(`${at}: must be an object`);
      return;
    }

    for (const f of REQUIRED_FIELDS) {
      if (typeof e[f] !== 'string' || e[f].trim() === '') {
        errors.push(`${at}: "${f}" is required and must be a non-empty string`);
      }
    }
    // Every later check reads these fields; bail rather than emit cascading noise.
    if (errors.some((m) => m.startsWith(`${at}:`))) return;

    if (!GHSA_ID.test(e.advisory)) {
      errors.push(`${at}: "advisory" must be an exact GHSA id (got "${e.advisory}")`);
    }
    if (e.severity !== 'high') {
      errors.push(
        `${at}: only "high" is exemptible — critical is never exemptible (got "${e.severity}")`
      );
    }

    const key = `${e.package}|${e.advisory}`;
    if (seen.has(key)) errors.push(`${at}: duplicate exemption for ${key}`);
    seen.add(key);

    const created = parseUtcDate(e.created);
    const expires = parseUtcDate(e.expires);
    if (Number.isNaN(created.getTime())) {
      errors.push(`${at}: "created" must be a valid YYYY-MM-DD date (got "${e.created}")`);
    }
    if (Number.isNaN(expires.getTime())) {
      errors.push(`${at}: "expires" must be a valid YYYY-MM-DD date (got "${e.expires}")`);
    }
    if (Number.isNaN(created.getTime()) || Number.isNaN(expires.getTime())) return;

    const days = (expires - created) / MS_PER_DAY;
    if (days <= 0) {
      errors.push(`${at}: "expires" must be after "created"`);
    } else if (days > MAX_EXEMPTION_DAYS) {
      errors.push(
        `${at}: exemption spans ${days} days — the maximum is ${MAX_EXEMPTION_DAYS} (ADR-059 SLA)`
      );
    }
    if (expires < today) {
      errors.push(
        `${at}: EXPIRED on ${e.expires} — re-check upstream and renew with a fresh decision, or fix`
      );
    }
  });

  return errors;
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
 * KARMYQ_AUDIT_REGISTRY overrides the registry path. Used by the regression tier to drive the real
 * CLI against a fixture, which is the only way to prove the EXECUTABLE path exits non-zero — an
 * evaluator returning ok:false while the CLI exits 0 would be a silently inert gate.
 */
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
    return { __parseError: err.message };
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
  const registry = readRegistry();
  if (registry.__parseError) {
    console.error(`❌ security/audit-exemptions.json is not valid JSON: ${registry.__parseError}`);
    process.exit(1);
  }

  const result = evaluateAudit(runAudit(), registry);

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
  MAX_EXEMPTION_DAYS,
  REGISTRY_PATH,
  evaluateAudit,
  reachableAdvisories,
  readRegistry,
  runAudit,
  validateRegistry,
};

if (require.main === module) main();