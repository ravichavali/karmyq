import { createPublisher } from '@karmyq/shared';
import { publishDirectedNotification, startDirectedNotificationRelay } from './directedNotifications';

const shared = createPublisher('request-service');
export const getEventQueue = shared.getEventQueue;
export async function initEventPublisher() {
  await shared.initEventPublisher();
  startDirectedNotificationRelay();
}
export async function publishEvent(type: string, payload: any) {
  if (type === 'directed_request_created') return publishDirectedNotification(payload);
  return shared.publishEvent(type, payload);
}
