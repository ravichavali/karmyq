import { createPublisher } from '@karmyq/shared';

const { initEventPublisher, publishEvent } = createPublisher('community-service');
export { initEventPublisher, publishEvent };
