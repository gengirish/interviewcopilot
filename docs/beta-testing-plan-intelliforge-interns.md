# InfinityHire Copilot Beta Testing Plan (Intern Cohort)

Prepared for: IntelliForge AI interns ([https://www.intelliforge.tech/](https://www.intelliforge.tech/))

## Purpose

Run a structured beta test to validate:

- activation (signup to first answer),
- reliability of core session flow,
- quality of AI outputs,
- usefulness of new YC features,
- readiness for public launch.

---

## 1) Copy-Paste Message to Intern Testers

**Subject:** Beta Testing Sprint - InfinityHire Copilot (Action Required)

Hi team,  
We are running a focused beta test for **InfinityHire Copilot** (AI interview assistant), and you should use it like real users, not internal builders.

### What we are testing

- Onboarding and signup/login flow
- Session setup and live Q&A experience
- AI answer quality and speed
- New YC features:
  - Best Answer Rewrite
  - Company Question Bank
  - 7-Day Prep Plan
  - Shareable Report
  - Team Panel mode
- Dashboard analytics and upgrade journey

### Your mission

- Use the product like an actual candidate or hiring panel member
- Break workflows, find edge cases, and report friction
- Give clear product feedback (not only bug reports)

### Testing window

- **Start:** [Date]
- **End:** [Date]
- **Expected effort:** 45-60 mins/day per tester

### Where to report

- Bugs: [Jira/Notion/Sheet link]
- UX feedback: [Form link]
- Daily summary: [Slack channel]

This sprint is critical for launch readiness.

---

## 2) Beta Test Charter

### Objective

Validate that InfinityHire Copilot delivers clear value in under 10 minutes and is stable enough for external growth testing.

### Success criteria

- 90%+ testers complete signup -> first answer flow
- Median time to first answer < 3 minutes
- 0 P0 issues, <= 3 unresolved P1 issues
- 80% testers rate "Would use again" >= 4/5
- 70% testers say debrief/prep-plan features are useful

### Tester role assignment

- 4 testers as **candidate personas** (ML, backend, PM, data)
- 2 testers as **hiring panel/team mode users**
- 1 tester as **adversarial tester** (tries to break auth/session/edge cases)

---

## 3) Five-Day Beta Sprint Plan

### Day 1 - Onboarding and activation

- Signup/login/logout
- Session setup
- First question asked and first answer received
- Record all friction in first 10 minutes

### Day 2 - Core session reliability

- 10+ Q&A interactions per tester
- Voice + typed question mix
- Resume upload + no-resume path
- Observe latency and output consistency

### Day 3 - YC feature validation

- Rewrite answer at least 3 times
- Generate company question bank for 2 company modes
- Generate debrief and 7-day prep plan
- Validate share report and copy flow

### Day 4 - Monetization and dashboard

- Dashboard interpretation and quality score
- Upgrade/checkout behavior
- Team panel summary generation
- Copy/export/report quality

### Day 5 - Retention simulation

- Return as same user
- Start second session from dashboard/session
- Re-check quality score and prep-plan relevance
- Final usability score and launch recommendation

---

## 4) Required Scenario Checklist

Each tester must complete these:

- Can I sign up and reach first useful answer quickly?
- Are answers role-appropriate and company-style aware?
- Does Rewrite improve answer quality?
- Is question bank relevant and usable?
- Is debrief practical or generic?
- Is 7-day prep plan actionable and realistic?
- Can I generate and copy a shareable report successfully?
- Does Team Panel produce coherent summary output?
- Are errors clear and recoverable?
- Does any screen feel confusing, slow, or untrustworthy?

---

## 5) Bug Reporting Template

Use this format for every bug:

- **Title:** short and specific
- **Area:** Auth / Session / AI / Dashboard / Billing / Team
- **Severity:** P0 / P1 / P2 / P3
- **Environment:** Browser + OS
- **Steps to reproduce:** numbered list
- **Expected:** what should happen
- **Actual:** what happened
- **Evidence:** screenshot/video + timestamp
- **Frequency:** always / intermittent
- **Workaround:** yes/no

### Severity guide

- **P0:** App unusable, security/data risk
- **P1:** Core flow broken (signup, first answer, checkout)
- **P2:** Feature broken but workaround exists
- **P3:** UI/copy polish issue

---

## 6) Product Feedback Form Questions (Daily)

Ask each tester:

- What was the most valuable moment today?
- Where did you lose confidence or get confused?
- Did AI output feel personalized or generic?
- Which feature should we keep/remove?
- Would you pay INR 499/month? Why or why not?
- One change that would make you recommend this immediately

---

## 7) Daily Ops Cadence

- 10-minute daily sync (Slack/Meet)
- One triage owner (you)
- One QA captain (lead intern)
- End-of-day status dashboard:
  - New bugs by severity
  - Fixed bugs
  - Activation completion rate
  - Qualitative highlights

---

## 8) Go / No-Go Exit Criteria

### Go if all are true

- No open P0 issues
- P1 issues <= 3 with fix plan
- Activation success >= 90%
- Majority usefulness score >= 4/5

### No-Go if any are true

- Core flow instability persists
- AI trust/relevance concerns remain high
- Upgrade/checkout path is unclear or broken

---

## 9) Optional Operational Templates

If needed, create these as companion docs:

- Google Form template for feedback collection
- Notion/Jira bug triage board template
- Daily Slack/WhatsApp status message template

