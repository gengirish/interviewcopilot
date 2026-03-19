---
name: turfstack-backend
description: Guide for working with the TurfStack FastAPI backend. Use when modifying backend routers, services, database queries, Pydantic schemas, auth endpoints, or adding new API features. Covers project structure, multi-tenant architecture, and coding conventions.
---

# TurfStack Backend

## Project Structure

```
backend/
├── fly.toml                    # Fly.io deployment config
├── Dockerfile                  # Python 3.12-slim based
├── pyproject.toml              # Dependencies (pip installable)
└── src/sfms/
    ├── main.py                 # FastAPI app factory, CORS, exception handler
    ├── config.py               # pydantic-settings, env vars, async_database_url
    ├── dependencies.py         # get_db, get_current_user, get_tenant_id, require_roles
    ├── middleware/
    │   └── tenant.py           # TenantMiddleware: JWT -> request.state.tenant_id
    ├── models/
    │   ├── database.py         # AsyncSession, create_async_engine (asyncpg)
    │   └── schemas.py          # All Pydantic v2 request/response models
    ├── routers/
    │   ├── auth.py             # /login, /register, /refresh, /me
    │   ├── facilities.py       # CRUD facilities + branches
    │   ├── courts.py           # CRUD courts + pricing rules
    │   ├── bookings.py         # Slots, create, list, cancel, schedule
    │   ├── payments.py         # Razorpay order/verify, cash, UPI, refund, webhook
    │   ├── dashboard.py        # KPIs, revenue-trend, utilization, CSV export
    │   └── health.py           # /health, /health/db
    └── services/
        ├── booking_engine.py   # Core booking logic, slot generation, schedule, KPIs
        ├── payment_service.py  # Razorpay client, cash/UPI recording, refunds
        ├── slot_generator.py   # Time slot generation with pricing rules
        └── exceptions.py       # BookingNotFoundError, SlotUnavailableError
```

## Key Conventions

### Adding a New Router

1. Create `routers/new_feature.py` with `router = APIRouter(prefix="/feature", tags=["Feature"])`
2. Register in `main.py`: `app.include_router(new_router.router, prefix="/api/v1")`
3. Add Pydantic schemas to `models/schemas.py`
4. Use raw SQL via `sqlalchemy.text()` -- no ORM models, just raw queries with `RETURNING *`

### Auth & Multi-Tenancy

```python
from sfms.dependencies import get_current_user, get_db, get_tenant_id, require_roles

# Any authenticated user
user: dict = Depends(get_current_user)
# user dict: {"sub": "1", "email": "...", "role": "owner", "facility_id": 1}

# Restrict to specific roles
user: dict = Depends(require_roles("owner", "manager"))

# Get tenant facility_id from JWT (set by TenantMiddleware)
tenant_id: int | None = Depends(get_tenant_id)
```

All data queries MUST filter by `facility_id = :fid` when `tenant_id` is available.

### Database Queries

Use raw SQL with `sqlalchemy.text()`:

```python
result = await db.execute(
    text("SELECT * FROM court WHERE facility_id = :fid AND is_active = true"),
    {"fid": tenant_id},
)
rows = result.mappings().all()
return [CourtResponse(**r) for r in rows]
```

For inserts, always use `RETURNING *`:

```python
result = await db.execute(
    text("INSERT INTO table (...) VALUES (...) RETURNING *"),
    params,
)
await db.commit()
row = result.mappings().first()
```

### Schema Patterns

```python
class FeatureCreate(BaseModel):
    name: str = Field(..., min_length=2, max_length=255)
    optional_field: str | None = None

class FeatureResponse(BaseModel):
    id: int
    name: str
    optional_field: str | None
    is_active: bool
```

## Database Tables

| Table | Key Columns | Notes |
|-------|------------|-------|
| `facility` | id, name, slug, subscription_plan | Tenant root |
| `branch` | id, facility_id, name, opening_time, closing_time | Facility locations |
| `court` | id, branch_id, facility_id, sport, hourly_rate, peak_hour_rate | Courts with pricing |
| `users` | id, facility_id, email, hashed_password, role | Roles: owner/manager/staff/accountant/player |
| `booking` | id, facility_id, court_id, player_id, date, start_time, end_time, status, amount | Has DB-level `uq_no_overlap` exclusion constraint |
| `payment` | id, facility_id, booking_id, amount, status, method, razorpay_* | Methods: razorpay/cash/upi |
| `pricing_rule` | id, court_id, facility_id, day_of_week, start_time, end_time, rate | Custom time-based pricing |

## Environment Variables

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string (Fly.io sets this) |
| `JWT_SECRET` | Secret key for HS256 tokens |
| `CORS_ORIGINS` | Comma-separated allowed origins |
| `RAZORPAY_KEY_ID` | Razorpay API key |
| `RAZORPAY_KEY_SECRET` | Razorpay API secret |

## Common Pitfalls

- `bcrypt` must be pinned `>=4.0,<5.0` for passlib compatibility
- Internal Fly.io Postgres uses `ssl=False` in connect_args (handled in `database.py`)
- `async_database_url` property in config.py converts `postgres://` to `postgresql+asyncpg://`
- Always `await db.commit()` after INSERT/UPDATE/DELETE
