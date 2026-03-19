---
name: sfms-booking-engine
description: Implement the core booking engine for SFMS including slot generation, availability checking, concurrency control, and pricing. Use when working with booking logic, slot availability, double-booking prevention, pricing rules, or court scheduling.
---

# SFMS Booking Engine

## Project Context

The booking engine is the heart of SFMS. It handles slot generation from court operating hours, real-time availability checking, price calculation with dynamic pricing rules, and concurrency-safe booking creation. Double-bookings are prevented at both application and database levels.

## Slot Generation

Generate available slots for a court on a given date based on operating hours and slot duration.

```python
# src/sfms/services/slot_generator.py
from datetime import date, time, datetime, timedelta

class SlotGenerator:
    def generate_slots(
        self,
        court_id: int,
        target_date: date,
        opening: time,
        closing: time,
        duration_minutes: int,
        pricing_rules: list[dict],
    ) -> list[dict]:
        slots = []
        current = datetime.combine(target_date, opening)
        end = datetime.combine(target_date, closing)

        while current + timedelta(minutes=duration_minutes) <= end:
            slot_end = current + timedelta(minutes=duration_minutes)
            price = self._calculate_price(
                current.time(), slot_end.time(), target_date.weekday(), pricing_rules
            )
            slots.append({
                "court_id": court_id,
                "start_time": current.time().isoformat(),
                "end_time": slot_end.time().isoformat(),
                "price": float(price),
                "is_available": True,
            })
            current = slot_end

        return slots

    def _calculate_price(
        self, start: time, end: time, day_of_week: int, rules: list[dict]
    ) -> float:
        for rule in rules:
            if rule.get("day_of_week") is not None and rule["day_of_week"] != day_of_week:
                continue
            if rule["start_time"] <= start and end <= rule["end_time"]:
                return rule["rate"]
        return 0.0
```

## Availability Check

Mark booked slots as unavailable. Query existing bookings and overlay on generated slots.

```python
# src/sfms/services/booking_engine.py
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from sfms.services.slot_generator import SlotGenerator

class BookingEngine:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.slot_gen = SlotGenerator()

    async def get_available_slots(self, court_id: int, target_date: str) -> list[dict]:
        court = await self._get_court(court_id)
        branch = await self._get_branch(court["branch_id"])
        rules = await self._get_pricing_rules(court_id)

        slots = self.slot_gen.generate_slots(
            court_id=court_id,
            target_date=target_date,
            opening=branch["opening_time"],
            closing=branch["closing_time"],
            duration_minutes=court["slot_duration_minutes"],
            pricing_rules=rules,
        )

        booked = await self.db.execute(text(
            """SELECT start_time, end_time FROM booking
               WHERE court_id = :court_id AND date = :date AND status != 'cancelled'"""
        ), {"court_id": court_id, "date": target_date})

        booked_ranges = [(r.start_time, r.end_time) for r in booked.fetchall()]

        for slot in slots:
            for b_start, b_end in booked_ranges:
                if self._overlaps(slot["start_time"], slot["end_time"], b_start, b_end):
                    slot["is_available"] = False
                    break

        return slots

    def _overlaps(self, s1, e1, s2, e2) -> bool:
        return s1 < e2 and s2 < e1
```

## Concurrency-Safe Booking Creation

Use `SELECT ... FOR UPDATE` to prevent race conditions. The DB exclusion constraint is the final safety net.

```python
    async def create(
        self, tenant_id, court_id, date, start_time, end_time, player_id, booking_type
    ) -> dict:
        async with self.db.begin():
            # Acquire row lock on overlapping bookings
            conflict = await self.db.execute(text(
                """SELECT id FROM booking
                   WHERE court_id = :court_id
                     AND date = :date
                     AND status != 'cancelled'
                     AND start_time < :end_time
                     AND end_time > :start_time
                   FOR UPDATE"""
            ), {
                "court_id": court_id, "date": date,
                "start_time": start_time, "end_time": end_time,
            })

            if conflict.fetchone():
                raise SlotUnavailableError("This slot is no longer available")

            price = await self._get_slot_price(court_id, date, start_time, end_time)

            result = await self.db.execute(text(
                """INSERT INTO booking
                   (facility_id, court_id, player_id, date, start_time, end_time,
                    status, booking_type, amount, created_by)
                   VALUES (:facility_id, :court_id, :player_id, :date, :start_time,
                           :end_time, 'confirmed', :booking_type, :amount, :player_id)
                   RETURNING id, status, amount"""
            ), {
                "facility_id": tenant_id, "court_id": court_id,
                "player_id": player_id, "date": date,
                "start_time": start_time, "end_time": end_time,
                "booking_type": booking_type, "amount": price,
            })

            booking = result.fetchone()
            return {"id": booking.id, "status": booking.status, "amount": float(booking.amount)}

    async def cancel(self, booking_id: int, cancelled_by: int) -> dict:
        result = await self.db.execute(text(
            """UPDATE booking
               SET status = 'cancelled', cancelled_by = :by, cancelled_at = NOW()
               WHERE id = :id AND status = 'confirmed'
               RETURNING id, status"""
        ), {"id": booking_id, "by": cancelled_by})

        row = result.fetchone()
        if not row:
            raise BookingNotFoundError("Booking not found or already cancelled")
        return {"id": row.id, "status": row.status}
```

## Custom Exceptions

```python
# src/sfms/services/exceptions.py
class SlotUnavailableError(Exception):
    pass

class BookingNotFoundError(Exception):
    pass

class PaymentRequiredError(Exception):
    pass
```

## Cancellation Policy

- Player can cancel up to 2 hours before slot start (configurable)
- Manager/Staff can cancel anytime
- Owner can cancel anytime
- Cancelled bookings with captured payments trigger refund flow

## Dashboard Aggregations

```python
    async def get_dashboard_kpis(self, facility_id: int, period: str = "today") -> list[dict]:
        today_revenue = await self.db.execute(text(
            """SELECT COALESCE(SUM(amount), 0) as total
               FROM booking WHERE facility_id = :fid AND date = CURRENT_DATE AND status != 'cancelled'"""
        ), {"fid": facility_id})

        today_bookings = await self.db.execute(text(
            """SELECT COUNT(*) as total
               FROM booking WHERE facility_id = :fid AND date = CURRENT_DATE AND status != 'cancelled'"""
        ), {"fid": facility_id})

        total_courts = await self.db.execute(text(
            "SELECT COUNT(*) FROM court WHERE facility_id = :fid AND is_active = true"
        ), {"fid": facility_id})

        # ... build KPI response
```

## Key Rules

1. **Double-booking prevention**: Application-level `FOR UPDATE` lock + DB exclusion constraint
2. **Slot generation is stateless** -- computed from hours + duration, not stored
3. **Pricing rules are evaluated in order** -- first match wins, day-specific overrides generic
4. **All times are in facility's local timezone** -- no UTC conversion for display
5. **Cancellation respects role hierarchy** -- player < staff < manager < owner
6. **Walk-in bookings** don't require player account -- store name/phone directly
7. **Never delete bookings** -- only status transitions (confirmed -> cancelled/completed)
