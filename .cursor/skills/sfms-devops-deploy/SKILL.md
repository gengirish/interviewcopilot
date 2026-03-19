---
name: sfms-devops-deploy
description: Configure Docker, Docker Compose, CI/CD pipelines, and production deployments for SFMS. Use when working with Dockerfiles, docker-compose, GitHub Actions, Vercel, Render/Fly.io, or deployment configuration for the sports facility management system.
---

# SFMS DevOps & Deployment

## Project Context

SFMS deploys as:
- **Local dev**: Docker Compose (Postgres + Backend + Frontend)
- **Production**: Vercel (frontend) + Render or Fly.io (backend) + Supabase/Neon (Postgres)
- **CI/CD**: GitHub Actions (lint, test, build, deploy)

## Docker Compose (Development)

```yaml
# docker/docker-compose.yml
services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: ${POSTGRES_DB:-sfms}
      POSTGRES_USER: ${POSTGRES_USER:-postgres}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:?Set POSTGRES_PASSWORD in .env}
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ../db/init.sql:/docker-entrypoint-initdb.d/01-init.sql
      - ../db/seed.sql:/docker-entrypoint-initdb.d/02-seed.sql
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 10s
      timeout: 5s
      retries: 5

  backend:
    build:
      context: ../backend
      target: production
    ports:
      - "8001:8001"
    env_file: ../.env
    environment:
      DATABASE_URL: postgresql+asyncpg://${POSTGRES_USER:-postgres}:${POSTGRES_PASSWORD}@postgres:5432/${POSTGRES_DB:-sfms}
    depends_on:
      postgres:
        condition: service_healthy
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8001/api/v1/health"]
      interval: 30s
      timeout: 10s
      retries: 3

  frontend:
    build:
      context: ../frontend
      target: runner
    ports:
      - "3000:3000"
    environment:
      NEXT_PUBLIC_API_URL: http://localhost:8001
    depends_on:
      - backend

volumes:
  postgres_data:
```

## Backend Dockerfile

```dockerfile
# backend/Dockerfile
FROM python:3.12-slim AS base
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends curl && rm -rf /var/lib/apt/lists/*
COPY pyproject.toml .
COPY src/ src/
RUN pip install --no-cache-dir .

FROM base AS production
EXPOSE 8001
CMD ["uvicorn", "sfms.main:app", "--host", "0.0.0.0", "--port", "8001", "--workers", "2"]
```

## Frontend Dockerfile

```dockerfile
# frontend/Dockerfile
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci --prefer-offline

FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
EXPOSE 3000
CMD ["node", "server.js"]
```

Requires `output: "standalone"` in `next.config.ts`.

## Environment Variables Template

```bash
# .config/.env.example

# Database
POSTGRES_DB=sfms
POSTGRES_USER=postgres
POSTGRES_PASSWORD=          # REQUIRED

# Backend
DATABASE_URL=postgresql+asyncpg://postgres:PASSWORD@localhost:5432/sfms
JWT_SECRET=                 # REQUIRED: openssl rand -hex 32
RAZORPAY_KEY_ID=            # REQUIRED: rzp_test_xxx
RAZORPAY_KEY_SECRET=        # REQUIRED
CORS_ORIGINS=["http://localhost:3000"]
SMS_API_KEY=                # Optional
APP_ENV=dev
DEBUG=true

# Frontend
NEXT_PUBLIC_API_URL=http://localhost:8001
NEXT_PUBLIC_RAZORPAY_KEY_ID=  # Same as RAZORPAY_KEY_ID (public)
```

## GitHub Actions CI

```yaml
# .github/workflows/ci.yml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  backend:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16-alpine
        env:
          POSTGRES_DB: sfms_test
          POSTGRES_USER: postgres
          POSTGRES_PASSWORD: testpassword
        ports: ["5432:5432"]
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: "3.12"
      - run: pip install -e ".[dev]"
        working-directory: backend
      - run: ruff check src/
        working-directory: backend
      - run: mypy src/sfms/
        working-directory: backend
      - run: pytest tests/ -v
        working-directory: backend
        env:
          DATABASE_URL: postgresql+asyncpg://postgres:testpassword@localhost:5432/sfms_test
          JWT_SECRET: test-secret-key
          RAZORPAY_KEY_ID: rzp_test_fake
          RAZORPAY_KEY_SECRET: fake_secret

  frontend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: "20"
      - run: npm ci
        working-directory: frontend
      - run: npm run lint
        working-directory: frontend
      - run: npm run build
        working-directory: frontend
        env:
          NEXT_PUBLIC_API_URL: http://localhost:8001
```

## PR Checks (from Python Blueprint)

```yaml
# .github/workflows/pr-checks.yml
name: PR Checks

on:
  pull_request:
    branches: [main]

jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with: { python-version: "3.12" }
      - run: pip install ruff
      - run: ruff check backend/src/
      - run: ruff format --check backend/src/

  typecheck:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with: { python-version: "3.12" }
      - run: pip install -e ".[dev]"
        working-directory: backend
      - run: mypy src/sfms/
        working-directory: backend

  security:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with: { python-version: "3.12" }
      - run: pip install bandit
      - run: bandit -r backend/src/ -c backend/pyproject.toml
```

## Production Targets

### Frontend -> Vercel
```bash
cd frontend && npx vercel --yes --prod
```
Set `NEXT_PUBLIC_API_URL` and `NEXT_PUBLIC_RAZORPAY_KEY_ID` in Vercel dashboard.

### Backend -> Render
```yaml
# render.yaml
services:
  - type: web
    name: sfms-api
    runtime: docker
    dockerfilePath: backend/Dockerfile
    envVars:
      - key: DATABASE_URL
        fromDatabase:
          name: sfms-db
          property: connectionString
      - key: JWT_SECRET
        generateValue: true
      - key: RAZORPAY_KEY_ID
        sync: false
      - key: RAZORPAY_KEY_SECRET
        sync: false
databases:
  - name: sfms-db
    plan: starter
```

### Database -> Supabase / Neon
Use Supabase (free tier) or Neon (serverless) for production Postgres.

## .gitignore

```gitignore
__pycache__/
*.pyc
.venv/
node_modules/
.next/
.env
.env.local
.env.production
postgres_data/
.log/
*.egg-info/
```

## Key Rules

1. **Never use `version:` in Docker Compose** -- deprecated
2. **Always use health checks** for dependent services
3. **Always use multi-stage builds**
4. **Never commit `.env`** -- only `.env.example`
5. **Pin major versions** of base images
6. **CI must test against real Postgres** -- not SQLite
7. **Frontend `output: "standalone"`** for Docker deployment
8. **`NEXT_PUBLIC_` vars are build-time** -- redeploy after changes
