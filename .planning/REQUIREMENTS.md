# Requirements: Blood Help

**Defined:** 2026-06-20
**Core Value:** A person can post a blood request and have nearby, blood-compatible donors actually receive a push alert and call them back — turning an hours-long search into help within minutes.

## v1 Requirements

Requirements for this milestone. All UI screens — no backend wiring. Each maps to roadmap phases.

### Celebration

- [ ] **CELE-01**: User sees a heart-warming thank-you screen after completing donor registration
- [ ] **CELE-02**: Donor sees a congratulations celebration screen after donation is confirmed via QR/code

### Home

- [ ] **HOME-01**: User sees a Home/Dashboard screen with nearby blood requests feed (static/placeholder data)
- [ ] **HOME-02**: Home screen integrates bottom navigation (Profile, Home, Leaderboard)

### Request Session

- [ ] **SESS-01**: Requester sees a request-live screen with header (blood type, township), transparency line ("We've alerted [X] nearby donors"), and donor list layout (Will help / Can call / + N more states)
- [ ] **SESS-02**: Requester can close/resolve a request with "Did you get blood from the app or outside?" flow leading to appropriate outcomes

### Confirmation

- [ ] **CONF-01**: Requester can scan a donor's QR code or type a 5-char code to confirm donation

### Screen Updates

- [ ] **UPDT-01**: Profile screen refreshed to match new Claude Design prompt
- [ ] **UPDT-02**: CreateRequest screen refreshed to match new Claude Design prompt

## v2 Requirements

Deferred to future milestone. Tracked but not in current roadmap.

### Backend Integration

- **BACK-01**: Supabase schema deployed (profiles, blood_requests, request_responses, donations, device_tokens)
- **BACK-02**: Row-Level Security policies for all tables
- **BACK-03**: Supabase anonymous auth (signInAnonymously) replacing dummy localStorage auth
- **BACK-04**: PostGIS geo-distance matching (ST_DWithin RPC)

### Push Notifications

- **PUSH-01**: Firebase Cloud Messaging integration with merged service worker
- **PUSH-02**: FCM token registration and storage in device_tokens table
- **PUSH-03**: Donor alert push on new blood request (compatible + nearby + available)
- **PUSH-04**: Requester notification when donor responds

### Donor Interaction

- **DNOR-01**: Donor response flow ("I'll help" button on request cards)
- **DNOR-02**: Real-time donor list updates on request-live screen (Supabase Realtime)
- **DNOR-03**: Resolution notices to responding donors on request close

### Data & Privacy

- **PRIV-01**: Personal data purge on request close (location, phone, responder rows)
- **PRIV-02**: Gated, logged, rate-limited phone number reveal
- **PRIV-03**: Coarsened location storage (never raw GPS to clients)

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Real SMS OTP | Requires Twilio; dummy OTP sufficient for v1 demo |
| Call masking / telephony proxy | v2 feature; direct call sufficient for v1 |
| One-time request-scoped QR codes | v2; static QR + participant-only crediting for v1 |
| SMS fallback for push | v2; FCM-only (itself deferred to backend milestone) |
| Background location tracking | PWA cannot read location in background; by design |
| Native mobile app | Web-first PWA approach; native later if needed |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| CELE-01 | Phase 1 | Pending |
| CELE-02 | Phase 1 | Pending |
| HOME-01 | Phase 2 | Pending |
| HOME-02 | Phase 2 | Pending |
| SESS-01 | Phase 3 | Pending |
| SESS-02 | Phase 3 | Pending |
| CONF-01 | Phase 4 | Pending |
| UPDT-01 | Phase 5 | Pending |
| UPDT-02 | Phase 5 | Pending |

**Coverage:**
- v1 requirements: 9 total
- Mapped to phases: 9
- Unmapped: 0

---
*Requirements defined: 2026-06-20*
*Last updated: 2026-06-20 — traceability filled after roadmap creation*
