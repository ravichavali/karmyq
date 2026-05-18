import { createPublisher } from '@karmyq/shared';

const { initEventPublisher, publishEvent, getEventQueue } = createPublisher('auth-service');
export { initEventPublisher, publishEvent, getEventQueue };
