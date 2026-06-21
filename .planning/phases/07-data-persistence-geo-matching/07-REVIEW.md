---
phase: 07-data-persistence-geo-matching
reviewed: 2026-06-21T20:55:15Z
depth: standard
files_reviewed: 4
files_reviewed_list:
  - src/App.tsx
  - src/screens/CreateRequest.tsx
  - src/screens/DonorProfileSetup.tsx
  - src/screens/Home.tsx
findings:
  critical: 3
  warning: 4
  info: 0
  total: 7
status: issues_found
---

# Phase 07: Code Review Report

**Reviewed:** 2026-06-21T20:55:15Z
**Depth:** standard
**Files Reviewed:** 4
**Status:** issues_found

## Summary

Phase 07 adds real Supabase writes (dual upsert for donor profile, insert for blood request), GPS pre-permission flow in both `CreateRequest` and `DonorProfileSetup`, full `initAuth` hydration on session restore, and a live `requests_within_radius` feed in `Home` replacing dummy data.

Three blockers were found. The most severe is a phone-format mismatch in `handleVerified` that causes every returning user who logs in via OTP to be routed to the intent-choice screen instead of home — effectively breaking the returning-user login path entirely. The second is that both availability toggles (Home and Profile screens) update only in-memory state and never write to Supabase, so the change silently vanishes on reload. The third is a double-invocation race on the GPS request AlertDialog that can fire two concurrent `onPosted` inserts against the `blood_requests` table.

Cross-referenced: `src/geolocation.ts`, `src/auth.ts`, `src/blood.ts`, `src/components/AlertDialog.tsx`, `src/components/Input.tsx`, `src/types/database.ts`.

---

## Critical Issues

### CR-01: `handleVerified` queries `profiles.phone` with raw digits; DB stores E.164 — always mismatches

**File:** `src/App.tsx:199`

**Issue:** `handleVerified` executes `.eq('phone', phone)` where `phone` is the raw digit string stored by `setPhone(digits)` (e.g. `'9123456789'`). However, every profile write goes through `normalizePhone(profile.phone)` which prepends `'+95'`, storing `'+959123456789'` in the database. The equality check therefore never matches any row — `profile` is always `null` — so all returning users are routed to `'intent'` instead of `'home'`. Donors who already completed setup are forced through the intent-choice fork on every login after the first session expires.

**Fix:**
```typescript
// App.tsx handleVerified — normalize before querying
const handleVerified = async () => {
  const e164 = normalizePhone(phone)                // '+95' + digits
  const { data: profile } = await supabase
    .from('profiles')
    .select('id')
    .eq('phone', e164)                              // matches stored E.164 value
    .maybeSingle()
  setScreen(profile ? 'home' : 'intent')
}
```

---

### CR-02: Availability and emergency-callable toggles write to local state only — changes lost on reload

**File:** `src/App.tsx:400`, `src/App.tsx:441`

**Issue:** Both `onAvailableChange` handlers (Home screen, line 400; Profile screen, line 439) and `onEmergencyChange` (line 441) resolve to `setUser((u) => ({ ...u, available: v }))` / `setUser((u) => ({ ...u, emergencyCallable: v }))`. No Supabase write happens. The donor's `donors.is_available` and `donors.emergency_callable` columns are never updated by these toggles. On any reload the DB-hydrated value overrides the user's toggle. A donor who marks themselves unavailable remains visible to the feed until they re-save their full profile.

**Fix:**
```typescript
// App.tsx — persist toggle changes to Supabase immediately
const handleAvailableChange = async (v: boolean) => {
  setUser((u) => ({ ...u, available: v }))
  if (!user.supabaseId) return
  const { error } = await supabase
    .from('donors')
    .update({ is_available: v, updated_at: new Date().toISOString() })
    .eq('profile_id', user.supabaseId)
  if (error) console.error('availability update failed:', error.message)
}

const handleEmergencyChange = async (v: boolean) => {
  setUser((u) => ({ ...u, emergencyCallable: v, showNumber: v }))
  if (!user.supabaseId) return
  const { error } = await supabase
    .from('donors')
    .update({ emergency_callable: v, updated_at: new Date().toISOString() })
    .eq('profile_id', user.supabaseId)
  if (error) console.error('emergency callable update failed:', error.message)
}
```
Pass these handlers instead of the inline lambdas at lines 400, 439, and 441.

---

### CR-03: AlertDialog confirm button re-fires GPS handler during `'requesting'` phase — concurrent inserts

**File:** `src/screens/CreateRequest.tsx:405-412`, `src/screens/DonorProfileSetup.tsx:338-344`

**Issue:** Both screens keep the `AlertDialog` open while `geoPhase === 'requesting'` (so the user sees the dialog while GPS is pending). The `AlertDialog`'s confirm `<Button>` has no `disabled` prop, so a user who taps "Continue" a second time during the GPS wait fires a second concurrent call to `requestLocation` / `requestLocationAndSave`. In `CreateRequest` this triggers two simultaneous `onPosted` calls → two `blood_requests` inserts. The first succeeds; the second hits the `23505` unique-index violation and surfaces the duplicate-request error dialog even though the request was actually posted successfully. In `DonorProfileSetup` the double-upsert is idempotent but calls `onSave` twice, causing a double navigation transition.

**Fix — option A (preferred): close the dialog when GPS request starts**
```typescript
// CreateRequest requestLocation — dismiss dialog immediately on confirm
const requestLocation = async () => {
  setGeoPhase('requesting')
  // Dialog closes here because open={geoPhase === 'prealert'} is now false
  const res = await getCurrentPosition()
  // ... rest unchanged
}

// AlertDialog open prop change:
// Before: open={geoPhase === 'prealert' || geoPhase === 'requesting'}
// After:  open={geoPhase === 'prealert'}
```
Apply the same change in `DonorProfileSetup` (`requestLocationAndSave` / its `AlertDialog` `open` prop).

**Fix — option B (guard in handler)**
```typescript
const requestLocation = async () => {
  if (geoPhase === 'requesting') return   // prevent re-entry
  setGeoPhase('requesting')
  // ...
}
```

---

## Warnings

### WR-01: `phone` state not hydrated from DB on session restore — forms pre-fill with empty string

**File:** `src/App.tsx:111-190` (the `initAuth` `useEffect`)

**Issue:** On session restore, `initAuth` hydrates `user.name`, `user.bloodType`, coordinates, etc. from `profiles` and `donors`, but never calls `setPhone(profile.phone)`. The `phone` state remains `''`. When a returning user navigates to `CreateRequest` or `DonorProfileSetup`, `defaultPhone={phone}` passes an empty string instead of their stored phone number, forcing re-entry of a number they already registered.

**Fix:**
```typescript
// In initAuth, after the profile row is confirmed:
if (profile) {
  if (profile.phone) {
    // Strip the +95 prefix so the Input component (digits-only) renders it correctly
    setPhone(profile.phone.replace(/^\+95/, ''))
  }
  // ... rest of hydration unchanged
}
```

---

### WR-02: `formatPhone` in `Home.tsx` falls through without formatting for 12-char local numbers

**File:** `src/screens/Home.tsx:33-39`

**Issue:** The regex `9\d{9,10}` matches Myanmar mobile numbers where the digit string after `+95` is 10 or 11 digits long, producing a local number (with the `'0'` prefix added) of 11 or 12 characters respectively. The 11-character case is formatted with pattern `(\d{2})(\d{3})(\d{3})(\d{3})` (sums to 11). The 12-character case falls to the else branch and uses `(\d{2})(\d{3})(\d{2})(\d{3})` which sums to only 10 — the regex does not match and `local.replace(...)` returns the unformatted string `'091234567890'`. The raw unformatted number is then displayed to the user.

```typescript
// Verify the mismatch:
// local = '0' + '91234567890'  → 12 chars
// pattern \d{2}\d{3}\d{2}\d{3} = 2+3+2+3 = 10  ← never matches 12 chars
```

**Fix:**
```typescript
function formatPhone(e164: string): string {
  const m = e164.match(/^\+95(9\d{9,10})$/)
  if (!m) return e164
  const local = '0' + m[1]                          // 11 or 12 chars
  if (local.length === 11) {
    return local.replace(/^(\d{2})(\d{3})(\d{3})(\d{3})$/, '$1-$2-$3-$4')
  }
  // 12 chars: 09-XXXX-XXX-XXX  (2+4+3+3)
  return local.replace(/^(\d{2})(\d{4})(\d{3})(\d{3})$/, '$1-$2-$3-$4')
}
```

---

### WR-03: `formatTimeAgo` returns a negative label when `createdAt` is in the future

**File:** `src/screens/Home.tsx:50-62`

**Issue:** `diffMs = Date.now() - new Date(createdAt).getTime()`. If the server timestamp is ahead of the client clock (clock skew, timezone offset, or a data anomaly), `diffMs` is negative. `diffMin = Math.floor(negative / 60000)` is also negative, and the function returns strings like `"-5 min ago"` / `"-5 မိနစ်က"`. There is no guard for this case.

**Fix:**
```typescript
function formatTimeAgo(createdAt: string, lang: Lang): string {
  const diffMs = Math.max(0, Date.now() - new Date(createdAt).getTime())
  const diffMin = Math.floor(diffMs / 60000)
  // ... rest unchanged
}
```

---

### WR-04: Falsy guard `!donorLat || !donorLng` silently suppresses feed if coordinates are exactly `0`

**File:** `src/screens/Home.tsx:221`

**Issue:** The guard `if (!donorLat || !donorLng)` uses JavaScript falsy semantics, so a coordinate value of `0.0` is treated the same as `null`. Myanmar coordinates cannot realistically be `0` (lat range ~9.7–28.5°N, lng range ~92–101°E) so the guard is safe in practice. However, `coarsenCoordinates` rounds to 2 decimal places; if a donor were exactly on a coordinate that rounds to `0.00` in either axis, the feed would silently show empty. The intent is clearly to check for "no coordinates set", which is accurately expressed with an explicit `null` check.

**Fix:**
```typescript
// Before (line 221):
if (!donorLat || !donorLng || !donorBloodType) {

// After:
if (donorLat === null || donorLat === undefined ||
    donorLng === null || donorLng === undefined ||
    !donorBloodType) {
```

---

_Reviewed: 2026-06-21T20:55:15Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
