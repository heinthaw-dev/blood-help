# Requirements: Blood Help

**Defined:** 2026-06-20
**Updated:** 2026-07-01 — v2.0 complete (all 15 requirements shipped); PUSH-01–04 pulled forward from v3.0 and shipped via quick tasks
**Core Value:** A person can post a blood request and have nearby, blood-compatible donors actually receive a push alert and call them back — turning an hours-long search into help within minutes.

## v2.0 Requirements (Current Milestone — Backend Core)

Requirements for the backend core milestone. Full data layer, anonymous auth, geo-matching, donor response, real-time, and request lifecycle. FCM push deferred to v3.0.

### Schema & Infrastructure

- [x] **BACK-01**: Supabase schema deployed — PostGIS extension enabled; all 5 enums (blood_type, request_status, response_status, urgency, lang) and 5 tables (profiles, device_tokens, blood_requests, request_responses, donations) created with all constraints per blood-help-spec.md §4; applied via Supabase MCP migrations
- [x] **BACK-02**: Row-Level Security policies enabled on all tables; users can read/write their own profile; requests visible to nearby compatible donors; responses and donations visible only to the two parties involved; donor phone never exposed directly (per spec §4.3)
- [x] **BACK-04**: PostGIS `ST_DWithin` RPC function created and callable from the React client for geo-distance donor and request queries

### Authentication & Persistence

- [x] **BACK-03**: `signInAnonymously()` called silently when user submits the OTP screen; user gets a real Supabase session with a UUID; phone number stored as a field in profiles (not used for auth verification)
- [x] **BACK-05**: Donor profile setup form writes to `profiles` table (name, blood_type, township, is_donor=true, is_available, emergency_callable, lat/lng coarsened); subsequent visits load and update the existing profile row
- [x] **BACK-06**: Blood request creation form writes to `blood_requests` table with expires_at = now()+24h; one-open-request-per-user unique index enforced (user sees error if they try to open a second active request)

### Geo-Matching

- [x] **GEO-01**: Blood type directional compatibility implemented in code (per spec §3.1 table) — queries filter donors whose blood type can donate into the requested type, not exact-match only
- [x] **GEO-02**: Home feed queries real active `blood_requests` from DB within `DISPLAY_RADIUS_KM` (default 10km) of the current user's last-known location; requests shown are real data, not static placeholders

### Donor Response

- [x] **DNOR-01**: "I'll help" button on home feed request cards creates a `request_responses` row (status = 'responding') for the current donor; button disabled/hidden if donor already responded
- [x] **DNOR-02**: Request-live screen subscribes to `request_responses` for the active request via Supabase Realtime; donor list (Will Help / Can Call states) updates live when donors respond without requiring a page refresh

### Confirmation & Lifecycle

- [x] **CONF-02**: QR scan / 5-char code entry on the confirmation screen validates that the donor is a 'responding' participant on this request (anti-fraud per spec §4.2), then creates a `donations` row and increments `donation_count`, sets `last_donation_date`, increments `units_collected` on the request
- [x] **CONF-03**: After each donation confirmation, if `units_collected >= units_needed`, request `status` is set to 'fulfilled' and `closed_at` is set; donor sees the congrats screen (triggered by Supabase Realtime subscription on their own new `donations` row)
- [x] **LIFE-01**: Request close action (requester taps "Mark as fulfilled" / resolve flow) writes `status = 'cancelled'` and `closed_at` to `blood_requests`; "outside" and "inside" resolution paths handled correctly per spec §2.3 step 6
- [x] **LIFE-02**: Scheduled Edge Function (or pg_cron) runs periodically and sets `status = 'expired'` for all `blood_requests` where `expires_at < now()` and `status = 'active'`; dummy data seeded via Supabase MCP for development and testing

### Privacy

- [x] **PRIV-03**: All location data coarsened before writing to DB — lat/lng rounded to ~4 decimal places (~11m resolution, effectively ~1km grid); raw GPS coordinates from `navigator.geolocation` are never stored or sent to clients

## v3.0 Requirements (Push + Advanced Privacy)

**Status (2026-07-01):** FCM push (PUSH-01–04) was pulled forward and shipped early via quick tasks during v2.0 — the request → donor → requester push loop is live end-to-end. Three items remain unbuilt: DNOR-03, PRIV-01, and the logging/rate-limit half of PRIV-02.

### Push Notifications

- [x] **PUSH-01**: Firebase Cloud Messaging integration with merged service worker *(shipped: quick 260625-v8m, commit 9df03ea — src/firebase-messaging-sw.js, manifest.webmanifest)*
- [x] **PUSH-02**: FCM device token written to `device_tokens` table on service worker registration *(shipped: src/lib/push.ts)*
- [x] **PUSH-03**: FCM push sent to nearby compatible available donors when a new blood request is posted (geo-match + blood type match + is_available = true) *(shipped: notify-donors edge fn, invoked App.tsx:590)*
- [x] **PUSH-04**: FCM push sent to requester when a donor responds ("I'll help") *(shipped: notify-requester edge fn, invoked App.tsx:643)*
- [ ] **DNOR-03**: Resolution FCM notice sent to 'responding' donors when request closes (so no one travels for nothing) — **not started** (no notify-close edge function)

### Privacy (Advanced)

- [ ] **PRIV-01**: Personal data purge on request close — location, contact_phone, and request_responses rows deleted; only the minimal `donations` record kept — **not started**
- [ ] **PRIV-02**: Donor phone number reveal is gated — only shown on explicit "reveal" tap, logged, rate-limited; only applies to emergency_callable donors or those who responded — **partial**: gating/masking shipped (src/components/IncomingRequestAlert.tsx); logging + rate-limiting not built

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Real SMS OTP via Twilio | Deferred to v4; anonymous session sufficient through v3 |
| i18n library (react-i18next) | Not blocking backend; inline bilingual strings sufficient |
| One-time request-scoped QR codes | v4; participant-only 5-char code crediting for v2/v3 |
| Call masking / telephony proxy | v4+; direct call sufficient for v1/v2 |
| SMS fallback for push | v4; FCM-only for v3 |
| OAuth or social login | Not relevant to this domain |
| Admin panel / moderation tools | Out of scope for non-profit MVP |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| BACK-01 | Phase 6 | Complete |
| BACK-02 | Phase 6 | Complete |
| BACK-03 | Phase 6 | Complete |
| BACK-04 | Phase 6 | Complete |
| PRIV-03 | Phase 6 | Complete |
| BACK-05 | Phase 7 | Complete |
| BACK-06 | Phase 7 | Complete |
| GEO-01 | Phase 7 | Complete |
| GEO-02 | Phase 7 | Complete |
| DNOR-01 | Phase 8 | Complete |
| DNOR-02 | Phase 8 | Complete |
| CONF-02 | Phase 9 | Complete |
| CONF-03 | Phase 9 | Complete |
| LIFE-01 | Phase 9 | Complete |
| LIFE-02 | Phase 9 | Complete |

**Coverage:**
- v2.0 requirements: 15 total
- Mapped to phases: 15 (Phase 6: 5, Phase 7: 4, Phase 8: 2, Phase 9: 4)
- Unmapped: 0

---
*Requirements defined: 2026-06-20*
*Last updated: 2026-07-01 — v2.0 marked complete; v3.0 status synced to code (PUSH-01–04 shipped early, DNOR-03/PRIV-01/PRIV-02 remain)*
