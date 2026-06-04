/**
 * Sprint 86 / ADR-066 — Community Feed texture builders.
 *
 * Pure, side-effect-free builders for the `view=community` texture layer: the single
 * community-activity summary and the story items. The route handler does the I/O (SQL) and
 * feeds rows through these so the ranking band invariants stay unit-testable.
 *
 * Action altitude (direction-doc Principle 3): requests you can fill rank above the activity
 * summary, which ranks above stories. The client renders in array order — the server owns it.
 *
 * The data shapes mirror the wire contract in apps/frontend/src/types/feed-items.ts
 * (`CommunityActivityData` / `StoryData`).
 */

import {
  PRIORITY_ACTIVITY_BASE,
  PRIORITY_STORY_BASE,
  type UnifiedFeedItem,
} from './unifiedFeed';

export interface RecentHelper {
  name: string;
  help_count: number;
}

/** The community pulse: exchanges this week, new members, open requests, recent helpers. */
export interface ActivityData {
  community_id: string;
  community_name: string;
  exchanges_completed_week: number;
  recent_helpers?: RecentHelper[];
  new_members_count: number;
  open_requests_count: number;
}

export type StoryType = 'first_timer' | 'milestone' | 'pay_it_forward' | 'unexpected_match';

/** A short narrative beat — a first exchange, a karma milestone — that gives the feed warmth. */
export interface StoryData {
  type: StoryType;
  title: string;
  description: string;
  community_name?: string;
}

/** Wrap the community activity summary into a ranked union item (below every request). */
export function buildActivityItem(data: ActivityData): UnifiedFeedItem<ActivityData> {
  return { kind: 'activity', priority: PRIORITY_ACTIVITY_BASE, data };
}

/** Wrap a story into a ranked union item (below activity). Caller orders stories by recency. */
export function buildStoryItem(data: StoryData): UnifiedFeedItem<StoryData> {
  return { kind: 'story', priority: PRIORITY_STORY_BASE, data };
}
