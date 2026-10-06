import { createPublisher } from '@karmyq/shared';
import { publishDirectedNotification, startDirectedNotificationRelay } from './directedNotifications';
import { publishCompletionEvent, startCompletionDelivery } from './completionEvents';

const shared = createPublisher('request-service');
export const getEventQueue = shared.getEventQueue;
export async function initEventPublisher() {
  await shared.initEventPublisher();
  startDirectedNotificationRelay();
  startCompletionDelivery();
}
export async function publishEvent(type: string, payload: any) {
  if (type === 'directed_request_created') return publishDirectedNotification(payload);
  if (type === 'match_completed') return publishCompletionEvent(payload);
  return shared.publishEvent(type, payload);
}
