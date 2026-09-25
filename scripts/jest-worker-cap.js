// Caps Jest's worker pool: 2 workers by default, KARMYQ_JEST_MAX_WORKERS to override.
//
// `npm test` is `turbo run test`: Turbo runs several workspaces at once and each workspace's Jest
// starts its own worker pool (Jest's default is cores - 1), so total parallelism is the PRODUCT of
// the two. turbo.json's `concurrency` bounds the Turbo side and this bounds the Jest side, for every
// caller of `npm test`: the pre-push hook, CI and a developer's shell alike. Uncapped, the 8-core /
// 7.6 GB Windows dev box ran out of memory and ordinary tests hit their Jest timeouts.
//
// Every jest config wraps its export in withWorkerCap, directly or by extending the root
// jest.config.js. turbo.json lists the variable in globalPassThroughEnv, because Turbo's strict env
// mode strips undeclared variables before a task starts. An invalid value throws rather than being
// ignored: a cap that silently does not apply looks like one. A config that sets its own maxWorkers
// keeps it, and a CLI --runInBand or --maxWorkers still overrides the config.

const ENV = 'KARMYQ_JEST_MAX_WORKERS';
const DEFAULT_WORKERS = 2;

function workerCap(env = process.env) {
  const raw = env[ENV];
  if (raw === undefined || raw === '') return DEFAULT_WORKERS;
  if (!/^[1-9][0-9]*$/.test(raw)) {
    throw new Error(`${ENV} must be a positive integer, got ${JSON.stringify(raw)}`);
  }
  return Number(raw);
}

function withWorkerCap(config, env = process.env) {
  if (config.maxWorkers !== undefined) return config;
  return { ...config, maxWorkers: workerCap(env) };
}

module.exports = { DEFAULT_WORKERS, withWorkerCap };
