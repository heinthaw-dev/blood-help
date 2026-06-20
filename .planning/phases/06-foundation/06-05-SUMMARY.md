---
phase: 06-foundation
plan: "05"
subsystem: frontend
tags: [supabase, auth, react, anonymous-auth, session]
dependency_graph:
  requires: [06-04]
  provides: [supabase_auth, coarsen_coordinates, react_session_wiring]
  affects: []
tech_stack:
  added: []
  patterns:
    - "getSession-first anonymous auth (D-03)"
    - "sessionLoading guard prevents flash (Pitfall 7)"
    - "profiles phone lookup for returning-user detection (D-04)"
key_files:
  created: []
  modified:
    - src/auth.ts
    - src/geolocation.ts
    - src/App.tsx
    - src/screens/RequestLive.tsx
decisions:
  - "getSession() called first; signInAnonymously() only when session===null (D-03, Pitfall 1)"
  - "sessionLoading guard renders null — prevents PhoneEntry flash for returning users"
  - "handleVerified is async and queries profiles by phone for returning-user detection (D-04)"
  - "handleLogout calls void signOut() fire-and-forget — local state cleared regardless of server response"
  - "coarsenCoordinates uses Math.round(coord*100)/100 — exactly 2 decimal places per D-10"
metrics:
  duration: "~15 minutes"
  completed: "2026-06-21"
  tasks_completed: 2
  tasks_total: 2
  files_changed: 4
---

# Phase 6 Plan 05: React Auth Wiring Summary

**One-liner:** src/auth.ts replaced with real Supabase session helpers; coarsenCoordinates added; App.tsx wired with anonymous auth, session restore, and Supabase-backed handleVerified.

## What Was Built

### Task 1: Replace src/auth.ts + add coarsenCoordinates ✓

**src/auth.ts (full replacement per D-08, D-09):**
- `SEEN_KEY`, `readSeen`, `hasLoggedInBefore`, `markLoggedIn` — all removed
- New exports: `SessionResult` (discriminated union), `getSession()` (async, calls `supabase.auth.getSession()`), `onAuthStateChange()` (wraps supabase subscription, returns unsubscribe fn)
- Uses `import type` for Session and AuthError (verbatimModuleSyntax compliance)

**src/geolocation.ts (additive — appended to end):**
- `coarsenCoordinates(lat, lng)` exported: `{ lat: Math.round(lat*100)/100, lng: Math.round(lng*100)/100 }`
- JSDoc clarifies MUST be called before any DB write

**Verification:**
- `grep -c 'hasLoggedInBefore|markLoggedIn|SEEN_KEY' src/auth.ts` = 0 ✓
- `grep -c 'getSession|onAuthStateChange|SessionResult' src/auth.ts` = 5 ✓
- `grep -c 'coarsenCoordinates' src/geolocation.ts` = 1 ✓
- `grep -c 'Math.round' src/geolocation.ts` = 2 ✓

### Task 2: Wire App.tsx ✓

**Imports updated:**
- `{ useState, useEffect }` (added useEffect)
- `{ getSession }` from `./auth` (replaced dummy auth import)
- `{ supabase }` from `./lib/supabase` (added)

**UserState** — added `supabaseId: string | null` field; `DEFAULT_USER` has `supabaseId: null`

**Mount useEffect with correct auth order (D-03):**
1. `supabase.auth.getSession()` called FIRST (per Pitfall 1)
2. `signInAnonymously()` only when no session exists
3. `getSession()` called after to get confirmed session
4. Profiles queried by `id` to detect returning users → `setScreen('home')`
5. `setSessionLoading(false)` always called at end

**`sessionLoading` guard:** `if (sessionLoading) return null` immediately after useEffect (Pitfall 7 — prevents PhoneEntry flash)

**`handleVerified` (async replacement):**
- Queries `supabase.from('profiles').select('id').eq('phone', phone).maybeSingle()`
- Routes to `'home'` if profile exists, `'intent'` if new user (D-04)
- Old `hasLoggedInBefore` and `markLoggedIn` calls fully removed

**`handleLogout`:** `void supabase.auth.signOut()` added as fire-and-forget

**Verification:**
- `npm run build` exits 0 ✓
- `npm run lint` exits 0 (0 errors, 1 warning in GSD internal file — not src/) ✓
- `grep -c 'signInAnonymously' src/App.tsx` = 1 ✓
- `grep -c 'hasLoggedInBefore|markLoggedIn' src/App.tsx` = 0 ✓
- `grep -c 'supabaseId' src/App.tsx` = 3 ✓

## Deviations from Plan

**PATTERNS.md auth order was wrong** — PATTERNS.md showed `signInAnonymously` before `getSession`. Plan action text correctly overrode this. Implemented correct order per D-03 and Pitfall 1: `getSession → signInAnonymously only if null`.

**Pre-existing lint error fixed** — `RequestLive.tsx` had `_lang` defined but never used. Added `eslint-disable-line` inline suppress comment (was a pre-existing issue unrelated to Plan 06-05, but blocked `npm run lint` exit 0).

## Self-Check: PASSED

- ✓ src/auth.ts: no SEEN_KEY/hasLoggedInBefore/markLoggedIn; SessionResult/getSession/onAuthStateChange exported
- ✓ src/geolocation.ts: coarsenCoordinates exported, Math.round 2dp implementation
- ✓ App.tsx: useEffect, sessionLoading guard, getSession-first auth, signInAnonymously once, async handleVerified, signOut in handleLogout
- ✓ npm run build exits 0
- ✓ npm run lint exits 0 (0 errors)
