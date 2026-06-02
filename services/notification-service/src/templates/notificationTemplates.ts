// Notification template system for uniform cross-platform messaging

export type NotificationType =
  | 'match_created'
  | 'match_accepted'
  | 'match_completed'
  | 'match_cancelled'
  | 'karma_awarded'
  | 'karma_milestone'
  | 'new_request'
  | 'request_responded'
  | 'message_received'
  | 'community_invite'
  | 'join_request'
  | 'norm_proposed'
  | 'feedback_received'
  | 'match_reminder'
  | 'preferred_provider_selected'
  | 'provider_request_matched'
  | 'provider_review_received'
  | 'dibs_submitted'
  | 'dibs_accepted'
  | 'dibs_declined'
  | 'dibs_expired'
  | 'split_vote_started'
  | 'fusion_vote_started';

export type NotificationPriority = 'low' | 'medium' | 'high' | 'critical';

export interface NotificationTemplate {
  type: NotificationType;
  priority: NotificationPriority;
  title: (data: any) => string;
  body: (data: any) => string;
  icon?: string;
  ctaLabel: string; // Action button text (e.g., "View Offer", "Rate Helper")
  actionUrl: (data: any) => string;
  channels: {
    in_app: boolean;
    push: boolean;
    email: boolean;
  };
}

// Template definitions
export const notificationTemplates: Record<NotificationType, NotificationTemplate> = {
  match_created: {
    type: 'match_created',
    priority: 'high',
    title: (data) => 'New Match for Your Request',
    body: (data) => `${data.responder_name} wants to help with "${data.request_title}"`,
    icon: 'handshake',
    ctaLabel: 'View Offer',
    actionUrl: (data) => `/dashboard`,
    channels: { in_app: true, push: true, email: false },
  },

  match_accepted: {
    type: 'match_accepted',
    priority: 'high',
    title: (data) => 'Your Offer Was Accepted!',
    body: (data) => `${data.requester_name} accepted your offer to help with "${data.request_title}"`,
    icon: 'check-circle',
    ctaLabel: 'View Details',
    actionUrl: (data) => `/requests/${data.request_id}`,
    channels: { in_app: true, push: true, email: false },
  },

  match_completed: {
    type: 'match_completed',
    priority: 'medium',
    title: (data) => 'Match Completed — Leave a Rating',
    body: (data) => `Your match for "${data.request_title}" has been completed. Rate your experience!`,
    icon: 'star',
    ctaLabel: 'Rate Helper',
    actionUrl: (data) => `/requests/${data.request_id}`,
    channels: { in_app: true, push: true, email: false },
  },

  match_cancelled: {
    type: 'match_cancelled',
    priority: 'medium',
    title: (data) => 'Match Cancelled',
    body: (data) => `The match for "${data.request_title}" has been cancelled`,
    icon: 'x-circle',
    ctaLabel: 'View Request',
    actionUrl: (data) => `/requests/${data.request_id}`,
    channels: { in_app: true, push: false, email: false },
  },

  karma_awarded: {
    type: 'karma_awarded',
    priority: 'low',
    title: (data) => 'Karma Earned!',
    body: (data) => `You earned ${data.points} karma points for ${data.reason}`,
    icon: 'award',
    ctaLabel: 'View Karma',
    actionUrl: (data) => `/profile/karma`,
    channels: { in_app: true, push: false, email: false }, // In-app only: a quiet record of earned karma
  },

  karma_milestone: {
    type: 'karma_milestone',
    priority: 'medium',
    title: (data) => 'Karma Milestone Reached!',
    body: (data) => `Congratulations! You've reached ${data.total_karma} total karma points`,
    icon: 'trophy',
    ctaLabel: 'View Karma',
    actionUrl: (data) => `/profile/karma`,
    channels: { in_app: true, push: true, email: false }, // Milestones are worth a push
  },

  new_request: {
    type: 'new_request',
    priority: 'medium',
    title: (data) => 'New Request — Can You Help?',
    body: (data) => `${data.requester_name}: "${data.request_title}"`,
    icon: 'bell',
    ctaLabel: 'Offer Help',
    actionUrl: (data) => `/requests/${data.request_id}`,
    channels: { in_app: true, push: false, email: false },
  },

  request_responded: {
    type: 'request_responded',
    priority: 'high',
    title: (data) => 'Someone Responded to Your Request',
    body: (data) => `${data.responder_name} responded to "${data.request_title}"`,
    icon: 'message-circle',
    ctaLabel: 'View Response',
    actionUrl: (data) => `/requests/${data.request_id}`,
    channels: { in_app: true, push: true, email: false },
  },

  message_received: {
    type: 'message_received',
    priority: 'high',
    title: (data) => `New Message from ${data.sender_name}`,
    body: (data) => data.message_preview || 'You have a new message',
    icon: 'mail',
    ctaLabel: 'Reply',
    actionUrl: (data) => `/messages/${data.conversation_id || ''}`,
    channels: { in_app: true, push: true, email: false },
  },

  community_invite: {
    type: 'community_invite',
    priority: 'medium',
    title: (data) => 'Community Invitation',
    body: (data) => `${data.inviter_name} invited you to join "${data.community_name}"`,
    icon: 'users',
    ctaLabel: 'View Invite',
    actionUrl: (data) => `/communities/${data.community_id}/invite`,
    channels: { in_app: true, push: true, email: true },
  },

  join_request: {
    type: 'join_request',
    priority: 'high',
    title: (data) => 'New Join Request',
    body: (data) => `${data.user_name} wants to join "${data.community_name}"${data.message ? `: ${data.message}` : ''}`,
    icon: 'user-plus',
    ctaLabel: 'Review Request',
    actionUrl: (data) => `/communities/${data.community_id}/admin`,
    channels: { in_app: true, push: true, email: false },
  },

  norm_proposed: {
    type: 'norm_proposed',
    priority: 'low',
    title: (data) => 'New Norm Proposed',
    body: (data) => `${data.proposer_name} proposed a new norm in "${data.community_name}"`,
    icon: 'file-text',
    ctaLabel: 'View Norm',
    actionUrl: (data) => `/communities/${data.community_id}/norms/${data.norm_id}`,
    channels: { in_app: true, push: false, email: false },
  },

  feedback_received: {
    type: 'feedback_received',
    priority: 'medium',
    title: (data) => 'New Feedback Received',
    body: (data) => `${data.from_user_name} left you feedback (${data.rating}/5 stars)`,
    icon: 'star',
    ctaLabel: 'View Feedback',
    actionUrl: (data) => `/profile/feedback`,
    channels: { in_app: true, push: true, email: false },
  },
  match_reminder: {
    type: 'match_reminder',
    priority: 'high',
    title: (data) => `Time to leave — ${data.request_title || 'your commitment'}`,
    body: (data) => {
      const time = data.scheduled_at
        ? new Date(data.scheduled_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
        : 'soon';
      return data.request_type === 'ride'
        ? `Pickup is at ${time}. Head to the pickup spot now!`
        : `Your commitment starts at ${time}. Time to get ready!`;
    },
    icon: 'clock',
    ctaLabel: 'View Details',
    actionUrl: (data) => `/dashboard`,
    channels: { in_app: true, push: true, email: false },
  },

  preferred_provider_selected: {
    type: 'preferred_provider_selected',
    priority: 'high',
    title: (_data: any) => 'You were pre-selected',
    body: (data: any) =>
      `${data.requester_name} pre-selected you for a ${data.request_type} request: "${data.request_title}".`,
    icon: 'star',
    ctaLabel: 'View Request',
    actionUrl: (data: any) => `/requests/${data.request_id}`,
    channels: { in_app: true, push: true, email: false }, // High-priority: time-sensitive pre-selection deserves push
  },

  provider_request_matched: {
    type: 'provider_request_matched',
    priority: 'high',
    title: (data) => `New ${data.service_type ?? 'help'} request — can you help?`,
    body: (data) => `${data.requester_name} needs help with: "${data.request_title}"`,
    icon: 'briefcase',
    ctaLabel: 'View Request',
    actionUrl: (data) => `/requests/${data.request_id}`,
    channels: { in_app: true, push: true, email: false }, // High-priority: a fresh provider match deserves push
  },

  provider_review_received: {
    type: 'provider_review_received',
    priority: 'medium',
    title: (_data: any) => 'You received a new review',
    body: (data) => `${data.reviewer_name} left you a ${data.rating}-star review: "${data.review_excerpt}"`,
    icon: 'star',
    ctaLabel: 'View Review',
    actionUrl: (data) => `/providers/${data.provider_id}`,
    channels: { in_app: true, push: false, email: false },
  },

  dibs_submitted: {
    type: 'dibs_submitted',
    priority: 'high',
    title: (_data: any) => 'Someone wants your help first',
    body: (data: any) => data.message ?? `${data.requester_name} wants your help first — respond before time runs out`,
    icon: 'clock',
    ctaLabel: 'Respond',
    actionUrl: (data: any) => `/requests/${data.request_id}`,
    channels: { in_app: true, push: true, email: false },
  },

  dibs_accepted: {
    type: 'dibs_accepted',
    priority: 'high',
    title: (_data: any) => 'Dibs accepted!',
    body: (data: any) => data.message ?? `${data.provider_name} accepted your dibs request`,
    icon: 'check-circle',
    ctaLabel: 'View Request',
    actionUrl: (data: any) => `/requests/${data.request_id}`,
    channels: { in_app: true, push: true, email: false },
  },

  dibs_declined: {
    type: 'dibs_declined',
    priority: 'medium',
    title: (_data: any) => 'Provider passed on your dibs',
    body: (data: any) => data.message ?? `${data.provider_name} passed — your request is now public`,
    icon: 'x-circle',
    ctaLabel: 'View Request',
    actionUrl: (data: any) => `/requests/${data.request_id}`,
    channels: { in_app: true, push: false, email: false },
  },

  split_vote_started: {
    type: 'split_vote_started',
    priority: 'high',
    title: (data) => `Vote open: should ${data.community_name} split?`,
    body: (data) => `A vote has started on splitting into "${data.group_a_name}" and "${data.group_b_name}". Your voice counts.`,
    icon: 'users',
    ctaLabel: 'Cast Your Vote',
    actionUrl: (data) => `/communities/${data.community_id}?tab=fission`,
    channels: { in_app: true, push: true, email: false },
  },

  fusion_vote_started: {
    type: 'fusion_vote_started',
    priority: 'high',
    title: (_data: any) => 'Fusion vote is open',
    body: (data: any) => `Your community is voting on merging to form "${data.merged_community_name}". Vote before ${new Date(data.voting_ends_at).toLocaleDateString()}.`,
    icon: 'users',
    ctaLabel: 'Cast Your Vote',
    actionUrl: (data: any) => `/communities/${data.community_a_id}?tab=fusion`,
    channels: { in_app: true, push: true, email: false },
  },

  dibs_expired: {
    type: 'dibs_expired',
    priority: 'medium',
    title: (_data: any) => 'Dibs window closed',
    body: (data: any) => data.message ?? 'Your dibs window closed — your request is now public',
    icon: 'clock',
    ctaLabel: 'View Request',
    actionUrl: (data: any) => `/requests/${data.request_id}`,
    channels: { in_app: true, push: false, email: false },
  },
};

// Helper function to generate notification from template
export function generateNotification(type: NotificationType, data: any) {
  const template = notificationTemplates[type];

  if (!template) {
    throw new Error(`Unknown notification type: ${type}`);
  }

  return {
    type: template.type,
    priority: template.priority,
    title: template.title(data),
    body: template.body(data),
    icon: template.icon,
    cta_label: template.ctaLabel,
    action_url: template.actionUrl(data),
    data, // Store original data for reference
  };
}
