---
name: turfstack-deploy
description: Deploy the TurfStack application to production. Use when deploying backend to Fly.io, frontend to Vercel, running database migrations, or troubleshooting deployment issues. Covers the full deployment workflow for both services.
---

# TurfStack Deployment

## Pre-Deploy: Resolve Project Names

Before running any deploy commands, **ask the user** for the following if not already known:

| Parameter | Description | Example |
|-----------|-------------|---------|
| `FLY_APP_NAME` | Fly.io app name (from `fly.toml` → `app` field) | `sfms-api` |
| `VERCEL_PROJECT` | Vercel project name / production alias | `turfstack` |
| `VERCEL_SCOPE` | Vercel team/org scope (from `.vercel/project.json` or `vercel team ls`) | `girish-hiremaths-projects` |

**How to discover these values automatically:**

```bash
# Fly.io app name — read from fly.toml
grep '^app' backend/fly.toml

# Vercel project — read from .vercel/project.json
cat frontend/.vercel/project.json

# Vercel scope — list available teams
npx vercel team ls
```

> **Never hardcode** project names. Always read from config or ask the user.

## Architecture Overview

```
┌─────────────────┐     API calls     ┌──────────────────┐     asyncpg     ┌────────────┐
│  Vercel (Next.js)│ ───────────────► │  Fly.io (FastAPI) │ ─────────────► │ Fly Postgres│
│  frontend/       │                  │  backend/          │                │ (internal)  │
└─────────────────┘                  └──────────────────┘                └────────────┘
```

| Service | Platform | How to find URL |
|---------|----------|-----------------|
| Frontend | Vercel | `npx vercel ls --scope $VERCEL_SCOPE` or check Vercel dashboard |
| Backend | Fly.io | `https://$FLY_APP_NAME.fly.dev` |
| Database | Fly.io Postgres | Internal connection via `DATABASE_URL` secret |

## Backend Deployment (Fly.io)

### First-Time Setup

```bash
cd backend
fly launch --name $FLY_APP_NAME --region sin
fly postgres create --name ${FLY_APP_NAME}-db --region sin
fly postgres attach ${FLY_APP_NAME}-db --app $FLY_APP_NAME

# Set secrets
fly secrets set JWT_SECRET="<secret>" \
  CORS_ORIGINS="https://$VERCEL_PROJECT.vercel.app" \
  RAZORPAY_KEY_ID="<key>" \
  RAZORPAY_KEY_SECRET="<secret>"
```

### Deploy Backend

```bash
cd backend
fly deploy --remote-only
```

This builds from `backend/Dockerfile` and deploys. The `fly.toml` configures:
- Internal port (check `fly.toml` → `[http_service].internal_port`)
- Health check path (check `fly.toml` → `[[http_service.checks]].path`)
- Auto-stop/start enabled
- `sin` (Singapore) region

### Database Migrations

For async SQLAlchemy (asyncpg), run migrations via SSH. **Important:** asyncpg does not support multiple statements per `execute()` call — each SQL statement must be a separate `await conn.execute(text(...))` call.

```bash
# Option 1: Write a migration script locally, pipe it in
# (Works around PowerShell quoting issues)
Get-Content migration.py | fly ssh console --app $FLY_APP_NAME -C "python -"

# Option 2: Connect via proxy and use psql
fly proxy 15432:5432 --app ${FLY_APP_NAME}-db
psql postgres://postgres:<password>@localhost:15432/turfstack
```

Migration script pattern:

```python
import asyncio
from sfms.models.database import get_engine
from sqlalchemy import text

async def run():
    engine = get_engine()
    async with engine.begin() as conn:
        await conn.execute(text("ALTER TABLE x ADD COLUMN IF NOT EXISTS y TEXT"))
        await conn.execute(text("CREATE TABLE IF NOT EXISTS z (id SERIAL PRIMARY KEY)"))
        print("Done")

asyncio.run(run())
```

### Verify Backend

```bash
# Read health check path from fly.toml, typically /api/v1/health/ready
fly status --app $FLY_APP_NAME

# Hit the health endpoint
curl https://$FLY_APP_NAME.fly.dev/api/v1/health/ready
# {"status":"ready","checks":{"database":"connected"}}
```

## Frontend Deployment (Vercel)

### First-Time Setup

1. Connect the GitHub repo to Vercel
2. Set root directory to `frontend`
3. Set environment variables:
   - `NEXT_PUBLIC_API_URL` = `https://$FLY_APP_NAME.fly.dev`
   - `NEXT_PUBLIC_RAZORPAY_KEY` = Razorpay publishable key

### Deploy Frontend

Vercel auto-deploys on push to `main`. For manual deploy:

```bash
cd frontend
npx vercel --prod --yes --scope $VERCEL_SCOPE
```

> **Always pass `--scope`** to avoid interactive prompts. Discover it from `npx vercel team ls` or `.vercel/project.json` → `orgId`.

### Verify Frontend

```bash
# Check deployment URL from Vercel output, or:
npx vercel ls --scope $VERCEL_SCOPE
```

Visit the production URL and confirm:
- Landing page loads
- Login/register forms submit to the backend
- Dashboard loads after authentication

## Deployment Order

Always deploy in this order when both services change:

1. **Backend first** — new API endpoints must exist before frontend calls them
2. **Run migrations** — new tables/columns must exist before the API uses them
3. **Frontend second** — now safe to reference new endpoints

## Smoke Testing After Deploy

```powershell
# Test multiple endpoints in one go (PowerShell)
$base = "https://$FLY_APP_NAME.fly.dev"
$endpoints = @("/api/v1/health/ready", "/api/v1/venues")
foreach ($ep in $endpoints) {
    try {
        $r = Invoke-WebRequest -Uri "$base$ep" -UseBasicParsing -TimeoutSec 60
        "$($r.StatusCode) $ep"
    } catch { "ERR $ep -> $($_.Exception.Message)" }
}
```

## Running E2E Tests Against Production

```bash
cd frontend
# Set env vars to skip local dev server and target production
$env:SKIP_WEBSERVER="1"
$env:BASE_URL="https://<vercel-production-url>"
npx playwright test --reporter=line
```

> **Discover the correct BASE_URL** from the Vercel deploy output or `npx vercel ls`.

## Troubleshooting

| Issue | Check |
|-------|-------|
| CORS errors | Verify `CORS_ORIGINS` secret on Fly.io includes the Vercel domain |
| 502 on Fly.io | Run `fly logs --app $FLY_APP_NAME --no-tail` to check startup errors |
| Machine stopped | `fly machine start <id> --app $FLY_APP_NAME` (get id from `fly machines list`) |
| `pkg_resources` missing | Add `setuptools==69.5.1` to `requirements.lock` (razorpay needs it) |
| DB connection refused | Verify Postgres app is running: `fly status --app ${FLY_APP_NAME}-db` |
| Frontend API errors | Verify `NEXT_PUBLIC_API_URL` env var on Vercel dashboard |
| Build fails (frontend) | `npm run build` locally; common: missing `"use client"` directive |
| Build fails (backend) | Check Dockerfile pip install; `bcrypt>=4.0,<5.0` required |
| Vercel scope error | Pass `--scope $VERCEL_SCOPE` or run `vercel link --yes --scope $VERCEL_SCOPE` first |
| asyncpg multi-statement | Split SQL into one statement per `execute()` call |

## Fly.io Key Commands

```bash
fly status --app $FLY_APP_NAME                    # App status + health checks
fly logs --app $FLY_APP_NAME --no-tail            # Recent logs (non-streaming)
fly ssh console --app $FLY_APP_NAME               # SSH into the container
fly machines list --app $FLY_APP_NAME             # List machines + state
fly machine start <ID> --app $FLY_APP_NAME        # Wake a stopped machine
fly secrets list --app $FLY_APP_NAME              # List secret names
fly secrets set K=V --app $FLY_APP_NAME           # Set/update a secret (triggers redeploy)
fly postgres connect --app ${FLY_APP_NAME}-db     # Connect to Postgres via psql
```
