# Phase 6: Foundation - Context

**Gathered:** 2026-06-21
**Status:** Ready for planning

<domain>
## Phase Boundary

Deploy the Supabase infrastructure and wire it into the React app. By the end of this phase:
- All 5 tables (profiles, device_tokens, blood_requests, request_responses, donations), 5 enums, and PostGIS extension exist in the Supabase project
- RLS policies are active on all tables
- A `ST_DWithin` RPC function is deployed and callable from the React client
- A Supabase client singleton exists at `src/lib/supabase.ts`
- `src/auth.ts` is replaced with Supabase session helpers
- App.tsx restores sessions on mount and routes returning users to home
- `coarsenCoordinates()` utility exists in `src/geolocation.ts` and all GPS writes go through it
- No user-facing UI change — the OTP screen looks identical; auth wiring is invisible

This phase is infrastructure only. No donor profile writes, no blood request creation, no geo-queries yet — those are Phase 7.

</domain>

<decisions>
## Implementation Decisions

### Authentication Strategy

- **D-01:** Use `signInAnonymously()` — NOT `signInWithOtp()`. Real phone OTP requires an SMS provider (Twilio) which costs money per message; test mode only works for pre-configured numbers. Anonymous auth is free and session-persists via localStorage between visits on the same browser.
- **D-02:** `signInAnonymously()` is called on **app mount** (in a `useEffect` in `App.tsx`), not on OTP submit. This ensures a Supabase session UUID always exists before any user action.
- **D-03:** On mount: call `supabase.auth.getSession()`. If a valid session exists AND a profile row exists for that UUID → skip phone entry and route directly to the appropriate home screen.
- **D-04:** If no session or no profile for the current session UUID → show `PhoneEntry` screen as normal. After user enters phone and submits OTP, query `profiles WHERE phone = $phone` to determine routing: if found → returning user → home; if not found → new user → IntentChoice.

### Session Persistence and Returning Users

- **D-05:** Session persistence across browser refreshes is handled automatically by the Supabase JS client (stores JWT in localStorage). No additional code needed for this.
- **D-06:** Cross-device limitation is **accepted for v2**: a user on a different device gets a new anonymous UUID and must re-enter their phone. Returning-user detection on a new device requires checking by phone number; their existing profile can't be automatically linked to the new UUID. This is a v3 concern (real phone OTP would solve it).
- **D-07:** The OTP screen UI is **unchanged** — auto-fill, 6-box input, any code accepted. The Supabase session is already created on mount; OTP submit is just used to verify phone ownership for profile lookup, not for session creation.

### src/auth.ts Replacement

- **D-08:** Keep the file at `src/auth.ts` (no import-path refactor cascade). Replace its contents entirely with Supabase session helpers:
  - `getSession()` — wrapper around `supabase.auth.getSession()`
  - `onAuthStateChange(callback)` — wrapper around `supabase.auth.onAuthStateChange()`
  - Remove `hasLoggedInBefore()` and `markLoggedIn()` (localStorage dummy auth)
- **D-09:** The `bloodhelp.seenPhones` localStorage key is no longer used after this phase. Remove it cleanly.

### GPS Coarsening

- **D-10:** Coarsen GPS to **2 decimal places** (~1.1km resolution at equator). This is the true "~1km grid" the spec intends. 4 decimal places (~11m) was a documentation error.
  - `Math.round(lat * 100) / 100` and `Math.round(lng * 100) / 100`
- **D-11:** Export `coarsenCoordinates(lat: number, lng: number): { lat: number; lng: number }` from `src/geolocation.ts`, co-located with `getCurrentPosition()`.
- **D-12:** All location writes in Phase 7+ MUST call `coarsenCoordinates()` before writing to DB. Raw `GeoResult.lat` / `GeoResult.lng` values are never written directly.

### Supabase Client

- **D-13:** Supabase client singleton lives at `src/lib/supabase.ts`. Created with `createClient(SUPABASE_URL, SUPABASE_ANON_KEY)`.
- **D-14:** Environment variables use Vite convention: `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in `.env.local` (gitignored). Values obtained via Supabase MCP `get_project_url` and `get_publishable_keys` during setup.

### Schema Deployment

- **D-15:** Use Supabase MCP `apply_migration` to deploy the schema SQL (not the Supabase CLI). Dummy seed data (for dev/testing) also applied via MCP `execute_sql`.
- **D-16:** Data model is **fixed** as per `blood-help-spec.md §4`. Any deviation requires explicit user sign-off before implementation.

### Geo-Matching Radius (for Phase 7, locked here)

- **D-17:** Two-radius approach: `DISPLAY_RADIUS_KM = 10` (home feed default), `ALERT_RADIUS_KM = 25` (push, Phase 3). If display query returns zero results, widen to alert radius once. No step-expansion — two radii are enough for v2.

### Claude's Discretion

- RLS policy SQL wording (within the rules from spec §4.3)
- TypeScript type strategy for Supabase-generated types (suggest `src/types/database.ts` auto-generated via MCP)
- Exact PostGIS RPC function signature (parameter names, return type)
- `.env.local` vs Vite `define` for env vars (`.env.local` is standard)
- Error handling for failed `signInAnonymously()` call on mount

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Data Model & Schema
- `blood-help-spec.md §4` — Complete SQL schema (enums, 5 tables, constraints). This is the source of truth. Do not deviate.
- `blood-help-spec.md §4.3` — RLS high-level rules (who can read what)
- `blood-help-spec.md §3.4` — Privacy guardrails (coarsened GPS, gated phone reveal)

### Geo-Matching
- `blood-help-spec.md §3.2` — Location and radius logic (ALERT_RADIUS_KM, DISPLAY_RADIUS_KM, expansion rules)
- `blood-help-spec.md §3.1` — Blood type compatibility table (directional — for Phase 7, referenced here for RPC context)

### Current Codebase (files being modified)
- `src/auth.ts` — Current dummy auth implementation being replaced
- `src/geolocation.ts` — `getCurrentPosition()` and `GeoResult` type; `coarsenCoordinates()` added here
- `src/App.tsx` — Session restore logic and auth state changes go here (mount useEffect, handleVerified flow)

### Planning Context
- `.planning/REQUIREMENTS.md` — Requirements BACK-01, BACK-02, BACK-03, BACK-04, PRIV-03
- `.planning/ROADMAP.md` Phase 6 — Success criteria

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/geolocation.ts` — `getCurrentPosition()` and `GeoResult` discriminated union: add `coarsenCoordinates()` alongside these exports
- `src/App.tsx` `handleVerified(code)` at ~line 60 — this is the OTP submit callback; session logic triggers here or in mount useEffect
- `src/App.tsx` `UserState` interface — needs a `supabaseId: string` field to store session UUID after auth

### Established Patterns
- Domain utilities in `src/*.ts` (blood.ts, i18n.ts, auth.ts, geolocation.ts) are stateless exported functions — Supabase client in `src/lib/supabase.ts` follows the same flat-module pattern
- All global state lives in `App.tsx` via `useState` — Supabase session goes into App state, not a context provider
- Error handling uses discriminated unions (`GeoResult`) — Supabase auth errors should follow the same pattern in auth.ts wrappers
- No test framework installed — verification is manual + Supabase dashboard checks

### Integration Points
- `src/App.tsx` mount → `useEffect` → `signInAnonymously()` + `getSession()` → set session state → decide screen
- `src/screens/OtpVerification.tsx` `onVerified` callback → `App.handleVerified()` → phone-based profile lookup
- `src/geolocation.ts` exports → Phase 7 profile/request writes call `coarsenCoordinates()` on raw GeoResult before DB write

</code_context>

<specifics>
## Specific Ideas

- The user confirmed: use Supabase MCP tools (`apply_migration`, `execute_sql`) for all schema deployment and seed data — NOT the Supabase CLI.
- GPS precision: `Math.round(coord * 100) / 100` — round to 2 decimal places specifically.
- The spec data model (`blood-help-spec.md §4`) is authoritative — if any spec ambiguity arises during implementation, ask the user before deviating.
- Seed at least 2-3 dummy profiles and 1-2 dummy blood_requests via MCP so Phase 7 has data to query against.

</specifics>

<deferred>
## Deferred Ideas

- Real SMS OTP (Twilio) — v3; anonymous auth + phone-as-field is sufficient through v2
- Cross-device session linking (same phone, different browser UUID) — v3; accepted limitation for v2
- TypeScript DB types auto-generation strategy — Claude's discretion (suggest `src/types/database.ts` via MCP `generate_typescript_types`)
- Supabase client setup details (env vars, `src/lib/supabase.ts` exact structure) — Claude's discretion; standard Vite conventions apply
- Step-expansion radius logic (5km → 10km → 25km → 50km) — two-radius approach is enough for v2

</deferred>

---

*Phase: 6-Foundation*
*Context gathered: 2026-06-21*
