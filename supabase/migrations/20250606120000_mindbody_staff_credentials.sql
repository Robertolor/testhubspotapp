-- Per-tenant Mindbody staff credentials for user token (Bearer) API access

ALTER TABLE mindbody_accounts
  ADD COLUMN IF NOT EXISTS staff_username TEXT,
  ADD COLUMN IF NOT EXISTS staff_password_encrypted TEXT;
