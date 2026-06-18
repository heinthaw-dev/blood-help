# Feature Research

**Domain:** Emergency blood-donor matching PWA (Myanmar audience)
**Researched:** 2026-06-19
**Confidence:** HIGH (compatibility matrix from verified medical sources; feature landscape from comparable apps + domain logic)

---

## Blood Compatibility Reference (Correctness Requirement, Not a Feature Opinion)

### ABO + Rh Red Blood Cell Compatibility Matrix

Rules (verified from hematology.org, American Cancer Society, American Red Cross):
- ABO: recipients carry antibodies against antigens they lack. A recipient with blood type A cannot receive B or AB donor blood.
- Rh: Rh-negative recipients can only receive Rh-negative blood. Rh-positive recipients can receive both.
- O- is the universal RBC donor (no A, B, or Rh antigens to react against).
- AB+ is the universal RBC recipient (carries all three antigens; no circulating antibodies against A, B, or Rh).

| Donor \ Recipient | A+ | A- | B+ | B- | AB+ | AB- | O+ | O- |
|-------------------|----|----|----|----|-----|-----|----|----|
| **O-**            | Y  | Y  | Y  | Y  | Y   | Y   | Y  | Y  |
| **O+**            | Y  | N  | Y  | N  | Y   | N   | Y  | N  |
| **A-**            | Y  | Y  | N  | N  | Y   | Y   | N  | N  |
| **A+**            | Y  | N  | N  | N  | Y   | N   | N  | N  |
| **B-**            | N  | N  | Y  | Y  | Y   | Y   | N  | N  |
| **B+**            | N  | N  | Y  | N  | Y   | N   | N  | N  |
| **AB-**           | N  | N  | N  | N  | Y   | Y   | N  | N  |
| **AB+**           | N  | N  | N  | N  | Y   | N   | N  | N  |

Read: row = donor blood type, column = recipient blood type. Y = compatible, N = incompatible.

**Summary by recipient blood type:**
| Recipient | Can receive from |
|-----------|-----------------|
| O-        | O- only |
| O+        | O-, O+ |
| A-        | O-, A- |
| A+        | O-, O+, A-, A+ |
| B-        | O-, B- |
| B+        | O-, O+, B-, B+ |
| AB-       | O-, A-, B-, AB- |
| AB+       | All 8 types (universal recipient) |

**Implementation note:** The matching query filters donor profiles where `donor.blood_type` is in the compatible-donor list for `request.blood_type`. Hard-code the 8-element compatibility sets per recipient type. Do not compute this at runtime from rules — precompute the lookup table and store it as a constant.

---

## Donor Eligibility / Cooldown Reality

For whole blood (the only type relevant to this v1 use case):
- Minimum interval between whole-blood donations: **56 days (~8 weeks)** per Red Cross / American Blood Centers standards.
- Donors who gave recently are physiologically ineligible and should not be alerted or shown as available.

**v1 decision: model cooldown as a soft availability toggle, not an enforced medical gate.**

Reasoning:
- v1 has dummy auth — we cannot verify actual donation history.
- Enforcing 56-day lockouts requires trust in self-reported data that v1 does not have.
- A donor availability toggle (on/off) is the v1 proxy: donors who recently donated manually switch themselves "unavailable."
- v1 should display a reminder prompt ("You should wait ~8 weeks between donations") when a donor marks a request as "responding" or when they toggle availability back on after marking a previous response.
- A `last_donated_at` timestamp field on the profile can be stored for future enforcement without blocking v1 ship.

---

## Request Lifecycle

States and transitions for a blood request:

```
OPEN
  ├─(donor responds)──────────────────────────────> OPEN (still active, multiple donors may respond)
  ├─(requester marks fulfilled)──────────────────> FULFILLED (terminal — no more alerts)
  ├─(auto-expiry: 24h no activity)───────────────> EXPIRED (terminal — stops alerts automatically)
  └─(requester cancels manually)─────────────────> CANCELLED (terminal)

Per-donor response states (independent of request state):
  NONE ──(donor taps "I'm responding")──> RESPONDING
  RESPONDING ──(requester marks fulfilled / request expires)──> ARCHIVED
```

**Field model for a request row:**
```
id, requester_id, blood_type, location (lat/lng), callback_phone,
status: OPEN | FULFILLED | EXPIRED | CANCELLED,
created_at, fulfilled_at, expires_at
```

**Field model for a donor response row:**
```
id, request_id, donor_id, responded_at
```

**Key behavioral rules:**
1. When `status = FULFILLED`, suppress all further FCM notifications for this request.
2. Auto-expire: a Supabase scheduled function or client-side check moves OPEN → EXPIRED after 24 hours.
3. A donor can only submit one response per request (unique constraint on `request_id + donor_id`).
4. The requester can see a list of donors who have responded (name, phone) so they can coordinate.
5. If a request expires, show the requester a prompt: "Your request expired — do you still need blood?"

---

## Donor Availability Toggle

The donor visibility to the matching engine is controlled by a boolean `is_available` field on the user profile.

**Behavioral rules:**
- Default on registration: `is_available = false` (opt-in model — donors must explicitly activate).
- Donors toggle ON to appear in the pool for future match queries.
- Donors toggle OFF to stop receiving push notifications (e.g., they recently donated, are traveling, or are sick).
- The toggle must be reachable from the home screen in one tap — not buried in settings.
- When toggling back ON after a previous RESPONDING state, display: "If you donated recently, please wait at least 8 weeks before donating again."
- FCM token is stored separately from availability; turning off availability does NOT unsubscribe from FCM (the subscription is retained so re-enabling is instant). Notification delivery is gated by the `is_available` field in the matching query, not by FCM subscription state.

---

## Feature Landscape

### Table Stakes (Emergency Loop Cannot Function Without These)

| Feature | Why Table Stakes | Complexity | Notes |
|---------|-----------------|------------|-------|
| Phone number auth (dummy OTP) | Identity anchor; without it, no profile to attach donor/request to | LOW | Auto-fill after ~3s; no real SMS needed for v1 |
| Blood type on profile | Core matching input; app is useless without it | LOW | Single-select from 8 types at registration |
| GPS location on request | "Nearby" is the whole value proposition; without it, you'd alert everyone in Myanmar | MEDIUM | Use browser Geolocation API; store lat/lng on the request, not the profile |
| Blood compatibility matrix in matching query | Alerting an incompatible donor wastes their time and the requester's only chance | MEDIUM | Hard-coded lookup table; Supabase PostGIS or haversine distance filter + blood type IN list |
| FCM push to matching donors | Donors must receive alerts when the PWA is not open; in-app only is not emergency-grade | HIGH | Requires service worker + FCM token registration + Supabase → FCM trigger |
| Donor "I'm responding" action | Closes the loop: requester knows help is coming; without it the requester has no signal | LOW | Inserts a response row; optionally triggers a notification back to the requester |
| Direct call action from notification | The actual coordination channel; without call, "responding" is a dead end | LOW | `tel:` link on the callback phone stored in the request |
| Requester marks request "fulfilled" | Stops stale alerts to donors who are no longer needed; critical for trust | LOW | Status update to FULFILLED; Supabase edge function suppresses further FCM sends |
| Donor availability toggle | Without it, dormant users who registered once receive alerts forever | LOW | Boolean field; reachable from home screen in one tap |
| PWA install prompt + service worker | iOS push requires home-screen install; without install, iOS donors never get push | MEDIUM | `beforeinstallprompt` (Android); iOS requires manual A2HS prompt UI |
| Graceful in-app fallback (no push) | Users who do not install still need to see active requests near them | LOW | Polled feed or list view of nearby open requests |
| Bilingual UI (English + Burmese) | Myanmar audience; Burmese-only users cannot use the app if only English is present | MEDIUM | i18n strings + Noto Sans Myanmar font (already in design tokens) |
| Request auto-expiry | An open request from 3 days ago should not still alert donors | LOW | Expires_at field; server-side or client-side expiry check |

### Differentiators (Nice, Competitive, Not Emergency-Loop-Breaking)

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Unified donor/requester profile | Real users are both; removes friction of role-switching | LOW | One profile, two actions; no separate account types |
| Full compatibility matrix (not exact-type only) | Reaches more medically valid donors (e.g., O- can give to B- recipients) | LOW | More matches = faster help; correctness differentiator vs. apps doing exact-type-only |
| Real GPS radius (not township) | More accurate "nearby" than township/city selection; relevant in dense Yangon | MEDIUM | Supabase + PostGIS or haversine distance filter |
| Donor list visible to requester after responses | Requester can see who is responding and call them; removes coordination ambiguity | LOW | Query response rows joined with donor profile; show name + phone |
| Cooldown reminder on re-activation | Reduces medically ineligible donors responding; builds trust in app accuracy | LOW | Simple banner on availability toggle; no enforcement logic in v1 |
| Request expiry notification to requester | Proactive prompt to re-post if still needed | LOW | Client-side check on app open; or Supabase scheduled function |

### Anti-Features (Deliberately NOT Building in v1)

| Feature | Why Requested | Why It's Wrong for v1 | What to Do Instead |
|---------|---------------|----------------------|-------------------|
| In-app chat / messaging | Seems like natural coordination channel | Adds auth complexity, moderation risk, development cost; the call IS the channel | Use `tel:` callback phone link — zero infrastructure, works offline |
| Real SMS OTP verification | Looks more legitimate | Requires SMS provider, telephony cost, rate limiting, test accounts; blocks demo; out of scope | Dummy 3s auto-fill OTP — demoable, honest about v1 scope |
| Native iOS / Android apps | Better push reliability on iOS | App store approval delays, dual codebase, no faster to ship; PWA with A2HS is sufficient | PWA with proper service worker + install prompt |
| Donor medical history / health questionnaire | Reduces ineligible responses | Medical liability, complex UX, blocks registration funnel, out of scope for v1 | Cooldown reminder text only; no questionnaire gate |
| Gamification (badges, streaks, leaderboards) | Increases engagement in donor apps | Distracts from emergency UX; wrong tone for crisis product; adds scope | Show impact ("You helped N people") post-v1 as a profile stat |
| Payment / compensation for donors | Removes financial barrier for donors | Blood sales are ethically and legally complex; outside v1 scope entirely | Strictly voluntary; no payment infrastructure |
| Township / administrative zone matching | Familiar to Myanmar users | Less accurate than GPS; misses donors 500m away across a township boundary | GPS radius is strictly better; educate users with onboarding copy |
| Scheduled / non-emergency requests | "I need blood next week for surgery" | Different UX, different urgency model, different notification tone; dilutes emergency focus | Scope to emergency only for v1; "planned" tier is v2 |
| Request feed visible to all donors | Browse all open requests like a marketplace | Privacy exposure of requester location/phone; GPS push is the right model | Push-only model: donors receive alerts, not browse a public feed |
| Exact-type-only matching | Simpler to implement | Medically wrong; leaves B- patient without help when O- donor is 2km away | Full ABO/Rh compatibility matrix (already planned) |
| Enforced 56-day donation cooldown | Medically correct | Requires verified donation history; dummy auth makes this unverifiable in v1 | Soft toggle + reminder text |
| Blood bank / hospital integration | Adds institutional trust | Requires partnerships, B2B sales cycle, data agreements — entirely out of v1 scope | Direct donor-to-requester model only |

---

## Feature Dependencies

```
Auth (Phone OTP)
    └──requires──> User Profile
                       └──requires──> Blood Type (on profile)
                       └──requires──> FCM Token (stored on profile)
                       └──requires──> is_available toggle

Create Blood Request
    └──requires──> Auth
    └──requires──> GPS Location (browser Geolocation API)
    └──requires──> Blood Type (on request)
    └──requires──> Callback Phone (on request)

Matching + FCM Push
    └──requires──> Blood Request (with blood type + GPS)
    └──requires──> Donor Profiles (blood type, is_available=true, FCM token, location within radius)
    └──requires──> Compatibility Matrix (hard-coded lookup)
    └──requires──> Service Worker (for background push delivery)
    └──requires──> PWA Manifest (for install prompt + iOS push)

Donor "I'm Responding"
    └──requires──> FCM Push (donor received the alert)
    └──requires──> Auth (donor must be identified)
    └──enhances──> Call Action (call button appears alongside or in notification)

Mark Request Fulfilled
    └──requires──> Auth (requester identity)
    └──requires──> Request (must be OPEN or have RESPONDING donors)
    └──suppresses──> FCM Push (no further alerts after fulfilled)

Bilingual UI
    └──requires──> i18n library or string map (English + Burmese keys)
    └──requires──> Noto Sans Myanmar font (already in design tokens)

In-app Fallback (no push)
    └──enhances──> Matching (shows open nearby requests without relying on push)
    └──requires──> GPS Location
    └──requires──> Compatibility Matrix

Install Prompt
    └──requires──> PWA Manifest
    └──requires──> Service Worker
    └──enables──> FCM Push on iOS (only possible after A2HS install)
```

### Dependency Notes

- **FCM Push requires Service Worker:** Background push delivery is only possible with an active service worker. Service worker registration is a prerequisite for any push to reach a donor when the PWA is not open. This must be wired before any push testing.
- **iOS push requires A2HS install:** On iOS, push notifications are only delivered to PWAs installed to the home screen. The install prompt must appear early in the user journey, with a clear fallback for users who decline.
- **FCM Token is stored on the user profile:** The token must be updated on each app open (tokens rotate). If the token is stale, push delivery silently fails. Token refresh on app open is a correctness requirement.
- **Matching query is blocked on `is_available = true`:** Donors who have toggled off receive no push. This is the primary mechanism for opt-out, not FCM unsubscription.
- **Request expiry gates all downstream push:** Once a request reaches FULFILLED, EXPIRED, or CANCELLED, the FCM send must be suppressed. This logic lives in the matching trigger (Supabase Edge Function or client-side guard).

---

## MVP Definition

### Launch With (v1) — The Emergency Loop

- [x] Phone OTP auth (dummy, 3s auto-fill) — identity without telephony cost
- [x] User profile: blood type + FCM token + is_available toggle
- [x] Create blood request: blood type + GPS location + callback phone
- [x] Matching: ABO/Rh compatibility matrix + GPS radius filter
- [x] FCM push to matched donors (background-capable via service worker)
- [x] Donor "I'm responding" tap action
- [x] Call button (`tel:` link to requester callback phone)
- [x] Requester marks request fulfilled (stops alerts)
- [x] Request auto-expiry (24h)
- [x] PWA install prompt (Android `beforeinstallprompt` + iOS manual A2HS UI)
- [x] In-app fallback list of nearby open requests (for non-installed users)
- [x] Bilingual UI: English + Burmese (Noto Sans Myanmar)
- [x] Donor availability toggle (on/off from home screen)
- [x] Cooldown reminder text when re-activating availability

### Add After Validation (v1.x)

- [ ] Responder list visible to requester — show name + phone of donors who responded (trigger: requester feedback that they couldn't reach any donor)
- [ ] Request expiry re-post prompt — "still need blood? re-post" notification (trigger: expiry feedback)
- [ ] Last-donated-at date on profile — enables future cooldown enforcement (low effort to add; high value for data)
- [ ] Real SMS OTP — if trust/spam becomes an issue (trigger: abuse or user trust concerns)

### Future Consideration (v2+)

- [ ] Verified donation history + enforced 56-day cooldown — requires trusted data source
- [ ] Planned / scheduled blood requests — different urgency model, different UX
- [ ] Hospital / blood bank integration — B2B partnerships required
- [ ] Impact tracking ("you've helped N people") — engagement layer post-PMF
- [ ] Donation history log — donor-facing record of past responses

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| FCM push to matched donors | HIGH | HIGH | P1 |
| Blood compatibility matrix matching | HIGH | LOW | P1 |
| GPS-based request + donor radius filter | HIGH | MEDIUM | P1 |
| Donor "I'm responding" + call action | HIGH | LOW | P1 |
| Requester marks fulfilled | HIGH | LOW | P1 |
| Phone auth (dummy OTP) | HIGH | LOW | P1 |
| Blood type on profile | HIGH | LOW | P1 |
| PWA manifest + service worker | HIGH | MEDIUM | P1 |
| Install prompt (Android + iOS fallback) | HIGH | MEDIUM | P1 |
| Donor availability toggle | HIGH | LOW | P1 |
| Bilingual UI (English + Burmese) | HIGH | MEDIUM | P1 |
| Request auto-expiry | MEDIUM | LOW | P1 |
| In-app fallback (no push) | MEDIUM | LOW | P1 |
| Cooldown reminder text | MEDIUM | LOW | P2 |
| Responder list for requester | MEDIUM | LOW | P2 |
| Expiry re-post prompt | MEDIUM | LOW | P2 |
| last_donated_at field (data only, no enforcement) | LOW | LOW | P2 |
| Real SMS OTP | LOW | HIGH | P3 |
| Donation history + 56-day enforcement | LOW | HIGH | P3 |
| Gamification / impact stats | LOW | MEDIUM | P3 |

**Priority key:**
- P1: Must have for v1 launch (emergency loop breaks without it)
- P2: Add after v1 ships and core loop is validated
- P3: Defer to v2 or later

---

## Competitor Feature Analysis

| Feature | BLOODR (academic app, PMC 2017) | BloodLink / BloodFinder (UX concepts) | Blood Help (this v1) |
|---------|----------------------------------|---------------------------------------|----------------------|
| Account types | 3 separate types: donor, clinic, admin | Donor vs. recipient separation | Unified profile — both are actions |
| Matching method | Blood type + city/region (not GPS radius) | Location-based, GPS | Full ABO/Rh matrix + GPS radius |
| Notification | Targeted push to compatible donors | Push alerts for urgent needs | FCM background push (real, not in-app only) |
| Donor response | Accept/decline from app | Tap to respond | "I'm responding" + direct call |
| Request states | pending → success | Not fully documented | OPEN → RESPONDING → FULFILLED / EXPIRED |
| Donor availability | Not documented | Not documented | Explicit toggle on profile |
| Platform | Native Android | Concept / prototype | PWA (installable, Android + iOS) |
| Auth | Full verification implied | Full verification implied | Dummy OTP (demoable without telephony) |
| Cooldown tracking | Tracks donation history | Not documented | Soft reminder only (no enforcement in v1) |
| Call coordination | Not documented | In-app messaging | `tel:` callback link (zero infrastructure) |

---

## Sources

- [Blood Safety and Matching — hematology.org](https://www.hematology.org/education/patients/blood-basics/blood-safety-and-matching) — PRIMARY for compatibility matrix (HIGH confidence)
- [Blood Types and Matching — American Cancer Society](https://www.cancer.org/cancer/managing-cancer/treatment-types/blood-transfusion-and-donation/blood-types-and-matching.html) — ABO rules by recipient type (HIGH confidence)
- [Blood Types Explained — American Red Cross](https://www.redcrossblood.org/donate-blood/blood-types.html) — Universal donor/recipient confirmation (HIGH confidence)
- [How Often Can You Donate Blood — MSK Cancer Center](https://www.mskcc.org/about/get-involved/donating-blood/how-often-can-you-donate-blood) — 56-day whole blood interval (HIGH confidence)
- [How Often Can You Donate — America's Blood Centers](https://americasblood.org/abc-news/how-often-can-you-donate-blood/) — 8-week whole blood interval confirmation (HIGH confidence)
- [BLOODR app — PMC / NCBI](https://pmc.ncbi.nlm.nih.gov/articles/PMC5682362/) — Competitor feature analysis (MEDIUM confidence)
- [Blood Finder App UX Case Study — Medium](https://medium.com/@kmathewalfin/blood-finder-app-detailed-ux-case-study-6b458bf2d897) — UX patterns for donor apps (MEDIUM confidence)
- [PWA Push Notifications on iOS in 2026](https://webscraft.org/blog/pwa-pushspovischennya-na-ios-u-2026-scho-realno-pratsyuye?lang=en) — iOS push requirements confirmation (HIGH confidence)
- [FCM Web Push Setup — Firebase Docs](https://firebase.google.com/docs/cloud-messaging/web/get-started) — FCM service worker requirements (HIGH confidence)
- [FCM + PWA Push Guide — Coffee Inc / Medium](https://blog.coffeeinc.in/complete-guide-push-notifications-in-pwa-with-firebase-cloud-messaging-a515965372f7) — Implementation patterns (MEDIUM confidence)

---

*Feature research for: Emergency blood-donor matching PWA (Blood Help, Myanmar)*
*Researched: 2026-06-19*
