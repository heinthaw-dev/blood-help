---
phase: 09-confirmation-lifecycle
plan: 02
subsystem: frontend
tags: [react, supabase, qr-scanner, react-zxing, confirmation, lifecycle]

# Dependency graph
requires:
  - phase: 09-01
    provides: "confirm_donation SECURITY DEFINER RPC; blood_requests.extended column; regenerated database.ts"
provides:
  - "RequestLive.tsx wired to confirm_donation RPC with D-06 error granularity"
  - "react-zxing real QR camera scanner behind camera-permission AlertDialog gate"
  - "Honest closedData copy: no false 'data purged' claims (D-03)"
  - "onResolveClosed prop delegates outside/cancel DB writes to App.tsx (LIFE-01)"
  - "showExtendBanner + onExtend props render amber extend banner (D-17/D-18)"
affects: [09-03]

# Tech tracking
tech-stack:
  added: [react-zxing 3.0.0]
  patterns:
    - "useZxing hook with formats: ['qr_code'] — scanned Base32 code feeds same manual confirm path"
    - "Camera pre-permission AlertDialog gate (mirrors GPS pre-permission pattern from DonorProfileSetup)"
    - "confirm_donation RPC call with JSON result branching: invalid_code / already_confirmed / transport error"
    - "Amber inline tokens (#B45309, rgba(230,120,0,.18)) for extend banner — no --color-warning CSS token exists"

key-files:
  created: []
  modified:
    - src/screens/RequestLive.tsx
    - src/App.tsx
    - src/types/database.ts
    - package.json
    - package-lock.json

key-decisions:
  - "onResolveClosed prop made required (not optional) — LIFE-01 requires the callback for every resolve path"
  - "App.tsx stub for onResolveClosed clears local state only; full DB write (handleResolveClosed) is 09-03's responsibility"
  - "database.ts synced from main into worktree to include confirm_donation RPC type from 09-01"
  - "WASM CDN default (jsDelivr) acceptable for dev/localhost; self-hosted wasmUrl is a pre-production follow-up"
  - "Tasks 2 and 3 committed together since both modify RequestLive.tsx — one atomic commit per file changed"

patterns-established:
  - "Pattern: useZxing ref on <video> inside non-interactive <div> viewport (replaces placeholder <button>)"
  - "Pattern: camera AlertDialog gate before code sheet open — explains getUserMedia prompt before it fires"
  - "Pattern: supabase.rpc('confirm_donation') returns Json; cast to { error?, units_collected?, fulfilled? }"

requirements-completed: [CONF-02, LIFE-01]

# Metrics
duration: 45min
completed: 2026-06-23
---

# Phase 9 Plan 2: RequestLive UI wiring — confirm RPC, QR scanner, honest copy, extend banner

**confirm_donation RPC wired into RequestLive; real useZxing camera QR scanner behind camera-permission dialog; false 'data purged' closed copy corrected; onResolveClosed prop delegates resolve writes to App.tsx; extend banner renders from props**

## Performance

- **Duration:** ~45 min
- **Completed:** 2026-06-23
- **Tasks:** 3
- **Files modified:** 5 (RequestLive.tsx, App.tsx, database.ts, package.json, package-lock.json)

## Accomplishments

- Installed `react-zxing` 3.0.0 (slopcheck [OK], React 19 peer dep confirmed, no postinstall scripts)
- Replaced dummy `handleConfirmInApp` (local state increment) with real `async` RPC call to `supabase.rpc('confirm_donation', { p_request_id, p_donor_code, p_via })` (D-05/D-10)
- D-06 error granularity: `invalid_code` -> generic "Invalid or unrecognized code" toast (covers unknown + non-participant, no info disclosure per T-09-02-02); `already_confirmed` -> specific "This donor is already confirmed" toast; transport error -> `AlertDialog` write-error dialog
- Added `WRITE_ERROR_STRINGS` bilingual constant + `writeError` state + `AlertDialog` for transport failures (mirrors App.tsx pattern)
- Corrected `closedData` entries: `outside` now reads "Marked as received. Glad you got the blood you needed." / MY equivalent; `canceled` reads "Your request has been marked as no longer needed." -- both drop the false "personal data purged" claim (D-03)
- Added `onResolveClosed: (reason: 'outside' | 'canceled') => void` to `RequestLiveProps`; called from both outside and cancel resolve-sheet onClick handlers (LIFE-01)
- App.tsx stub for `onResolveClosed` clears local state; 09-03 will replace with full `handleResolveClosed` DB write
- Replaced QR viewport `<button>` with non-interactive `<div>` container + `<video ref={zxingRef}>` (Pitfall 4 structural change); `useZxing` hook configured with `formats: ['qr_code']`; valid `/^[A-Z2-7]{5}$/` decode calls `setCode(raw)` feeding the same manual confirm path
- Added `cameraWarningOpen` state + camera-permission `AlertDialog` gate: "From a donor in this app" button now opens the dialog (explains getUserMedia) before `setSheet('code')`; mirrors GPS pre-permission pattern from `DonorProfileSetup.tsx`
- Added `showExtendBanner?: boolean` + `onExtend?: () => void` props; amber extend banner renders when `showExtendBanner` is true using inline amber tokens (`#B45309`, `rgba(230,120,0,.18)`) -- no `--color-warning` CSS token exists in the theme; bilingual "Request expiring soon" / "+12h" button
- Synced `src/types/database.ts` from main into worktree (adds `confirm_donation` RPC type from 09-01)
- `npm run build` exits 0

## Task Commits

1. **Task 1: Install react-zxing** -- `70f78c4` (chore, on main branch -- package.json/lock)
2. **Tasks 2+3: Wire confirm RPC + QR scanner + extend banner** -- `6935f43` (feat, on worktree branch)

## Files Created/Modified

- `src/screens/RequestLive.tsx` -- Major rewrite: confirm_donation RPC, useZxing hook, camera AlertDialog, honest closed copy, onResolveClosed prop, extend banner
- `src/App.tsx` -- Added onResolveClosed stub to RequestLive usage
- `src/types/database.ts` -- Synced from main to include confirm_donation RPC type
- `package.json` -- react-zxing ^3.0.0 added to dependencies
- `package-lock.json` -- Updated lockfile

## Decisions Made

1. **onResolveClosed made required (not optional)** -- LIFE-01 requires the App.tsx DB write on every resolve path. Making it optional would allow the prop to be forgotten, silently skipping the DB write. Required prop enforces correctness.

2. **App.tsx stub clears local state only** -- The plan scope for 09-02 is RequestLive.tsx changes. The full `handleResolveClosed` (with `blood_requests.update()` call) belongs in 09-03 which handles App.tsx additions. The stub correctly clears `requestDraft` and `activeRequestId` so the UI transitions correctly while 09-03 wires the DB write.

3. **Tasks 2 and 3 committed together** -- Both tasks modify only `RequestLive.tsx` (plus the database.ts sync that unlocks compilation). A single atomic commit is cleaner than splitting modifications to the same file.

4. **WASM CDN default acceptable** -- Production PWA requires a self-hosted `wasmUrl` to avoid jsDelivr CDN dependency in offline mode. Phase 9 runs on localhost where CDN is reachable. Tracked as known follow-up (Pitfall 7 from RESEARCH.md).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Worktree database.ts lacked confirm_donation RPC type**
- **Found during:** Task 2 -- first `npm run build` failed with TypeScript error TS2345 on `supabase.rpc('confirm_donation')`
- **Issue:** The worktree was created before 09-01 committed the regenerated `src/types/database.ts`. The worktree branch had the old types file without `confirm_donation` in the Functions section.
- **Fix:** Copied `src/types/database.ts` from `main` branch (commit 0877556) into the worktree and committed it alongside the RequestLive changes.
- **Files modified:** `src/types/database.ts`
- **Committed in:** `6935f43`

---

**Total deviations:** 1 auto-fixed (1 blocking issue -- type file sync)
**Impact on plan:** No scope change. All plan objectives achieved.

## New Props Added to RequestLiveProps (for 09-03 to consume)

| Prop | Type | Required | Purpose |
|------|------|----------|---------|
| `onResolveClosed` | `(reason: 'outside' or 'canceled') => void` | Required | LIFE-01 -- App.tsx writes status + closed_at |
| `showExtendBanner` | `boolean` | Optional | D-17 -- supplied by App.tsx in 09-03 |
| `onExtend` | `() => void` | Optional | D-18 -- supplied by App.tsx in 09-03 |

**Note for 09-03:** The App.tsx `onResolveClosed` stub must be replaced with `handleResolveClosed` which:
- Maps `'outside'` -> `status='fulfilled'` (D-01)
- Maps `'canceled'` -> `status='cancelled'` (D-01)
- Calls `supabase.from('blood_requests').update({ status, closed_at: new Date().toISOString() }).eq('id', activeRequestId).eq('requester_id', uid)`
- Clears `requestDraft` and `activeRequestId` on success

## Known Stubs

**App.tsx `onResolveClosed` stub (intentional -- 09-03 scope):**
- Location: `src/App.tsx`, `RequestLive` usage
- Current behavior: clears `requestDraft` + `activeRequestId` (local state only)
- Required behavior: DB write `blood_requests.update({ status, closed_at })` per D-01 mapping
- Resolution plan: 09-03 replaces stub with `handleResolveClosed` function

## Production Follow-up: WASM wasmUrl (Pitfall 7)

`react-zxing` loads `zxing_reader.wasm` from jsDelivr CDN by default. In production PWA (offline-capable after `vite-plugin-pwa` is installed), the WASM file must be:
1. Bundled into the build output (copy via Vite plugin or public/ folder)
2. Passed to `useZxing` as `wasmUrl: '/zxing_reader.wasm'`

This is a pre-production hardening step, not a Phase 9 blocker. Track for the PWA manifest phase.

## Threat Flags

No new network endpoints or auth paths beyond the plan's threat model. The `confirm_donation` RPC call is the only new Supabase entry point exercised client-side; it already has `anon` EXECUTE revoked (hardened in 09-01). The camera `getUserMedia` path is browser-tier only and does not cross any Supabase trust boundary.

## Self-Check: PASSED

- `src/screens/RequestLive.tsx` exists in worktree with `confirm_donation`, `useZxing`, `onResolveClosed`, `cameraWarningOpen`, `showExtendBanner`
- `70f78c4` exists in git log (react-zxing install on main)
- `6935f43` exists in worktree git log (RequestLive wiring)
- `npm run build` exits 0 (verified)
- No "purged" in user-facing closed copy body/bodyEn strings (verified via grep)
- Both resolve handlers (outside + canceled) call `onResolveClosed` (verified via grep)

---
*Phase: 09-confirmation-lifecycle*
*Completed: 2026-06-23*
