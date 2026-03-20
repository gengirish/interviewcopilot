# Project Structure Alignment

This repository now follows the same top-level structure style as `D:\codebase\SFMS`:

```text
infinityhire-copilot/
├── .config/
├── .cursor/
├── .github/
├── backend/
├── db/
├── docker/
├── docs/
├── frontend/
├── src/                # Current active Next.js app (temporary until migration)
└── tests/
```

## Current State

- Active runtime remains the Next.js app in root (`src/` + `package.json`).
- `backend/` is scaffolded for future FastAPI split.
- `db/` holds baseline schema and seed scripts.
- `docker/` includes local Postgres startup.

## Migration Steps

1. Move frontend runtime from root into `frontend/`.
2. Promote `db/init.sql` to migration source-of-truth.
3. Implement `/api/v1/*` in `backend/src/infinityhire`.
4. Route `frontend` API calls to backend service.
