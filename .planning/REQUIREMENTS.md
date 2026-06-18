# Requirements: Blood Help

**Defined:** 2026-06-19
**Core Value:** A person can post a blood request and have nearby, blood-compatible donors actually receive a push alert and call them back — turning an hours-long search into help within minutes.

## v1 Requirements

Requirements for initial release. Each maps to roadmap phases.

### Identity & Auth (dummy)

- [ ] **AUTH-01**: User has a single unified profile; "request blood" and "donate" are actions, not separate account types
- [ ] **AUTH-02**: User signs in via a dummy phone-OTP flow — enters phone, sees an OTP screen, and a randomly-generated OTP auto-fills after ~3 seconds (no real SMS / verification)
- [ ] **AUTH-03**: The dummy auth establishes a stable, session-persistent identity (same user id survives reloads) so ownership and tokens stay consistent
- [ ] **AUTH-04**: User can set their blood type (one of 8 ABO/Rh values) on their profile
- [ ] **AUTH-05**: User can set/store their callback phone number on their profile
- [ ] **AUTH-06**: User provides a display name at registration (required; used in donor and responder lists)

### Donor Availability

- [ ] **DON-01**: User can toggle "available to donate" on/off from the home screen (opt-in, default off)
- [ ] **DON-02**: Only users who are toggled available receive donor alerts
- [ ] **DON-03**: When a user turns availability on, a soft cooldown reminder ("wait ~60 days between donations") is shown (text only, not enforced)
- [ ] **DON-04**: Profile stores a `last_donated_at` value (data only, displayed; no enforcement)
- [ ] **DON-05**: Donor can set a "hide my phone number in the donor list" privacy toggle (at registration or in profile settings). When on, their number is hidden from the public/requester donor list. This is asymmetric: a donor who received a request notification can still call the requester directly — the requester's number is never hidden from a matched donor
- [ ] **DON-06**: The home screen shows the donor's remaining 60-day waiting period (countdown to when they are eligible to donate again)
- [ ] **DON-07**: The public donor list shows only donors who are eligible to donate again (last donation 60+ days ago); donors still within their waiting period are hidden

### Blood Requests

- [ ] **REQ-01**: User can create a blood request specifying the blood type needed
- [ ] **REQ-02**: A blood request captures the requester's live GPS location at creation
- [ ] **REQ-03**: A blood request uses the requester's callback phone number
- [ ] **REQ-04**: A user can have only one open blood request at a time (anti-spam rate limit)
- [ ] **REQ-05**: A blood request auto-expires after 24 hours
- [ ] **REQ-06**: When a request expires, the requester is prompted to re-post

### Matching

- [ ] **MATCH-01**: Matching uses the full directional ABO/Rh blood-compatibility matrix (e.g. O− donor matches all recipient types)
- [ ] **MATCH-02**: Matching restricts donors by GPS distance from the request, using two distinct parameterized radii: an ALERT radius (who receives the push) and a DISPLAY radius (who appears on the requester's live list), where DISPLAY ≤ ALERT (see Live Donor Discovery)
- [ ] **MATCH-03**: Matching only includes donors who are currently available to donate
- [ ] **MATCH-04**: Matching never exposes other users' raw GPS coordinates to the client. All distances are computed server-side; location is stored coarsened (rounded / grid-snapped). A donor's phone is never sent to the client unless gated by DISC-06

### Live Donor Discovery

> Refines MATCH-02; uses MATCH-01/03/04, RESP-01/03/05, PUSH-01/03.
>
> **HARD CONSTRAINT:** A PWA cannot read a donor's location in the background. Donor location is always "last-known," refreshed only in the foreground — on app open, on toggling availability on, on tapping a push, or via a manual "update my area." The requester's location is captured live at request creation (REQ-02). No background or continuous donor tracking.

- [ ] **DISC-01**: On request creation, send ONE broad FCM push to every donor who is blood-compatible (MATCH-01), available (MATCH-03), and whose last-known location is within the ALERT radius of the request's live GPS. Not expanding waves
- [ ] **DISC-02**: The requester immediately sees a live donor list, pre-seeded from available compatible donors whose last-known location is within the initial DISPLAY radius, sorted by ascending distance (never an empty list while waiting)
- [ ] **DISC-03**: If fewer than `MIN_DISPLAY_DONORS` are in the current display radius, the DISPLAY radius auto-expands in steps (10 → 20 → 30 km); DISPLAY radius never exceeds ALERT radius
- [ ] **DISC-04**: The donor list updates via a Supabase Realtime subscription (event-driven, no polling); new matches insert without a manual refresh
- [ ] **DISC-05**: On notification tap, the app opens (foreground), captures current GPS, writes it to Supabase as the donor's new last-known location, re-evaluates against the active request, and realtime-inserts the donor into the requester's list if now in range
- [ ] **DISC-06**: A list item shows donor name + approximate distance only. The donor's phone is revealed only if that donor's `show_phone = true` OR that donor has submitted a response (RESP-01). No raw coordinates are ever sent to the client (MATCH-04)
- [ ] **DISC-07**: Ordering — donors who responded (RESP-01) are pinned at the top with a `tel:` call action; other available nearby donors appear below by ascending distance

### Push Alerts (Firebase Cloud Messaging)

- [ ] **PUSH-01**: Matching donors receive a real push notification when a compatible nearby request is created, even when the PWA is not open
- [ ] **PUSH-02**: A user's FCM device token is registered/refreshed and stored against their profile on app open
- [ ] **PUSH-03**: Push delivery is triggered serverlessly (blood request insert → Supabase webhook → Edge Function → FCM), with no custom backend
- [ ] **PUSH-04**: Donors are not alerted for requests that are already fulfilled or expired
- [ ] **PUSH-05**: Stale/invalid device tokens are pruned so failed pushes don't accumulate

### Response & Resolution

- [ ] **RESP-01**: An alerted donor can tap "I'm responding" to signal they are helping
- [ ] **RESP-02**: A responding donor can call the requester directly (tel: link to the callback phone)
- [ ] **RESP-03**: The requester sees the list of donors who responded, showing donor name, and phone only when DISC-06 permits (donor has `show_phone = true` or has responded)
- [ ] **RESP-04**: The requester can tap "Got help" on a request, which stops all further alerts (marks the request fulfilled) and serves as the requester's half of the donation handshake
- [ ] **RESP-05**: Responses update in near-real-time for the requester (Supabase Realtime)
- [ ] **RESP-06**: A donation is only counted on a two-sided handshake — the donor taps "Donated" AND the requester taps "Got help" (RESP-04). When both occur, the donation is marked "all done" (congrats shown to the donor) and the donor's lifetime donation count increments by 1, shown on the donor's profile. One side alone does not count the donation

### PWA & Install

- [ ] **PWA-01**: The app is an installable PWA (web manifest + service worker)
- [ ] **PWA-02**: A single merged service worker handles both offline/precache and FCM background messages
- [ ] **PWA-03**: The app prompts the user to "Add to Home Screen" to enable push
- [ ] **PWA-04**: FCM push is gated to installed/standalone mode where required (iOS); push registration does not silently fail
- [ ] **PWA-05**: Users who don't install get an in-app fallback list of nearby open requests they can respond to

### Localization

- [ ] **LOC-01**: The UI is available in both Burmese and English, with Burmese (Myanmar) as the default; the user can toggle to English
- [ ] **LOC-02**: Burmese text renders correctly via the Noto Sans Myanmar web font (not OS fallback)
- [ ] **LOC-03**: Phone numbers are normalized to a consistent format (E.164)

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Real Auth

- **V2-AUTH-01**: Real phone-OTP verification via an SMS provider
- **V2-AUTH-02**: Account recovery / cross-device identity

### Donor Eligibility

- **V2-DON-01**: Enforced 60-day donation cooldown based on verified donation history

### Engagement

- **V2-ENG-01**: In-app messaging/chat between donor and requester
- **V2-ENG-02**: Donor gamification (streaks, badges)
- **V2-ENG-03**: Hospital / blood-bank integration

## Configuration Parameters

Discovery/matching radii are parameterized (not hardcoded). Tunable without code changes.

| Parameter | Default | Purpose |
|-----------|---------|---------|
| `ALERT_RADIUS_KM` | 25 | Broad radius — who receives the FCM push (DISC-01) |
| `DISPLAY_RADIUS_KM` | 10 (expands 10→20→30) | Who appears on the requester's live list (DISC-02/03); never exceeds `ALERT_RADIUS_KM` |
| `MIN_DISPLAY_DONORS` | 5 | Threshold below which the display radius auto-expands (DISC-03) |
| `DONATION_WAITING_DAYS` | 60 | Soft cooldown reminder, home-screen countdown, donor-list eligibility (DON-03/06/07) |

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Real SMS OTP verification | Auth is intentionally a dummy UI flow for v1 (auto-filled OTP) |
| Custom backend server | Supabase (data) + Firebase (push) only; no bespoke API tier |
| Exact-blood-type-only matching | Replaced by the full directional compatibility matrix |
| Township-only (non-GPS) matching | v1 uses real GPS distance radius |
| Background / continuous donor location tracking | A PWA cannot read location in the background; donor location is foreground "last-known" only |
| Expanding-wave alert pushes | A single broad ALERT-radius push is sent, not staged waves (DISC-01) |
| In-app chat / messaging | The response channel is a phone call |
| Native iOS / Android apps | PWA only for v1 |
| Enforced donation cooldown | Dummy auth can't verify donation history; v1 reminder is soft text only |

## Traceability

Which phases cover which requirements. Updated during roadmap revision 2026-06-19.

| Requirement | Phase | Status |
|-------------|-------|--------|
| AUTH-01 | Phase 1 | Pending |
| AUTH-02 | Phase 1 | Pending |
| AUTH-03 | Phase 1 | Pending |
| PWA-01 | Phase 1 | Pending |
| PWA-02 | Phase 1 | Pending |
| DON-06 | Phase 2 | Pending |
| REQ-01 | Phase 3 | Pending |
| REQ-02 | Phase 3 | Pending |
| REQ-03 | Phase 3 | Pending |
| REQ-04 | Phase 3 | Pending |
| REQ-05 | Phase 3 | Pending |
| REQ-06 | Phase 3 | Pending |
| AUTH-04 | Phase 4 | Pending |
| AUTH-05 | Phase 4 | Pending |
| AUTH-06 | Phase 4 | Pending |
| DON-01 | Phase 4 | Pending |
| DON-05 | Phase 4 | Pending |
| PUSH-02 | Phase 5 | Pending |
| PUSH-05 | Phase 5 | Pending |
| PWA-03 | Phase 5 | Pending |
| PWA-04 | Phase 5 | Pending |
| PWA-05 | Phase 5 | Pending |
| DON-02 | Phase 6 | Pending |
| DON-03 | Phase 6 | Pending |
| DON-04 | Phase 6 | Pending |
| DON-07 | Phase 6 | Pending |
| MATCH-01 | Phase 6 | Pending |
| MATCH-02 | Phase 6 | Pending |
| MATCH-03 | Phase 6 | Pending |
| MATCH-04 | Phase 6 | Pending |
| PUSH-01 | Phase 7 | Pending |
| PUSH-03 | Phase 7 | Pending |
| PUSH-04 | Phase 7 | Pending |
| RESP-01 | Phase 8 | Pending |
| RESP-02 | Phase 8 | Pending |
| RESP-03 | Phase 8 | Pending |
| RESP-04 | Phase 8 | Pending |
| RESP-05 | Phase 8 | Pending |
| RESP-06 | Phase 8 | Pending |
| DISC-01 | Phase 8 | Pending |
| DISC-02 | Phase 8 | Pending |
| DISC-03 | Phase 8 | Pending |
| DISC-04 | Phase 8 | Pending |
| DISC-05 | Phase 8 | Pending |
| DISC-06 | Phase 8 | Pending |
| DISC-07 | Phase 8 | Pending |
| LOC-01 | Phase 9 | Pending |
| LOC-02 | Phase 9 | Pending |
| LOC-03 | Phase 9 | Pending |

**Coverage:**
- v1 requirements: 49 total
- Mapped to phases: 49
- Unmapped: 0 ✓

---
*Requirements defined: 2026-06-19*
*Last updated: 2026-06-19 — traceability table revised for 9-phase screen-first restructure*
