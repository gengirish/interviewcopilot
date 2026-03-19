---
name: sfms-project-structure
description: Set up and maintain the SFMS monorepo structure following the Python Project Blueprint pattern. Use when scaffolding the project, creating new modules, configuring pyproject.toml, setting up structured logging, or organizing the codebase.
---

# SFMS Project Structure

## Project Context

Sports Facility Management System (SFMS) is a multi-tenant booking platform for sports facilities (pickleball, cricket, volleyball). Built as a monorepo with a Python backend (FastAPI) and Next.js frontend, following the [Python Project Blueprint](https://github.com/Pymetheus/python-project-blueprint) conventions.

## Monorepo Layout

```
sfms/
├── .config/                    # Environment & structural config
│   ├── .env.example            # Secret placeholders
│   ├── config.dev.toml         # Dev settings (committed)
│   └── config.prod.toml        # Prod settings (committed)
├── .github/
│   ├── ISSUE_TEMPLATE/
│   ├── workflows/
│   │   ├── pr-checks.yml
│   │   ├── ci.yml
│   │   ├── cd.yml
│   │   └── security.yml
│   ├── CODEOWNERS
│   ├── dependabot.yml
│   ├── labels.yml
│   └── PULL_REQUEST_TEMPLATE.md
├── backend/
│   ├── src/sfms/               # Python package (src-layout)
│   │   ├── __init__.py
│   │   ├── main.py             # FastAPI app factory
│   │   ├── config.py           # Pydantic Settings
│   │   ├── dependencies.py     # DI: DB, current_user, tenant
│   │   ├── routers/
│   │   │   ├── health.py
│   │   │   ├── auth.py
│   │   │   ├── facilities.py
│   │   │   ├── courts.py
│   │   │   ├── bookings.py
│   │   │   ├── payments.py
│   │   │   └── dashboard.py
│   │   ├── services/
│   │   │   ├── booking_engine.py
│   │   │   ├── payment_service.py
│   │   │   ├── slot_generator.py
│   │   │   └── notification.py
│   │   ├── models/
│   │   │   ├── database.py     # SQLAlchemy async models
│   │   │   └── schemas.py      # Pydantic request/response
│   │   ├── middleware/
│   │   │   ├── tenant.py       # Multi-tenant context
│   │   │   ├── auth.py
│   │   │   └── logging.py
│   │   └── utils/
│   │       ├── config.py       # Layered config loader
│   │       └── logger.py       # structlog setup
│   ├── alembic/
│   ├── tests/
│   ├── pyproject.toml          # Central config hub
│   └── Dockerfile
├── frontend/
│   ├── app/                    # Next.js 15 App Router
│   ├── components/
│   ├── lib/
│   ├── public/
│   ├── next.config.ts
│   ├── tailwind.config.ts
│   ├── package.json
│   └── Dockerfile
├── db/
│   ├── init.sql                # Schema DDL
│   └── seed.sql                # Realistic seed data
├── docker/
│   └── docker-compose.yml
├── docs/
├── .gitignore
├── .pre-commit-config.yaml
└── codecov.yml
```

## pyproject.toml (Backend)

```toml
[project]
name = "sfms"
version = "0.1.0"
description = "Sports Facility Management System"
requires-python = ">=3.12"
license = {file = "LICENSE.md"}

dependencies = [
    "fastapi>=0.115",
    "uvicorn[standard]>=0.30",
    "pydantic>=2.9",
    "pydantic-settings>=2.5",
    "httpx>=0.27",
    "asyncpg>=0.30",
    "sqlalchemy[asyncio]>=2.0",
    "alembic>=1.13",
    "python-jose[cryptography]>=3.3",
    "passlib[bcrypt]>=1.7",
    "python-multipart>=0.0.9",
    "structlog>=24.1",
    "razorpay>=1.4",
]

[dependency-groups]
test = ["pytest>=8.0", "pytest-cov>=5.0", "pytest-asyncio>=0.24", "httpx"]
quality = ["ruff>=0.8", "mypy>=1.13", "bandit[toml]>=1.7"]
dev = [{include-group = "test"}, {include-group = "quality"}]

[build-system]
requires = ["setuptools>=68.0"]
build-backend = "setuptools.build_meta"

[tool.setuptools.packages.find]
where = ["src"]

[tool.pytest.ini_options]
pythonpath = ["src"]
testpaths = ["tests"]
addopts = ["--cov=src", "--cov-report=term-missing", "--verbose"]

[tool.ruff]
line-length = 120
target-version = "py312"

[tool.ruff.lint]
select = ["E", "W", "F", "I", "N", "UP", "B", "C4", "SIM"]

[tool.mypy]
python_version = "3.12"
mypy_path = "src"
strict = true
ignore_missing_imports = true

[tool.bandit]
exclude_dirs = ["tests"]
```

## Configuration Management

Follow the layered config pattern from Python Project Blueprint:

1. **Pydantic Defaults** (failsafe values in code)
2. **config.{APP_ENV}.toml** (structural: ports, hosts, feature flags -- committed)
3. **.env.{APP_ENV}** (secrets: API keys, DB passwords -- gitignored)
4. **System env vars** (highest priority, for Docker/K8s)

```python
# src/sfms/config.py
from pydantic_settings import BaseSettings
from functools import lru_cache

class Settings(BaseSettings):
    app_env: str = "dev"
    debug: bool = False
    database_url: str
    jwt_secret: str
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 60
    razorpay_key_id: str = ""
    razorpay_key_secret: str = ""
    cors_origins: list[str] = ["http://localhost:3000"]
    sms_api_key: str = ""

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}

@lru_cache
def get_settings() -> Settings:
    return Settings()
```

## Structured Logging

Use `structlog` with environment-aware rendering:

```python
# src/sfms/utils/logger.py
import structlog

def setup_logging(app_env: str = "dev") -> None:
    processors = [
        structlog.contextvars.merge_contextvars,
        structlog.processors.add_log_level,
        structlog.processors.TimeStamper(fmt="iso"),
    ]
    if app_env == "prod":
        processors.append(structlog.processors.JSONRenderer())
    else:
        processors.append(structlog.dev.ConsoleRenderer())

    structlog.configure(processors=processors)
```

## Naming Conventions

| Used for | Style | Example |
|---|---|---|
| GitHub repo, Docker image | kebab-case | `sfms`, `sfms-api` |
| Python package, files | snake_case | `sfms`, `booking_engine.py` |
| Next.js components | PascalCase | `CourtGrid.tsx` |
| API routes | kebab-case | `/api/v1/bookings` |
| DB tables | snake_case | `booking`, `court` |

## Key Rules

1. **Always use `src/` layout** for the Python package
2. **`pyproject.toml` is the single source of truth** for backend config
3. **Never mix secrets with structural config** -- TOML for structure, .env for secrets
4. **Always use structlog** -- never `print()`
5. **APP_ENV controls everything** -- `dev`, `staging`, `prod`
6. **Frontend and backend are independently deployable**
