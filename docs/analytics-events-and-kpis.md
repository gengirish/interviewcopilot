# InfinityHire Copilot Analytics Events and KPI Framework

## North star and stage metrics

- North star: weekly activated users (`signup -> first_question_asked`)
- Acquisition: landing visitors, CTR on primary/secondary CTA
- Activation: signup completion rate, time to first question
- Retention: D3 and D7 return session rate
- Revenue: free-to-pro conversion rate, upgrade revenue per active user

## Event taxonomy

Use snake_case for all events and include ISO timestamps server-side.

### Acquisition events

- `landing_viewed`
  - properties: `source`, `campaign`, `device`, `geo_country`
- `cta_start_free_clicked`
  - properties: `placement` (`hero`, `nav`, `pricing`)
- `cta_book_demo_clicked`
  - properties: `placement`

### Activation events

- `signup_started`
  - properties: `entry_path` (`/signup`, gated redirect, pricing)
- `signup_completed`
  - properties: `method` (`email_password`)
- `session_started`
  - properties: `role_mode`, `resume_provided` (boolean)
- `first_question_asked`
  - properties: `input_type` (`voice`, `typed`), `time_to_first_question_sec`
- `first_answer_generated`
  - properties: `latency_ms`, `provider_model`

### Retention and quality events

- `session_completed`
  - properties: `questions_count`, `duration_sec`
- `return_session_started`
  - properties: `days_since_last_session`
- `answer_feedback_submitted`
  - properties: `score` (1-5), `feedback_type` (`quality`, `relevance`, `clarity`)

### Monetization events

- `quota_limit_reached`
  - properties: `plan`, `remaining_quota`
- `upgrade_cta_viewed`
  - properties: `placement` (`session`, `dashboard`, `pricing`)
- `upgraded_to_pro`
  - properties: `source`, `price_inr`

## KPI formulas

- Landing -> signup conversion = `signup_completed / landing_viewed`
- Signup -> session start = `session_started / signup_completed`
- Activation rate = `first_question_asked / signup_completed`
- D7 retention = `users_with_return_session_started_within_7d / signup_completed`
- Upgrade rate = `upgraded_to_pro / signup_completed`
- Median time to value = median(`time_to_first_question_sec`)

## Dashboard layout (minimum viable)

### Panel 1: Growth funnel (7d and 30d toggle)

- Landing viewed
- Signup completed
- Session started
- First question asked
- Upgraded to Pro

### Panel 2: Activation quality

- Median time to first question
- First answer latency p50 and p95
- Resume upload rate before first question

### Panel 3: Retention

- D3 return rate
- D7 return rate
- Sessions per activated user (30d)

### Panel 4: Revenue

- New Pro upgrades (7d/30d)
- Upgrade rate by source
- Revenue per activated user

## Experiment instrumentation checklist

For every experiment, include:

1. Hypothesis and single success metric
2. New/changed events required
3. Guardrail metrics
4. Observation window (minimum 7 days unless traffic is very high)
5. Decision at end: ship, iterate, or rollback

## First implementation slice

Ship these first before adding advanced breakdowns:

- `landing_viewed`
- `cta_start_free_clicked`
- `signup_completed`
- `session_started`
- `first_question_asked`
- `upgraded_to_pro`

This gives a measurable acquisition -> activation -> revenue loop with minimal complexity.
