-- Notifications Schema
CREATE SCHEMA IF NOT EXISTS notifications;

-- Notifications table
CREATE TABLE notifications.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  type VARCHAR(50) NOT NULL,
  title VARCHAR(255) NOT NULL,
  body TEXT NOT NULL,
  data JSONB DEFAULT '{}',
  read BOOLEAN DEFAULT FALSE,
  action_url VARCHAR(500),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  read_at TIMESTAMP,

  CONSTRAINT fk_user FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
);

-- Notification preferences table
CREATE TABLE notifications.preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  community_id UUID,
  event_type VARCHAR(50) NOT NULL,
  in_app_enabled BOOLEAN DEFAULT TRUE,
  push_enabled BOOLEAN DEFAULT TRUE,
  email_enabled BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT fk_user FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  CONSTRAINT fk_community FOREIGN KEY (community_id) REFERENCES communities.communities(id) ON DELETE CASCADE,
  UNIQUE(user_id, community_id, event_type)
);

-- Default global preferences (when community_id is NULL)
CREATE TABLE notifications.global_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE,
  in_app_enabled BOOLEAN DEFAULT TRUE,
  push_enabled BOOLEAN DEFAULT TRUE,
  email_enabled BOOLEAN DEFAULT FALSE,
  quiet_hours_start TIME,
  quiet_hours_end TIME,
  timezone VARCHAR(50) DEFAULT 'UTC',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT fk_user FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
);

-- Indexes for performance
CREATE INDEX idx_notifications_user_id ON notifications.notifications(user_id);
CREATE INDEX idx_notifications_type ON notifications.notifications(type);
CREATE INDEX idx_notifications_created_at ON notifications.notifications(created_at DESC);
CREATE INDEX idx_notifications_unread ON notifications.notifications(user_id, read) WHERE read = FALSE;
CREATE INDEX idx_preferences_user_id ON notifications.preferences(user_id);
CREATE INDEX idx_preferences_event_type ON notifications.preferences(event_type);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION notifications.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for preferences table
CREATE TRIGGER preferences_updated_at
  BEFORE UPDATE ON notifications.preferences
  FOR EACH ROW
  EXECUTE FUNCTION notifications.update_updated_at();

-- Trigger for global_preferences table
CREATE TRIGGER global_preferences_updated_at
  BEFORE UPDATE ON notifications.global_preferences
  FOR EACH ROW
  EXECUTE FUNCTION notifications.update_updated_at();

-- Grant permissions
GRANT USAGE ON SCHEMA notifications TO karmyq_user;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA notifications TO karmyq_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA notifications TO karmyq_user;
