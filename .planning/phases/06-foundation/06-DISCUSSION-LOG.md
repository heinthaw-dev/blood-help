# Phase 6: Foundation - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-21
**Phase:** 6-Foundation
**Areas discussed:** Session + Auth flow, GPS coarsening precision

---

## Session + Auth Flow

### When should signInAnonymously() be called?

| Option | Description | Selected |
|--------|-------------|----------|
| On OTP submit | Call signInAnonymously() when user taps Verify on OtpVerification screen | |
| On app mount | useEffect calls signInAnonymously() immediately on load | ✓ |
| Lazy — on first DB write | Session created only when a write is needed | |

**User's choice:** App mount (after discussion clarified that this is simpler and always ensures session exists before any user action)

---

### Supabase signInWithOtp vs signInAnonymously

**User question:** How does signInWithOtp work for the dummy OTP flow? Does it cost money?

**Notes:** User asked for clarification about signInWithOtp before deciding. Key finding: signInWithOtp requires either (a) an SMS provider like Twilio (costs ~$0.01-0.05/SMS) or (b) pre-configured test phone numbers in the Supabase dashboard (free, but only works for those exact numbers). For real Myanmar numbers (+959...) in development without Twilio, signInWithOtp doesn't work. User then chose signInAnonymously() as the free alternative.

---

### Returning user identification across sessions

| Option | Description | Selected |
|--------|-------------|----------|
| Supabase phone auth in test mode | signInWithOtp + verifyOtp gives phone-tied session; same UUID every login | |
| Anonymous auth + profile upsert by phone | New UUID each session, upsert to reclaim profile | |
| Keep localStorage for routing, anonymous auth for writes | Hybrid: localStorage for first-time detection, Supabase for DB | |

**User's choice:** Anonymous auth + phone as profile field (after further discussion)
**Notes:** User initially selected "Supabase phone auth in test mode" but after understanding the SMS/cost constraints, decided on anonymous auth + phone lookup. Session UUID is consistent within the same browser (localStorage persistence). Cross-device creates new UUID.

---

### Cross-device limitation

| Option | Description | Selected |
|--------|-------------|----------|
| Acceptable for v2 | Most users use one device (PWA on phone). Cross-device re-setup is v3 concern. | ✓ |
| Must handle cross-device now | Edge Function to re-link profile to new UUID when same phone logs in on new device | |

**User's choice:** Acceptable for v2
**Notes:** User asked about two-tab behavior first. Clarified that same-browser tabs share localStorage session (Tab 2 gets same UUID as Tab 1). Cross-device is the real gap — user accepted this for v2.

---

### What happens to existing src/auth.ts

| Option | Description | Selected |
|--------|-------------|----------|
| Replace with Supabase helpers, keep filename | Keep src/auth.ts, replace contents with session wrappers | ✓ |
| Delete it, call supabase client directly | Remove file, update all import sites | |

**User's choice:** Replace contents, keep filename
**Notes:** Avoids import refactor cascade across App.tsx and any other consumers.

---

## GPS Coarsening Precision

### Coarsening resolution

| Option | Description | Selected |
|--------|-------------|----------|
| 2 decimal places (~1.1km) | True "1km grid". Hides street/building. Good for 25km radius geo-matching. | ✓ |
| 3 decimal places (~111m) | City block level. More precise but still anonymous. | |
| Township centroid only | Maximum privacy but requires township→centroid lookup table for Myanmar | |

**User's choice:** 2 decimal places
**Notes:** User confirmed agreement. Noted that both donor location (during profile setup) and requester location (during blood request creation) need this treatment.

---

### How PostGIS ST_DWithin works (user asked)

**User question:** How does Supabase check that a donor is nearby the requester's address?

**Notes:** Explained ST_DWithin RPC pattern — SQL function takes req_lat, req_lng, radius_km and returns matching profiles using `geography(ST_MakePoint(lng, lat))`. React client calls `supabase.rpc('nearby_donors', {...})`. User then asked about expanding radius.

---

### Expanding radius strategy

| Option | Description | Selected |
|--------|-------------|----------|
| Two-radius approach | DISPLAY_RADIUS_KM=10, ALERT_RADIUS_KM=25. Widen once if zero results. | ✓ |
| Step-expansion | 5km → 10km → 25km → 50km configurable steps | |

**User's choice:** Two-radius approach is enough
**Notes:** User mentioned interest in radius expansion feature ("maybe next version, we will add"). Confirmed two radii as specified in blood-help-spec.md §3.2 are sufficient for v2.

---

### coarsenCoordinates() utility location

| Option | Description | Selected |
|--------|-------------|----------|
| src/geolocation.ts | Co-located with getCurrentPosition() | ✓ |
| src/blood.ts | Domain utility file | |
| New src/lib/location.ts | Separate module | |

**User's choice:** src/geolocation.ts

---

## Claude's Discretion

- RLS policy SQL wording (within spec §4.3 rules)
- TypeScript DB types strategy (suggested: `src/types/database.ts` via MCP generate_typescript_types)
- PostGIS RPC function signature details
- `.env.local` structure for VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY
- Error handling for failed signInAnonymously() on mount

## Deferred Ideas

- Real SMS OTP via Twilio — v3 (after anonymous auth proves sufficient for v2)
- Cross-device session linking — v3 (accepted limitation for v2)
- Step-expansion radius logic — v2 is fine with two-radius approach
- Supabase client and TypeScript types setup details — Claude's discretion
