---
name: infinityhire-yc-ship
description: Executes high-impact YC shipping cycles for InfinityHire Copilot. Use when planning or implementing features that should improve activation, retention, monetization, reliability, or weekly growth metrics.
---

# InfinityHire Copilot YC Ship Loop

## Objective

Ship measurable product improvements fast, without sacrificing reliability.

## Workflow

1. Define one target metric for the task:
   - activation: signup -> first answered question
   - retention: weekly active users
   - monetization: free -> pro upgrade rate
2. Ship the smallest complete slice that can move that metric.
3. Add instrumentation/loggable events for verification.
4. Add at least one test or deterministic verification step.
5. Record rollout notes and next experiment.

## Product Priorities

- P0: session reliability, auth correctness, plan gating
- P1: onboarding friction and first-value time
- P2: upgrade prompts tied to usage limits
- P3: dashboard insights that drive user action

## Output format

When reporting completion, include:

- metric targeted
- behavior changed
- validation done
- next highest-leverage follow-up
