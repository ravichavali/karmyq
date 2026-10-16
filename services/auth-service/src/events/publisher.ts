import { createPublisher } from '@karmyq/shared';

const { initEventPublisher, publishEvent } = createPublisher('auth-service');
export { initEventPublisher, publishEvent };
