/**
 * Sprint 117 — Curated Demo Fixtures: allowlisted `.env.demo` config publisher.
 *
 * Touches only the five allowlisted demo variables — the persona email and the four
 * server-generated story IDs. It backs the file up first, replaces exactly the anchored key
 * lines in memory (keeping every other line), writes a same-directory temp file with restrictive
 * permissions, then atomically renames it over the original. Unknown or missing keys fail closed.
 */

export const DEMO_CONFIG_KEYS = [
  'DEMO_PERSONA_EMAIL',
  'DEMO_ORDINARY_REQUEST_ID',
  'DEMO_ORDINARY_MATCH_ID',
  'DEMO_PROVIDER_REQUEST_ID',
  'DEMO_PROVIDER_OFFER_ID',
] as const;

export type DemoConfigKey = (typeof DEMO_CONFIG_KEYS)[number];
export type DemoConfigValues = Record<DemoConfigKey, string>;

/** Injected filesystem operations so publication is unit-testable without touching disk. */
export interface ConfigFsDeps {
  readFile(path: string): Promise<string>;
  copyFile(source: string, destination: string): Promise<void>;
  writeFile(path: string, content: string): Promise<void>;
  rename(source: string, destination: string): Promise<void>;
  chmod(path: string, mode: number): Promise<void>;
}

export interface ConfigPublishResult {
  backupPath: string;
}

function assertAllowlisted(values: Record<string, string>): asserts values is DemoConfigValues {
  const allowed = new Set<string>(DEMO_CONFIG_KEYS);
  for (const key of Object.keys(values)) {
    if (!allowed.has(key)) {
      throw new Error(`Refusing config publish: unknown variable ${key}`);
    }
  }
  for (const key of DEMO_CONFIG_KEYS) {
    if (!(key in values) || values[key] === undefined || values[key] === '') {
      throw new Error(`Refusing config publish: missing variable ${key}`);
    }
  }
}

/** Replace anchored `KEY=...` lines in place; append any allowlisted key not already present. */
function replaceEnvLines(existing: string, values: DemoConfigValues): string {
  const replaced = new Set<string>();
  const lines = existing.split('\n').map(line => {
    const match = /^([A-Z0-9_]+)=/.exec(line);
    if (match && (DEMO_CONFIG_KEYS as readonly string[]).includes(match[1])) {
      const key = match[1] as DemoConfigKey;
      replaced.add(key);
      return `${key}=${values[key]}`;
    }
    return line;
  });
  const trailing = DEMO_CONFIG_KEYS.filter(key => !replaced.has(key)).map(key => `${key}=${values[key]}`);
  if (trailing.length === 0) return lines.join('\n');
  // Insert the new keys before any trailing empty line so the file keeps one terminal newline.
  const body = lines.join('\n').replace(/\n*$/, '\n');
  return `${body}${trailing.join('\n')}\n`;
}

export async function publishDemoConfig(
  path: string,
  values: DemoConfigValues,
  fs: ConfigFsDeps,
): Promise<ConfigPublishResult> {
  assertAllowlisted(values);
  const existing = await fs.readFile(path);
  const stamp = new Date().toISOString().replace(/[:.]/g, '');
  const backupPath = `${path}.${stamp}.bak`;
  await fs.copyFile(path, backupPath);

  const updated = replaceEnvLines(existing, values);
  const tmpPath = `${path}.tmp`;
  await fs.writeFile(tmpPath, updated);
  await fs.chmod(tmpPath, 0o600);
  await fs.rename(tmpPath, path);

  return { backupPath };
}
