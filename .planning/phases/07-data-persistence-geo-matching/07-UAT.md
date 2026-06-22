---
status: complete
phase: 07-data-persistence-geo-matching
source: [07-01-SUMMARY.md, 07-02-SUMMARY.md, 07-03-SUMMARY.md, 07-04-SUMMARY.md]
started: 2026-06-22T00:00:00Z
updated: 2026-06-23T12:00:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Cold Start Smoke Test
expected: Fresh HTTPS dev server + reload — app boots cleanly, anonymous session created, Phone Entry screen shows, no auth/signup errors in console.
result: pass
note: "[vite] connecting... is normal HMR client log, not an app error"

### 2. Donor Registration Persists to DB
expected: As a new number, complete the donor profile form (name, blood type, phone), tap Save → allow location → a row is written to both the `profiles` and `donors` tables (donor_code auto-assigned), and you land on the thank-you screen.
result: pass

### 3. Post a Blood Request Persists to DB
expected: From the request form, fill blood type + contact + current address, post → allow location → a row is inserted into `blood_requests` (status active, coarsened lat/lng, E.164 phone) and you navigate to the live-request screen.
result: pass

### 4. Live Nearby Donor Feed
expected: Logged in as an available donor with coordinates, the Home feed shows REAL active requests from the DB (not dummy data) within radius — filtered to blood types you can donate to, excluding your own requests — each with a distance label and a time-ago label (Burmese numerals when language is Burmese).
result: pass
note: "Initially failed (donor lat/lng/bloodType not hydrated due to per-session anonymous UID vs RLS owner). Resolved by replacing anonymous auth with deterministic phone-keyed auth (stable uid per phone). Re-tested: donor 1234 saw requester 5678's nearby request."

### 5. Required Address Guard
expected: On the request form, the "Post request" button stays disabled until the current-address field is non-empty. There is no longer an "Optional" divider in the form.
result: pass

### 6. Returning User Routing (Cross-Device)
expected: Logging in with a number that already exists in `profiles` (even from a different device / fresh anonymous session) routes straight to Home. Logging in with an unregistered number routes to the Intent Choice screen.
result: pass
note: "Demonstrated: logged out as donor 1234, registered requester 5678 (→ intent/request), then logged back in as 1234 → went straight to Home. Stable phone-keyed auth makes auth.uid() == profile owner across sessions."

### 7. Availability Toggle Persists Across Reload
expected: Toggling "Available to donate" off on Home or Profile writes to the `donors` table immediately; after a page reload the toggle reflects the saved (off) state rather than resetting to on.
result: pass

### 8. Geolocation Pre-Permission + Spinner Flow
expected: Tapping Save/Post shows the pre-permission dialog first; tapping Continue closes it and shows a loading spinner with "Getting your location…" while the browser asks for permission; on Allow it resolves quickly and proceeds (no stuck/blank screen, no double-fire).
result: pass

## Summary

total: 8
passed: 8
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps

- truth: "Home feed shows live nearby compatible requests for a logged-in donor"
  status: resolved
  resolution: "Replaced anonymous auth with deterministic phone-keyed auth (signInWithPassword/signUp on a phone-derived email+password) so the same phone yields a stable auth.uid() == profile owner on every session/device. handleVerified + initAuth now share hydrateUserFromDb. Re-tested end-to-end: donor 1234 sees requester 5678's nearby request; returning login lands on Home."
  reason: "User reported: feed empty despite a matching A+ request ~1km away; RPC + data verified correct in DB"
  severity: major
  test: 4
  root_cause: "TWO layers. (1) handleVerified didn't hydrate lat/lng/bloodType — FIXED via shared hydrateUserFromDb helper. (2) DEEPER: hydration reads are RLS-scoped (auth.uid()=owner), but anonymous auth mints a NEW uid per session/device, so when a returning user logs in on a session whose uid != their profile owner uid, the profile/donor SELECTs return zero rows. Confirmed by console: currentUserId=6fd31d8a set correctly, but donorLat/lng null and donorBloodType defaulted to O+. Root identity flaw: phone is the logical identity but RLS ties ownership to a per-session anonymous auth.uid()."
  artifacts:
    - path: "src/App.tsx"
      issue: "handleVerified now hydrates (fixed), but RLS-scoped reads fail when session auth.uid() != profile owner"
    - path: "supabase RLS policies"
      issue: "own_profile_select / donors_select_own scope reads to auth.uid()=owner; incompatible with per-session anonymous UIDs for cross-session returning users"
  missing:
    - "Stable phone->uid identity so auth.uid() always equals the profile owner (deterministic phone-keyed auth, or real phone OTP), OR a SECURITY DEFINER hydration RPC stopgap"
  debug_session: ""
