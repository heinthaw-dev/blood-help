# Blood Help

## Current Milestone: v2.0 Backend Core

**Goal:** Wire the full blood request loop end-to-end on Supabase — schema, anonymous auth, geo-matching, FCM push, donor responses, real-time updates, QR/code confirmation, and request close.

**Target features:**
- Supabase schema deployed (PostGIS, 5 tables, RLS) per blood-help-spec.md §4
- Anonymous Supabase session behind existing dummy OTP screen
- Donor profiles and blood requests persisted to DB
- FCM service worker, device token registration, push to nearby compatible donors
- PostGIS geo-matching + blood type compatibility matching
- Donor response flow wired ("I'll help" → request_responses → FCM to requester)
- Supabase Realtime on request-live screen (live donor list)
- QR/5-char code confirmation → donations, donation_count++, auto-fulfill
- Request close + resolution FCM; pg_cron 24h auto-expiry
- Coarsened GPS storage (never raw lat/lng)

## What This Is

A free, non-profit Progressive Web App that connects people who urgently need blood with nearby compatible donors, so a donor can be reached within minutes. Built for Myanmar / Southeast Asia, Burmese-first (Noto Sans Myanmar), privacy-conscious. One unified user profile — "requesting blood" and "being available to donate" are actions a single user takes, not separate account types.

## Core Value

A person can post a blood request and have nearby, blood-compatible donors actually receive a push alert and call them back — turning an hours-long search into help within minutes. If everything else fails, this end-to-end loop (Request → nearby compatible donor alerted → callback) must work.

## Requirements

### Validated

<!-- Shipped and confirmed valuable. Inferred from existing codebase. -->

- ✓ Phone number entry screen with E.164 formatting — v1.0 UI milestone
- ✓ OTP verification screen (dummy auto-fill flow) — v1.0 UI milestone
- ✓ Intent choice screen ("I need blood" / "I want to donate") — v1.0 UI milestone
- ✓ Donor profile setup screen (name, blood type, township, availability, emergency-callable) — v1.0 UI milestone
- ✓ Blood request creation screen (blood type, location, contact, units, urgency) — v1.0 UI milestone
- ✓ Profile screen with bottom navigation — v1.0 UI milestone
- ✓ Leaderboard screen with donation rankings — v1.0 UI milestone
- ✓ Home/dashboard screen (donor view: nearby requests feed) — v1.0 UI milestone
- ✓ Request-live screen (requester session view) — v1.0 UI milestone
- ✓ QR + 5-char code confirmation screen — v1.0 UI milestone
- ✓ Donor thank-you and congratulations celebration screens — v1.0 UI milestone
- ✓ Bilingual support (English + Burmese) with language toggle — v1.0 UI milestone
- ✓ Shared component library (Button, Input, Switch, Badge, BottomNav, BloodTypeSelector, AlertDialog) — v1.0 UI milestone
- ✓ Domain utilities (blood type enum, i18n formatting, auth localStorage, geolocation wrapper) — v1.0 UI milestone

### Active

<!-- Current scope. Building toward these. -->

- [x] Supabase schema + RLS deployed via MCP migrations (profiles, device_tokens, blood_requests, request_responses, donations) — Phase 6 ✓
- [x] PostGIS ST_DWithin RPC for geo-distance matching — Phase 6 ✓
- [x] Supabase JS client wired into React app — Phase 6 ✓
- [x] Anonymous session via signInAnonymously() behind dummy OTP screen — Phase 6 ✓
- [x] Coarsened GPS: location snapped to ~1km grid before storage — Phase 6 ✓
- [ ] Blood type compatibility matching (directional, per spec §3.1)
- [ ] Donor profile and blood request forms write to DB
- [ ] FCM service worker (vite-plugin-pwa) + device token registration
- [ ] FCM push on new request → nearby compatible available donors
- [ ] "I'll help" donor response → request_responses row + FCM to requester
- [ ] Supabase Realtime subscription on request-live donor list
- [ ] QR / 5-char code confirmation → donations row → donation_count++, auto-fulfill
- [ ] Request close → resolution FCM to responding donors
- [ ] pg_cron Edge Function: auto-expire after 24h + notify responders

### Out of Scope

<!-- Explicit boundaries. Includes reasoning to prevent re-adding. -->

- Real SMS OTP via Twilio — v3; anonymous session sufficient for backend milestone
- Personal data purge on request close — deferred to v3 privacy milestone
- Gated, logged, rate-limited phone number reveal — deferred to v3 privacy milestone
- Call masking / telephony proxy — v3+; direct call sufficient for v1
- One-time request-scoped QR codes — v3; participant-only crediting via 5-char code for v2
- SMS fallback for FCM push — v3; FCM-only for now
- i18n library (react-i18next) — not blocking backend; inline strings continue for now

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
| Screens-first, backend later | User wants full UI layer complete before wiring Supabase/FCM | ✓ Good — UI milestone shipped |
| Defer donor response flow | Requires real-time backend; not meaningful as static UI | ✓ Good — now implementing in v2.0 |
| Defer FCM push | Service worker + Firebase setup is backend work | ✓ Good — now implementing in v2.0 |
| Anonymous Supabase session behind dummy OTP | Profiles table FK requires auth.users; anonymous auth gives real session without real SMS | — Pending |
| Data model fixed from blood-help-spec.md | Spec is the source of truth; schema deviations must be discussed before implementation | — Pending |
| Use Supabase MCP for migrations and seeding | MCP tools apply migrations directly; dummy data seeded via MCP for dev/testing | — Pending |
| Defer data purge and gated phone reveal | Privacy features deferred to v3; coarsened GPS only for v2.0 | — Pending |

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
*Last updated: 2026-06-20 after v2.0 milestone start — backend core*
