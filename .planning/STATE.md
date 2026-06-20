# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-06-20)

**Core value:** A person can post a blood request and have nearby, blood-compatible donors actually receive a push alert and call them back — turning an hours-long search into help within minutes.
**Current focus:** v2.0 Backend Core — Phase 7: Data Persistence + Geo-Matching (ready to plan)

## Current Position

Phase: 7 of 9 (Data Persistence + Geo-Matching)
Plan: TBD (not yet planned)
Status: Ready to discuss/plan
Last activity: 2026-06-21 — Phase 6 complete (6 plans, human-approved); advancing to Phase 7

Progress: [██░░░░░░░░] 25% (v2.0 — Phase 6/4 phases done)

## Performance Metrics

**Velocity:**
- Total plans completed: 6 (v2.0 milestone)
- Average duration: ~1 session/phase
- Total execution time: 1 session

**By Phase:**

| Phase | Plans | Status | Completed |
|-------|-------|--------|-----------|
| 6 — Foundation | 6 (5+1 gap) | ✓ Complete | 2026-06-21 |
| 7 — Data Persistence + Geo-Matching | TBD | ○ Next | — |

**Recent Trend:**
- Last 6 plans: Phase 6 foundation (schema, RLS, RPC, auth wiring, gap closure)
- Trend: On track

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

- Phase 6 human UAT items (4 items in 06-HUMAN-UAT.md) are pending — non-blocking for Phase 7 but should be confirmed before Phase 8 (they involve live Supabase auth and session behavior)
- handleSaveDonor and handlePosted in App.tsx still use local state — Phase 7 will wire these to real DB writes

## Deferred Items

| Category | Item | Status | Deferred At |
|----------|------|--------|-------------|
| Push | FCM push (PUSH-01 through PUSH-04, DNOR-03) | Deferred to v3.0 | 2026-06-20 |
| Privacy | Personal data purge on request close (PRIV-01) | Deferred to v3 | 2026-06-20 |
| Privacy | Gated, logged, rate-limited phone reveal (PRIV-02) | Deferred to v3 | 2026-06-20 |
| Auth | Real SMS OTP via Twilio | Deferred to v4 | 2026-06-20 |
| i18n | react-i18next library | Not blocking backend | 2026-06-20 |

## Session Continuity

Last session: 2026-06-21
Stopped at: Phase 6 complete (6 plans, human-approved). Phase 7 not yet planned.
Resume with: /gsd:discuss-phase 7 (recommended) or /gsd:plan-phase 7
