# Release runbook (Phase 1)

Concise checklist for promoting InfinityHire Copilot to production via GitHub Actions → Vercel.

## Preconditions and secrets

**Branch:** merge to `main` only after gates pass (see below).

**GitHub Actions secrets** (repository → Settings → Secrets and variables):

| Secret | Used by |
|--------|---------|
| `AUTH_SECRET` | CI (e2e), runtime auth |
| `DATABASE_URL` | CI (e2e), production DB |
| `DATABASE_CA_CERT` | Optional CA bundle for strict DB TLS verification in production |
| `OPENROUTER_API_KEY` | CI (optional in app; static fallback exists) |
| `GOOGLE_AI_KEY` | CI (optional) |
| `VERCEL_TOKEN` | Deploy workflow |
| `VERCEL_ORG_ID` | Deploy workflow |
| `VERCEL_PROJECT_ID` | Deploy workflow |

**Local parity:** `.env.local` for dev is documented in the root `README.md`. Never commit `.env` files.

**DB TLS hardening:** Production DB connections now verify certificates by default. Use `DATABASE_CA_CERT` for private CA providers. `DATABASE_SSL_ALLOW_INSECURE=true` is emergency-only and must be disabled after incident recovery.

## Required checks

Run locally before you merge or tag a release (commands exist in root `package.json`):

```bash
npx tsc --noEmit
npm run lint
npm run build
npm run test:e2e
```

**CI (`.github/workflows/ci.yml`):** on PR and push to `main`, runs `npx tsc --noEmit`, `npm run lint`, `npm run build`, then `npm run test:e2e` (with Playwright Chromium).

**Release gates alignment:** auth (protected routes, signup/login/logout), billing/quota, session (question path, errors), and analytics integrity should be verified per the internal release-gates checklist; E2E and manual QA supplement that (`docs/test-accounts-and-qa.md`).

## Deploy (GitHub Actions)

Workflow: `.github/workflows/deploy-vercel.yml` — **Deploy Vercel**.

**Triggers:**

- Automatic after **successful `CI` workflow completion** for `main` branch commits (`workflow_run`).
- Manual via **Actions** → **Deploy Vercel** → **Run workflow** (`workflow_dispatch`).

**What it does:** `checkout` (CI commit SHA) → Node 20 → `npm ci` → `vercel pull` (production env) → `vercel build --prod` → `vercel deploy --prebuilt --prod` → smoke check `GET /api/health`.

Monitor the run in the GitHub Actions tab; confirm the job finishes green and note the production URL from the Vercel step output or the Vercel dashboard.

## Post-deploy smoke checks

Replace `https://YOUR_PRODUCTION_HOST` with your real production URL.

1. **Health**

   ```bash
   curl -sS https://YOUR_PRODUCTION_HOST/api/health
   ```

   Expect JSON including `"status":"healthy"` and `"service":"infinityhire-copilot"`.

2. **App shell:** open `/` in a browser—page loads without 5xx.

3. **Auth/billing/session (spot-check):** sign-in, a protected route, and one critical user path (see release gates).

## Rollback

**Application (Vercel):** In the Vercel project → **Deployments** → select the last known-good deployment → **Promote to Production** (or use Instant Rollback if enabled). This restores the previous build without a new Git revert.

**Database:** Rolling back the app does **not** undo schema or data migrations. If a release included DB changes, coordinate rollback separately (restore backup, forward-fix migration, or avoid deploying incompatible app + schema). Document what changed before deploy.

## Risk sign-off template

Copy and fill before production deploy. Aligns with InfinityHire release gates (types/lint/tests, auth, billing/quota, session reliability, analytics).

```text
Release: _______________   Commit/SHA: _______________   Deployed by: _______________

Risk level: [ ] low   [ ] medium   [ ] high

Blockers: _______________   (or: none)

Pre-deploy verification:
[ ] npx tsc --noEmit
[ ] npm run lint
[ ] npm run build
[ ] npm run test:e2e
[ ] Auth: unauthenticated cannot access protected routes; signup/login/logout OK
[ ] Billing: free quota enforced; upgrade behavior OK
[ ] Session: question submission works; errors visible/actionable
[ ] Analytics/usage aligns with answer generation (if instrumented)

Rollback path: Vercel promote previous deployment; DB: _______________

Sign-off: _______________   Date: _______________
```
