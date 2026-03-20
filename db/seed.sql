-- Optional local seed data for development only
-- Replace password hashes and emails before any shared environment use.

INSERT INTO interview_users (id, email, password_hash, plan)
VALUES (
  '11111111-1111-1111-1111-111111111111',
  'demo@infinityhirecopilot.com',
  'seed-placeholder-hash',
  'free'
)
ON CONFLICT (email) DO NOTHING;
