-- Migration: Create user_push_tokens table
-- This table stores device tokens for push notifications (APNs for iOS, FCM for Android)

CREATE TABLE IF NOT EXISTS user_push_tokens (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    device_token TEXT NOT NULL,
    platform VARCHAR(20) NOT NULL, -- 'ios', 'android'
    last_used_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, device_token)
);

-- Index for faster lookup by user_id
CREATE INDEX idx_user_push_tokens_user_id ON user_push_tokens(user_id);

-- Index for faster lookup by token
CREATE INDEX idx_user_push_tokens_token ON user_push_tokens(device_token);

-- Add comment explaining the table
COMMENT ON TABLE user_push_tokens IS 'Stores device tokens for push notifications per user and platform';
