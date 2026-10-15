import { createPublisher } from '@karmyq/shared';

const { initEventPublisher, publishEvent } = createPublisher('reputation-service');
export { initEventPublisher, publishEvent };
