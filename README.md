# InfinityHire Copilot

AI interview intelligence platform built with Next.js 14.

## SFMS-style Structure Alignment

This repo has been aligned to SFMS top-level structure conventions by adding:

- `.config/` for environment and structural config templates
- `backend/` scaffold for future FastAPI split
- `db/` for SQL schema/seed source files
- `docker/` for local infrastructure compose files
- `docs/` for architecture and migration notes
- `frontend/` placeholder for eventual frontend relocation

Current active app runtime remains the root Next.js project (`src/` + root `package.json`) to avoid deployment regressions.

## Product Direction

This project follows production patterns inspired by `interview-with-giri/.cursor`:

- typed API layer (`src/lib/api.ts`, `src/lib/types.ts`)
- resilient AI fallback path (Gemini -> OpenRouter -> static fallback)
- candidate-first realtime UX (mic + typed input + transcript export)
- API hardening (input validation, file checks, lightweight rate limiting)
- health endpoint (`/api/health`) for deploy checks

## Local Development

1. Install dependencies

```bash
npm install
```

2. Create `.env.local`

```env
OPENROUTER_API_KEY=sk-or-v1-...
# optional
GOOGLE_AI_KEY=...
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/infinityhire_copilot
```

3. Run app

```bash
npm run dev
```

Open `http://localhost:3004`.

## API Endpoints

- `GET /api/health` - liveness check
- `POST /api/extract-resume` - upload `.txt` or `.pdf` (max 5MB)
- `POST /api/answer` - generate role-aware interview answer
- `POST /api/auth/*` + `GET /api/auth/me` - auth via secure cookie + Postgres users table
- `GET /api/billing/subscription` + `POST /api/billing/upgrade` - plan/usage backed by Postgres

## Quality Checks

```bash
npm run lint
npm run build
npx tsc --noEmit
npm run test:e2e
```

## Deployment

This repository includes GitHub Actions for CI and Vercel deploy:

- `.github/workflows/ci.yml`
- `.github/workflows/deploy-vercel.yml`

Required GitHub secrets:

- `DATABASE_URL`
- `AUTH_SECRET`
- `OPENROUTER_API_KEY` (optional, fallback still works)
- `GOOGLE_AI_KEY` (optional)
- `VERCEL_TOKEN`
- `VERCEL_ORG_ID`
- `VERCEL_PROJECT_ID`

Manual production deploy from local machine (if Vercel CLI is authenticated):

```bash
npx vercel --prod
```

## Next YC-Worthy Milestones

- add auth + user accounts (session persistence across devices)
- add billing and plan gating (free/pro usage quotas)
- add interview analytics dashboard (mock scorecards -> real scorecards)
- add automated tests (Playwright E2E + API contract tests)
- add observability (Sentry + structured server logs)
