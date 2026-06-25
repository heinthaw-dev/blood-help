# Roadmap: Blood Help

## Milestones

- ✅ **v1.0 UI Milestone** - Phases 1-5 (shipped 2026-06-20)
- ✅ **v2.0 Backend Core** - Phases 6-8 complete (2026-06-22) — Phase 9 (Confirmation + Lifecycle) is the remaining item

## Phases

<details>
<summary>✅ v1.0 UI Milestone (Phases 1-5) - SHIPPED 2026-06-20</summary>

### Phase 1: Celebration Screens

**Goal**: Users see emotionally resonant confirmation screens after completing donor registration and after a donation is confirmed
**Depends on**: Nothing (first phase)
**Requirements**: CELE-01, CELE-02
**Success Criteria** (what must be TRUE):

  1. After completing donor registration, user lands on a heart-warming thank-you screen (not a blank state or generic success toast)
  2. After donation is confirmed, donor sees a distinct congratulations celebration screen
  3. Both screens render correctly in English and Burmese
  4. Both screens are reachable from App.tsx screen routing

**Plans**: TBD
**UI hint**: yes

### Phase 2: Home Dashboard

**Goal**: Donors can view a home/dashboard screen with a feed of nearby blood requests and navigate the app via bottom navigation
**Depends on**: Phase 1
**Requirements**: HOME-01, HOME-02
**Success Criteria** (what must be TRUE):

  1. User sees a Home screen with a visible feed of blood request cards (static/placeholder data)
  2. Each request card displays blood type, location/township, and urgency indicators
  3. Bottom navigation bar (Profile, Home, Leaderboard) is present and switches between screens correctly
  4. Home screen renders correctly in English and Burmese

**Plans**: TBD
**UI hint**: yes

### Phase 3: Request Session

**Goal**: Requesters can view their live request session screen and close/resolve a request with an outcome choice
**Depends on**: Phase 2
**Requirements**: SESS-01, SESS-02
**Success Criteria** (what must be TRUE):

  1. Requester sees a request-live screen showing blood type, township header, and transparency line ("We've alerted X nearby donors")
  2. Donor list layout is visible with Will Help / Can Call / +N more state placeholders
  3. Requester can tap a close/resolve action that presents "Did you get blood from the app or outside?" choice
  4. Both resolution paths (app / outside) lead to a distinct outcome screen or state
  5. All text on the request session and resolve flow renders in English and Burmese

**Plans**: TBD
**UI hint**: yes

### Phase 4: Confirmation Flow

**Goal**: Requesters can confirm a donation by scanning a donor's QR code or typing a 5-character code
**Depends on**: Phase 3
**Requirements**: CONF-01
**Success Criteria** (what must be TRUE):

  1. Requester sees a confirmation screen with a QR scan option and a manual 5-char code entry field
  2. Entering a valid 5-char code advances to the next screen (no real validation required — static flow)
  3. Screen renders correctly in English and Burmese

**Plans**: TBD
**UI hint**: yes

### Phase 5: Screen Refreshes

**Goal**: Existing Profile and CreateRequest screens are updated to match the new Claude Design prompts
**Depends on**: Phase 4
**Requirements**: UPDT-01, UPDT-02
**Success Criteria** (what must be TRUE):

  1. Profile screen visually matches the new Claude Design prompt provided by the user
  2. CreateRequest screen visually matches the new Claude Design prompt provided by the user
  3. Both refreshed screens retain English/Burmese bilingual support
  4. No regressions in existing shared components (BottomNav, BloodTypeSelector, etc.)

**Plans**: TBD
**UI hint**: yes

</details>

---

### ✅ v2.0 Backend Core (Complete — 2026-06-24)

**Milestone Goal:** Wire the full blood request loop end-to-end on Supabase — schema, anonymous auth, geo-matching, donor responses, real-time updates, QR/code confirmation, and request lifecycle. FCM push deferred to v3.0.

**Phase Numbering (continuing from v1.0):**

- Integer phases (6, 7, 8, 9): Planned milestone work
- Decimal phases (6.1, 7.1): Urgent insertions if needed (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 6: Foundation** - Supabase schema, PostGIS, RLS, anonymous auth, and React client wiring — the full infrastructure layer before any user-facing data flows *(completed: 6 plans, 2026-06-21)*
- [x] **Phase 7: Data Persistence + Geo-Matching** - Profile and request forms write real data; home feed queries real requests from DB using blood-type compatibility matching and PostGIS proximity (completed 2026-06-21)
- [x] **Phase 8: Donor Response + Realtime** - "I'll help" creates a DB row; request-live screen subscribes to Supabase Realtime and updates donor list live *(completed: 3 plans, 2026-06-22)*
- [x] **Phase 9: Confirmation + Lifecycle** - QR/5-char code confirms donations, auto-fulfills on units target, requester close writes to DB, and pg_cron expires stale requests *(completed: 3 plans, 2026-06-24)*

## Phase Details

### Phase 6: Foundation

**Goal**: The Supabase infrastructure is deployed and wired into the React app — schema, RLS, PostGIS RPC, anonymous session, and coarsened GPS utility are all in place so that every subsequent phase can write real data
**Depends on**: Phase 5 (UI milestone)
**Requirements**: BACK-01, BACK-02, BACK-03, BACK-04, PRIV-03
**Success Criteria** (what must be TRUE):

  1. All 5 tables (profiles, device_tokens, blood_requests, request_responses, donations), 5 enums, and PostGIS extension exist in the Supabase project (verifiable via Supabase dashboard or MCP list_tables)
  2. RLS is enabled on all tables; an anonymous user cannot read another user's profile phone number or contact_phone from blood_requests
  3. Submitting the OTP screen calls signInAnonymously() silently — the user gets a real Supabase session UUID (visible in Supabase Auth dashboard) without any UI change
  4. The ST_DWithin RPC function is deployed and callable from the React client without a Postgres error
  5. Any lat/lng value written through the app's coarsening utility rounds to 2 decimal places (~1.1km grid) — raw GPS coordinates from navigator.geolocation are never sent to the DB (D-10)

**Plans**: 6 plans (5 original + 1 gap closure)
**Completed**: 2026-06-21
Plans:

- [x] 06-01-PLAN.md — PostGIS extension + 5 enums + 5 tables with all constraints (BACK-01)
- [x] 06-02-PLAN.md — RLS policies on all 5 tables (BACK-02)
- [x] 06-03-PLAN.md — donors_within_radius RPC function + seed data (BACK-04)
- [x] 06-04-PLAN.md — @supabase/supabase-js install + .env.local + vite-env.d.ts + src/lib/supabase.ts + src/types/database.ts (BACK-03)
- [x] 06-05-PLAN.md — Replace src/auth.ts + add coarsenCoordinates to src/geolocation.ts + wire App.tsx mount auth (BACK-03, PRIV-03)
- [x] 06-06-PLAN.md — Gap closure: wire coarsenCoordinates call site in CreateRequest.tsx (PRIV-03)

### Phase 7: Data Persistence + Geo-Matching

**Goal**: Completing the donor profile form and posting a blood request both write real rows to the DB; the home feed shows real active requests within proximity, filtered by directional blood-type compatibility
**Depends on**: Phase 6
**Requirements**: BACK-05, BACK-06, GEO-01, GEO-02
**Success Criteria** (what must be TRUE):

  1. After a donor saves their profile, an identity row exists in `profiles` and a donor row exists in the new `donors` table (the profiles/donors split signed off per D-01–D-07) with the correct blood_type, emergency_callable, and coarsened lat/lng (verifiable in Supabase dashboard)
  2. After a requester posts a blood request, a row exists in blood_requests with status='active' and expires_at = now()+24h; attempting to post a second active request shows an error rather than creating a duplicate row
  3. The home feed shows real blood_requests from the DB — not static placeholder data — filtered to within 10km of the donor's location
  4. A donor with blood type O+ sees requests needing O+, A+, B+, and AB+ (directional compatibility), not only exact O+ matches

**Plans**: 4 plans
Plans:
**Wave 1**

- [x] 07-01-PLAN.md — [BLOCKING] Schema migration (profiles/donors split, current_address rename, donors RLS, donors_within_radius recreate, requests_within_radius RPC) applied via Supabase MCP + type regen + donor re-seed (BACK-05, BACK-06, GEO-02)
- [x] 07-02-PLAN.md — COMPATIBLE_REQUEST_TYPES directional compatibility map in blood.ts (GEO-01)

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 07-03-PLAN.md — App handlers (donor dual-upsert, request insert, hydration, write-error dialog, E.164) + DonorProfileSetup GPS pre-permission flow (BACK-05, BACK-06)

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 07-04-PLAN.md — CreateRequest required current_address + Home live feed via requests_within_radius with compatibility + proximity + own-request filters (BACK-06, GEO-01, GEO-02)

### Phase 8: Donor Response + Realtime

**Goal**: A donor can tap "I'll help" to commit to a request and that action immediately appears on the requester's live screen without a page refresh
**Depends on**: Phase 7
**Requirements**: DNOR-01, DNOR-02
**Success Criteria** (what must be TRUE):

  1. Tapping "I'll help" on a request card creates a request_responses row with status='responding' for that donor; tapping again is a no-op (button is disabled/hidden)
  2. The request-live screen (requester view) shows a new donor in the "Will Help" section within seconds of that donor tapping "I'll help" — no page refresh required
  3. A donor who has already responded to a request cannot submit a duplicate response row (unique constraint enforced at DB level)

**Plans**: 3 plans
**Completed**: 2026-06-22
Plans:

- [x] 08-01-PLAN.md — responders_for_request SECURITY DEFINER RPC + request_responses added to supabase_realtime publication + types regen (DNOR-02 foundation)
- [x] 08-02-PLAN.md — Donor "I'll help" action: handleRespond + respondedIds in App.tsx + RequestCard state machine in Home.tsx (DNOR-01)
- [x] 08-03-PLAN.md — RequestLive realtime: real responders via RPC + Postgres Changes subscription + toast + calm empty state + truthful D-09 count + activeRequestId threading (DNOR-02)

### Phase 9: Confirmation + Lifecycle

**Goal**: The full request lifecycle is wired end-to-end — a confirmed donation credits the donor, fulfills the request when units are met, the requester can manually close a request, and stale requests auto-expire after 24 hours
**Depends on**: Phase 8
**Requirements**: CONF-02, CONF-03, LIFE-01, LIFE-02
**Success Criteria** (what must be TRUE):

  1. Entering a valid 5-char code on the confirmation screen (for a donor who is a 'responding' participant) creates a donations row and increments donation_count and units_collected on the request; an invalid code or non-participant code shows an error
  2. When units_collected reaches units_needed after a confirmation, the request status is set to 'fulfilled' and closed_at is set; the donor sees the congrats screen triggered by a Realtime event on their new donations row
  3. The requester resolving the request writes status + closed_at per the D-01 mapping: the "got it outside the app" path writes status='fulfilled' (the need was met), and the "no longer needed" path writes status='cancelled' (revised from the original wording per CONTEXT D-01)
  4. The scheduled Edge Function (or pg_cron) sets status='expired' for any blood_requests where expires_at < now() and status='active'; dummy seed data exists to verify this behavior without waiting 24 hours

**Plans**: 3 plans

Plans:

**Wave 1**

- [x] 09-01-PLAN.md — [BLOCKING] Schema foundation via Supabase MCP: confirm_donation RPC, donations unique constraint + Realtime publication, blood_requests.extended column, pg_cron auto-expiry + dummy-seed verification, type regen (CONF-02, CONF-03, LIFE-02)

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 09-02-PLAN.md — RequestLive wiring: real confirm RPC, react-zxing QR scanner + camera permission, honest closed copy, resolve DB-write callback, extend banner (CONF-02, LIFE-01)

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 09-03-PLAN.md — App.tsx + Home: app-wide donations Realtime congrats takeover + check-on-open, handleResolveClosed, extend +12h once, extend banner wiring (CONF-03, LIFE-01)

## Progress

**Execution Order:**
v1.0 phases complete. v2.0 executes: 6 → 7 → 8 → 9

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Celebration Screens | v1.0 | TBD | Complete | 2026-06-20 |
| 2. Home Dashboard | v1.0 | TBD | Complete | 2026-06-20 |
| 3. Request Session | v1.0 | TBD | Complete | 2026-06-20 |
| 4. Confirmation Flow | v1.0 | TBD | Complete | 2026-06-20 |
| 5. Screen Refreshes | v1.0 | TBD | Complete | 2026-06-20 |
| 6. Foundation | v2.0 | 6/6 | Complete | 2026-06-21 |
| 7. Data Persistence + Geo-Matching | v2.0 | 4/4 | Complete   | 2026-06-21 |
| 8. Donor Response + Realtime | v2.0 | 3/3 | Complete   | 2026-06-22 |
| 9. Confirmation + Lifecycle | v2.0 | 3/3 | Complete | 2026-06-24 |
