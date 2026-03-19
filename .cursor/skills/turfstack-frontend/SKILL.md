---
name: turfstack-frontend
description: Guide for working with the TurfStack Next.js frontend. Use when building new pages, components, API integrations, or modifying auth, roles, sidebar, dashboard, or booking flows. Covers project structure, styling conventions, and the centralized API client.
---

# TurfStack Frontend

## Project Structure

```
frontend/
├── next.config.ts
├── package.json              # Next.js 15, tailwindcss, shadcn/ui, sonner, lucide-react
├── tailwind.config.ts
├── components.json           # shadcn/ui config
├── lib/
│   ├── api.ts                # Centralized API client (ALL backend calls go here)
│   ├── auth.ts               # Token/role helpers: getToken, getRole, isAuthenticated, etc.
│   ├── razorpay.ts           # Razorpay script loader + checkout opener
│   └── utils.ts              # cn() from shadcn
├── components/
│   ├── ui/                   # shadcn/ui primitives (button, card, input, dialog, etc.)
│   └── layout/
│       ├── sidebar.tsx        # Role-aware sidebar navigation
│       └── topbar.tsx         # User info + role badge
└── app/
    ├── layout.tsx             # Root layout (Toaster from sonner)
    ├── page.tsx               # Landing/marketing page
    ├── login/page.tsx
    ├── register/page.tsx
    ├── book/
    │   ├── page.tsx           # Court selection + slot picker + booking form
    │   └── confirmation/page.tsx  # Payment gateway (Razorpay)
    └── dashboard/
        ├── layout.tsx         # Auth guard + sidebar/topbar shell
        ├── loading.tsx        # Skeleton shimmer loading state
        ├── error.tsx          # Global error boundary
        ├── page.tsx           # Role-specific landing (Owner/Staff/Player/Accountant)
        ├── bookings/page.tsx  # All bookings (staff+), payment recording, refunds
        ├── my-bookings/page.tsx  # Player's own bookings
        ├── courts/
        │   ├── page.tsx       # Court CRUD (owner/manager)
        │   └── pricing/page.tsx   # Custom pricing rules per court
        ├── branches/page.tsx  # Branch management (owner)
        ├── schedule/page.tsx  # Visual timeline grid (staff+)
        ├── revenue/page.tsx   # Revenue trends + utilization heatmap
        └── settings/page.tsx  # Profile and facility settings
```

## Key Conventions

### Adding a New Dashboard Page

1. Create `app/dashboard/feature/page.tsx`
2. Export a default `"use client"` component
3. Add navigation entry to `components/layout/sidebar.tsx` with appropriate `roles` array
4. Use `api.xxx()` from `lib/api.ts` for data fetching
5. Use `toast.success()` / `toast.error()` from `sonner` for feedback (never `alert()`)

### API Client (`lib/api.ts`)

ALL backend communication goes through this single file. It handles:
- Base URL from `NEXT_PUBLIC_API_URL` env var
- Auto-attaching JWT from `localStorage` (`sfms_token`)
- 401 interceptor with token refresh
- Typed responses via generics

```typescript
// Adding a new API method:
const api = {
  // ... existing methods
  getFeatures: () =>
    request<Feature[]>("/api/v1/features"),

  createFeature: (data: FeatureCreate) =>
    request<Feature>("/api/v1/features", {
      method: "POST",
      body: JSON.stringify(data),
    }),
};
```

Add corresponding TypeScript interfaces at the top of the file.

### Authentication & Roles

```typescript
import { getToken, getRole, getFacilityId, isAuthenticated } from "@/lib/auth";

// Available roles: "owner" | "manager" | "staff" | "accountant" | "player"
const role = getRole();  // reads from localStorage "sfms_role"

// Role checks for conditional rendering
if (["owner", "manager"].includes(role || "")) {
  // Show admin controls
}
```

Login stores: `sfms_token`, `sfms_role`, `sfms_facility_id` in localStorage.

### Sidebar Navigation

Each nav item has a `roles` array controlling visibility:

```typescript
const navItems = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard, roles: ["all"] },
  { label: "Courts", href: "/dashboard/courts", icon: Layers, roles: ["owner", "manager"] },
  // ...
];
```

### Styling

- **Framework**: Tailwind CSS with shadcn/ui components
- **Brand colors**: Green primary (`emerald`/`green`), dark sidebar (`bg-gray-900`)
- **Icons**: `lucide-react` exclusively
- **Notifications**: `sonner` toasts (`toast.success()`, `toast.error()`)
- **Cards**: Use shadcn `<Card>` / `<CardHeader>` / `<CardContent>`
- **Forms**: Standard `<input>` with Tailwind classes or shadcn `<Input>`
- **Loading states**: Show spinners or skeleton UI, never blank screens

### Common Page Pattern

```tsx
"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { getRole } from "@/lib/auth";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function FeaturePage() {
  const [data, setData] = useState<Feature[]>([]);
  const [loading, setLoading] = useState(true);
  const role = getRole();

  useEffect(() => {
    api.getFeatures()
      .then(setData)
      .catch(() => toast.error("Failed to load features"))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="animate-pulse">...</div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Features</h1>
        {["owner", "manager"].includes(role || "") && (
          <Button>Add Feature</Button>
        )}
      </div>
      {/* Content */}
    </div>
  );
}
```

## Environment Variables

| Variable | Where | Description |
|----------|-------|-------------|
| `NEXT_PUBLIC_API_URL` | Vercel env / `.env.local` | Backend API base URL (e.g., `https://turfstack-api.fly.dev`) |
| `NEXT_PUBLIC_RAZORPAY_KEY` | Vercel env / `.env.local` | Razorpay publishable key |

## Common Pitfalls

- `useSearchParams()` requires wrapping with `<Suspense>` in Next.js 15
- Never import server-only code in `"use client"` components
- `localStorage` access must be guarded with `typeof window !== "undefined"`
- Booking flow passes params via URL search params (not state), allowing page refreshes
- Role checks use `getRole()` which reads `sfms_role` from localStorage
