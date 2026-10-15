import { createPublisher } from '@karmyq/shared';

// ADR-101: cleanup publishes through the shared router like every other service; it used to write
// straight to the shared karmyq-events queue with no retry options.
const { initEventPublisher, publishEvent } = createPublisher('cleanup-service');
export { initEventPublisher, publishEvent };
