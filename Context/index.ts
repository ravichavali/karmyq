// shared/types/index.ts

// ============= USER TYPES =============
export interface User {
  id: string;
  email: string;
  name: string;
  bio?: string;
  avatarUrl?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserProfile extends User {
  trustScore: number;
  karma: number;
  communities: string[]; // community IDs
  badges: Badge[];
}

// ============= COMMUNITY TYPES =============
export interface Community {
  id: string;
  name: string;
  description: string;
  maxMembers: number; // typically 150 (Dunbar's number)
  currentMembers: number;
  creatorId: string;
  createdAt: Date;
  updatedAt: Date;
  status: 'active' | 'paused' | 'archived';
}

export interface CommunityMember {
  id: string;
  communityId: string;
  userId: string;
  role: 'member' | 'moderator' | 'admin';
  joinedAt: Date;
  invitedBy: string; // userId of inviter (trust chain)
  status: 'active' | 'inactive' | 'removed';
}

export interface CommunityNorms {
  id: string;
  communityId: string;
  norms: Norm[];
  createdAt: Date;
  updatedAt: Date;
}

export interface Norm {
  id: string;
  description: string;
  rationale: string;
  createdBy: string; // userId
  approvedBy?: string[]; // userIds (consensus tracking)
  status: 'proposed' | 'approved' | 'archived';
}

// ============= REQUEST TYPES =============
export interface HelpRequest {
  id: string;
  communityId: string;
  requesterId: string;
  title: string;
  description: string;
  category: RequestCategory;
  urgency: 'low' | 'medium' | 'high';
  preferredTimeframe?: {
    startDate: Date;
    endDate: Date;
  };
  status: 'open' | 'matched' | 'in_progress' | 'completed' | 'cancelled';
  createdAt: Date;
  updatedAt: Date;
}

export interface HelpOffer {
  id: string;
  communityId: string;
  offererId: string;
  title: string;
  description: string;
  category: string;
  availability?: {
    startDate: Date;
    endDate: Date;
  };
  status: 'active' | 'paused' | 'completed';
  createdAt: Date;
  updatedAt: Date;
}

export type RequestCategory =
  | 'transportation'
  | 'household'
  | 'skill_sharing'
  | 'emergency_support'
  | 'childcare'
  | 'elder_care'
  | 'tool_lending'
  | 'other';

export interface RequestMatch {
  id: string;
  requestId: string;
  offerId?: string;
  responderId: string;
  status: 'proposed' | 'accepted' | 'rejected' | 'completed' | 'failed';
  completedAt?: Date;
  feedback?: Feedback;
}

// ============= REPUTATION TYPES =============
export interface KarmaRecord {
  id: string;
  userId: string;
  communityId: string;
  points: number;
  reason: string; // 'request_completed', 'offer_accepted', 'norm_respected', etc.
  relatedEntityId?: string; // requestId, offerId, etc.
  createdAt: Date;
}

export interface TrustScore {
  id: string;
  userId: string;
  communityId: string;
  score: number; // 0-100
  requestsCompleted: number;
  offersAccepted: number;
  averageFeedback: number;
  lastUpdated: Date;
}

export interface Badge {
  id: string;
  name: string;
  description: string;
  icon: string;
  requirement: string; // 'completed_5_requests', '100_karma', etc.
}

// ============= MESSAGING TYPES =============
export interface Message {
  id: string;
  senderId: string;
  recipientId: string;
  requestMatchId?: string; // context of the conversation
  content: string;
  status: 'sent' | 'delivered' | 'read';
  createdAt: Date;
}

export interface Conversation {
  id: string;
  participantIds: string[];
  requestMatchId?: string;
  lastMessage?: Message;
  lastMessageAt?: Date;
}

// ============= FEEDBACK TYPES =============
export interface Feedback {
  id: string;
  fromUserId: string;
  toUserId: string;
  requestMatchId: string;
  communityId: string;
  rating: number; // 1-5
  comment: string;
  categories: FeedbackCategory[];
  createdAt: Date;
}

export type FeedbackCategory =
  | 'reliability'
  | 'communication'
  | 'helpfulness'
  | 'respect'
  | 'other';

// ============= GOVERNANCE TYPES =============
export interface Proposal {
  id: string;
  communityId: string;
  proposedBy: string; // userId
  type: ProposalType;
  title: string;
  description: string;
  status: 'proposed' | 'voting' | 'approved' | 'rejected' | 'implemented' | 'archived';
  proposedAt: Date;
  votingStartsAt?: Date;
  votingEndsAt?: Date;
  results?: VotingResults;
}

export type ProposalType =
  | 'norm_proposal'
  | 'policy_change'
  | 'community_event'
  | 'resource_allocation'
  | 'member_review'
  | 'other';

export interface Vote {
  id: string;
  proposalId: string;
  voterId: string;
  communityId: string;
  choice: 'yes' | 'no' | 'abstain';
  votedAt: Date;
}

export interface VotingResults {
  totalVotes: number;
  yesVotes: number;
  noVotes: number;
  abstainVotes: number;
  percentageYes: number;
  percentageNo: number;
  percentageAbstain: number;
  passed: boolean;
}

export interface ConflictCase {
  id: string;
  communityId: string;
  accuserId: string;
  accusedId: string;
  description: string;
  relatedRequestMatchId?: string;
  status: 'reported' | 'investigating' | 'mediation' | 'resolved' | 'closed';
  reportedAt: Date;
  resolvedAt?: Date;
  resolution?: string;
  mediators?: string[]; // userIds
}

// ============= EVENT TYPES (for event queue) =============
export interface BaseEvent {
  id: string;
  timestamp: Date;
  source: string; // service name
}

export interface UserCreatedEvent extends BaseEvent {
  type: 'user_created';
  userId: string;
  email: string;
}

export interface UserJoinedCommunityEvent extends BaseEvent {
  type: 'user_joined_community';
  userId: string;
  communityId: string;
}

export interface RequestCreatedEvent extends BaseEvent {
  type: 'request_created';
  requestId: string;
  requesterId: string;
  communityId: string;
  category: RequestCategory;
}

export interface RequestMatchedEvent extends BaseEvent {
  type: 'request_matched';
  requestId: string;
  matchId: string;
  responderId: string;
  requesterId: string;
  communityId: string;
}

export interface RequestCompletedEvent extends BaseEvent {
  type: 'request_completed';
  requestId: string;
  matchId: string;
  responderId: string;
  requesterId: string;
  communityId: string;
}

export interface FeedbackSubmittedEvent extends BaseEvent {
  type: 'feedback_submitted';
  feedbackId: string;
  fromUserId: string;
  toUserId: string;
  communityId: string;
  rating: number;
}

export interface ProposalCreatedEvent extends BaseEvent {
  type: 'proposal_created';
  proposalId: string;
  communityId: string;
  proposedBy: string;
  proposalType: ProposalType;
}

export interface VoteSubmittedEvent extends BaseEvent {
  type: 'vote_submitted';
  proposalId: string;
  communityId: string;
  voterId: string;
}

export interface ConflictReportedEvent extends BaseEvent {
  type: 'conflict_reported';
  conflictCaseId: string;
  communityId: string;
  accuserId: string;
  accusedId: string;
}

export type DomainEvent =
  | UserCreatedEvent
  | UserJoinedCommunityEvent
  | RequestCreatedEvent
  | RequestMatchedEvent
  | RequestCompletedEvent
  | FeedbackSubmittedEvent
  | ProposalCreatedEvent
  | VoteSubmittedEvent
  | ConflictReportedEvent;

// ============= API RESPONSE TYPES =============
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}
