/**
 * Sprint 86 / ADR-066 — Community Feed texture builders + ranking (TDD).
 *
 * The `view=community` union ranks request items (1000–1100) ABOVE the community-activity
 * summary (activity band) ABOVE the stories (story band). These are the pure builders and
 * the band invariants — the route handler does the SQL and feeds rows through these so the
 * ordering can be unit-tested directly.
 *
 * Per the robust-testing standard: exact priority values and exact ordering, no stubs.
 */

import {
  assembleFeed,
  buildRequestItem,
  PRIORITY_REQUEST_BASE,
  PRIORITY_ACTIVITY_BASE,
  PRIORITY_STORY_BASE,
} from '../../src/services/unifiedFeed';
import {
  buildActivityItem,
  buildStoryItem,
  type ActivityData,
  type StoryData,
} from '../../src/services/communityTexture';

const activity = (): ActivityData => ({
  community_id: 'c-1',
  community_name: 'Hawthorne',
  exchanges_completed_week: 4,
  new_members_count: 2,
  open_requests_count: 7,
  recent_helpers: [{ name: 'Sam', help_count: 3 }],
});

const story = (overrides: Partial<StoryData> = {}): StoryData => ({
  type: 'first_timer',
  title: 'Priya helped for the first time',
  description: 'Welcomed by the Hawthorne circle.',
  community_name: 'Hawthorne',
  ...overrides,
});

describe('texture priority bands — requests > activity > story', () => {
  it('places activity strictly below the request floor and at the activity base', () => {
    const item = buildActivityItem(activity());
    expect(item.kind).toBe('activity');
    expect(item.priority).toBe(PRIORITY_ACTIVITY_BASE);
    expect(item.priority).toBeLessThan(PRIORITY_REQUEST_BASE);
  });

  it('places stories strictly below activity and at the story base', () => {
    const item = buildStoryItem(story());
    expect(item.kind).toBe('story');
    expect(item.priority).toBe(PRIORITY_STORY_BASE);
    expect(item.priority).toBeLessThan(PRIORITY_ACTIVITY_BASE);
  });

  it('keeps the bands separated even at their extremes', () => {
    // request floor (feedScore 0) still outranks activity; activity outranks story.
    expect(buildRequestItem({ request_id: 'r' }, 0).priority).toBeGreaterThan(PRIORITY_ACTIVITY_BASE);
    expect(PRIORITY_ACTIVITY_BASE).toBeGreaterThan(PRIORITY_STORY_BASE);
  });
});

describe('assembleFeed — community union keeps requests > activity > story', () => {
  it('sorts a shuffled request+activity+story input into the right bands (exact order)', () => {
    const items = [
      buildStoryItem(story({ title: 'story-A' })),
      buildRequestItem({ request_id: 'r-low' }, 30),
      buildActivityItem(activity()),
      buildRequestItem({ request_id: 'r-high' }, 90),
      buildStoryItem(story({ title: 'story-B' })),
    ];

    const { items: ranked } = assembleFeed(items);

    expect(ranked.map((i) => i.kind)).toEqual(['request', 'request', 'activity', 'story', 'story']);
    // requests by descending feed score within the request band
    expect((ranked[0].data as { request_id: string }).request_id).toBe('r-high');
    expect((ranked[1].data as { request_id: string }).request_id).toBe('r-low');
    // stories keep input order (stable sort) — story-A before story-B
    expect((ranked[3].data as { title: string }).title).toBe('story-A');
    expect((ranked[4].data as { title: string }).title).toBe('story-B');
    // exact priorities
    expect(ranked.map((i) => i.priority)).toEqual([1090, 1030, 500, 100, 100]);
  });

  it('handles a request-only community (no texture available) without reordering', () => {
    const { items } = assembleFeed([
      buildRequestItem({ request_id: 'a' }, 50),
      buildRequestItem({ request_id: 'b' }, 50),
    ]);
    expect(items.map((i) => (i.data as { request_id: string }).request_id)).toEqual(['a', 'b']);
  });
});
