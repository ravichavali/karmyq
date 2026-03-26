-- 20260326-device-push-tokens.sql
-- Sprint 41: Push notification tokens for Expo
-- Stores device-specific push tokens for iOS and Android apps
-- One device (token) per user per platform can be stored

CREATE TABLE IF NOT EXISTS auth.device_push_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  expo_push_token TEXT NOT NULL,
  platform VARCHAR(10) CHECK (platform IN ('ios', 'android')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, expo_push_token)
);

CREATE INDEX IF NOT EXISTS idx_device_push_tokens_user_id
  ON auth.device_push_tokens(user_id);
