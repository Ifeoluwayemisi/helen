-- ====================================================================
-- Hellen Store POS & Inventory: Migration 005_sessions_and_auth.sql
-- Server Authentication, Sessions, Rate Limiting & Account Security
-- ====================================================================

-- 1. Create sessions table for server-authoritative token tracking
CREATE TABLE IF NOT EXISTS sessions (
  id VARCHAR(64) PRIMARY KEY, -- SHA-256 hash of random session token
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  ip_address VARCHAR(64),
  user_agent TEXT
);

CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);

-- 2. Add security and rate-limiting fields to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS failed_login_attempts INT NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS locked_until TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ;

-- 3. Update existing demo accounts with secure scrypt password hashes
UPDATE users
SET password_hash = 'scrypt$b38108030a5a9cada9d23d9a01e2a9b4$2d8a698d32d175ca58e163de9c85b8d9959f3a15d609ee83b7dd4249852f72e5dd9203a96e0e1aa12bc0d3f3c239d1ba84d1a315e01e343b34f3ae0f7ec7abd6'
WHERE email = 'hellen@hellenstore.com' AND (password_hash IS NULL OR password_hash = '');

UPDATE users
SET password_hash = 'scrypt$fa20cdf2f4cf2befccae00a38447448a$29dff49ccfa4978244876d2e605c773fe420244b1cdc83b82f1ad0ec4b208681cd201f2f195359abeb90170a2895982097a83a65b0a6812715e230250c255d3e'
WHERE email = 'blessing@hellenstore.com' AND (password_hash IS NULL OR password_hash = '');

UPDATE users
SET password_hash = 'scrypt$21c53980f3f233148bb91392b153e95b$9be25b453753220e611c985286d2ca5114f8df0e61c4324ee60d0091419fbfaad8ebda68af0ab68993c62ffc57a003c984fff75fcfe3ce66bf7ab95578293fcb'
WHERE email = 'emeka@hellenstore.com' AND (password_hash IS NULL OR password_hash = '');
