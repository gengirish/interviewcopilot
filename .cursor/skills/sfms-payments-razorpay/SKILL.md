---
name: sfms-payments-razorpay
description: Integrate Razorpay payment gateway for SFMS including order creation, checkout, webhook handling, and refunds. Use when working with payments, Razorpay API, payment orders, webhooks, refunds, or cash/UPI payments for the sports facility booking system.
---

# SFMS Razorpay Payments

## Project Context

SFMS uses Razorpay for online payments (Indian market). The flow supports:
- Online payments via Razorpay Checkout (cards, UPI, netbanking, wallets)
- Cash/UPI-direct payments recorded offline by staff
- Webhook-based payment confirmation
- Refunds on cancellation

## Payment Flow

```
1. Player creates booking → booking status = 'confirmed', payment status = 'pending'
2. Frontend calls POST /api/v1/payments/order/{booking_id} → Razorpay order created
3. Frontend opens Razorpay Checkout with order_id
4. Player completes payment on Razorpay
5. Razorpay sends webhook → POST /api/v1/payments/webhook
6. Backend verifies signature, updates payment status = 'captured'
7. On cancellation → POST /api/v1/payments/refund/{payment_id}
```

## Payment Service

```python
# src/sfms/services/payment_service.py
import razorpay
import hmac
import hashlib
from sfms.config import get_settings
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text

class PaymentService:
    def __init__(self, db: AsyncSession):
        self.db = db
        settings = get_settings()
        self.client = razorpay.Client(auth=(settings.razorpay_key_id, settings.razorpay_key_secret))
        self.key_secret = settings.razorpay_key_secret

    async def create_order(self, booking_id: int) -> dict:
        booking = await self.db.execute(text(
            "SELECT id, amount, facility_id FROM booking WHERE id = :id AND status = 'confirmed'"
        ), {"id": booking_id})
        row = booking.fetchone()
        if not row:
            raise ValueError("Booking not found or not in confirmed state")

        order = self.client.order.create({
            "amount": int(row.amount * 100),  # Razorpay expects paise
            "currency": "INR",
            "receipt": f"booking_{booking_id}",
            "notes": {"booking_id": str(booking_id), "facility_id": str(row.facility_id)},
        })

        await self.db.execute(text(
            """INSERT INTO payment (facility_id, booking_id, amount, currency, status, method, razorpay_order_id)
               VALUES (:fid, :bid, :amount, 'INR', 'pending', 'razorpay', :order_id)"""
        ), {
            "fid": row.facility_id, "bid": booking_id,
            "amount": float(row.amount), "order_id": order["id"],
        })
        await self.db.commit()

        return {
            "order_id": order["id"],
            "amount": order["amount"],
            "currency": order["currency"],
            "key_id": get_settings().razorpay_key_id,
        }

    def verify_signature(self, order_id: str, payment_id: str, signature: str) -> bool:
        message = f"{order_id}|{payment_id}"
        expected = hmac.new(
            self.key_secret.encode(), message.encode(), hashlib.sha256
        ).hexdigest()
        return hmac.compare_digest(expected, signature)

    async def capture_payment(self, order_id: str, payment_id: str, signature: str) -> dict:
        if not self.verify_signature(order_id, payment_id, signature):
            raise ValueError("Invalid payment signature")

        await self.db.execute(text(
            """UPDATE payment
               SET status = 'captured', razorpay_payment_id = :pid,
                   razorpay_signature = :sig, paid_at = NOW()
               WHERE razorpay_order_id = :oid"""
        ), {"pid": payment_id, "sig": signature, "oid": order_id})
        await self.db.commit()

        return {"status": "captured", "payment_id": payment_id}

    async def record_cash_payment(self, booking_id: int, facility_id: int) -> dict:
        await self.db.execute(text(
            """INSERT INTO payment (facility_id, booking_id, amount, currency, status, method, paid_at)
               SELECT :fid, :bid, amount, 'INR', 'captured', 'cash', NOW()
               FROM booking WHERE id = :bid"""
        ), {"fid": facility_id, "bid": booking_id})
        await self.db.commit()
        return {"status": "captured", "method": "cash"}

    async def initiate_refund(self, payment_id: int) -> dict:
        payment = await self.db.execute(text(
            "SELECT razorpay_payment_id, amount FROM payment WHERE id = :id AND status = 'captured'"
        ), {"id": payment_id})
        row = payment.fetchone()
        if not row or not row.razorpay_payment_id:
            raise ValueError("Payment not found or not refundable")

        refund = self.client.payment.refund(row.razorpay_payment_id, {
            "amount": int(row.amount * 100),
        })

        await self.db.execute(text(
            "UPDATE payment SET status = 'refunded' WHERE id = :id"
        ), {"id": payment_id})
        await self.db.commit()

        return {"refund_id": refund["id"], "status": "refunded"}
```

## Payment Router

```python
# src/sfms/routers/payments.py
from fastapi import APIRouter, Depends, Request
from sfms.dependencies import get_current_user, get_db, get_tenant_id
from sfms.services.payment_service import PaymentService

router = APIRouter(prefix="/payments", tags=["Payments"])

@router.post("/order/{booking_id}")
async def create_payment_order(
    booking_id: int,
    user=Depends(get_current_user),
    db=Depends(get_db),
):
    service = PaymentService(db)
    return await service.create_order(booking_id)

@router.post("/verify")
async def verify_payment(
    request: Request,
    db=Depends(get_db),
):
    body = await request.json()
    service = PaymentService(db)
    return await service.capture_payment(
        order_id=body["razorpay_order_id"],
        payment_id=body["razorpay_payment_id"],
        signature=body["razorpay_signature"],
    )

@router.post("/cash/{booking_id}")
async def record_cash(
    booking_id: int,
    user=Depends(get_current_user),
    db=Depends(get_db),
    tenant_id: int = Depends(get_tenant_id),
):
    service = PaymentService(db)
    return await service.record_cash_payment(booking_id, tenant_id)

@router.post("/webhook")
async def razorpay_webhook(request: Request, db=Depends(get_db)):
    body = await request.json()
    event = body.get("event")
    if event == "payment.captured":
        payload = body["payload"]["payment"]["entity"]
        service = PaymentService(db)
        await service.capture_payment(
            order_id=payload["order_id"],
            payment_id=payload["id"],
            signature=request.headers.get("X-Razorpay-Signature", ""),
        )
    return {"status": "ok"}
```

## Frontend Razorpay Checkout

```typescript
// lib/razorpay.ts
declare global {
  interface Window { Razorpay: any; }
}

export function openRazorpayCheckout(
  order: { order_id: string; amount: number; key_id: string },
  onSuccess: (response: any) => void,
  onFailure: (error: any) => void,
) {
  const options = {
    key: order.key_id,
    amount: order.amount,
    currency: "INR",
    order_id: order.order_id,
    name: "SFMS",
    description: "Court Booking Payment",
    handler: onSuccess,
    theme: { color: "#10b981" },
  };

  const rzp = new window.Razorpay(options);
  rzp.on("payment.failed", onFailure);
  rzp.open();
}
```

Load the Razorpay script in `app/layout.tsx`:
```html
<Script src="https://checkout.razorpay.com/v1/checkout.js" strategy="lazyOnload" />
```

## Testing with Sandbox

Always use Razorpay Test Mode keys during development:
- Key ID starts with `rzp_test_`
- Test card: `4111 1111 1111 1111`, any future expiry, any CVV
- Test UPI: `success@razorpay`

## Key Rules

1. **Razorpay amounts are in paise** -- multiply INR by 100
2. **Always verify webhook signatures** -- reject unverified events
3. **Never store Razorpay secret in frontend** -- only `key_id` is public
4. **Cash payments are recorded manually** by staff/manager
5. **Refunds only for Razorpay payments** -- cash refunds are offline
6. **Use sandbox keys in dev** -- never test with live keys
7. **Payment status transitions**: pending -> captured -> refunded (never skip)
