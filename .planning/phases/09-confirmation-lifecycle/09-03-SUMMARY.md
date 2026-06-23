---
phase: 09-confirmation-lifecycle
plan: 03
subsystem: frontend
tags: [react, supabase, realtime, lifecycle, extend-banner, congrats-takeover]

# Dependency graph
requires:
  - phase: 09-01
    provides: "blood_requests.extended column; donations in supabase_realtime publication; direct owner UPDATE confirmed sufficient for extend"
  - phase: 09-02
    provides: "RequestLiveProps with onResolveClosed (required), showExtendBanner?, onExtend?; amber inline tokens pattern"
provides:
  - "App-wide donations:${uid} Realtime subscription (D-11) — congrats takeover from any screen"
  - "hydrateUserFromDb check-on-open unseen donation query (D-12) — returns 'congrats' to route to DonorCongrats"
  - "handleResolveClosed owner-scoped UPDATE with D-01 status map (LIFE-01)"
  - "handleExtend direct owner UPDATE of expires_at+12h + extended=true with optimistic+rollback (D-18/D-19)"
  - "activeRequestExtended + activeRequestExpiresAt hydrated from DB row (Pitfall 5 — banner survives reload)"
  - "showExtendBanner client-side 4h-window computation (D-17)"
  - "Home.tsx extend banner row inside active-request card (D-17)"
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "App-wide Realtime subscription on donations table filtered to donor_id=eq.${uid} — fires setScreen('donor-congrats') from any screen"
    - "hydrateUserFromDb returns boolean | 'congrats' — callers gate on === 'congrats' before === true"
    - "Direct owner UPDATE for extends: .update({ expires_at, extended: true }).eq('id', id).eq('requester_id', uid)"
    - "Optimistic extend + rollback pattern: setActiveRequestExtended(true) before write, revert both state values on error"
    - "Inline amber tokens (#B45309, rgba(230,120,0,.18)) for expiry banners — no --color-warning CSS token exists"

key-files:
  created: []
  modified:
    - src/App.tsx
    - src/screens/Home.tsx
    - src/screens/RequestLive.tsx
    - src/types/database.ts

key-decisions:
  - "handleExtend uses direct owner UPDATE (not extend_request RPC) — confirmed sufficient by 09-01: blood_requests UPDATE policy has no column restriction"
  - "Tasks 1+2 committed together: both modify only App.tsx and the build fails between them (activeRequestExtended declared but unused until showExtendBanner computation added in Task 2)"
  - "database.ts and RequestLive.tsx synced from main (Rule 3 auto-fix): worktree predated 09-01 and 09-02 commits"
  - "showExtendBanner gated on requestDraft !== null (active request present) in addition to 0 < msLeft < 4h and !activeRequestExtended"

patterns-established:
  - "Pattern: hydrateUserFromDb returns boolean | 'congrats' — callers must check === 'congrats' first, then truthy for 'home'"
  - "Pattern: donations:${uid} channel in App.tsx useEffect gated on user.supabaseId with removeChannel cleanup"

requirements-completed: [CONF-03, LIFE-01]

# Metrics
duration: 30min
completed: 2026-06-24
---

# Phase 9 Plan 3: Lifecycle wiring — donations Realtime, handleResolveClosed, handleExtend, Home extend banner

**App-wide donations Realtime subscription wired for congrats takeover; handleResolveClosed writes D-01 mapped status; handleExtend does +12h optimistic write; showExtendBanner computed client-side; Home extend banner renders in active-request card**

## Performance

- **Duration:** ~30 min
- **Completed:** 2026-06-24
- **Tasks:** 3 (Tasks 1+2 committed together; Task 3 separate)
- **Files modified:** 4 (App.tsx, Home.tsx, RequestLive.tsx sync, database.ts sync)

## Accomplishments

- Added `donations:${uid}` Realtime channel in `App.tsx` `useEffect` gated on `user.supabaseId`: subscribes to `postgres_changes` INSERT on `public.donations` filtered `donor_id=eq.${uid}`; on event updates `lastSeenDonationAt` in localStorage, increments `user.donationCount` optimistically, and calls `setScreen('donor-congrats')` (D-11 app-wide takeover)
- Added D-12 check-on-open in `hydrateUserFromDb`: reads `lastSeenDonationAt` from localStorage, queries `donations` where `donor_id=uid AND created_at>lastSeenAt`, advances marker and returns `'congrats'` if unseen row found; return type changed to `Promise<boolean | 'congrats'>`; both `initAuth` and `handleVerified` callers updated to handle `'congrats'` correctly
- Added `activeRequestExtended` and `activeRequestExpiresAt` state (Pitfall 5 — hydrated from `activeRequest.extended` and `activeRequest.expires_at` in `hydrateUserFromDb` so banner state survives reload)
- Added `handleResolveClosed(reason: 'outside' | 'canceled')`: owner-scoped UPDATE with D-01 map (`outside -> 'fulfilled'`, `canceled -> 'cancelled'`) + `closed_at`; surfaces AlertDialog on error; clears local request state on success
- Added `handleExtend`: direct owner UPDATE `{ expires_at: newExpiry, extended: true }` with optimistic state flip + rollback on error; uses existing `WRITE_ERROR_STRINGS` AlertDialog pattern
- Added `showExtendBanner` computed value: true only when `activeRequestExpiresAt` set, `!activeRequestExtended`, `requestDraft !== null`, and `0 < msLeft < EXTEND_WARN_MS (4h)` (D-17)
- Wired `onResolveClosed={handleResolveClosed}`, `showExtendBanner={showExtendBanner}`, and `onExtend={handleExtend}` to both `<RequestLive>` and `<Home>` render blocks
- Added `localStorage.removeItem('bloodhelp.lastSeenDonationAt')` to `handleLogout` (T-09-03-04 shared-device privacy)
- Added `showExtendBanner?` and `onExtend?` to `HomeProps`; inserted amber banner row in active-request card before View button (D-17); bilingual copy; inline amber tokens (#B45309) matching RequestLive banner
- `npm run build` exits 0

## Task Commits

1. **Tasks 1+2: App.tsx lifecycle wiring + file syncs** — `a3d8baa` (feat)
2. **Task 3: Home extend banner row** — `9f3e03d` (feat)

## Files Created/Modified

- `src/App.tsx` — donations channel (D-11), check-on-open (D-12), handleResolveClosed (LIFE-01), handleExtend + optimistic rollback (D-18/D-19), activeRequestExtended + activeRequestExpiresAt hydration (Pitfall 5), showExtendBanner computation (D-17), extended state cleared on logout + onGoHome
- `src/screens/Home.tsx` — HomeProps showExtendBanner? + onExtend?; amber extend banner row in active-request card (D-17)
- `src/screens/RequestLive.tsx` — Synced from main to include 09-02 changes (onResolveClosed, showExtendBanner, onExtend props + confirm_donation RPC + useZxing scanner)
- `src/types/database.ts` — Synced from main to include blood_requests.extended boolean column from 09-01

## Decisions Made

1. **handleExtend uses direct owner UPDATE** — 09-01 confirmed the `blood_requests` UPDATE policy (`requester_update`) has no column restriction. Direct `.from('blood_requests').update({ expires_at, extended: true }).eq('id', ...).eq('requester_id', uid)` is sufficient. No SECURITY DEFINER extend RPC needed.

2. **Tasks 1+2 committed atomically** — Both tasks modify only `src/App.tsx`. Splitting them would create a build-failing intermediate state: `activeRequestExtended` and `activeRequestExpiresAt` are declared in Task 1 but TypeScript's `noUnusedLocals` errors until `showExtendBanner` computation (Task 2) consumes them.

3. **database.ts and RequestLive.tsx synced from main (Rule 3)** — The worktree was created before 09-01 (extended column) and 09-02 (onResolveClosed prop, confirm RPC) merged to main. Without the sync, TypeScript errors blocked compilation. Same fix as 09-02 did for `confirm_donation` types.

4. **showExtendBanner also gated on requestDraft !== null** — Ensures the banner only computes when there is an active request in local state (belt-and-suspenders alongside the `activeRequestExpiresAt` guard).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Worktree database.ts lacked blood_requests.extended column**
- **Found during:** Task 2 first build attempt
- **Issue:** The worktree was created before 09-01 committed the regenerated `src/types/database.ts`. The worktree branch had the old types file without `extended` in the blood_requests Row/Insert/Update. TypeScript error TS2339: Property 'extended' does not exist.
- **Fix:** Copied `src/types/database.ts` from `main` branch into the worktree.
- **Files modified:** `src/types/database.ts`
- **Committed in:** `a3d8baa`

**2. [Rule 3 - Blocking] Worktree RequestLive.tsx lacked 09-02 props and confirm RPC**
- **Found during:** Task 2 first build attempt
- **Issue:** The worktree was created before 09-02 merged to main. The worktree's RequestLive.tsx was the pre-09-02 version without `onResolveClosed`, `showExtendBanner`, or `onExtend` props. TypeScript error TS2322: Property 'onResolveClosed' does not exist on RequestLiveProps.
- **Fix:** Copied `src/screens/RequestLive.tsx` from `main` branch into the worktree.
- **Files modified:** `src/screens/RequestLive.tsx`
- **Committed in:** `a3d8baa`

---

**Total deviations:** 2 auto-fixed (both Rule 3 blocking — worktree predated prior-wave commits)
**Impact on plan:** No scope change. All plan objectives achieved. Same pattern as 09-02's database.ts sync.

## Extend Write Mechanism

**Direct owner UPDATE confirmed** — Per 09-01-SUMMARY decision 2: "The `blood_requests` UPDATE policy has no column restriction. Any column can be updated by the owner directly. No SECURITY DEFINER extend RPC is needed."

Implementation in `handleExtend`:
```typescript
const { error } = await supabase
    .from("blood_requests")
    .update({ expires_at: newExpiry, extended: true })
    .eq("id", activeRequestId)
    .eq("requester_id", uid);
```

## Manual Two-Device Verification Notes (D-11 takeover, D-12 check-on-open)

**D-11 live takeover:** Requester (Device A) taps confirm for a donor's code on RequestLive -> `confirm_donation` RPC fires -> donation row inserted -> Realtime INSERT event arrives on donor's Device B -> `App.tsx` channel fires -> `setScreen('donor-congrats')` interrupts whatever screen the donor is on.

**D-12 check-on-open:** Donor (Device B) app is closed -> requester (Device A) confirms -> donation row inserted -> donor reopens app -> `hydrateUserFromDb` queries `donations WHERE created_at > lastSeenDonationAt` -> unseen row found -> returns `'congrats'` -> `initAuth` caller sets `setScreen('donor-congrats')`.

Both paths depend on the `donations` table being in `supabase_realtime` publication with REPLICA IDENTITY FULL and a SELECT RLS policy scoped to the donor (all set in 09-01).

## Known Stubs

None — all lifecycle wiring is real: handleResolveClosed writes to DB, handleExtend writes to DB, donations channel is a real Supabase Realtime subscription. No placeholder copy or hardcoded empty values.

## Threat Flags

No new network endpoints or auth paths beyond the plan's threat model. All four threat mitigations verified:
- T-09-03-01: `donations:${uid}` channel filtered by `donor_id=eq.${uid}`; Realtime honors RLS
- T-09-03-02: Both handleResolveClosed and handleExtend use `.eq('requester_id', uid)` owner scope
- T-09-03-03: handleExtend only fires when `!activeRequestExtended`; `extended` hydrated from DB (Pitfall 5)
- T-09-03-04: handleLogout clears `bloodhelp.lastSeenDonationAt`

## Self-Check: PASSED

- `src/App.tsx` exists and contains: `donations:`, `lastSeenDonationAt`, `donor-congrats`, `handleResolveClosed`, `handleExtend`, `activeRequestExtended`, `onResolveClosed=`
- `src/screens/Home.tsx` exists and contains: `showExtendBanner`, `onExtend`
- `a3d8baa` exists in git log (Tasks 1+2)
- `9f3e03d` exists in git log (Task 3)
- `npm run build` exits 0 (verified)

---
*Phase: 09-confirmation-lifecycle*
*Completed: 2026-06-24*
