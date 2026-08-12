#!/usr/bin/env node
/**
 * Expo SDK drift gate with SDK-generation-scoped divergences (ADR-094).
 *
 * Expo's live `expo install --check` result remains the arbiter. This gate subtracts only exact,
 * reviewed divergences and fails closed when the output, registry, or live inputs disagree.
 */

const { spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const {
  validateRegistry: validateWithSpec,
} = require("./lib/exemption-registry");

const ROOT = path.join(__dirname, "..");
const MOBILE_ROOT = path.join(ROOT, "apps", "mobile");
const MOBILE_PACKAGE_PATH = path.join(MOBILE_ROOT, "package.json");
const REGISTRY_PATH = path.join(ROOT, "security", "expo-divergences.json");

const REQUIRED_FIELDS = [
  "package",
  "declared",
  "expoPins",
  "sdk",
  "rationale",
  "decision",
  "owner",
  "created",
];

const DRIFT_HEADER =
  "The following packages should be updated for best compatibility with the installed expo version:";
const DRIFT_GUIDANCE =
  "Your project may not work correctly until you install the expected versions of the packages.";
const DRIFT_FOOTER = "Found outdated dependencies";
const DRIFT_LINE = /^\s*(@?[^@\s]+)@(\S+)\s+-\s+expected version:\s+(.+?)\s*$/;

/** Live SDK major from apps/mobile's declared expo range. Never a hand-maintained constant. */
function currentSdkMajor(mobilePkg) {
  const range = (mobilePkg.dependencies || {}).expo;
  const match = /(\d+)\./.exec(String(range || ""));
  if (!match)
    throw new Error("cannot derive the SDK major from apps/mobile expo range");
  return match[1];
}

function readMobilePackage() {
  try {
    return JSON.parse(fs.readFileSync(MOBILE_PACKAGE_PATH, "utf8"));
  } catch (err) {
    throw new Error(`${MOBILE_PACKAGE_PATH} is not valid JSON: ${err.message}`);
  }
}

function declaredRange(mobilePkg, packageName) {
  return (
    (mobilePkg.dependencies || {})[packageName] ??
    (mobilePkg.devDependencies || {})[packageName]
  );
}

function expoSpec(mobilePkg) {
  const sdk = currentSdkMajor(mobilePkg);
  return {
    collection: "divergences",
    requiredFields: REQUIRED_FIELDS,
    identity: (entry) => entry.package,
    fieldValidators: {
      sdk: (value, at) =>
        /^\d+$/.test(value)
          ? []
          : [`${at}: "sdk" must be a numeric Expo SDK major (got "${value}")`],
    },
    checkExpiry: (entry) =>
      entry.sdk === sdk
        ? []
        : [
            `EXPIRED with SDK ${entry.sdk} — re-argue this divergence for SDK ${sdk}`,
          ],
  };
}

function validateDeclaredRanges(registry, mobilePkg) {
  const errors = [];
  for (const entry of registry.divergences) {
    const live = declaredRange(mobilePkg, entry.package);
    if (entry.declared !== live) {
      errors.push(
        `divergence ${entry.package} recorded declared "${entry.declared}" but apps/mobile declares "${live ?? "not declared"}"`,
      );
    }
  }
  return errors;
}

function validateRegistry(registry, mobilePkg = readMobilePackage()) {
  const errors = validateWithSpec(registry, expoSpec(mobilePkg));
  if (errors.length) return errors;
  return validateDeclaredRanges(registry, mobilePkg);
}

/** Parse every package drift from the human-readable `expo install --check` output. */
function parseExpoCheckOutput(output) {
  const lines = String(output || "").split(/\r?\n/);
  const headerIndexes = lines
    .map((line, index) => (line.trim() === DRIFT_HEADER ? index : -1))
    .filter((index) => index !== -1);

  if (headerIndexes.length === 0) {
    if (lines.some((line) => DRIFT_LINE.test(line))) {
      throw new Error(
        "recognized Expo drift rows without the required header and footer framing",
      );
    }
    return [];
  }
  if (headerIndexes.length !== 1) {
    throw new Error("Expo drift output contains multiple drift headers");
  }

  const headerIndex = headerIndexes[0];
  const guidanceIndex = lines.findIndex(
    (line, index) => index > headerIndex && line.trim() === DRIFT_GUIDANCE,
  );
  if (guidanceIndex === -1) {
    throw new Error(
      "Expo drift output is missing its compatibility guidance footer",
    );
  }

  const footerIndex = lines.findIndex(
    (line, index) => index > guidanceIndex && line.trim() !== "",
  );
  if (footerIndex === -1 || lines[footerIndex].trim() !== DRIFT_FOOTER) {
    throw new Error(
      `Expo drift output is missing its final "${DRIFT_FOOTER}" footer`,
    );
  }
  const trailingIndex = lines.findIndex(
    (line, index) => index > footerIndex && line.trim() !== "",
  );
  if (trailingIndex !== -1) {
    throw new Error(
      `unexpected content after the final Expo drift footer: "${lines[trailingIndex].trim()}"`,
    );
  }

  const drifts = [];
  for (const line of lines.slice(headerIndex + 1, guidanceIndex)) {
    const match = DRIFT_LINE.exec(line);
    if (!match) {
      throw new Error(`cannot parse Expo drift row "${line.trim()}"`);
    }
    drifts.push({ package: match[1], installed: match[2], expoPins: match[3] });
  }
  if (drifts.length === 0)
    throw new Error("Expo drift block contains no package rows");
  return drifts;
}

function failedResult(errors) {
  return { ok: false, errors, blocking: [], cleared: [], stale: [] };
}

/**
 * Apply the divergence registry to an Expo compatibility check.
 *
 * @returns {{ok: boolean, errors: string[], blocking: object[], cleared: object[], stale: object[]}}
 */
function evaluate(checkResult, registry) {
  const mobilePkg = readMobilePackage();
  const errors = validateRegistry(registry, mobilePkg);
  if (errors.length) return failedResult(errors);

  if (checkResult && checkResult.signal) {
    return failedResult([
      `Expo install check was terminated by signal ${checkResult.signal}`,
    ]);
  }

  const status = checkResult && checkResult.status;
  if (status !== 0 && status !== 1) {
    return failedResult([
      `Expo install check returned unexpected exit status ${status}`,
    ]);
  }

  let drifts;
  try {
    drifts = parseExpoCheckOutput(checkResult.output);
  } catch (err) {
    return failedResult([
      `could not parse the complete Expo drift output: ${err.message}`,
    ]);
  }

  if (status === 1 && drifts.length === 0) {
    return failedResult([
      "Expo install check exited non-zero, but the gate could not parse any drift; output format was not recognized and compatibility could not be determined",
    ]);
  }
  if (status === 0 && drifts.length !== 0) {
    return failedResult([
      `Expo emitted a drift block with exit status 0; the documented drift status is 1`,
    ]);
  }

  const registered = new Map(
    registry.divergences.map((entry) => [entry.package, entry]),
  );
  const matched = new Set();
  const mismatched = new Set();
  const blocking = [];

  for (const drift of drifts) {
    const entry = registered.get(drift.package);
    if (!entry) {
      blocking.push(drift);
      continue;
    }

    matched.add(entry.package);
    if (entry.expoPins !== drift.expoPins) {
      mismatched.add(entry.package);
      errors.push(
        `divergence ${entry.package} recorded expoPins "${entry.expoPins}" but Expo reports "${drift.expoPins}"`,
      );
    }
  }

  const cleared = registry.divergences.filter(
    (entry) => matched.has(entry.package) && !mismatched.has(entry.package),
  );
  const stale = registry.divergences.filter(
    (entry) => !matched.has(entry.package),
  );

  for (const entry of stale) {
    errors.push(
      `divergence ${entry.package} matches no current Expo drift — the pin may have converged; remove it`,
    );
  }

  return {
    ok: blocking.length === 0 && errors.length === 0,
    errors,
    blocking,
    cleared,
    stale,
  };
}

/** Constant fixture paths. The environment selects a key and never supplies a filesystem path. */
const TEST_REGISTRIES = {
  "wrong-sdk": path.join(
    ROOT,
    "tests",
    "regression",
    "fixtures",
    "expo-divergences-wrong-sdk.json",
  ),
};

function registryPath() {
  const key = process.env.KARMYQ_EXPO_REGISTRY;
  if (!key) return REGISTRY_PATH;
  if (!Object.prototype.hasOwnProperty.call(TEST_REGISTRIES, key)) {
    throw new Error(
      `KARMYQ_EXPO_REGISTRY must name a known fixture (${Object.keys(TEST_REGISTRIES).join(", ")}); got "${key}"`,
    );
  }
  return TEST_REGISTRIES[key];
}

function readRegistry(file = registryPath()) {
  if (!fs.existsSync(file)) throw new Error(`${file} does not exist`);
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (err) {
    throw new Error(`${file} is not valid JSON: ${err.message}`);
  }
}

function runExpoCheck() {
  const command = process.platform === "win32" ? "cmd.exe" : "npx";
  const args =
    process.platform === "win32"
      ? ["/d", "/s", "/c", "npx", "expo", "install", "--check"]
      : ["expo", "install", "--check"];
  const result = spawnSync(command, args, {
    cwd: MOBILE_ROOT,
    encoding: "utf8",
    env: { ...process.env, EXPO_NO_TELEMETRY: "1" },
    maxBuffer: 16 * 1024 * 1024,
  });

  if (result.error) throw result.error;
  return {
    status: result.status,
    signal: result.signal,
    output: `${result.stdout || ""}${result.stderr || ""}`,
  };
}

function printResult(result) {
  for (const entry of result.cleared) {
    console.log(
      `⚠️  REGISTERED DIVERGENCE: ${entry.package} ${entry.declared} (Expo pins ${entry.expoPins})`,
    );
  }
  for (const error of result.errors) console.error(`❌ ${error}`);
  for (const drift of result.blocking) {
    console.error(
      `❌ BLOCKING: ${drift.package}@${drift.installed} — Expo expects ${drift.expoPins}`,
    );
  }
}

function main() {
  const args = process.argv.slice(2);
  if (args.some((arg) => arg !== "--registry-only") || args.length > 1) {
    throw new Error(
      "usage: node scripts/expo-divergences.js [--registry-only]",
    );
  }

  const registry = readRegistry();
  if (args[0] === "--registry-only") {
    const mobilePkg = readMobilePackage();
    const errors = validateRegistry(registry, mobilePkg);
    const result = {
      ok: errors.length === 0,
      errors,
      blocking: [],
      cleared: [],
      stale: [],
    };
    printResult(result);
    if (!result.ok) {
      console.error("\nExpo divergence gate FAILED.");
      process.exitCode = 1;
      return;
    }
    console.log(
      `✅ Expo divergence registry valid for SDK ${currentSdkMajor(mobilePkg)}.`,
    );
    return;
  }

  const result = evaluate(runExpoCheck(), registry);
  printResult(result);
  if (!result.ok) {
    console.error("\nExpo divergence gate FAILED.");
    process.exitCode = 1;
    return;
  }
  console.log(
    `✅ Expo divergence gate clean (${result.cleared.length} registered divergence(s)).`,
  );
}

module.exports = {
  REGISTRY_PATH,
  currentSdkMajor,
  evaluate,
  expoSpec,
  parseExpoCheckOutput,
  readRegistry,
  runExpoCheck,
  validateRegistry,
};

if (require.main === module) {
  try {
    main();
  } catch (err) {
    console.error(`❌ ${err.message}`);
    console.error("\nExpo divergence gate FAILED.");
    process.exitCode = 1;
  }
}
