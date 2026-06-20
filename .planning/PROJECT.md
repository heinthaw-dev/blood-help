# Blood Help

## What This Is

A free, non-profit Progressive Web App that connects people who urgently need blood with nearby compatible donors, so a donor can be reached within minutes. Built for Myanmar / Southeast Asia, Burmese-first (Noto Sans Myanmar), privacy-conscious. One unified user profile — "requesting blood" and "being available to donate" are actions a single user takes, not separate account types.

## Core Value

A person can post a blood request and have nearby, blood-compatible donors actually receive a push alert and call them back — turning an hours-long search into help within minutes. If everything else fails, this end-to-end loop (Request → nearby compatible donor alerted → callback) must work.

## Requirements

### Validated

<!-- Shipped and confirmed valuable. Inferred from existing codebase. -->

- ✓ Phone number entry screen with E.164 formatting — existing
- ✓ OTP verification screen (dummy auto-fill flow) — existing
- ✓ Intent choice screen ("I need blood" / "I want to donate") — existing
- ✓ Donor profile setup screen (name, blood type, township, availability, emergency-callable) — existing
- ✓ Blood request creation screen (blood type, location, contact, units, urgency) — existing
- ✓ Profile screen with bottom navigation — existing
- ✓ Leaderboard screen with donation rankings — existing
- ✓ Bilingual support (English + Burmese) with language toggle — existing
- ✓ Shared component library (Button, Input, Switch, Badge, BottomNav, BloodTypeSelector, AlertDialog) — existing
- ✓ Domain utilities (blood type enum, i18n formatting, auth localStorage, geolocation wrapper) — existing

### Active

<!-- Current scope. Building toward these. -->

- [ ] Thank-you screen after donor registration (heart-warming confirmation)
- [ ] Home / Dashboard screen (donor view: nearby requests feed, navigation)
- [ ] Request-live screen (requester session view — UI layout only, no live donor data)
- [ ] QR + 5-char code confirmation screen (scan or manual entry)
- [ ] Congratulations screen (donor post-confirmation celebration)
- [ ] Close/resolve flow ("Did you get blood from the app or outside?")
- [ ] Update Profile screen to new design (from Claude Design prompt)
- [ ] Update CreateRequest screen to new design (from Claude Design prompt)

### Out of Scope

<!-- Explicit boundaries. Includes reasoning to prevent re-adding. -->

- Donor response flow ("I'll help") — deferred; requires backend wiring and real-time data
- FCM push notifications — deferred; requires Firebase setup and service worker integration
- Real-time donor interaction on request-live screen — deferred; requires Supabase Realtime
- Backend wiring (Supabase schema, RLS, Edge Functions) — deferred to next milestone
- Real SMS OTP — v2; dummy OTP sufficient for v1 demo
- Call masking / telephony proxy — v2
- One-time request-scoped QR codes — v2; static QR + participant-only crediting for v1

## Context

- **Existing codebase**: 20 source files across `src/screens/` and `src/components/`. All screens are React function components with Tailwind v4 utility classes. No backend integration yet — all state is in-memory React state or localStorage.
- **Design source**: UI screens come from Claude Design HTML prompts. GSD assembles and wires them into React components rather than designing from scratch. The user has designs ready for all remaining screens.
- **Architecture**: Single `App.tsx` acts as screen router and global state container. No React Router — screen switching is via state machine pattern.
- **Spec reference**: `blood-help-spec.md` contains the full system specification including data model, matching logic, privacy rules, and user flows.
- **This milestone focuses on completing the UI layer** — all screens built and styled — before any backend wiring begins.

## Constraints

- **Tech stack**: React 19 + Vite 8 + Tailwind CSS v4 (CSS-only config, no tailwind.config.js) + TypeScript 6
- **Platform**: PWA, mobile-first — screens must work on small viewports
- **Localization**: All user-facing text must support English and Burmese (Noto Sans Myanmar)
- **Design fidelity**: Screens must match Claude Design HTML prompts provided by the user
- **No backend this milestone**: All screens are UI-only; no Supabase, Firebase, or API calls

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Screens-first, backend later | User wants full UI layer complete before wiring Supabase/FCM | — Pending |
| Defer donor response flow | Requires real-time backend; not meaningful as static UI | — Pending |
| Defer FCM push | Service worker + Firebase setup is backend work | — Pending |
| Update existing Profile + CreateRequest | New designs available; existing screens need refresh | — Pending |

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
*Last updated: 2026-06-20 after initialization*
