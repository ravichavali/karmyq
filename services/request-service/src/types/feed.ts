export interface FeedPreferences {
  user_id: number;
  show_community_activity: boolean;
  show_open_requests: boolean;
  show_completed_exchanges: boolean;
  suggest_adjacent_requests: boolean;
  exploration_level: 'conservative' | 'balanced' | 'adventurous';
  show_explanations: boolean;
  show_broader_stories: boolean;
  allow_public_featuring: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface FeedItem {
  id: string;
  type: 'community_activity' | 'open_request' | 'suggested_request' | 'story' | 'exchange_completed';
  priority: number;
  created_at: Date;
  data: CommunityActivity | OpenRequest | SuggestedRequest | Story | ExchangeCompleted;
}

export interface CommunityActivity {
  community_id: number;
  community_name: string;
  exchanges_completed_week: number;
  recent_helpers: Array<{ name: string; help_count: number }>;
  open_requests_count: number;
  new_members_count: number;
}

export interface OpenRequest {
  request_id: number;
  title: string;
  description: string;
  author_id: number;
  author_name: string;
  requester_id: string;
  community_id: number;
  community_name: string;
  urgency: 'low' | 'medium' | 'high' | 'urgent';
  expected_duration: string;
  created_at: Date;
  offers_count: number;
  required_skills: string[];
}

export interface SuggestedRequest {
  request_id: number;
  requester_id: string;
  title: string;
  description: string;
  community_id: number;
  community_name: string;
  urgency: 'low' | 'medium' | 'high' | 'urgent';
  reason: string;
  match_score: number;
  required_skills: string[];
}

export interface Story {
  story_id: string;
  type: 'first_timer' | 'pay_it_forward' | 'unexpected_match' | 'milestone';
  title: string;
  description: string;
  community_id?: number;
  community_name?: string;
  created_at: Date;
}

export interface ExchangeCompleted {
  exchange_id: number;
  helper_name: string;
  helpee_name: string;
  community_id: number;
  community_name: string;
  skill: string;
  feedback?: string;
  completed_at: Date;
}

export interface FeedComposition {
  your_communities: number;
  suggested_requests: number;
  broader_stories: number;
}

export interface UserBehavior {
  recent_helps_count: number;
  communities_count: number;
  skills: string[];
  member_since: Date;
}

export interface AdjacentCommunity {
  community_id: number;
  community_name: string;
  shared_members_count: number;
  shared_skills: string[];
  relevance_score: number;
}

export interface DismissedItem {
  user_id: number;
  item_type: string;
  item_id: string;
  dismissed_at: Date;
}
