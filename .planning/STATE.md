# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-06-20)

**Core value:** A person can post a blood request and have nearby, blood-compatible donors actually receive a push alert and call them back — turning an hours-long search into help within minutes.
**Current focus:** v2.0 Backend Core — Phase 6: Foundation (ready to plan)

## Current Position

Phase: 6 of 9 (Foundation)
Plan: — (not yet planned)
Status: Ready to plan
Last activity: 2026-06-20 — v2.0 roadmap created; Phases 6-9 defined

Progress: [░░░░░░░░░░] 0% (v2.0)

## Performance Metrics

**Velocity:**
- Total plans completed: 0 (v2.0 milestone)
- Average duration: —
- Total execution time: 0 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| - | - | - | - |

**Recent Trend:**
- Last 5 plans: —
- Trend: —

*Updated after each plan completion*

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- [v2.0 init]: Anonymous Supabase session behind dummy OTP — profiles FK requires auth.users
- [v2.0 init]: Data model is fixed from blood-help-spec.md — deviations require user sign-off
- [v2.0 init]: Use Supabase MCP tools for all migrations and dummy data seeding
- [v2.0 init]: FCM push is deferred to v3.0 — not in scope for this milestone
- [v2.0 init]: Coarsened GPS only for privacy this milestone; purge and phone reveal deferred to v3

### Pending Todos

None yet.

### Blockers/Concerns

- Data model deviations from blood-help-spec.md §4 must be discussed with user before implementation
- Supabase project URL and anon key needed before Phase 6 can wire the React client

## Deferred Items

| Category | Item | Status | Deferred At |
|----------|------|--------|-------------|
| Push | FCM push (PUSH-01 through PUSH-04, DNOR-03) | Deferred to v3.0 | 2026-06-20 |
| Privacy | Personal data purge on request close (PRIV-01) | Deferred to v3 | 2026-06-20 |
| Privacy | Gated, logged, rate-limited phone reveal (PRIV-02) | Deferred to v3 | 2026-06-20 |
| Auth | Real SMS OTP via Twilio | Deferred to v4 | 2026-06-20 |
| i18n | react-i18next library | Not blocking backend | 2026-06-20 |

## Session Continuity

Last session: 2026-06-20
Stopped at: v2.0 roadmap created (Phases 6-9); ready to run /gsd:plan-phase 6
Resume file: None
