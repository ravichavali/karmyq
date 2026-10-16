import {
  DEDICATED_EVENTS, EVENT_CONSUMERS, EVENT_ROUTES, UNCONSUMED_EVENTS, consumerQueueName, eventsFor,
} from '../../../events/routes';

describe('event routing table (ADR-101)', () => {
  it('classifies every name exactly once', () => {
    const routed = Object.keys(EVENT_ROUTES);
    const dedicated = Object.keys(DEDICATED_EVENTS);
    const unconsumed = [...UNCONSUMED_EVENTS];
    const all = [...routed, ...dedicated, ...unconsumed];
    expect(new Set(all).size).toBe(all.length);
  });

  it('partitions the routed events across the consumers, none empty', () => {
    const union = EVENT_CONSUMERS.flatMap((c) => eventsFor(c));
    expect(union.sort()).toEqual(Object.keys(EVENT_ROUTES).sort());
    for (const c of EVENT_CONSUMERS) expect(eventsFor(c).length).toBeGreaterThan(0);
  });

  it('pins the exact routes', () => {
    expect(eventsFor('reputation')).toEqual(['interaction_feedback_submitted']);
    expect(eventsFor('notification')).toEqual([
      'dibs_accepted', 'dibs_declined', 'dibs_expired', 'dibs_submitted', 'fusion_vote_started',
      'join_request_created', 'karma_awarded', 'match_created', 'match_reminder', 'offer_accepted',
      'offer_declined', 'offer_submitted', 'preferred_provider_selected', 'provider_review_received',
      'provider_went_on_duty', 'request_created', 'split_vote_started',
    ]);
    expect(Object.keys(DEDICATED_EVENTS).sort()).toEqual(['directed_request_created', 'match_completed', 'skill_endorsement_changed']);
    expect(UNCONSUMED_EVENTS.size).toBe(21);
  });

  it('never names the shared legacy queue', () => {
    for (const c of EVENT_CONSUMERS) expect(consumerQueueName(c)).not.toBe('karmyq-events');
    expect(consumerQueueName('notification')).toBe('karmyq-events-notification');
    expect(consumerQueueName('reputation')).toBe('karmyq-events-reputation');
  });
});
