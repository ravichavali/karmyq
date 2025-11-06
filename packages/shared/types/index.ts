/**
 * Karmyq Shared Types
 * 
 * These types are used across all services to ensure consistent
 * API contracts and data structures. This is NOT a shared library
 * of code - only types and interfaces.
 * 
 * Each service implements its own business logic but uses these
 * types to communicate with other services and the frontend.
 */

// ============================================
// USER TYPES
// ============================================

export interface User {
  id: string;
  email: string;
  name: string;
  avatar?: string;
  bio?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserProfile extends User {
  communityIds: string[];
  karma: number;
  trustScore: number;
  preferences: UserPreferences;
}

export interface UserPreferences {
  notificationsEnabled: boolean;
  emailDigestFrequency: 'daily' | 'weekly' | 'never';
  communicationStyle: 'direct' | 'formal' | 'casual';
  languagePreference: string;
}

export interface CreateUserRequest {
  email: string;
  name: string;
  password: string;
}

export interface AuthTokenResponse {
  accessToken: string;
  refreshToken: string;
  user: User;
}

// ============================================
// COMMUNITY TYPES
// ============================================

export interface Community {
  id: string;
  name: string;
  description: string;
  seed: string; // The founding reason or philosophy
  maxMembers: number; // Typically 150 (Dunbar's number)
  currentMembers: number;
  createdAt: Date;
  updatedAt: Date;
  status: 'active' | 'paused' | 'archived';
}

export interface CommunityWithMembers extends Community {
  members: CommunityMember[];
  governance?: CommunityGovernance;
}

export interface CommunityMember {
  id: string;
  userId: string;
  communityId: string;
  role: 'admin' | 'moderator' | 'member';
  joinedAt: Date;
  trustLevel: number; // 0-100, based on reputation
  status: 'active' | 'inactive' | 'suspended';
}

export interface CreateCommunityRequest {
  name: string;
  description: string;
  seed: string;
  maxMembers?: number; // Default 150
}

export interface JoinCommunityRequest {
  communityId: string;
  invitedByUserId: string; // Referral chain
  message?: string;
}

export interface CommunityStats {
  totalMembers: number;
  activeRequests: number;
  completedRequests: number;
  averageTrustScore: number;
  topContributors: Array<{ userId: string; karma: number }>;
}

export interface CommunityGovernance {
  proposalProcess: ProposalProcess;
  votingRules: VotingRules;
  communityNorms: CommunityNorm[];
  conflictResolution: ConflictResolutionPolicy;
}

// ============================================
// REQUEST/OFFER TYPES
// ============================================

export interface HelpRequest {
  id: string;
  communityId: string;
  requesterId: string;
  title: string;
  description: string;
  category: RequestCategory;
  urgency: 'low' | 'medium' | 'high';
  skillsNeeded?: string[];
  timeframe?: {
    startDate: Date;
    endDate?: Date;
    flexibility: 'flexible' | 'fixed';
  };
  createdAt: Date;
  updatedAt: Date;
  status: 'open' | 'matched' | 'in_progress' | 'completed' | 'cancelled';
  responses?: RequestResponse[];
}

export interface HelpOffer {
  id: string;
  communityId: string;
  offererId: string;
  title: string;
  description: string;
  category: OfferCategory;
  skills: string[];
  availability: 'always' | 'weekdays' | 'weekends' | 'specific';
  availabilityDetails?: string;
  createdAt: Date;
  updatedAt: Date;
  status: 'active' | 'inactive';
}

export type RequestCategory = 
  | 'transportation'
  | 'errands'
  | 'technical'
  | 'physical'
  | 'learning'
  | 'emotional_support'
  | 'other';

export type OfferCategory =
  | 'transportation'
  | 'errands'
  | 'technical'
  | 'physical'
  | 'learning'
  | 'emotional_support'
  | 'other';

export interface RequestResponse {
  id: string;
  requestId: string;
  responderId: string;
  message: string;
  status: 'pending' | 'accepted' | 'rejected';
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateRequestRequest {
  communityId: string;
  title: string;
  description: string;
  category: RequestCategory;
  urgency?: 'low' | 'medium' | 'high';
  skillsNeeded?: string[];
  timeframe?: {
    startDate: Date;
    endDate?: Date;
    flexibility: 'flexible' | 'fixed';
  };
}

export interface MatchedRequest {
  request: HelpRequest;
  offers: Array<{
    offer: HelpOffer;
    score: number; // Match confidence 0-100
  }>;
}

// ============================================
// REPUTATION/KARMA TYPES
// ============================================

export interface KarmaScore {
  id: string;
  userId: string;
  communityId: string;
  totalKarma: number;
  giverKarma: number;
  receiverKarma: number;
  history: KarmaTransaction[];
  lastUpdated: Date;
}

export interface KarmaTransaction {
  id: string;
  userId: string;
  amount: number;
  type: KarmaType;
  reason: string;
  relatedEntityId?: string; // ID of request, offer, proposal, etc
  createdAt: Date;
}

export type KarmaType =
  | 'request_completed'
  | 'offer_completed'
  | 'proposal_voted'
  | 'conflict_resolved'
  | 'community_moderated'
  | 'feedback_given'
  | 'other';

export interface TrustScore {
  userId: string;
  communityId: string;
  score: number; // 0-100
  factors: TrustFactor[];
  lastUpdated: Date;
}

export interface TrustFactor {
  name: string;
  weight: number; // 0-1
  value: number; // contribution to overall score
  description: string;
}

export interface UserReputation {
  userId: string;
  communities: Array<{
    communityId: string;
    karma: KarmaScore;
    trust: TrustScore;
  }>;
  requestsCompleted: number;
  offersCompleted: number;
  averageRating: number;
}

// ============================================
// MESSAGING TYPES
// ============================================

export interface Message {
  id: string;
  senderId: string;
  recipientId: string;
  communityId?: string; // If community-specific
  content: string;
  type: 'text' | 'request_update' | 'system';
  conversationId: string;
  read: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface Conversation {
  id: string;
  participantIds: string[];
  relatedRequestId?: string; // If about a specific request
  communityId: string;
  lastMessage?: Message;
  createdAt: Date;
  updatedAt: Date;
}

export interface SendMessageRequest {
  recipientId: string;
  content: string;
  type?: 'text' | 'request_update' | 'system';
  conversationId?: string;
}

export interface ConversationThread {
  conversation: Conversation;
  messages: Message[];
  unreadCount: number;
}

// ============================================
// NOTIFICATION TYPES
// ============================================

export interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  relatedEntityId?: string;
  relatedEntityType?: string;
  read: boolean;
  channels: NotificationChannel[];
  createdAt: Date;
}

export type NotificationType =
  | 'request_matched'
  | 'offer_accepted'
  | 'message_received'
  | 'proposal_created'
  | 'vote_needed'
  | 'conflict_reported'
  | 'karma_awarded'
  | 'community_update'
  | 'system_alert';

export type NotificationChannel = 'in_app' | 'email' | 'push';

export interface NotificationPreference {
  userId: string;
  type: NotificationType;
  channels: NotificationChannel[];
  enabled: boolean;
}

export interface EmailTemplate {
  name: string;
  subject: string;
  htmlTemplate: string;
  textTemplate: string;
  variables: string[]; // Variable names like {{userName}}, {{requestTitle}}
}

// ============================================
// GOVERNANCE TYPES (STUBS - TO BE EXPANDED)
// ============================================

export interface Proposal {
  id: string;
  communityId: string;
  creatorId: string;
  title: string;
  description: string;
  type: ProposalType;
  status: ProposalStatus;
  process: ProposalProcess;
  createdAt: Date;
  closesAt: Date;
  votes: Vote[];
  result?: ProposalResult;
}

export type ProposalType =
  | 'norm_change'        // Change community norms
  | 'policy_change'      // Change community policies
  | 'member_removal'     // Remove member
  | 'community_decision' // General decision
  | 'resource_allocation'; // How to use community resources

export type ProposalStatus = 'draft' | 'active' | 'closed' | 'passed' | 'failed';

export interface ProposalProcess {
  votingMethod: 'simple_majority' | 'consensus' | 'supermajority';
  duration: number; // hours
  minimumParticipation: number; // percentage
  description: string;
}

export interface Vote {
  id: string;
  proposalId: string;
  voterId: string;
  choice: 'yes' | 'no' | 'abstain';
  reasoning?: string;
  createdAt: Date;
}

export interface ProposalResult {
  totalVotes: number;
  yesVotes: number;
  noVotes: number;
  abstainVotes: number;
  passed: boolean;
  participationRate: number;
}

export interface VotingRules {
  defaultMethod: ProposalType;
  minimumParticipation: number; // percentage
  superMajorityThreshold: number; // percentage, typically 66%
  proposalDuration: number; // hours
}

export interface CommunityNorm {
  id: string;
  communityId: string;
  title: string;
  description: string;
  rationale: string;
  createdAt: Date;
  proposalId?: string; // How it was established
  status: 'active' | 'archived';
}

export interface ConflictResolutionPolicy {
  stages: ConflictStage[];
  mediation: MediationProcess;
  escalation: EscalationProcess;
}

export interface ConflictStage {
  name: string;
  description: string;
  duration: number; // days
  actions: string[];
}

export interface MediationProcess {
  available: boolean;
  mediatorSelection: 'random' | 'volunteer' | 'appointed';
  description: string;
}

export interface EscalationProcess {
  levels: number;
  description: string;
}

export interface ConflictReport {
  id: string;
  communityId: string;
  reporterId: string;
  accusedUserId: string;
  title: string;
  description: string;
  severity: 'low' | 'medium' | 'high';
  status: 'open' | 'under_review' | 'resolved' | 'dismissed';
  createdAt: Date;
  updatedAt: Date;
  resolution?: ConflictResolution;
}

export interface ConflictResolution {
  mediatorId?: string;
  outcome: string;
  actions: string[];
  resolvedAt: Date;
}

// ============================================
// EVENT TYPES (for Bull Queue)
// ============================================

export interface QueueEvent<T = any> {
  id: string;
  type: EventType;
  timestamp: Date;
  data: T;
  source: string; // which service published this
}

export type EventType =
  // Auth Events
  | 'user_created'
  | 'user_deleted'
  | 'password_reset'
  | 'login'
  
  // Community Events
  | 'community_created'
  | 'user_joined_community'
  | 'user_left_community'
  | 'community_archived'
  
  // Request Events
  | 'request_created'
  | 'request_matched'
  | 'request_completed'
  | 'offer_response_received'
  
  // Reputation Events
  | 'karma_awarded'
  | 'trust_score_updated'
  | 'user_rating_received'
  
  // Messaging Events
  | 'message_sent'
  | 'conversation_started'
  
  // Governance Events
  | 'proposal_created'
  | 'vote_cast'
  | 'proposal_closed'
  | 'norm_established'
  | 'conflict_reported';

// ============================================
// API ERROR TYPES
// ============================================

export interface ApiError {
  code: string;
  message: string;
  statusCode: number;
  details?: Record<string, any>;
  timestamp: Date;
}

export interface ValidationError extends ApiError {
  fields: Record<string, string[]>;
}

// ============================================
// PAGINATION
// ============================================

export interface PaginationParams {
  page: number;
  pageSize: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

// ============================================
// GENERIC RESPONSE TYPES
// ============================================

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: ApiError;
  timestamp: Date;
}

// ============================================
// Export all types as namespace for convenience
// ============================================

export namespace Karmyq {
  export type UserType = User;
  export type CommunityType = Community;
  export type RequestType = HelpRequest;
  export type OfferType = HelpOffer;
  export type KarmaType = KarmaScore;
  export type MessageType = Message;
  export type NotificationType = Notification;
  export type ProposalType = Proposal;
}
