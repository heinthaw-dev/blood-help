# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-06-18)

**Core value:** A person can post a blood request and have nearby, blood-compatible donors actually receive a push alert and call them back — turning an hours-long search into help within minutes.
**Current focus:** Phase 1 — Auth / Login

## Current Position

Phase: 1 of 9 (Auth / Login)
Plan: 0 of TBD in current phase
Status: Ready to plan
Last activity: 2026-06-19 — Roadmap revised to 9-phase screen-first structure; 49 v1 requirements remapped

Progress: [░░░░░░░░░░] 0%

## Performance Metrics

**Velocity:**
- Total plans completed: 0
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

- Foundation: Use `supabase.auth.signInAnonymously()` guarded by `getSession()` check — never call on every mount
- Foundation: `injectManifest` strategy (single `src/sw.ts`) is mandatory — `generateSW` cannot host FCM `onBackgroundMessage`; FCM slot reserved in Phase 1 SW even though token logic ships in Phase 5
- Auth model: ONE unified login; donor vs. requester are actions chosen from the home screen, not separate account types or separate logins
- Roadmap order: Screen-first, demoable-per-phase — each phase delivers an on-screen capability wired to real Supabase data; only genuinely later-phase capabilities are stubbed
- Phase 3 (Request form): Saves a real `blood_requests` row now; push fan-out and matching are stubbed until Phase 7
- Phase 6 (Matching Data): Blood compatibility matrix gets all 64 directional unit tests before any SQL migration runs — this is a hard gate before Phase 7
- Matching: Blood compatibility matrix is directional (donor→recipient); write 64-cell unit tests before SQL migration
- Security: RLS enabled on every table at creation; raw lat/lon and phone numbers never returned to client
- Commits: Conventional Commits style (feat:/fix:) per feature during execution

### Pending Todos

None yet.

### Blockers/Concerns

- **Phase 5 research flag:** Verify exact token-refresh API in Firebase modular SDK v12 before push-token plan
- **Phase 7 research flag:** Cross-reference FCM OAuth2 JWT signing in Deno; test fan-out concurrency for 20+ donors; monitor `net._http_response` for Edge Function failures

## Deferred Items

| Category | Item | Status | Deferred At |
|----------|------|--------|-------------|
| *(none)* | | | |

## Session Continuity

Last session: 2026-06-19
Stopped at: Roadmap revised from 6-phase to 9-phase screen-first structure. Ready to run `/gsd:plan-phase 1`.
Resume file: None
