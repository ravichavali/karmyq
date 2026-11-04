/**
 * BUG-087: the CI test stack (tests/docker-compose.test.yml) sets SCHEDULED_JOBS_DISABLED="true", so no wall-clock job
 * fires in the middle of a test. Only the exact string "true" disables; absent or anything else leaves the jobs on, so a
 * missing variable can never turn a production cron off.
 */
export function scheduledJobsDisabled(): boolean {
  return process.env.SCHEDULED_JOBS_DISABLED === 'true';
}
