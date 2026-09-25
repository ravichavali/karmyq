// Caps Jest's worker pool from KARMYQ_JEST_MAX_WORKERS.
//
// `npm test` is `turbo run test`: Turbo runs many workspaces at once and each workspace's Jest
// starts its own worker pool (default: cores - 1), so total parallelism is the PRODUCT of the two.
// scripts/prepush-test-runner.js bounds the Turbo side with --concurrency and this bounds the Jest
// side. Every jest config wraps its export in withWorkerCap, directly or by extending the root
// jest.config.js. turbo.json must list the variable in the test task's passThroughEnv, because
// Turbo's strict env mode strips undeclared variables before the task starts.
//
// Unset or empty leaves the config untouched (Jest's own default). An invalid value throws rather
// than being silently ignored: a cap that does not apply is worse than no cap, because it looks
// like one. A config that already sets maxWorkers keeps its own value, and a CLI --runInBand or
// --maxWorkers still overrides the config.

const ENV = 'KARMYQ_JEST_MAX_WORKERS';

function workerCap(env = process.env) {
  const raw = env[ENV];
  if (raw === undefined || raw === '') return undefined;
  if (!/^[1-9][0-9]*$/.test(raw)) {
    throw new Error(`${ENV} must be a positive integer, got ${JSON.stringify(raw)}`);
  }
  return Number(raw);
}

function withWorkerCap(config, env = process.env) {
  const cap = workerCap(env);
  if (cap === undefined || config.maxWorkers !== undefined) return config;
  return { ...config, maxWorkers: cap };
}

module.exports = { ENV, workerCap, withWorkerCap };
