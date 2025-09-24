-- Migration: Add users table and OAuth token management for multi-user support
-- Phase 1 of multi-user OAuth architecture

-- Users table for authentication and profile management
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255),
    image_url VARCHAR(500),
    role VARCHAR(50) DEFAULT 'user' CHECK(role IN ('admin', 'user')),
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- OAuth tokens table for multi-user token storage
CREATE TABLE IF NOT EXISTS oauth_tokens (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    provider VARCHAR(50) NOT NULL DEFAULT 'google',
    access_token TEXT NOT NULL,
    refresh_token TEXT NOT NULL,
    token_type VARCHAR(20) DEFAULT 'Bearer',
    scope TEXT NOT NULL,
    expiry_date BIGINT NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(user_id, provider)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_active ON users(active);
CREATE INDEX IF NOT EXISTS idx_oauth_tokens_user_provider ON oauth_tokens(user_id, provider);
CREATE INDEX IF NOT EXISTS idx_oauth_tokens_expiry ON oauth_tokens(expiry_date);

-- Insert current users from hardcoded allowed emails
INSERT INTO users (email, name, role) VALUES 
('sheridan.gray@gmail.com', 'Sheridan Gray', 'admin'),
('joyce.yan.zhang@gmail.com', 'Joyce Zhang', 'user')
ON CONFLICT (email) DO NOTHING;

-- Audit table for OAuth token operations (optional but recommended for security)
CREATE TABLE IF NOT EXISTS oauth_audit_log (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    action VARCHAR(50) NOT NULL, -- 'token_created', 'token_refreshed', 'token_revoked'
    provider VARCHAR(50) NOT NULL,
    ip_address INET,
    user_agent TEXT,
    success BOOLEAN DEFAULT true,
    error_message TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_oauth_audit_user ON oauth_audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_oauth_audit_created_at ON oauth_audit_log(created_at);