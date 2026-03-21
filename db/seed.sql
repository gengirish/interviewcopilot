-- Local seed data for development and QA verification.
-- Never use these credentials in shared or production environments.

INSERT INTO interview_users (id, email, password_hash, plan)
VALUES
  (
    '11111111-1111-1111-1111-111111111111',
    'candidate.free@infinityhirecopilot.test',
    '5e8eb22f34fb700e2e310ade0d925653:6c1ee14aa4307ab1b637ec323f6f078a7943dec7d14079d49a4e3125310c9288fb8c0176374f0e3c63c5fa023eb819a8e1c44f54a9b8319a3d256df4d682b700',
    'free'
  ),
  (
    '22222222-2222-2222-2222-222222222222',
    'candidate.pro@infinityhirecopilot.test',
    'fd631834f004fb231195e20d29e0734d:793e0f6fc178cc4de1b1d458153f41574cfc7b0317bcda7ade10ad2ea8913bdc5b7aa04b236dbb79818f049f67babdcdcc1a7ee91bbc6d95199477fd10a9958c',
    'pro'
  ),
  (
    '33333333-3333-3333-3333-333333333333',
    'candidate.limit@infinityhirecopilot.test',
    '0ebc1366502e111a04f541c3e1175fff:01437c7208074da0ae78134da89051d081846cfeade94b1496bd5961007893264a69f61838b7a78b14a59d2b23d04b4f8aa68c6fc2879e513094e4399d5d0d3f',
    'free'
  )
ON CONFLICT (email) DO UPDATE
SET password_hash = EXCLUDED.password_hash,
    plan = EXCLUDED.plan;

INSERT INTO interview_usage_monthly (user_id, month_key, count)
VALUES
  (
    '33333333-3333-3333-3333-333333333333',
    to_char(CURRENT_DATE, 'YYYY-MM'),
    29
  ),
  (
    '11111111-1111-1111-1111-111111111111',
    to_char(CURRENT_DATE, 'YYYY-MM'),
    0
  ),
  (
    '22222222-2222-2222-2222-222222222222',
    to_char(CURRENT_DATE, 'YYYY-MM'),
    0
  )
ON CONFLICT (user_id, month_key) DO UPDATE
SET count = EXCLUDED.count;
