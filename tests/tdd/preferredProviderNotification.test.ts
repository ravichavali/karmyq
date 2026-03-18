// tests/tdd/preferredProviderNotification.test.ts
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

  it('channels: in_app true, push false, email false', () => {
    expect(template.channels).toEqual({ in_app: true, push: false, email: false });
  });
});
