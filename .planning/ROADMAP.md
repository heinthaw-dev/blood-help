# Roadmap: Blood Help

## Overview

Blood Help ships as a 9-phase MVP ordered for screen-first, demoable-per-phase delivery. Phase 1 locks the two irrevocable architectural decisions (session-persistent anonymous identity and the merged service worker) alongside the dummy OTP UI. Phase 2 builds the post-login home screen hub. Phase 3 wires the blood-request form to real Supabase rows. Phase 4 builds the donor registration form and profile. Phase 5 registers FCM device tokens and gates the iOS install flow. Phase 6 establishes the full blood-compatibility data model, availability fields, and matching RPC — the prerequisite for any query that selects donors. Phase 7 wires the serverless push trigger to complete the core emergency loop. Phase 8 closes the loop with donor response, requester fulfilment, the two-sided donation handshake, and the live realtime donor-discovery list. Phase 9 applies bilingual localization (Burmese default, English toggle, Noto Sans Myanmar web font). Every phase delivers a demoable on-screen capability wired to real Supabase data where possible; only capabilities genuinely owned by a later phase are stubbed.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Auth / Login** - Dummy phone-OTP flow, session-persistent Supabase anonymous identity, installable PWA shell, and single merged service worker
- [ ] **Phase 2: Home Screen** - Post-login hub where user chooses to request blood or donate; shows donor 60-day eligibility countdown wired to real data
- [ ] **Phase 3: Request Blood Form** - Requester creates a blood request (blood type + live GPS + callback phone) saved as a real Supabase row; one-open-request limit and 24h auto-expiry enforced
- [ ] **Phase 4: Donor Register Form** - Donor registration screen (display name, blood type, callback phone, hide-phone toggle, availability opt-in) saved to real Supabase profile
- [ ] **Phase 5: FCM Push Token & Install** - FCM device-token registration and refresh, stale-token pruning, iOS/A2HS install gate, in-app fallback list skeleton
- [ ] **Phase 6: Profiles, Availability & Matching Data** - Remaining availability/profile fields, 64-cell directional blood-compatibility matrix (tested), PostGIS matching RPC with RLS
- [ ] **Phase 7: Core Emergency Loop** - Serverless push trigger: blood_requests INSERT → DB webhook → notify-donors Edge Function → FCM HTTP v1 per-token fan-out
- [ ] **Phase 8: Donor Response & Live Discovery** - Respond action, direct call, requester fulfilled, two-sided donation handshake, Realtime live donor list with auto-expanding display radius
- [ ] **Phase 9: Localization** - Bilingual EN/Burmese UI, Noto Sans Myanmar web font, E.164 phone normalization

## Phase Details

### Phase 1: Auth / Login
**Goal**: A visitor can open the app, enter a phone number on the Phone Entry screen, wait ~3 seconds and see an OTP auto-fill, and be taken to the home screen — establishing a single unified login (donor vs. requester are actions chosen later, not account types) backed by a stable Supabase anonymous identity that survives reloads. The installable PWA shell and single merged service worker are scaffolded here as an irrevocable architecture decision.
**Mode:** mvp
**Depends on**: Nothing (first phase)
**Requirements**: AUTH-01, AUTH-02, AUTH-03, PWA-01, PWA-02
**Success Criteria** (what must be TRUE):
  1. User opens the app, enters a phone number, waits ~3 seconds, sees an OTP auto-fill, and is taken to the home screen — no real SMS sent, no separate donor vs. requester login exists
  2. The same user UUID is present in Supabase `auth.users` on every subsequent page reload and browser restart (localStorage session reused; `signInAnonymously()` is called only when `getSession()` returns null)
  3. The app passes the browser's PWA installability check (manifest present, service worker registered) and an install prompt is triggerable
  4. A single service worker file compiled by `vite-plugin-pwa injectManifest` is registered at root scope — no second `firebase-messaging-sw.js` exists at any scope; FCM `onBackgroundMessage` slot is reserved in the SW even though FCM token logic ships in Phase 5
**Plans**: TBD
**UI hint**: yes

### Phase 2: Home Screen
**Goal**: After login the user lands on a home screen that acts as the hub for all actions — they can choose to post a blood request or register/act as a donor from here. The screen shows the donor's remaining 60-day waiting-period countdown wired to real profile data. Donor counts and matching-derived stats that later phases own are stubbed with placeholder UI.
**Mode:** mvp
**Depends on**: Phase 1
**Requirements**: DON-06
**Success Criteria** (what must be TRUE):
  1. After completing the OTP flow the user is taken to the home screen where two clear action paths are visible: "Request Blood" and "Donate / Be a Donor"
  2. A user whose profile has a `last_donated_at` value sees an accurate countdown (days remaining) to their next eligible donation date; a user with no prior donation sees an "eligible now" or first-time donor state
  3. Tapping "Request Blood" navigates to the request form (Phase 3 screen, may be a stub at this phase); tapping the donor path navigates to the donor registration/profile screen (Phase 4 screen, may be a stub at this phase)
**Plans**: TBD
**UI hint**: yes

### Phase 3: Request Blood Form
**Goal**: A logged-in user can fill out and submit the blood-request form — selecting blood type, capturing live GPS at creation, providing their callback phone — and the submission saves a real `blood_requests` row in Supabase with RLS enforced. The one-open-request limit and 24h auto-expiry are enforced server-side; the push fan-out and donor matching are stubbed until Phase 7.
**Mode:** mvp
**Depends on**: Phase 1
**Requirements**: REQ-01, REQ-02, REQ-03, REQ-04, REQ-05, REQ-06
**Success Criteria** (what must be TRUE):
  1. User selects a blood type and taps submit; a real row appears in `blood_requests` with the correct blood type, a GPS coordinate captured at the moment of submission, and the user's callback phone number
  2. A user who already has an open request cannot submit a second one; the form shows an appropriate blocking message instead
  3. A blood request row automatically transitions to `status = 'expired'` after 24 hours (via Supabase scheduled job or `pg_cron`); the user who created an expired request sees a re-post prompt when they view the request
  4. RLS prevents any other user from reading or modifying the request row directly via the anon key; raw GPS coordinates are never returned to the client by any query
**Plans**: TBD
**UI hint**: yes

### Phase 4: Donor Register Form
**Goal**: A user can complete the donor registration screen — providing a required display name, selecting blood type, entering a callback phone, toggling the hide-phone privacy option, and opting in to availability — and all fields persist to their real Supabase profile row. The availability toggle sets `is_available` on the profile.
**Mode:** mvp
**Depends on**: Phase 1
**Requirements**: AUTH-04, AUTH-05, AUTH-06, DON-01, DON-05
**Success Criteria** (what must be TRUE):
  1. A user who completes the donor register form sees their display name, blood type (one of 8 ABO/Rh values), and callback phone persisted on their profile row across sessions
  2. The hide-phone privacy toggle persists; when `show_phone = false` the donor's phone number is not shown in any donor-list context visible to other users
  3. The availability opt-in checkbox/toggle sets `is_available = true` on the profile; the home screen reflects the current availability state after registration
  4. Submitting the form without a display name is blocked with a validation message — display name is required
**Plans**: TBD
**UI hint**: yes

### Phase 5: FCM Push Token & Install
**Goal**: The installed PWA registers and stores a real FCM device token on every app open; the iOS standalone-mode gate prevents silent push failure; the Add-to-Home-Screen prompt is shown; users who have not installed the PWA see an in-app fallback list skeleton of nearby open requests. Push token infrastructure is in place so Phase 7 can send real notifications without touching this layer.
**Mode:** mvp
**Depends on**: Phase 1
**Requirements**: PUSH-02, PUSH-05, PWA-03, PWA-04, PWA-05
**Success Criteria** (what must be TRUE):
  1. After installing the PWA and opening the app, a valid FCM token row exists in `device_tokens` for the current user's `auth.uid()`
  2. On every subsequent app open the token is upserted (refreshed); when FCM returns a 404 or 400 the stale token row is deleted from `device_tokens`
  3. On iOS Safari the A2HS install prompt is shown before push registration is attempted; `getToken()` is never called when `display-mode` is not `standalone`
  4. A user who has not installed the PWA sees an in-app list skeleton (empty state or stubbed data) of nearby open blood requests they can interact with without push
**Plans**: TBD
**UI hint**: yes

### Phase 6: Profiles, Availability & Matching Data
**Goal**: Remaining donor profile and availability fields are wired (availability-off toggling, last_donated_at, 60-day reminder text, eligible-only donor list filter). The directional ABO/Rh blood-compatibility matrix is seeded as a tested Supabase lookup table with all 64 unit-test cells passing before any migration runs. The PostGIS `find_compatible_donors` RPC is created with RLS, returning distance only — no raw coordinates, no phone numbers — and is load-tested with `EXPLAIN ANALYZE`. This phase is the prerequisite gate for Phase 7.
**Mode:** mvp
**Depends on**: Phase 4
**Requirements**: DON-02, DON-03, DON-04, DON-07, MATCH-01, MATCH-02, MATCH-03, MATCH-04
**Success Criteria** (what must be TRUE):
  1. The `blood_compatibility` lookup table passes all 64 directional unit-test cells (O− donor → AB+ is a match; AB+ donor → O− is not a match); tests run in CI before the migration is applied
  2. The `find_compatible_donors` RPC returns only `distance_m` and `user_id` to clients — no raw lat/lon, no phone numbers — and a direct `SELECT` of location columns via the anon key is blocked by RLS
  3. Only donors with `is_available = true` AND `last_donated_at` more than 60 days ago (or null) appear in the eligible donor list (DON-07); donors within their waiting period are filtered out
  4. When a user turns availability on the soft cooldown reminder text is shown (DON-03); the `last_donated_at` field is stored and displayed on the profile (DON-04)
  5. `ST_DWithin` query with GiST index runs in under 200 ms on a representative dataset; verified with `EXPLAIN ANALYZE` output
**Plans**: TBD
**UI hint**: yes

### Phase 7: Core Emergency Loop
**Goal**: Posting a blood request now triggers a real FCM push notification to matched nearby donors — the end-to-end emergency loop is wired and validated on a physical device. The serverless chain is: `blood_requests` INSERT → Supabase Database Webhook → `notify-donors` Deno Edge Function → FCM HTTP v1 per-token fan-out. Donors who are fulfilled or expired are excluded. The request rows created in Phase 3 now actually alert donors.
**Mode:** mvp
**Depends on**: Phase 5, Phase 6
**Requirements**: PUSH-01, PUSH-03, PUSH-04
**Success Criteria** (what must be TRUE):
  1. Within seconds of a blood request INSERT, a matched donor's physical device (PWA closed) receives a real OS push notification via FCM HTTP v1
  2. The push delivery path is fully serverless: Database Webhook fires the Edge Function; the Edge Function runs the match RPC, fetches FCM tokens, signs an OAuth2 token from Firebase service account stored in Supabase secrets, and sends one POST per token
  3. Donors whose matched request has `status = 'fulfilled'` or `status = 'expired'` at the time of fanout do not receive a push notification
**Plans**: TBD

### Phase 8: Donor Response & Live Discovery
**Goal**: An alerted donor can tap "I'm responding" and call the requester; the requester sees a live, distance-sorted donor list that updates in real time via Supabase Realtime; the two-sided donation handshake (donor taps "Donated" + requester taps "Got help") closes the loop and increments the donor's lifetime donation count. The full Live Donor Discovery is also wired: live distance-sorted list seeded from the DISPLAY radius, auto-expanding 10→20→30 km, realtime inserts, foreground-only location refresh on notification tap.
**Mode:** mvp
**Depends on**: Phase 7
**Requirements**: RESP-01, RESP-02, RESP-03, RESP-04, RESP-05, RESP-06, DISC-01, DISC-02, DISC-03, DISC-04, DISC-05, DISC-06, DISC-07
**Success Criteria** (what must be TRUE):
  1. A donor who taps "I'm responding" appears pinned at the top of the requester's live donor list with a `tel:` call-back link; the requester's view updates without a page refresh via Supabase Realtime
  2. On notification tap the app opens (foreground), captures the donor's current GPS, writes it to Supabase as the donor's new last-known location, and realtime-inserts the donor into the requester's list if now within the DISPLAY radius
  3. The requester's donor list is pre-seeded immediately on request creation (no empty waiting state); if fewer than `MIN_DISPLAY_DONORS` donors are shown, the DISPLAY radius auto-expands 10 → 20 → 30 km (never exceeding ALERT radius)
  4. A donor's phone number is visible in the list only if `show_phone = true` OR the donor has submitted a response; raw GPS coordinates are never present in any client payload
  5. The donation handshake requires both sides: requester taps "Got help" AND donor taps "Donated"; only when both actions are recorded is the donation counted and the donor's lifetime donation count incremented by 1
  6. The requester tapping "Got help" sets `status = 'fulfilled'` and stops any further FCM alerts for that request
**Plans**: TBD
**UI hint**: yes

### Phase 9: Localization
**Goal**: Every user-visible string is available in both Burmese (default) and English; Burmese text renders via the Noto Sans Myanmar web font regardless of OS; phone numbers are stored and displayed in E.164 format throughout the app.
**Mode:** mvp
**Depends on**: Phase 8
**Requirements**: LOC-01, LOC-02, LOC-03
**Success Criteria** (what must be TRUE):
  1. A user can toggle between Burmese and English from the app; the default language on first open is Burmese regardless of the device's OS language setting
  2. Burmese text in the app renders in Noto Sans Myanmar (not the OS default) on a Zawgyi-system Android device — glyphs are readable, not garbled
  3. All phone numbers entered through the app are stored and displayed in E.164 format (e.g. +959xxxxxxxx); Zawgyi input is detected and converted before storage
**Plans**: TBD
**UI hint**: yes

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Auth / Login | 0/TBD | Not started | - |
| 2. Home Screen | 0/TBD | Not started | - |
| 3. Request Blood Form | 0/TBD | Not started | - |
| 4. Donor Register Form | 0/TBD | Not started | - |
| 5. FCM Push Token & Install | 0/TBD | Not started | - |
| 6. Profiles, Availability & Matching Data | 0/TBD | Not started | - |
| 7. Core Emergency Loop | 0/TBD | Not started | - |
| 8. Donor Response & Live Discovery | 0/TBD | Not started | - |
| 9. Localization | 0/TBD | Not started | - |
