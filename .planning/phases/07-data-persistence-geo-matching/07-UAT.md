---
status: partial
phase: 07-data-persistence-geo-matching
source: [07-01-SUMMARY.md, 07-02-SUMMARY.md, 07-03-SUMMARY.md, 07-04-SUMMARY.md]
started: 2026-06-22T00:00:00Z
updated: 2026-06-22T18:00:00Z
---

## Current Test
<!-- OVERWRITE each test - shows where we are -->

[testing paused — 7 items outstanding, resume from Test 2: Donor Registration Persists to DB]

## Tests

### 1. Cold Start Smoke Test
expected: Fresh HTTPS dev server + reload — app boots cleanly, anonymous session created, Phone Entry screen shows, no auth/signup errors in console.
result: pass
note: "[vite] connecting... is normal HMR client log, not an app error"

### 2. Donor Registration Persists to DB
expected: As a new number, complete the donor profile form (name, blood type, phone), tap Save → allow location → a row is written to both the `profiles` and `donors` tables (donor_code auto-assigned), and you land on the thank-you screen.
result: [pending]

### 3. Post a Blood Request Persists to DB
expected: From the request form, fill blood type + contact + current address, post → allow location → a row is inserted into `blood_requests` (status active, coarsened lat/lng, E.164 phone) and you navigate to the live-request screen.
result: [pending]

### 4. Live Nearby Donor Feed
expected: Logged in as an available donor with coordinates, the Home feed shows REAL active requests from the DB (not dummy data) within radius — filtered to blood types you can donate to, excluding your own requests — each with a distance label and a time-ago label (Burmese numerals when language is Burmese).
result: [pending]

### 5. Required Address Guard
expected: On the request form, the "Post request" button stays disabled until the current-address field is non-empty. There is no longer an "Optional" divider in the form.
result: [pending]

### 6. Returning User Routing (Cross-Device)
expected: Logging in with a number that already exists in `profiles` (even from a different device / fresh anonymous session) routes straight to Home. Logging in with an unregistered number routes to the Intent Choice screen.
result: [pending]

### 7. Availability Toggle Persists Across Reload
expected: Toggling "Available to donate" off on Home or Profile writes to the `donors` table immediately; after a page reload the toggle reflects the saved (off) state rather than resetting to on.
result: [pending]

### 8. Geolocation Pre-Permission + Spinner Flow
expected: Tapping Save/Post shows the pre-permission dialog first; tapping Continue closes it and shows a loading spinner with "Getting your location…" while the browser asks for permission; on Allow it resolves quickly and proceeds (no stuck/blank screen, no double-fire).
result: [pending]

## Summary

total: 8
passed: 1
issues: 0
pending: 7
skipped: 0
blocked: 0

## Gaps

[none yet]
