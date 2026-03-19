---
name: sfms-fastapi-backend
description: Build and maintain the SFMS FastAPI backend with production best practices. Use when creating API endpoints, services, middleware, or backend configuration for the sports facility booking system.
---

# SFMS FastAPI Backend

## Project Context

SFMS backend serves a multi-tenant sports facility booking platform. Core capabilities:
- Facility/branch/court configuration endpoints
- Booking creation with slot availability checks
- Razorpay payment integration
- Manager/staff/owner dashboards
- Multi-tenant data isolation

## Application Factory

Always use the factory pattern. Never create `app = FastAPI()` at module level.

```python
# src/sfms/main.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sfms.config import get_settings
from sfms.routers import health, auth, facilities, courts, bookings, payments, dashboard
from sfms.middleware.tenant import TenantMiddleware

def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(
        title="SFMS API",
        version="1.0.0",
        docs_url="/api/docs" if settings.debug else None,
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "DELETE", "PATCH"],
        allow_headers=["Authorization", "Content-Type", "X-Tenant-ID"],
    )
    app.add_middleware(TenantMiddleware)

    for router in [health, auth, facilities, courts, bookings, payments, dashboard]:
        app.include_router(router.router, prefix="/api/v1")

    return app

app = create_app()
```

## Router Pattern

Every router follows this structure. Domain logic lives in services, not routers.

```python
# src/sfms/routers/bookings.py
from fastapi import APIRouter, Depends, HTTPException, status
from sfms.dependencies import get_current_user, get_db, get_tenant_id
from sfms.models.schemas import BookingCreateRequest, BookingResponse
from sfms.services.booking_engine import BookingEngine

router = APIRouter(prefix="/bookings", tags=["Bookings"])

@router.post("", response_model=BookingResponse, status_code=status.HTTP_201_CREATED)
async def create_booking(
    request: BookingCreateRequest,
    user=Depends(get_current_user),
    db=Depends(get_db),
    tenant_id: int = Depends(get_tenant_id),
):
    engine = BookingEngine(db)
    booking = await engine.create(
        tenant_id=tenant_id,
        court_id=request.court_id,
        date=request.date,
        start_time=request.start_time,
        end_time=request.end_time,
        player_id=user["sub"],
        booking_type=request.booking_type,
    )
    return booking

@router.get("", response_model=list[BookingResponse])
async def list_bookings(
    date: str | None = None,
    court_id: int | None = None,
    user=Depends(get_current_user),
    db=Depends(get_db),
    tenant_id: int = Depends(get_tenant_id),
):
    engine = BookingEngine(db)
    return await engine.list_bookings(tenant_id, date=date, court_id=court_id)
```

## Dependencies (DI)

```python
# src/sfms/dependencies.py
from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import jwt
from sfms.config import get_settings
from sfms.models.database import get_session_factory

security = HTTPBearer()

async def get_db():
    factory = get_session_factory()
    async with factory() as session:
        yield session

async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
):
    settings = get_settings()
    try:
        payload = jwt.decode(
            credentials.credentials,
            settings.jwt_secret,
            algorithms=[settings.jwt_algorithm],
        )
        return payload
    except jwt.JWTError:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid token")

async def get_tenant_id(request: Request) -> int:
    tenant_id = request.state.tenant_id
    if not tenant_id:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Tenant context required")
    return tenant_id
```

## Pydantic Schemas

Strict validation on all inputs and outputs.

```python
# src/sfms/models/schemas.py
from pydantic import BaseModel, Field
from datetime import date, time
from enum import Enum

class BookingType(str, Enum):
    ONLINE = "online"
    WALKIN = "walkin"
    BLOCKED = "blocked"

class BookingCreateRequest(BaseModel):
    court_id: int
    date: date
    start_time: time
    end_time: time
    booking_type: BookingType = BookingType.ONLINE
    notes: str | None = Field(None, max_length=500)

class BookingResponse(BaseModel):
    id: int
    court_id: int
    court_name: str
    date: date
    start_time: time
    end_time: time
    status: str
    player_name: str | None
    amount: float
    booking_type: BookingType
    payment_status: str

class CourtResponse(BaseModel):
    id: int
    name: str
    sport: str
    branch_name: str
    hourly_rate: float
    is_active: bool

class SlotResponse(BaseModel):
    start_time: time
    end_time: time
    is_available: bool
    court_id: int
    price: float

class DashboardKPI(BaseModel):
    label: str
    value: str
    change_pct: float
    period: str
```

## Service Layer

All domain logic lives in service classes. Routers are thin wrappers.

```python
# src/sfms/services/booking_engine.py (interface only -- see sfms-booking-engine skill)
class BookingEngine:
    def __init__(self, db): ...
    async def check_availability(self, court_id, date, start, end) -> bool: ...
    async def create(self, tenant_id, court_id, date, start_time, end_time, player_id, booking_type) -> dict: ...
    async def cancel(self, booking_id, cancelled_by) -> dict: ...
    async def list_bookings(self, tenant_id, date=None, court_id=None) -> list: ...
```

## Health Checks

```python
# src/sfms/routers/health.py
from fastapi import APIRouter, Depends
from sfms.dependencies import get_db

router = APIRouter(prefix="/health", tags=["Health"])

@router.get("")
async def health():
    return {"status": "healthy", "service": "sfms-api"}

@router.get("/db")
async def health_db(db=Depends(get_db)):
    await db.execute("SELECT 1")
    return {"status": "healthy", "database": "connected"}
```

## Requirements

```
fastapi>=0.115
uvicorn[standard]>=0.30
pydantic>=2.9
pydantic-settings>=2.5
httpx>=0.27
asyncpg>=0.30
sqlalchemy[asyncio]>=2.0
alembic>=1.13
python-jose[cryptography]>=3.3
passlib[bcrypt]>=1.7
python-multipart>=0.0.9
structlog>=24.1
razorpay>=1.4
slowapi>=0.1.9
pytest>=8.0
pytest-asyncio>=0.24
```

## Testing

```python
# tests/conftest.py
import pytest
from httpx import AsyncClient, ASGITransport
from sfms.main import create_app

@pytest.fixture
def app():
    return create_app()

@pytest.fixture
async def client(app):
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        yield c
```

## Key Rules

1. **Never hardcode secrets** -- all secrets via `Settings`
2. **Always version API routes** -- prefix with `/api/v1/`
3. **Always validate inputs** -- use Pydantic `Field` constraints
4. **Always use async** -- `asyncpg`, `httpx.AsyncClient`
5. **Domain logic in services** -- routers are thin wrappers
6. **Multi-tenant isolation** -- every query filters by `tenant_id`
7. **Log with structlog** -- never `print()`
