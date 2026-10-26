/**
 * ADR-101 / BUG-060: an event published through createPublisher goes to the ONE consumer that
 * handles it, on a queue only that consumer's workers attach to. Bull lets any worker on a queue take
 * any waiting job and fails a job whose name it never registered (bull/lib/queue.js:1203-1208,1246),
 * so no queue may have workers from two services. Every published name must appear exactly once below.
 */
// Reputation left in Sprint 134 PR L: its one routed event was retired (BUG-068); it keeps its dedicated queues.
export const EVENT_CONSUMERS = Object.freeze(['notification'] as const);
export type EventConsumer = typeof EVENT_CONSUMERS[number];

export const EVENT_ROUTES: Readonly<Record<string, EventConsumer>> = Object.freeze({
  dibs_accepted: 'notification',
  dibs_declined: 'notification',
  dibs_expired: 'notification',
  dibs_submitted: 'notification',
  fusion_vote_started: 'notification',
  join_request_created: 'notification',
  karma_awarded: 'notification',
  match_created: 'notification',
  match_reminder: 'notification',
  offer_accepted: 'notification',
  offer_declined: 'notification',
  offer_submitted: 'notification',
  preferred_provider_selected: 'notification',
  provider_review_received: 'notification',
  provider_went_on_duty: 'notification',
  request_created: 'notification',
  split_vote_started: 'notification',
});

/**
 * Events with their own transport. Publishing one through createPublisher is a bug. An event needing
 * more than one consumer belongs here, following completionEvents.ts's dispatch-and-fan-out pattern.
 */
export const DEDICATED_EVENTS: Readonly<Record<string, { queue: string; consumers: readonly string[] }>> = Object.freeze({
  match_completed: { queue: 'karmyq-completion-dispatch', consumers: ['notification', 'reputation', 'social-graph'] },
  directed_request_created: { queue: 'karmyq-directed-notifications', consumers: ['notification'] },
  skill_endorsement_changed: { queue: 'karmyq-skill-endorsement-social-graph', consumers: ['social-graph'] },
});

/**
 * Published, handled by no service. publishEvent never enqueues these: a job nobody can process
 * fails three times and stays parked in Redis. Give one a consumer by moving it to EVENT_ROUTES.
 */
export const UNCONSUMED_EVENTS: ReadonlySet<string> = new Set([
  'activity_joined', 'community.config.created', 'community.config.updated', 'community_archived',
  'community_created', 'health_metrics_calculated', 'match_accepted', 'match_cancelled',
  'match_proposed_by_admin', 'match_rejected', 'milestone_achieved', 'norm_established', 'norm_proposed',
  'offer_created', 'offer_withdrawn', 'privacy_settings_updated', 'request_cancelled', 'request_completed',
  'user_created', 'user_joined_community', 'user_left_community',
]);

export const consumerQueueName = (consumer: EventConsumer): string => `karmyq-events-${consumer}`;

export function eventsFor(consumer: EventConsumer): string[] {
  return Object.keys(EVENT_ROUTES).filter((name) => EVENT_ROUTES[name] === consumer).sort();
}
