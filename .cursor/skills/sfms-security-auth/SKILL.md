---
name: sfms-security-auth
description: Implement authentication, authorization, multi-tenant RBAC, secrets management, and security hardening for SFMS. Use when working with login, JWT tokens, CORS, role-based access, tenant isolation, input validation, or audit logging.
---

# SFMS Security & Authentication

## Project Context

SFMS is a multi-tenant platform handling bookings and payments. Security requirements:
- JWT-based authentication for all API routes (except health, public booking pages)
- Multi-tenant RBAC: owner, manager, staff, accountant, player
- Row-level tenant isolation via `facility_id`
- Secrets via environment variables only
- Razorpay webhook signature verification

## Role Permissions Matrix

| Resource | Owner | Manager | Staff | Accountant | Player |
|---|---|---|---|---|---|
| Facility settings | RW | R | - | - | - |
| Branch/Court config | RW | RW | R | - | - |
| Create booking | RW | RW | RW | - | Own only |
| Cancel booking | All | All | Own shift | - | Own only |
| View schedule | All | All | Today only | - | Own only |
| Revenue reports | RW | R | - | R | - |
| User management | RW | Branch staff | - | - | - |
| Payment exports | R | - | - | R | - |

## Authentication Flow

```
1. POST /api/v1/auth/login with email + password
2. Backend verifies bcrypt hash in `users` table
3. Backend issues JWT (HS256, 60min) with: sub, email, role, facility_id
4. Frontend stores token (memory preferred, localStorage acceptable for MVP)
5. Frontend sends Authorization: Bearer <token> on every request
6. Backend middleware validates token + extracts tenant context
7. Token refresh via POST /api/v1/auth/refresh
```

## Auth Router

```python
# src/sfms/routers/auth.py
from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, HTTPException, status, Depends
from pydantic import BaseModel, EmailStr
from passlib.context import CryptContext
from jose import jwt
from sfms.config import get_settings
from sfms.dependencies import get_db

router = APIRouter(prefix="/auth", tags=["Auth"])
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

class LoginRequest(BaseModel):
    email: EmailStr
    password: str

class RegisterRequest(BaseModel):
    email: EmailStr
    password: str
    full_name: str
    phone: str | None = None

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int
    role: str
    facility_id: int | None

@router.post("/login", response_model=TokenResponse)
async def login(req: LoginRequest, db=Depends(get_db)):
    user = await db.fetch_one(
        "SELECT id, email, hashed_password, role, facility_id, is_active FROM users WHERE email = $1",
        req.email,
    )
    if not user or not pwd_context.verify(req.password, user["hashed_password"]):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid credentials")
    if not user["is_active"]:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Account disabled")

    settings = get_settings()
    expire = datetime.now(timezone.utc) + timedelta(minutes=settings.jwt_expire_minutes)
    token = jwt.encode(
        {
            "sub": str(user["id"]),
            "email": user["email"],
            "role": user["role"],
            "facility_id": user["facility_id"],
            "exp": expire,
        },
        settings.jwt_secret,
        algorithm=settings.jwt_algorithm,
    )
    return TokenResponse(
        access_token=token,
        expires_in=settings.jwt_expire_minutes * 60,
        role=user["role"],
        facility_id=user["facility_id"],
    )
```

## Tenant Middleware

Extracts `facility_id` from JWT and injects into request state.

```python
# src/sfms/middleware/tenant.py
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from jose import jwt
from sfms.config import get_settings

PUBLIC_PATHS = {"/api/v1/health", "/api/v1/auth/login", "/api/v1/auth/register", "/api/docs", "/openapi.json"}

class TenantMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        request.state.tenant_id = None

        if request.url.path in PUBLIC_PATHS or request.method == "OPTIONS":
            return await call_next(request)

        auth = request.headers.get("Authorization", "")
        if auth.startswith("Bearer "):
            try:
                settings = get_settings()
                payload = jwt.decode(auth[7:], settings.jwt_secret, algorithms=[settings.jwt_algorithm])
                request.state.tenant_id = payload.get("facility_id")
            except Exception:
                pass

        return await call_next(request)
```

## Role-Based Access Decorator

```python
# src/sfms/dependencies.py (add to existing)
from functools import wraps

def require_role(*allowed_roles: str):
    def decorator(func):
        @wraps(func)
        async def wrapper(*args, user=Depends(get_current_user), **kwargs):
            if user["role"] not in allowed_roles:
                raise HTTPException(status.HTTP_403_FORBIDDEN, "Insufficient permissions")
            return await func(*args, user=user, **kwargs)
        return wrapper
    return decorator

# Usage in routers:
# @router.get("/revenue")
# @require_role("owner", "manager", "accountant")
# async def get_revenue(...): ...
```

## Razorpay Webhook Verification

```python
# src/sfms/services/payment_service.py (webhook part)
import hmac
import hashlib

def verify_razorpay_signature(order_id: str, payment_id: str, signature: str, secret: str) -> bool:
    message = f"{order_id}|{payment_id}"
    expected = hmac.new(secret.encode(), message.encode(), hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, signature)
```

## Secrets Checklist

- [ ] No API keys in source code
- [ ] `.env` is in `.gitignore`
- [ ] `.env.example` exists with placeholders
- [ ] JWT secret is `openssl rand -hex 32`
- [ ] Razorpay keys never logged or returned in API responses
- [ ] Database password is not default

## Key Rules

1. **Never hardcode secrets** -- environment variables only
2. **Never use `allow_origins=["*"]`** in production
3. **Always hash passwords with bcrypt**
4. **JWT carries `facility_id`** -- tenant context travels with every request
5. **Every query must filter by `facility_id`** for tenant isolation
6. **Rate limit** auth endpoints (5/minute) and payment endpoints
7. **Health checks are the only fully public routes**
8. **Booking pages are semi-public** -- read-only without auth, write requires auth
