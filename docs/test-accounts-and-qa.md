# InfinityHire Copilot Test Accounts and QA Guide

This guide provides local-only test accounts and a quick verification flow for auth, quota, session, and feedback features.

## Seed test accounts

Run schema and seed SQL against your local Postgres database:

```bash
npm run db:seed
```

Test accounts (local dev only):

- `candidate.free@infinityhirecopilot.test` / `Candidate#123` (`free`)
- `candidate.pro@infinityhirecopilot.test` / `ProUser#123` (`pro`)
- `candidate.limit@infinityhirecopilot.test` / `NearLimit#123` (`free`, starts at 29/30 monthly usage)

## Manual QA checklist

### 1) Auth smoke test

1. Open `http://localhost:3004/login`
2. Login with each account
3. Confirm redirect to `/session`
4. Logout and confirm protected pages redirect to `/login`

### 2) Plan and quota behavior

1. Login as `candidate.limit@...`
2. Generate one answer and confirm it succeeds (30/30)
3. Generate one more answer and confirm quota limit UX appears
4. Login as `candidate.pro@...` and confirm repeated answer generation remains allowed

### 3) Feedback endpoints

1. Create at least one answer in a session
2. Submit answer feedback (`thumbs up/down` or API call)
3. Fetch monthly summary:

```bash
curl "http://localhost:3004/api/feedback/summary"
```

4. Verify feedback rows appear in DB:

```sql
SELECT user_id, source, rating, created_at
FROM interview_answer_feedback
ORDER BY created_at DESC
LIMIT 10;
```

### 4) Funnel and event integrity

1. Signup a brand-new account once
2. Login with an existing account
3. Visit `/session` and generate at least one answer
4. Validate funnel endpoint and events table:

```bash
curl "http://localhost:3004/api/analytics/funnel?days=30"
```

```sql
SELECT event_type, COUNT(*) FROM interview_events GROUP BY event_type ORDER BY event_type;
```

## Playwright notes

- Existing E2E specs should run with:

```bash
npm run test:e2e
```

- If your local DB is reset frequently, re-run `npm run db:seed` before test runs.
