---
name: sfms-data-layer
description: Set up and maintain the PostgreSQL database, Alembic migrations, seed data, and multi-tenant schema for SFMS. Use when working with database schemas, migrations, SQL queries, seed data, or SQLAlchemy models for the sports facility booking system.
---

# SFMS Data Layer

## Project Context

SFMS uses PostgreSQL with multi-tenant isolation at the row level. Every table with tenant-scoped data includes a `facility_id` foreign key. Financial values use `NUMERIC`, never `FLOAT`.

## Database Schema

```sql
-- db/init.sql

CREATE TABLE IF NOT EXISTS facility (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,
    owner_name VARCHAR(255),
    owner_email VARCHAR(255),
    owner_phone VARCHAR(20),
    subscription_plan VARCHAR(50) DEFAULT 'free',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS branch (
    id SERIAL PRIMARY KEY,
    facility_id INTEGER NOT NULL REFERENCES facility(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    address TEXT,
    city VARCHAR(100),
    state VARCHAR(100),
    pincode VARCHAR(10),
    phone VARCHAR(20),
    opening_time TIME DEFAULT '06:00',
    closing_time TIME DEFAULT '23:00',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS court (
    id SERIAL PRIMARY KEY,
    branch_id INTEGER NOT NULL REFERENCES branch(id) ON DELETE CASCADE,
    facility_id INTEGER NOT NULL REFERENCES facility(id),
    name VARCHAR(100) NOT NULL,
    sport VARCHAR(50) NOT NULL,           -- 'pickleball', 'cricket', 'volleyball', 'badminton'
    surface_type VARCHAR(50),             -- 'synthetic', 'clay', 'grass', 'concrete'
    hourly_rate NUMERIC(10, 2) NOT NULL,
    peak_hour_rate NUMERIC(10, 2),
    slot_duration_minutes INTEGER DEFAULT 60,
    is_indoor BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    facility_id INTEGER REFERENCES facility(id),
    email VARCHAR(255) UNIQUE NOT NULL,
    hashed_password VARCHAR(255) NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    phone VARCHAR(20),
    role VARCHAR(50) NOT NULL DEFAULT 'player',  -- 'owner', 'manager', 'staff', 'accountant', 'player'
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS booking (
    id SERIAL PRIMARY KEY,
    facility_id INTEGER NOT NULL REFERENCES facility(id),
    court_id INTEGER NOT NULL REFERENCES court(id),
    player_id INTEGER REFERENCES users(id),
    date DATE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    status VARCHAR(20) DEFAULT 'confirmed',      -- 'confirmed', 'cancelled', 'completed', 'no_show'
    booking_type VARCHAR(20) DEFAULT 'online',   -- 'online', 'walkin', 'blocked'
    player_name VARCHAR(255),                    -- for walk-ins without account
    player_phone VARCHAR(20),
    amount NUMERIC(10, 2) NOT NULL DEFAULT 0,
    notes TEXT,
    created_by INTEGER REFERENCES users(id),
    cancelled_by INTEGER REFERENCES users(id),
    cancelled_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS payment (
    id SERIAL PRIMARY KEY,
    facility_id INTEGER NOT NULL REFERENCES facility(id),
    booking_id INTEGER NOT NULL REFERENCES booking(id),
    amount NUMERIC(10, 2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'INR',
    status VARCHAR(20) DEFAULT 'pending',         -- 'pending', 'captured', 'failed', 'refunded'
    method VARCHAR(20),                           -- 'razorpay', 'cash', 'upi'
    razorpay_order_id VARCHAR(100),
    razorpay_payment_id VARCHAR(100),
    razorpay_signature VARCHAR(255),
    paid_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS pricing_rule (
    id SERIAL PRIMARY KEY,
    court_id INTEGER NOT NULL REFERENCES court(id),
    facility_id INTEGER NOT NULL REFERENCES facility(id),
    day_of_week INTEGER,                          -- 0=Mon, 6=Sun; NULL=all days
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    rate NUMERIC(10, 2) NOT NULL,
    label VARCHAR(50),                            -- 'peak', 'off-peak', 'weekend'
    is_active BOOLEAN DEFAULT TRUE
);

-- Indexes
CREATE INDEX idx_booking_facility_date ON booking(facility_id, date);
CREATE INDEX idx_booking_court_date ON booking(court_id, date);
CREATE INDEX idx_booking_player ON booking(player_id);
CREATE INDEX idx_court_branch ON court(branch_id);
CREATE INDEX idx_court_facility ON court(facility_id);
CREATE INDEX idx_payment_booking ON payment(booking_id);
CREATE INDEX idx_users_facility ON users(facility_id);
CREATE INDEX idx_pricing_court ON pricing_rule(court_id);

-- Unique constraint to prevent double-booking
ALTER TABLE booking ADD CONSTRAINT uq_no_overlap
    EXCLUDE USING gist (
        court_id WITH =,
        date WITH =,
        tsrange(
            (date + start_time)::timestamp,
            (date + end_time)::timestamp
        ) WITH &&
    ) WHERE (status != 'cancelled');
```

## Seed Data

```sql
-- db/seed.sql

INSERT INTO facility (name, slug, owner_name, owner_email) VALUES
('TurfStack Arena', 'turfstack-arena', 'Girish Hiremath', 'girish@turfstack.in');

INSERT INTO branch (facility_id, name, address, city, state, pincode) VALUES
(1, 'Gachibowli', 'Plot 42, Nanakramguda Road', 'Hyderabad', 'Telangana', '500032'),
(1, 'Madhapur', 'Cyber Towers Lane, Madhapur', 'Hyderabad', 'Telangana', '500081');

INSERT INTO court (branch_id, facility_id, name, sport, hourly_rate, peak_hour_rate, slot_duration_minutes) VALUES
(1, 1, 'Court A', 'pickleball', 800.00, 1200.00, 60),
(1, 1, 'Court B', 'pickleball', 800.00, 1200.00, 60),
(1, 1, 'Court C', 'cricket',    1500.00, 2000.00, 60),
(2, 1, 'Court 1', 'pickleball', 700.00, 1000.00, 60),
(2, 1, 'Court 2', 'volleyball', 600.00, 900.00, 60);

INSERT INTO users (facility_id, email, hashed_password, full_name, phone, role) VALUES
(1, 'owner@turfstack.in', '$2b$12$PLACEHOLDER_HASH', 'Girish Hiremath', '9876543210', 'owner'),
(1, 'manager@turfstack.in', '$2b$12$PLACEHOLDER_HASH', 'Ravi Kumar', '9876543211', 'manager'),
(1, 'staff@turfstack.in', '$2b$12$PLACEHOLDER_HASH', 'Priya Sharma', '9876543212', 'staff'),
(NULL, 'arjun@turfstack.in', '$2b$12$PLACEHOLDER_HASH', 'Arjun Reddy', '9876543213', 'player');

INSERT INTO pricing_rule (court_id, facility_id, day_of_week, start_time, end_time, rate, label) VALUES
(1, 1, NULL, '06:00', '09:00', 600.00, 'early-bird'),
(1, 1, NULL, '09:00', '17:00', 800.00, 'regular'),
(1, 1, NULL, '17:00', '21:00', 1200.00, 'peak'),
(1, 1, NULL, '21:00', '23:00', 800.00, 'regular'),
(1, 1, 6, '06:00', '23:00', 1000.00, 'weekend');
```

## SQLAlchemy Async Models

```python
# src/sfms/models/database.py
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sfms.config import get_settings

def get_engine():
    settings = get_settings()
    return create_async_engine(settings.database_url, echo=settings.debug)

def get_session_factory():
    return async_sessionmaker(get_engine(), class_=AsyncSession, expire_on_commit=False)
```

## Docker Compose (Database)

```yaml
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
      - ./db/init.sql:/docker-entrypoint-initdb.d/01-init.sql
      - ./db/seed.sql:/docker-entrypoint-initdb.d/02-seed.sql
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 10s
      timeout: 5s
      retries: 5

volumes:
  postgres_data:
```

## Key Rules

1. **Always use `NUMERIC`** for financial values -- never `FLOAT`
2. **Every tenant-scoped table has `facility_id`**
3. **Use exclusion constraint** to prevent double-booking at DB level
4. **Always add indexes** on columns used in WHERE/JOIN
5. **Always include `created_at`** timestamps
6. **Always use parameterized queries** -- never string interpolation
7. **Seed data must be realistic** -- Indian pricing in INR
8. **Use `docker-entrypoint-initdb.d/`** for schema + seed on first run
