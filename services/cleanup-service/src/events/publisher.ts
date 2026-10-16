import { createPublisher } from '@karmyq/shared';

// ADR-101: cleanup publishes through the shared router like every other service; it used to write
// straight to the shared karmyq-events queue with no retry options.
const shared = createPublisher('cleanup-service');
let ready: Promise<void> | undefined;

/** Idempotent: startServer calls it, and so does the first publish. */
export function initEventPublisher(): Promise<void> {
  return (ready ??= shared.initEventPublisher());
}

// node-cron schedules are registered at module load and can fire before startServer initializes.
export async function publishEvent(type: string, payload: unknown) {
  await initEventPublisher();
  return shared.publishEvent(type, payload);
}
