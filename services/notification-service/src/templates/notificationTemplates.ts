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
  | 'norm_proposed'
  | 'feedback_received';

export type NotificationPriority = 'low' | 'medium' | 'high' | 'critical';

export interface NotificationTemplate {
  type: NotificationType;
  priority: NotificationPriority;
  title: (data: any) => string;
  body: (data: any) => string;
  icon?: string;
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
    actionUrl: (data) => `/matches/${data.match_id}`,
    channels: { in_app: true, push: true, email: false },
  },

  match_accepted: {
    type: 'match_accepted',
    priority: 'high',
    title: (data) => 'Match Accepted',
    body: (data) => `${data.requester_name} accepted your offer to help with "${data.request_title}"`,
    icon: 'check-circle',
    actionUrl: (data) => `/matches/${data.match_id}`,
    channels: { in_app: true, push: true, email: false },
  },

  match_completed: {
    type: 'match_completed',
    priority: 'medium',
    title: (data) => 'Match Completed',
    body: (data) => `Your match for "${data.request_title}" has been completed`,
    icon: 'star',
    actionUrl: (data) => `/matches/${data.match_id}`,
    channels: { in_app: true, push: true, email: false },
  },

  match_cancelled: {
    type: 'match_cancelled',
    priority: 'medium',
    title: (data) => 'Match Cancelled',
    body: (data) => `The match for "${data.request_title}" has been cancelled`,
    icon: 'x-circle',
    actionUrl: (data) => `/requests/${data.request_id}`,
    channels: { in_app: true, push: false, email: false },
  },

  karma_awarded: {
    type: 'karma_awarded',
    priority: 'low',
    title: (data) => 'Karma Earned!',
    body: (data) => `You earned ${data.points} karma points for ${data.reason}`,
    icon: 'award',
    actionUrl: (data) => `/profile/karma`,
    channels: { in_app: true, push: false, email: false },
  },

  karma_milestone: {
    type: 'karma_milestone',
    priority: 'medium',
    title: (data) => 'Karma Milestone Reached!',
    body: (data) => `Congratulations! You've reached ${data.total_karma} total karma points`,
    icon: 'trophy',
    actionUrl: (data) => `/profile/karma`,
    channels: { in_app: true, push: true, email: false },
  },

  new_request: {
    type: 'new_request',
    priority: 'medium',
    title: (data) => 'New Request in Your Community',
    body: (data) => `${data.requester_name}: "${data.request_title}"`,
    icon: 'bell',
    actionUrl: (data) => `/requests/${data.request_id}`,
    channels: { in_app: true, push: false, email: false },
  },

  request_responded: {
    type: 'request_responded',
    priority: 'high',
    title: (data) => 'Someone Responded to Your Request',
    body: (data) => `${data.responder_name} responded to "${data.request_title}"`,
    icon: 'message-circle',
    actionUrl: (data) => `/requests/${data.request_id}`,
    channels: { in_app: true, push: true, email: false },
  },

  message_received: {
    type: 'message_received',
    priority: 'high',
    title: (data) => `New Message from ${data.sender_name}`,
    body: (data) => data.message_preview || 'You have a new message',
    icon: 'mail',
    actionUrl: (data) => `/messages/${data.conversation_id}`,
    channels: { in_app: true, push: true, email: false },
  },

  community_invite: {
    type: 'community_invite',
    priority: 'medium',
    title: (data) => 'Community Invitation',
    body: (data) => `${data.inviter_name} invited you to join "${data.community_name}"`,
    icon: 'users',
    actionUrl: (data) => `/communities/${data.community_id}/invite`,
    channels: { in_app: true, push: true, email: true },
  },

  norm_proposed: {
    type: 'norm_proposed',
    priority: 'low',
    title: (data) => 'New Norm Proposed',
    body: (data) => `${data.proposer_name} proposed a new norm in "${data.community_name}"`,
    icon: 'file-text',
    actionUrl: (data) => `/communities/${data.community_id}/norms/${data.norm_id}`,
    channels: { in_app: true, push: false, email: false },
  },

  feedback_received: {
    type: 'feedback_received',
    priority: 'medium',
    title: (data) => 'New Feedback Received',
    body: (data) => `${data.from_user_name} left you feedback (${data.rating}/5 stars)`,
    icon: 'star',
    actionUrl: (data) => `/profile/feedback`,
    channels: { in_app: true, push: true, email: false },
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
    action_url: template.actionUrl(data),
    data, // Store original data for reference
  };
}
