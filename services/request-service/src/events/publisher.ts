import { createPublisher } from '@karmyq/shared';

const { initEventPublisher, publishEvent, getEventQueue } = createPublisher('request-service');
export { initEventPublisher, publishEvent, getEventQueue };
