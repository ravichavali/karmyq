import { createPublisher } from '@karmyq/shared';

const { initEventPublisher, publishEvent, getEventQueue } = createPublisher('community-service');
export { initEventPublisher, publishEvent, getEventQueue };
