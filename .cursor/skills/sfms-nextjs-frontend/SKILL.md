---
name: sfms-nextjs-frontend
description: Build and maintain the SFMS Next.js frontend with responsive design, booking UI, and admin dashboards. Use when creating pages, components, layouts, or frontend configuration for the sports facility booking platform.
---

# SFMS Next.js Frontend

## Project Context

SFMS frontend is a sports facility booking platform built with Next.js 15, Tailwind CSS, shadcn/ui, and Recharts. It provides a player-facing booking flow and admin dashboards for facility managers/owners.

## Architecture

```
frontend/
├── app/
│   ├── layout.tsx              # Root layout (fonts, providers)
│   ├── page.tsx                # Landing / redirect
│   ├── login/page.tsx
│   ├── register/page.tsx
│   ├── book/                   # Player booking flow
│   │   ├── page.tsx            # Sport/branch/date selector
│   │   ├── [courtId]/page.tsx  # Slot picker + checkout
│   │   └── confirmation/page.tsx
│   └── dashboard/
│       ├── layout.tsx          # Admin shell (sidebar + topbar)
│       ├── page.tsx            # Overview (KPIs + today's schedule)
│       ├── bookings/page.tsx   # Booking management
│       ├── courts/page.tsx     # Court configuration
│       ├── revenue/page.tsx    # Revenue reports
│       └── settings/page.tsx   # Facility settings
├── components/
│   ├── ui/                     # shadcn/ui primitives
│   ├── booking/
│   │   ├── sport-selector.tsx
│   │   ├── slot-grid.tsx
│   │   ├── slot-timeline.tsx
│   │   └── checkout-form.tsx
│   ├── dashboard/
│   │   ├── kpi-card.tsx
│   │   ├── schedule-timeline.tsx
│   │   ├── revenue-chart.tsx
│   │   └── utilization-chart.tsx
│   └── layout/
│       ├── sidebar.tsx
│       ├── topbar.tsx
│       └── mobile-nav.tsx
├── lib/
│   ├── api.ts                  # Typed API client
│   ├── auth.ts                 # Auth utilities
│   └── utils.ts                # cn() and helpers
├── next.config.ts
├── tailwind.config.ts
└── package.json
```

## Tech Stack

```json
{
  "dependencies": {
    "next": "^15.1",
    "react": "^19",
    "react-dom": "^19",
    "@radix-ui/react-dialog": "^1.1",
    "@radix-ui/react-dropdown-menu": "^2.1",
    "class-variance-authority": "^0.7",
    "clsx": "^2.1",
    "tailwind-merge": "^2.5",
    "lucide-react": "^0.460",
    "recharts": "^2.13",
    "date-fns": "^3.6"
  }
}
```

Use **stable** Next.js releases only -- never RC or canary.

## API Client

```typescript
// lib/api.ts
const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8001";

class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const token = typeof window !== "undefined"
    ? localStorage.getItem("token")
    : null;

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options?.headers,
    },
  });

  if (!res.ok) throw new ApiError(res.status, await res.text());
  return res.json();
}

export const api = {
  health: () => request<{ status: string }>("/api/v1/health"),
  // Auth
  login: (email: string, password: string) =>
    request<{ access_token: string }>("/api/v1/auth/login", {
      method: "POST", body: JSON.stringify({ email, password }),
    }),
  // Booking
  getCourts: (branchId: number) =>
    request<Court[]>(`/api/v1/courts?branch_id=${branchId}`),
  getSlots: (courtId: number, date: string) =>
    request<Slot[]>(`/api/v1/bookings/slots?court_id=${courtId}&date=${date}`),
  createBooking: (data: BookingRequest) =>
    request<BookingResponse>("/api/v1/bookings", {
      method: "POST", body: JSON.stringify(data),
    }),
  // Dashboard
  getDashboardKPIs: () => request<KPI[]>("/api/v1/dashboard/kpis"),
  getRevenueTrend: () => request<RevenueTrend[]>("/api/v1/dashboard/revenue-trend"),
  getUtilization: () => request<Utilization[]>("/api/v1/dashboard/utilization"),
  // Payments
  createPaymentOrder: (bookingId: number) =>
    request<RazorpayOrder>(`/api/v1/payments/order/${bookingId}`, { method: "POST" }),
};
```

## Slot Grid Component

The core booking UI -- displays time slots for a court on a date.

```tsx
// components/booking/slot-grid.tsx
"use client";
import { cn } from "@/lib/utils";

interface Slot {
  start_time: string;
  end_time: string;
  is_available: boolean;
  price: number;
}

interface SlotGridProps {
  slots: Slot[];
  selectedSlot: Slot | null;
  onSelect: (slot: Slot) => void;
}

export function SlotGrid({ slots, selectedSlot, onSelect }: SlotGridProps) {
  return (
    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
      {slots.map((slot) => {
        const isSelected = selectedSlot?.start_time === slot.start_time;
        return (
          <button
            key={slot.start_time}
            disabled={!slot.is_available}
            onClick={() => onSelect(slot)}
            className={cn(
              "rounded-lg border p-3 text-center text-sm transition-all",
              slot.is_available
                ? isSelected
                  ? "border-emerald-500 bg-emerald-50 ring-2 ring-emerald-500"
                  : "border-slate-200 hover:border-emerald-300 hover:bg-emerald-50"
                : "border-slate-100 bg-slate-50 text-slate-400 cursor-not-allowed"
            )}
          >
            <div className="font-medium">{slot.start_time}</div>
            <div className="text-xs text-muted-foreground">₹{slot.price}</div>
          </button>
        );
      })}
    </div>
  );
}
```

## Dashboard Layout

```tsx
// app/dashboard/layout.tsx
"use client";
import { useState } from "react";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { MobileNav } from "@/components/layout/mobile-nav";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-emerald-50">
      <Sidebar className="hidden lg:fixed lg:inset-y-0 lg:flex lg:w-64" />
      <MobileNav open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="lg:pl-64">
        <Topbar onMenuClick={() => setSidebarOpen(true)} />
        <main className="p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
```

## KPI Card

```tsx
// components/dashboard/kpi-card.tsx
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, TrendingDown } from "lucide-react";

interface KPICardProps {
  label: string;
  value: string;
  changePct: number;
  icon: React.ReactNode;
  loading?: boolean;
}

export function KPICard({ label, value, changePct, icon, loading }: KPICardProps) {
  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="h-4 w-24 animate-pulse rounded bg-slate-200" />
          <div className="mt-3 h-8 w-32 animate-pulse rounded bg-slate-200" />
        </CardContent>
      </Card>
    );
  }

  const isPositive = changePct >= 0;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
        {icon}
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        <div className={`mt-1 flex items-center gap-1 text-sm ${
          isPositive ? "text-emerald-600" : "text-red-600"
        }`}>
          {isPositive ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
          {isPositive ? "+" : ""}{changePct.toFixed(1)}%
        </div>
      </CardContent>
    </Card>
  );
}
```

## Error Boundaries

```tsx
// app/dashboard/error.tsx
"use client";
export default function DashboardError({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="flex min-h-[400px] flex-col items-center justify-center gap-4">
      <h2 className="text-xl font-semibold">Something went wrong</h2>
      <p className="text-muted-foreground">{error.message}</p>
      <button onClick={reset} className="rounded-md bg-emerald-600 px-4 py-2 text-white hover:bg-emerald-700">
        Try again
      </button>
    </div>
  );
}
```

## Key Rules

1. **Never hardcode backend URLs** -- use `NEXT_PUBLIC_API_URL`
2. **Never use RC/canary Next.js** -- stable only
3. **Always wrap charts in `ResponsiveContainer`**
4. **Always provide loading skeletons** -- not just spinners
5. **Always define TypeScript interfaces** for API responses
6. **Always use the `api` client** -- never raw `fetch` in components
7. **Sidebar must collapse** on screens < 1024px
8. **Use INR (₹) formatting** for all prices
