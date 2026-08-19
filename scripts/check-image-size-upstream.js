#!/usr/bin/env node
/**
 * `image-size` upstream monitor (Sprint 125, Task 0 follow-through).
 *
 * WHY THIS EXISTS
 * ---------------
 * `security/audit-exemptions.json` suppresses two high advisories on `image-size` for a bounded
 * window (`MAX_EXEMPTION_DAYS`, ADR-059). That cap forces a human to re-decide. But
 * re-deciding requires *measurements*, and the measurements that mattered in Sprints 123-125 were
 * each re-taken by hand — `npm view`, the GHSA pages, `npm ls` — which is exactly the kind of
 * check that quietly stops happening.
 *
 * This script takes those measurements from the LIVE arbiters on every run:
 *   1. `npm view image-size version`          — is there a newer published release?
 *   2. `npm view metro@latest ...`            — has Metro moved off its `image-size ^1.0.2` dep?
 *   3. GitHub's advisory API, per GHSA id     — is there a patched version, or a withdrawal?
 *   4. GitHub's advisory API, by package      — has a THIRD advisory appeared? (the gate matches
 *                                               exact ids, so a new one blocks despite the two
 *                                               exemptions)
 *   5. `npm ls image-size --all --json`       — what does this repo actually resolve?
 *   6. `security/audit-exemptions.json`       — how long is the current decision good for?
 *
 * DESIGN RULES
 *   1. **No shadow map.** Nothing here is compared against a hand-written copy of upstream state.
 *      "Is the resolved version vulnerable" is answered by `semver.satisfies` against the range
 *      the advisory API returns *this run*, never against a remembered range. A gate that
 *      compares two local files that agree with each other is false-green (ADR-094's lesson).
 *   2. **NEVER writes `security/audit-exemptions.json`.** Renewing an exemption is a reviewed
 *      human decision with a written rationale and explicit authorization. A monitor that could
 *      renew its own suppression is not a monitor. The registry is opened read-only, and
 *      `tests/regression/sprint-125-image-size-monitor.test.ts` asserts this file contains no
 *      write path to it.
 *   3. **Quiet unless actionable.** Exit 0 and print a one-line all-clear while upstream is
 *      unchanged. Exit 1 only when a human has something to *do*: a fix landed, an advisory was
 *      withdrawn, a new advisory appeared, the tree changed, or the horizon needs a decision.
 *      A monitor that cries every week is a monitor whose output gets filtered to trash.
 *
 * USAGE
 *   node scripts/check-image-size-upstream.js            # human-readable
 *   node scripts/check-image-size-upstream.js --json     # machine-readable, for the workflow
 */

const { execFileSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const semver = require("semver");
// The cap is OWNED by the audit gate. Reading it here (rather than restating the number) keeps
// the monitor's guidance correct the next time it moves; Sprint 125 shipped a workflow that told
// humans "max 7 days" in the same diff that raised it to 30.
const { MAX_EXEMPTION_DAYS } = require("./audit-exemptions");
// `parseUtcDate` re-implemented here would drop the ISO_DATE regex and the 2026-02-31 rollover
// guard the shared core already has.
const { parseUtcDate, todayUtc } = require("./lib/exemption-registry");

const ROOT = path.join(__dirname, "..");
const REGISTRY_PATH = path.join(ROOT, "security", "audit-exemptions.json");

/**
 * Packages this monitor actually watches.
 *
 * ⚠️ THIS IS A COVERAGE CONTRACT, not a convenience list. Sprint 125 raised `MAX_EXEMPTION_DAYS`
 * from 7 to 30 on the explicit grounds that the re-measurement obligation moved to this monitor.
 * That argument only holds for packages this file actually looks at. A second package exempted
 * without being added here would inherit the 30-day cap with ZERO monitoring — including the
 * horizon warning — so it could lapse and start failing every PR between two quiet weekly runs.
 * That is strictly worse than the pre-sprint state, where the 7-day cap forced a human
 * re-decision for any package.
 *
 * `tests/regression/sprint-125-image-size-monitor.test.ts` asserts every distinct `package` in
 * security/audit-exemptions.json appears here, so adding an exemption without extending the
 * monitor is a BUILD FAILURE rather than a silent gap.
 */
const WATCHED_PACKAGES = ["image-size"];

/** The package under watch. */
const PACKAGE = WATCHED_PACKAGES[0];

/** The package whose dependency edge is the reason `image-size` is in this tree at all. */
const PARENT = "metro";

/**
 * How close to the exemption horizon before the monitor asks for a decision.
 *
 * Sized to the scheduling interval, not picked for feel: the workflow runs weekly, so an exemption
 * lapsing within 7 days will lapse BEFORE the next run. Warning any later would mean the horizon
 * passes between two quiet runs — the exact silence this monitor exists to prevent.
 *
 * Sprint 125 raised `MAX_EXEMPTION_DAYS` to 30, which is what makes this window meaningful: a live
 * exemption is now silent for its first three weeks and speaks up only in the final one. Under the
 * previous 7-day cap the two numbers were equal, so this signal fired on every single run — the
 * cap and the warning window must not be allowed to converge again, or the monitor becomes noise
 * and gets filtered to trash.
 */
const HORIZON_WARNING_DAYS = 7;

const MS_PER_DAY = 86400000;

const ADVISORY_API = "https://api.github.com/advisories";

/**
 * Run a command and return stdout.
 *
 * Windows/Node 24: `execFile`ing `npm.cmd` directly fails with `spawnSync npm.cmd EINVAL`, so npm
 * is reached through `cmd.exe /c`. Same shape as the npm invocation in
 * `scripts/audit-exemptions.js` (deliberately no line citation — the one written here was stale
 * before this file was even committed).
 */
function run(command, args, options = {}) {
  const [file, argv] =
    process.platform === "win32"
      ? ["cmd.exe", ["/c", command, ...args]]
      : [command, args];
  return execFileSync(file, argv, {
    cwd: ROOT,
    encoding: "utf8",
    maxBuffer: 32 * 1024 * 1024,
    stdio: ["ignore", "pipe", "pipe"],
    ...options,
  });
}

/**
 * `npm view <spec> <field...> --json`, parsed. Returns undefined when nothing came back.
 *
 * ⚠️ Fields are SEPARATE argv elements. Passing "version dependencies" as one string asks npm for
 * a single field whose name contains a space; it returns empty, and the caller silently reads
 * `undefined` as "metro no longer declares image-size" — a false actionable signal that would
 * file a misleading issue. Caught in review; the shape with 2+ fields is an OBJECT keyed by field
 * name, not an array.
 */
function npmView(spec, ...fields) {
  const raw = run("npm", ["view", spec, ...fields, "--json"]).trim();
  if (raw === "") return undefined;
  return JSON.parse(raw);
}

/**
 * Fetch a single advisory by GHSA id.
 *
 * Unauthenticated works but is rate-limited to 60/hour per IP; the workflow passes GITHUB_TOKEN.
 */
async function fetchAdvisory(ghsaId) {
  return fetchJson(`${ADVISORY_API}/${encodeURIComponent(ghsaId)}`);
}

/** Every published advisory affecting the watched package, whatever its severity. */
async function fetchAdvisoriesForPackage(packageName) {
  const url = `${ADVISORY_API}?ecosystem=npm&affects=${encodeURIComponent(packageName)}&per_page=100`;
  return fetchJson(url);
}

async function fetchJson(url) {
  const headers = {
    accept: "application/vnd.github+json",
    "user-agent": "karmyq-image-size-monitor",
    "x-github-api-version": "2022-11-28",
  };
  const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
  if (token) headers.authorization = `Bearer ${token}`;

  const response = await fetch(url, { headers });
  if (!response.ok) {
    throw new Error(
      `GitHub advisory API ${response.status} ${response.statusText} for ${url}`,
    );
  }
  return response.json();
}

/**
 * The vulnerability entry for `packageName` inside an advisory payload.
 *
 * An advisory can list several packages; picking the first blindly would compare `image-size`'s
 * resolved version against some other package's range.
 */
function vulnerabilityFor(advisory, packageName) {
  return (advisory.vulnerabilities || []).find(
    (entry) => entry.package && entry.package.name === packageName,
  );
}

/** Read the audit registry. Read-only by construction — this module never writes it. */
function readRegistry() {
  try {
    return JSON.parse(fs.readFileSync(REGISTRY_PATH, "utf8"));
  } catch (err) {
    throw new Error(`${REGISTRY_PATH} is not readable JSON: ${err.message}`);
  }
}

/** Exemptions in the registry that cover the watched package. */
function exemptionsForPackage(registry, packageName) {
  return (registry.exemptions || []).filter(
    (entry) => entry.package === packageName,
  );
}

/**
 * Every resolved `image-size` instance in this repo's tree, with its dependency path.
 *
 * `npm ls` exits non-zero for unrelated tree complaints (peer warnings, extraneous packages) while
 * still emitting valid JSON, so its exit status is deliberately ignored and only the payload is
 * trusted.
 */
function resolvedInstances(packageName = PACKAGE) {
  let raw;
  try {
    raw = run("npm", ["ls", packageName, "--all", "--json"]);
  } catch (err) {
    raw = err.stdout;
    if (!raw) throw new Error(`npm ls ${packageName} produced no output`);
  }

  const tree = JSON.parse(raw);
  const found = [];
  const seen = new Set();

  const walk = (node, trail) => {
    for (const [name, child] of Object.entries(node.dependencies || {})) {
      if (!child || typeof child !== "object") continue;
      const nextTrail = [...trail, `${name}@${child.version ?? "?"}`];
      if (name === packageName && child.version) {
        const key = nextTrail.join(" > ");
        if (!seen.has(key)) {
          seen.add(key);
          found.push({ version: child.version, path: key });
        }
      }
      walk(child, nextTrail);
    }
  };

  walk(tree, [tree.name ? `${tree.name}@${tree.version ?? "?"}` : "root"]);
  return found;
}

/**
 * Compare live measurements against the local decision and produce the signal list.
 *
 * Pure: every input is passed in, so `tests/` can drive it with synthetic upstream states without
 * reaching the network. That is what makes "prove the monitor can fail" cheap.
 *
 * @returns {{ok: boolean, signals: Array<{code: string, message: string}>, facts: object}}
 */
function evaluate({ latestVersion, parentRange, parentVersion, advisories, packageAdvisories, instances, exemptions }, now = new Date()) {
  const signals = [];
  const today = todayUtc(now);

  const add = (code, message) => signals.push({ code, message });

  // --- 1. Per-exempted-advisory upstream state -------------------------------------------------
  for (const advisory of advisories) {
    const vulnerability = vulnerabilityFor(advisory, PACKAGE);
    const range = vulnerability ? vulnerability.vulnerable_version_range : null;
    const patched = vulnerability ? vulnerability.first_patched_version : null;

    if (advisory.withdrawn_at) {
      add(
        "advisory-withdrawn",
        `${advisory.ghsa_id} was WITHDRAWN on ${advisory.withdrawn_at}. The audit gate fails on an exemption that matches no live advisory — delete this entry from security/audit-exemptions.json.`,
      );
      continue;
    }

    if (patched) {
      add(
        "patched-release",
        `${advisory.ghsa_id} now reports first_patched_version ${patched} (was null). Upgrade ${PACKAGE} past it and DELETE this exemption.`,
      );
    }

    // A newer published release that falls outside the vulnerable range is an upgrade path even
    // when the advisory has not been re-cut to name a patched version.
    if (!patched && range && latestVersion && !semver.satisfies(latestVersion, range, { includePrerelease: true })) {
      add(
        "latest-outside-range",
        `${PACKAGE}@${latestVersion} is the newest published release and is OUTSIDE ${advisory.ghsa_id}'s vulnerable range (${range}). An upgrade path exists.`,
      );
    }
  }

  // --- 2. A third advisory would block the gate despite both exemptions ------------------------
  const exemptedIds = new Set(exemptions.map((entry) => entry.advisory));
  for (const advisory of packageAdvisories) {
    if (advisory.withdrawn_at) continue;
    if (exemptedIds.has(advisory.ghsa_id)) continue;

    const severity = String(advisory.severity || "").toLowerCase();
    if (severity !== "high" && severity !== "critical") continue;

    const vulnerability = vulnerabilityFor(advisory, PACKAGE);
    const range = vulnerability ? vulnerability.vulnerable_version_range : null;
    const hits = instances.filter(
      (instance) => range && semver.satisfies(instance.version, range, { includePrerelease: true }),
    );
    if (hits.length === 0) continue;

    add(
      "new-advisory",
      `${advisory.ghsa_id} (${severity}) affects resolved ${PACKAGE}@${hits[0].version} and is NOT exempted. Exemptions match exact GHSA ids, so this BLOCKS the audit gate now.`,
    );
  }

  // --- 3. Has Metro moved off the dependency? --------------------------------------------------
  if (parentRange === undefined || parentRange === null) {
    add(
      "parent-dropped-dep",
      `${PARENT}@${parentVersion} no longer declares a ${PACKAGE} dependency at all. Upgrading ${PARENT} may remove this package from the tree entirely.`,
    );
  } else {
    // Metro's declared range mattering means: does a version satisfying it still land inside every
    // live vulnerable range? If some satisfying version escapes, upgrading Metro is a real path.
    const stillForcesVulnerable = advisories.every((advisory) => {
      // `true` is the NEUTRAL value inside `.every`, and a withdrawn advisory constrains nothing.
      // Returning `false` here short-circuited the whole predicate, so ONE withdrawn advisory made
      // the monitor claim "upgrading metro is a remediation path" while the other advisory was
      // still live and still blocking — a confident, wrong instruction in the issue body.
      if (advisory.withdrawn_at) return true;
      const vulnerability = vulnerabilityFor(advisory, PACKAGE);
      const range = vulnerability ? vulnerability.vulnerable_version_range : null;
      if (!range || !latestVersion) return true;
      // The best a consumer of `parentRange` could resolve to is the newest published version
      // that satisfies it.
      return !semver.satisfies(latestVersion, parentRange, { includePrerelease: true })
        || semver.satisfies(latestVersion, range, { includePrerelease: true });
    });
    if (!stillForcesVulnerable) {
      add(
        "parent-moved",
        `${PARENT}@${parentVersion} declares ${PACKAGE} ${parentRange}, which can now resolve to a version outside the advisory ranges. Upgrading ${PARENT} is a remediation path.`,
      );
    }
  }

  // --- 4. What does this repo actually resolve? ------------------------------------------------
  // Ranges come from EVERY live advisory for the package, not just the two exempted ones. Deriving
  // them from `advisories` alone made "is the tree vulnerable" unanswerable once the exemptions
  // were deleted: an empty range list matches nothing, so the success state and a brand-new
  // unexempted advisory both read as "not vulnerable".
  const liveRanges = packageAdvisories
    .filter((advisory) => !advisory.withdrawn_at)
    .map((advisory) => {
      const vulnerability = vulnerabilityFor(advisory, PACKAGE);
      return vulnerability ? vulnerability.vulnerable_version_range : null;
    })
    .filter(Boolean);

  // These two signals say "your exemptions no longer match reality — delete them". With no
  // exemptions on file there is nothing to delete: that is the post-remediation success state,
  // and reporting it every week is how a monitor trains its reader to ignore it.
  if (exemptions.length > 0) {
    if (instances.length === 0) {
      add(
        "tree-clean",
        `${PACKAGE} is no longer present in the resolved tree. The exemptions now match nothing and the audit gate will FAIL until they are deleted.`,
      );
    } else {
      const vulnerable = instances.filter((instance) =>
        liveRanges.some((range) => semver.satisfies(instance.version, range, { includePrerelease: true })),
      );
      if (vulnerable.length === 0) {
        add(
          "tree-not-vulnerable",
          `Resolved ${PACKAGE} (${instances.map((i) => i.version).join(", ")}) matches NO live advisory range. Remediation appears complete — delete the exemptions.`,
        );
      }
    }
  }

  // --- 5. Does the local decision need renewing? -----------------------------------------------
  for (const exemption of exemptions) {
    const expires = parseUtcDate(exemption.expires);
    if (Number.isNaN(expires.getTime())) {
      add(
        "horizon-unparseable",
        `Exemption ${exemption.advisory} has an unparseable "expires" (${exemption.expires}).`,
      );
      continue;
    }
    // `expires` is the first INVALID day (scripts/audit-exemptions.js checkExpiry uses `<=`), so
    // the last day the exemption is live is `expires - 1`.
    const daysLeft = Math.round((expires - today) / MS_PER_DAY);
    if (daysLeft <= 0) {
      add(
        "horizon-expired",
        `Exemption ${exemption.advisory} EXPIRED on ${exemption.expires} — the audit gate is failing every PR right now. Remediate, or renew with a fresh reviewed decision.`,
      );
    } else if (daysLeft <= HORIZON_WARNING_DAYS) {
      add(
        "horizon-approaching",
        `Exemption ${exemption.advisory} stops suppressing on ${exemption.expires} (${daysLeft} day(s) left). It needs a remediation attempt or an authorized renewal before then.`,
      );
    }
  }

  return {
    ok: signals.length === 0,
    signals,
    facts: {
      package: PACKAGE,
      latestVersion,
      parent: PARENT,
      parentVersion,
      parentRange: parentRange ?? null,
      advisories: advisories.map((advisory) => {
        const vulnerability = vulnerabilityFor(advisory, PACKAGE);
        return {
          ghsa_id: advisory.ghsa_id,
          severity: advisory.severity,
          withdrawn_at: advisory.withdrawn_at ?? null,
          vulnerable_version_range: vulnerability ? vulnerability.vulnerable_version_range : null,
          first_patched_version: vulnerability ? vulnerability.first_patched_version : null,
        };
      }),
      resolved: instances,
      exemptions: exemptions.map((entry) => ({
        advisory: entry.advisory,
        created: entry.created,
        expires: entry.expires,
      })),
      maxExemptionDays: MAX_EXEMPTION_DAYS,
      measuredAt: new Date().toISOString(),
    },
  };
}

/** Take every live measurement. Network + npm registry access required. */
async function measure() {
  const registry = readRegistry();
  // Zero exemptions is deliberately NOT an error. It is the success state: remediation landed and
  // the entries were deleted. Throwing here would leave the monitor permanently red precisely
  // when the problem it watches is over — and a job that is always red is a job nobody reads.
  // `evaluate` still fires if the tree is vulnerable with nothing exempting it.
  const exemptions = exemptionsForPackage(registry, PACKAGE);

  // One `npm view` for the parent, not two: both fields come from the same packument, and each
  // spawn is a process plus a registry round trip.
  const latestVersion = npmView(PACKAGE, "version");
  const parent = npmView(`${PARENT}@latest`, "version", "dependencies") || {};
  const parentVersion = parent.version;
  const parentRange = (parent.dependencies || {})[PACKAGE];

  // Independent network calls — no ordering between them.
  const [advisories, packageAdvisories] = await Promise.all([
    Promise.all(exemptions.map((e) => fetchAdvisory(e.advisory))),
    fetchAdvisoriesForPackage(PACKAGE),
  ]);
  const instances = resolvedInstances();

  return { latestVersion, parentRange, parentVersion, advisories, packageAdvisories, instances, exemptions };
}

function printHuman(result) {
  const { facts } = result;
  console.log(`${PACKAGE} upstream check — measured ${facts.measuredAt}`);
  console.log(`  newest published:   ${PACKAGE}@${facts.latestVersion}`);
  console.log(`  ${PARENT}@${facts.parentVersion} declares: ${PACKAGE} ${facts.parentRange ?? "(no dependency)"}`);
  for (const advisory of facts.advisories) {
    console.log(
      `  ${advisory.ghsa_id} [${advisory.severity}] range=${advisory.vulnerable_version_range} patched=${advisory.first_patched_version ?? "none"}${advisory.withdrawn_at ? ` WITHDRAWN ${advisory.withdrawn_at}` : ""}`,
    );
  }
  for (const instance of facts.resolved) {
    console.log(`  resolved: ${instance.path}`);
  }
  for (const exemption of facts.exemptions) {
    console.log(`  exemption ${exemption.advisory}: created ${exemption.created}, stops suppressing ${exemption.expires}`);
  }

  if (result.ok) {
    console.log(`\n✅ Nothing actionable — upstream is unchanged and the horizon is not near.`);
    return;
  }
  console.log("");
  for (const signal of result.signals) {
    console.log(`❗ [${signal.code}] ${signal.message}`);
  }
}

async function main() {
  const asJson = process.argv.slice(2).includes("--json");
  const result = evaluate(await measure());

  if (asJson) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    printHuman(result);
  }

  process.exitCode = result.ok ? 0 : 1;
}

module.exports = {
  HORIZON_WARNING_DAYS,
  WATCHED_PACKAGES,
  PACKAGE,
  PARENT,
  REGISTRY_PATH,
  evaluate,
  exemptionsForPackage,
  measure,
  readRegistry,
  resolvedInstances,
  vulnerabilityFor,
};

if (require.main === module) {
  main().catch((err) => {
    console.error(`❌ ${err.message}`);
    console.error(
      "\nThe monitor could not complete its measurements. This is NOT an all-clear.",
    );
    process.exitCode = 1;
  });
}
