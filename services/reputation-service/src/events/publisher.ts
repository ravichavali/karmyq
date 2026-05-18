import { createPublisher } from '@karmyq/shared';

const { initEventPublisher, publishEvent, getEventQueue } = createPublisher('reputation-service');
export { initEventPublisher, publishEvent, getEventQueue };
