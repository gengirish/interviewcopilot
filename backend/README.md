# Backend (SFMS-style alignment)

This folder is added to align project structure with `D:\codebase\SFMS`.

Current production APIs are still implemented in Next.js route handlers under:

- `src/app/api/**/route.ts`

Planned migration path:

1. Move auth/billing/analytics APIs to FastAPI in `backend/src/infinityhire`.
2. Keep frontend in Next.js (`frontend/` target layout).
3. Version APIs under `/api/v1/`.
4. Run Postgres migrations from `db/`.

This staged approach keeps today’s deployment stable while enabling gradual service split.
