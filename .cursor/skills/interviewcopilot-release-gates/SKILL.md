---
name: infinityhire-release-gates
description: Applies pre-release quality gates for InfinityHire Copilot. Use before merge/deploy to verify auth, billing quota, analytics correctness, and session reliability.
---

# Release Gates

## Must-pass checks

1. Type and lint checks pass.
2. Auth flow works:
   - unauthenticated user cannot access protected routes
   - signup/login/logout behave correctly
3. Billing/usage flow works:
   - free quota enforced
   - upgrade changes plan behavior
4. Session flow works:
   - question submission works (voice or typed)
   - error states are visible and actionable
5. Analytics integrity:
   - usage metrics align with answer generation behavior

## Verification commands

```bash
npx tsc --noEmit
npm run lint
npm run test:e2e
```

## Sign-off format

- risk level: low/medium/high
- blockers: list or none
- rollback path: short note
