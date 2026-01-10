-- Migration 010: User Privacy Settings
-- Date: 2026-01-09
-- Purpose: Add privacy settings for karma display (Minimal Karma Measurement - Fractal Karma & Trust)
--
-- Changes:
-- - Create auth.user_privacy_settings table
-- - Add show_my_karma_to_me boolean column (default FALSE)
--
-- Backward Compatibility: ✅ New table, no breaking changes

-- Create privacy settings table
CREATE TABLE IF NOT EXISTS auth.user_privacy_settings (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    show_my_karma_to_me BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_user_privacy_settings_user_id ON auth.user_privacy_settings(user_id);

-- Add comment explaining the table
COMMENT ON TABLE auth.user_privacy_settings IS 'Privacy settings for users - controls karma display visibility (opt-in), future: profile visibility, message preferences, etc.';
COMMENT ON COLUMN auth.user_privacy_settings.show_my_karma_to_me IS 'If TRUE, user sees their own karma score on their profile (private display only, never public)';
