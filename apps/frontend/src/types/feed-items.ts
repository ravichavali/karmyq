/**
 * Type definitions for feed item data structures
 */

import { RequestPayload, RequestType } from './request-payloads';

export interface RecentHelper {
  name: string;
  help_count: number;
}

export interface CommunityActivityData {
  community_id: string;
  community_name: string;
  exchanges_completed_week: number;
  recent_helpers?: RecentHelper[];
  new_members_count: number;
  open_requests_count: number;
}

export interface OpenRequestData {
  request_id: string;
  title: string;
  description: string;
  author_name: string;
  requester_id: string;
  community_id: string;
  community_name: string;
  urgency: 'urgent' | 'high' | 'medium' | 'low';
  expected_duration: string;
  offers_count: number;
  request_type?: RequestType;
  payload?: RequestPayload;
  requirements?: Record<string, string | number | boolean>;
  preferred_start_date?: string;
  required_skills?: string[];
  // Sprint 112 (ADR-082): the feed no longer returns the requester's exact karma/trust score.
  is_boosted?: boolean;
  boosted_expires_at?: string;
  status?: string;
  completed_at?: string;
  updated_at?: string;
}

export interface SuggestedRequestData {
  request_id: string;
  requester_id: string;
  community_id: string;
  community_name: string;
  title: string;
  description: string;
  reason: string;
  match_score: number;
}

export type StoryType = 'first_timer' | 'milestone' | 'pay_it_forward' | 'unexpected_match';

export interface StoryData {
  type: StoryType;
  title: string;
  description: string;
  community_name?: string;
}

export type FeedItemData =
  | CommunityActivityData
  | OpenRequestData
  | SuggestedRequestData
  | StoryData;

export interface FeedItem {
  id: string;
  type: 'community_activity' | 'open_request' | 'suggested_request' | 'story';
  priority: number;
  created_at: string;
  data: FeedItemData;
}
