# Blood Help

## What This Is

Blood Help is a free, mobile-first PWA that instantly connects someone who urgently needs blood with nearby compatible donors, so a donor can call and help within minutes. It is built for a Myanmar audience (English + Burmese) and replaces the slow scramble of Facebook posts and word-of-mouth during a blood emergency with a direct, push-driven alert to the right donors nearby.

There is one unified user profile — "requesting blood" and "being available to donate" are *actions* a single user takes, not separate account types. The app runs as an installable PWA (Add to Home Screen) so donors receive push notifications even when the site isn't open.

## Core Value

A person can post a blood request and have nearby, blood-compatible donors actually receive a push alert and call them back — turning an hours-long search into help within minutes. If everything else fails, this end-to-end loop (Request → nearby compatible donor alerted → callback) must work.

## Requirements

### Validated

<!-- Shipped and confirmed valuable. -->

(None yet — ship to validate)

### Active

<!-- Current scope. Building toward these. All are hypotheses until shipped and validated. -->

- [ ] Unified user profile: one user can both request blood and mark themselves available to donate
- [ ] Dummy phone-OTP auth: request OTP → OTP screen → after ~3s a randomly-generated OTP auto-fills (no real SMS/verification)
- [ ] User can create a blood request (blood type + GPS location + their callback phone)
- [ ] Matching alerts nearby donors using the full blood-compatibility matrix (e.g. O− can donate to B−) within a GPS distance radius
- [ ] Matching donors receive a real Firebase Cloud Messaging push notification (works when the PWA isn't open / installed to home screen)
- [ ] Donor can respond ("I'm responding") and call the requester from the alert
- [ ] Requester can mark a request "fulfilled" to stop further alerts
- [ ] Prompt "Add to Home Screen" to enable push, with graceful in-app fallback for users who don't install
- [ ] App UI works in English and Burmese (Noto Sans Myanmar)
- [ ] PWA is installable (manifest + service worker)

### Out of Scope

<!-- Explicit boundaries. Includes reasoning to prevent re-adding. -->

- Real phone-OTP verification / SMS provider — auth is intentionally a dummy UI flow for v1 (auto-filled OTP)
- Custom backend server — Supabase (data) + Firebase (push) only; no bespoke API tier
- Exact-blood-type-only matching — replaced by the full compatibility matrix
- Township-only (non-GPS) matching — v1 uses real GPS distance radius
- In-app chat / messaging — the response channel is a phone call
- Native iOS/Android apps — PWA only for v1

## Context

- **Stack:** Supabase (database, real data + matching queries) + Firebase Cloud Messaging (real push) + React + Tailwind v4, delivered as a PWA. No custom backend tier.
- **What's real vs mocked:** Supabase data and FCM push are real. Only the auth/OTP step is dummy (3-second auto-fill). The matching logic (compatibility matrix + GPS distance) runs for real against Supabase.
- **Design system already imported:** Blood Help design tokens (colors, fonts incl. Burmese, spacing, radius, shadows, typography) live in `src/index.css` as Tailwind v4 `@theme` tokens, sourced from the "Mobile phone entry screen" Claude Design project.
- **UI delivery:** The user supplies React UI screens via Claude Design prompts, screen by screen (the Phone Entry screen is the first). GSD's work per phase is wiring, logic, data, and push onto those screens.
- **Audience:** Myanmar (Yangon and beyond), bilingual English/Burmese, likely Android-leaning but iOS supported via installed-PWA push with fallback.
- **Origin story:** Built around the real scenario of needing B-negative blood at 9pm in Yangon when the blood bank is short and the only alternative is hoping a Facebook post is seen in time.

## Constraints

- **Tech stack**: Supabase + Firebase Cloud Messaging + React + Tailwind v4, PWA — chosen for a serverless, fast-to-ship two-sided app with real push.
- **Auth**: Dummy OTP flow only (no SMS provider) — keeps v1 demoable without telephony cost/setup.
- **Platform**: PWA, mobile-first — iOS web push requires the PWA be installed to the home screen, so install prompting + in-app fallback are required.
- **Localization**: Must support English and Burmese (Noto Sans Myanmar already in the design tokens).
- **UI source**: Screens come from the user's Claude Design prompts; GSD assembles and wires them rather than designing from scratch.

## Key Decisions

<!-- Decisions that constrain future work. Add throughout project lifecycle. -->

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Unified profile — donor/receiver are actions, not account types | Real users are both; avoids duplicate auth/profile surfaces | — Pending |
| Supabase + Firebase + React + Tailwind, no custom backend | Serverless, fast to ship, real push without running servers | — Pending |
| Ship as an installable PWA | Donors must get push when the site isn't open; avoids native app stores | — Pending |
| Dummy OTP auth (auto-fill after 3s) | Demoable v1 without an SMS provider or telephony cost | — Pending |
| Full blood-compatibility matrix (not exact-type) | Reaches more medically-valid donors; matches real transfusion rules | — Pending |
| GPS distance radius for location | More accurate "nearby" than township; the story is geographic | — Pending |
| Requester marks "fulfilled"; donor can mark "responding" | Stops stale alerts after the need is met; keeps the loop honest | — Pending |
| Roadmap organized by feature/flow; user supplies screens per phase | UI comes from Claude Design; GSD wires logic/data/push | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd:complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-06-18 after initialization*
