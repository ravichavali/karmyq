// tests/regression/preferredProviderNotification.test.ts (promoted from tests/tdd/ in Sprint 140)
import { notificationTemplates } from '../../services/notification-service/src/templates/notificationTemplates';

describe('preferred_provider_selected notification template', () => {
  const template = notificationTemplates['preferred_provider_selected'];

  it('template exists', () => {
    expect(template).toBeDefined();
  });

  it('title is correct', () => {
    expect(template.title({})).toBe('You were pre-selected');
  });

  it('body interpolates correctly', () => {
    const body = template.body({
      requester_name: 'Alice',
      request_type: 'tutor',
      request_title: 'Math Help',
    });
    expect(body).toContain('Alice');
    expect(body).toContain('Math Help');
  });

  it('actionUrl resolves to /requests/:id', () => {
    expect(template.actionUrl({ request_id: 'abc-123' })).toBe('/requests/abc-123');
  });

  // Sprint 83 (2c65c70b) made this high-priority template push ("time-sensitive pre-selection deserves push"), in
  // line with the other high-priority templates; Sprint 140 caught this expectation up. Email stays off.
  it('is high priority and delivers in-app and push, never email', () => {
    expect(template.priority).toBe('high');
    expect(template.channels).toEqual({ in_app: true, push: true, email: false });
  });
});
