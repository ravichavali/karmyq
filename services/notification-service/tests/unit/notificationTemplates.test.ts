/**
 * Unit Tests for Notification Templates
 * Following TDD principles: Test template rendering and logic
 *
 * Test Coverage:
 * - Template title generation
 * - Template body generation
 * - Template priority assignment
 * - Template channel configuration
 * - Action URL generation
 * - Error handling for unknown types
 * - Edge cases (missing data, special characters)
 */

import {
  notificationTemplates,
  generateNotification,
  NotificationType,
} from '../../src/templates/notificationTemplates';

describe('Notification Templates - Template Rendering', () => {
  describe('match_created Template', () => {
    const mockData = {
      responder_name: 'Alice',
      request_title: 'Help with moving furniture',
      match_id: 'match-123',
    };

    it('should generate correct title for match_created', () => {
      // Arrange
      const template = notificationTemplates.match_created;

      // Act
      const title = template.title(mockData);

      // Assert
      expect(title).toBe('New Match for Your Request');
    });

    it('should generate correct body with responder name and request title', () => {
      // Arrange
      const template = notificationTemplates.match_created;

      // Act
      const body = template.body(mockData);

      // Assert
      expect(body).toBe('Alice wants to help with "Help with moving furniture"');
    });

    it('should have high priority', () => {
      // Arrange & Act
      const template = notificationTemplates.match_created;

      // Assert
      expect(template.priority).toBe('high');
    });

    it('should enable in_app and push channels, but not email', () => {
      // Arrange & Act
      const template = notificationTemplates.match_created;

      // Assert
      expect(template.channels.in_app).toBe(true);
      expect(template.channels.push).toBe(true);
      expect(template.channels.email).toBe(false);
    });

    it('should generate correct action URL', () => {
      // Arrange
      const template = notificationTemplates.match_created;

      // Act
      const actionUrl = template.actionUrl(mockData);

      // Assert
      expect(actionUrl).toBe('/dashboard');
    });
  });

  describe('match_accepted Template', () => {
    const mockData = {
      requester_name: 'Bob',
      request_title: 'Need a ride to the airport',
    };

    it('should generate body with requester name and title', () => {
      // Arrange
      const template = notificationTemplates.match_accepted;

      // Act
      const body = template.body(mockData);

      // Assert
      expect(body).toBe('Bob accepted your offer to help with "Need a ride to the airport"');
    });

    it('should have high priority', () => {
      expect(notificationTemplates.match_accepted.priority).toBe('high');
    });
  });

  describe('karma_awarded Template', () => {
    const mockData = {
      points: 10,
      reason: 'helping with a request',
    };

    it('should generate body with points and reason', () => {
      // Arrange
      const template = notificationTemplates.karma_awarded;

      // Act
      const body = template.body(mockData);

      // Assert
      expect(body).toBe('You earned 10 karma points for helping with a request');
    });

    it('should have low priority', () => {
      expect(notificationTemplates.karma_awarded.priority).toBe('low');
    });

    it('should only enable in_app channel', () => {
      // Arrange
      const template = notificationTemplates.karma_awarded;

      // Assert
      expect(template.channels.in_app).toBe(true);
      expect(template.channels.push).toBe(false);
      expect(template.channels.email).toBe(false);
    });

    it('should link to karma profile', () => {
      // Arrange
      const template = notificationTemplates.karma_awarded;

      // Act
      const actionUrl = template.actionUrl(mockData);

      // Assert
      expect(actionUrl).toBe('/profile/karma');
    });
  });

  describe('karma_milestone Template', () => {
    const mockData = {
      total_karma: 100,
    };

    it('should generate congratulatory message with total karma', () => {
      // Arrange
      const template = notificationTemplates.karma_milestone;

      // Act
      const body = template.body(mockData);

      // Assert
      expect(body).toBe("Congratulations! You've reached 100 total karma points");
    });

    it('should have medium priority', () => {
      expect(notificationTemplates.karma_milestone.priority).toBe('medium');
    });

    it('should enable push notifications for milestones', () => {
      // Arrange
      const template = notificationTemplates.karma_milestone;

      // Assert
      expect(template.channels.push).toBe(true);
    });
  });

  describe('message_received Template', () => {
    it('should show message preview when available', () => {
      // Arrange
      const mockData = {
        sender_name: 'Charlie',
        message_preview: 'Hey, are you free tomorrow?',
      };
      const template = notificationTemplates.message_received;

      // Act
      const body = template.body(mockData);

      // Assert
      expect(body).toBe('Hey, are you free tomorrow?');
    });

    it('should show default message when preview is missing', () => {
      // Arrange
      const mockData = {
        sender_name: 'Charlie',
      };
      const template = notificationTemplates.message_received;

      // Act
      const body = template.body(mockData);

      // Assert
      expect(body).toBe('You have a new message');
    });

    it('should include sender name in title', () => {
      // Arrange
      const mockData = {
        sender_name: 'Charlie',
      };
      const template = notificationTemplates.message_received;

      // Act
      const title = template.title(mockData);

      // Assert
      expect(title).toBe('New Message from Charlie');
    });

    it('should have high priority', () => {
      expect(notificationTemplates.message_received.priority).toBe('high');
    });
  });

  describe('community_invite Template', () => {
    const mockData = {
      inviter_name: 'Diana',
      community_name: 'Tech Helpers',
      community_id: 'comm-123',
    };

    it('should show inviter and community name', () => {
      // Arrange
      const template = notificationTemplates.community_invite;

      // Act
      const body = template.body(mockData);

      // Assert
      expect(body).toBe('Diana invited you to join "Tech Helpers"');
    });

    it('should enable all channels (in_app, push, email)', () => {
      // Arrange
      const template = notificationTemplates.community_invite;

      // Assert
      expect(template.channels.in_app).toBe(true);
      expect(template.channels.push).toBe(true);
      expect(template.channels.email).toBe(true);
    });

    it('should link to invite page with community ID', () => {
      // Arrange
      const template = notificationTemplates.community_invite;

      // Act
      const actionUrl = template.actionUrl(mockData);

      // Assert
      expect(actionUrl).toBe('/communities/comm-123/invite');
    });
  });

  describe('join_request Template', () => {
    it('should show user name and community when no message', () => {
      // Arrange
      const mockData = {
        user_name: 'Eve',
        community_name: 'Book Club',
        community_id: 'comm-456',
      };
      const template = notificationTemplates.join_request;

      // Act
      const body = template.body(mockData);

      // Assert
      expect(body).toBe('Eve wants to join "Book Club"');
    });

    it('should include optional message when provided', () => {
      // Arrange
      const mockData = {
        user_name: 'Eve',
        community_name: 'Book Club',
        community_id: 'comm-456',
        message: 'I love reading sci-fi!',
      };
      const template = notificationTemplates.join_request;

      // Act
      const body = template.body(mockData);

      // Assert
      expect(body).toBe('Eve wants to join "Book Club": I love reading sci-fi!');
    });

    it('should link to community admin page', () => {
      // Arrange
      const mockData = {
        user_name: 'Eve',
        community_name: 'Book Club',
        community_id: 'comm-456',
      };
      const template = notificationTemplates.join_request;

      // Act
      const actionUrl = template.actionUrl(mockData);

      // Assert
      expect(actionUrl).toBe('/communities/comm-456/admin');
    });

    it('should have high priority', () => {
      expect(notificationTemplates.join_request.priority).toBe('high');
    });
  });

  describe('norm_proposed Template', () => {
    const mockData = {
      proposer_name: 'Frank',
      community_name: 'Gardening Group',
      community_id: 'comm-789',
      norm_id: 'norm-101',
    };

    it('should show proposer and community name', () => {
      // Arrange
      const template = notificationTemplates.norm_proposed;

      // Act
      const body = template.body(mockData);

      // Assert
      expect(body).toBe('Frank proposed a new norm in "Gardening Group"');
    });

    it('should have low priority', () => {
      expect(notificationTemplates.norm_proposed.priority).toBe('low');
    });

    it('should link to specific norm page', () => {
      // Arrange
      const template = notificationTemplates.norm_proposed;

      // Act
      const actionUrl = template.actionUrl(mockData);

      // Assert
      expect(actionUrl).toBe('/communities/comm-789/norms/norm-101');
    });

    it('should NOT enable push or email notifications', () => {
      // Arrange
      const template = notificationTemplates.norm_proposed;

      // Assert
      expect(template.channels.push).toBe(false);
      expect(template.channels.email).toBe(false);
    });
  });

  describe('feedback_received Template', () => {
    const mockData = {
      from_user_name: 'Grace',
      rating: 4,
    };

    it('should show sender name and rating', () => {
      // Arrange
      const template = notificationTemplates.feedback_received;

      // Act
      const body = template.body(mockData);

      // Assert
      expect(body).toBe('Grace left you feedback (4/5 stars)');
    });

    it('should handle 5-star rating', () => {
      // Arrange
      const template = notificationTemplates.feedback_received;
      const fiveStarData = { from_user_name: 'Grace', rating: 5 };

      // Act
      const body = template.body(fiveStarData);

      // Assert
      expect(body).toBe('Grace left you feedback (5/5 stars)');
    });

    it('should link to feedback profile', () => {
      // Arrange
      const template = notificationTemplates.feedback_received;

      // Act
      const actionUrl = template.actionUrl(mockData);

      // Assert
      expect(actionUrl).toBe('/profile/feedback');
    });
  });
});

describe('generateNotification - Notification Generation', () => {
  it('should generate complete notification from template', () => {
    // Arrange
    const type: NotificationType = 'match_created';
    const data = {
      responder_name: 'Alice',
      request_title: 'Help needed',
    };

    // Act
    const notification = generateNotification(type, data);

    // Assert
    expect(notification.type).toBe('match_created');
    expect(notification.priority).toBe('high');
    expect(notification.title).toBe('New Match for Your Request');
    expect(notification.body).toBe('Alice wants to help with "Help needed"');
    expect(notification.icon).toBe('handshake');
    expect(notification.action_url).toBe('/dashboard');
    expect(notification.data).toEqual(data);
  });

  it('should preserve original data in notification', () => {
    // Arrange
    const type: NotificationType = 'karma_awarded';
    const data = {
      points: 15,
      reason: 'first help',
      match_id: 'match-xyz',
    };

    // Act
    const notification = generateNotification(type, data);

    // Assert
    expect(notification.data).toEqual(data);
    expect(notification.data.match_id).toBe('match-xyz');
  });

  it('should throw error for unknown notification type', () => {
    // Arrange
    const invalidType = 'unknown_type' as NotificationType;
    const data = {};

    // Act & Assert
    expect(() => generateNotification(invalidType, data))
      .toThrow('Unknown notification type: unknown_type');
  });

  it('should generate notification for all valid types without errors', () => {
    // Arrange
    const mockData = {
      responder_name: 'Test User',
      requester_name: 'Test User',
      request_title: 'Test Request',
      points: 10,
      reason: 'test',
      total_karma: 100,
      sender_name: 'Test',
      message_preview: 'Test message',
      inviter_name: 'Test',
      community_name: 'Test Community',
      community_id: 'comm-1',
      user_name: 'Test',
      proposer_name: 'Test',
      norm_id: 'norm-1',
      from_user_name: 'Test',
      rating: 5,
    };

    const types: NotificationType[] = [
      'match_created',
      'match_accepted',
      'match_completed',
      'match_cancelled',
      'karma_awarded',
      'karma_milestone',
      'new_request',
      'request_responded',
      'message_received',
      'community_invite',
      'join_request',
      'norm_proposed',
      'feedback_received',
    ];

    // Act & Assert: All should generate without errors
    types.forEach(type => {
      expect(() => generateNotification(type, mockData)).not.toThrow();
    });
  });
});

describe('Edge Cases & Special Characters', () => {
  it('should handle special characters in names', () => {
    // Arrange
    const mockData = {
      responder_name: "O'Brien",
      request_title: 'Help with "coding"',
    };
    const template = notificationTemplates.match_created;

    // Act
    const body = template.body(mockData);

    // Assert
    expect(body).toContain("O'Brien");
    expect(body).toContain('"Help with "coding""');
  });

  it('should handle very long request titles', () => {
    // Arrange
    const longTitle = 'A'.repeat(200);
    const mockData = {
      requester_name: 'Bob',
      request_title: longTitle,
    };
    const template = notificationTemplates.match_accepted;

    // Act
    const body = template.body(mockData);

    // Assert: Should not truncate or error
    expect(body).toContain(longTitle);
  });

  it('should handle unicode characters in names', () => {
    // Arrange
    const mockData = {
      sender_name: '李明 (Li Ming)',
    };
    const template = notificationTemplates.message_received;

    // Act
    const title = template.title(mockData);

    // Assert
    expect(title).toBe('New Message from 李明 (Li Ming)');
  });

  it('should handle numeric values in template data', () => {
    // Arrange
    const mockData = {
      points: 0, // Edge case: zero points
      reason: 'test',
    };
    const template = notificationTemplates.karma_awarded;

    // Act
    const body = template.body(mockData);

    // Assert
    expect(body).toBe('You earned 0 karma points for test');
  });

  it('should handle negative ratings (validation edge case)', () => {
    // Arrange
    const mockData = {
      from_user_name: 'Test',
      rating: -1, // Invalid, but template should still render
    };
    const template = notificationTemplates.feedback_received;

    // Act
    const body = template.body(mockData);

    // Assert
    expect(body).toBe('Test left you feedback (-1/5 stars)');
  });
});

describe('Priority Classification', () => {
  it('should classify urgent user actions as high priority', () => {
    // Assert: These require immediate user attention
    expect(notificationTemplates.match_created.priority).toBe('high');
    expect(notificationTemplates.match_accepted.priority).toBe('high');
    expect(notificationTemplates.message_received.priority).toBe('high');
    expect(notificationTemplates.request_responded.priority).toBe('high');
    expect(notificationTemplates.join_request.priority).toBe('high');
  });

  it('should classify informational updates as medium priority', () => {
    // Assert: These are important but not urgent
    expect(notificationTemplates.match_completed.priority).toBe('medium');
    expect(notificationTemplates.match_cancelled.priority).toBe('medium');
    expect(notificationTemplates.karma_milestone.priority).toBe('medium');
    expect(notificationTemplates.new_request.priority).toBe('medium');
    expect(notificationTemplates.community_invite.priority).toBe('medium');
    expect(notificationTemplates.feedback_received.priority).toBe('medium');
  });

  it('should classify background events as low priority', () => {
    // Assert: These are nice-to-know but not important
    expect(notificationTemplates.karma_awarded.priority).toBe('low');
    expect(notificationTemplates.norm_proposed.priority).toBe('low');
  });
});

describe('Channel Configuration Validation', () => {
  it('should enable email only for important cross-platform notifications', () => {
    // Assert: Only community_invite enables email
    const emailEnabledTypes = Object.values(notificationTemplates)
      .filter(t => t.channels.email)
      .map(t => t.type);

    expect(emailEnabledTypes).toEqual(['community_invite']);
  });

  it('should enable push for high-priority notifications', () => {
    // Assert: All high-priority notifications should have push enabled
    const highPriorityWithoutPush = Object.values(notificationTemplates)
      .filter(t => t.priority === 'high' && !t.channels.push)
      .map(t => t.type);

    expect(highPriorityWithoutPush).toEqual([]);
  });

  it('should always enable in_app channel for all notifications', () => {
    // Assert: Every notification type should be visible in-app
    const withoutInApp = Object.values(notificationTemplates)
      .filter(t => !t.channels.in_app)
      .map(t => t.type);

    expect(withoutInApp).toEqual([]);
  });
});
