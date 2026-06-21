---
plan: 07-04
phase: 07-data-persistence-geo-matching
status: complete
completed_at: 2026-06-22
subsystem: frontend-persistence
tags: [supabase, rpc, geo, feed, blood-type-compatibility, burmese-numerals, required-field]

dependency_graph:
  requires: [07-01, 07-02, 07-03]
  provides: [live requests_within_radius feed, directional compatibility filter, own-request exclusion, required current_address, Burmese distance/time labels]
  affects: [src/screens/CreateRequest.tsx, src/screens/Home.tsx]

tech_stack:
  added: []
  patterns:
    - supabase.rpc() live feed with cancelled-flag useEffect cleanup
    - Client-side directional blood-type compatibility filter via COMPATIBLE_REQUEST_TYPES
    - Null-coord guard before RPC call (Pitfall 6)
    - formatDistanceLabel / formatTimeAgo with formatNumber for Burmese numerals
    - Required-field guard in postDisabled (address.trim().length === 0)

key_files:
  modified:
    - src/screens/CreateRequest.tsx — postDisabled now includes address.trim().length === 0; Optional divider and optional string removed
    - src/screens/Home.tsx — DUMMY_REQUESTS removed; live requests_within_radius RPC feed; NearbyRequest refactored to currentAddress/distMeters/createdAt; formatDistanceLabel/formatTimeAgo helpers; empty state render

decisions:
  - Null-coord guard also checks donorBloodType (needed for COMPATIBLE_REQUEST_TYPES lookup — avoids undefined key error when blood type not set)
  - Empty state rendered inline in the feed section (reuses existing t.emptyTitle / t.emptyHint strings, no new component needed)
  - Optional divider removed entirely rather than repositioned — units/urgency are implicitly optional by having defaults (1 unit, urgent)
  - donorLat/donorLng destructured with default = null (not = undefined) so the null-coord guard works predictably

metrics:
  duration: ~15 minutes
  completed_date: 2026-06-22
  tasks_completed: 2
  files_modified: 2
---

# Phase 07 Plan 04: Required Address and Live Feed Summary

**One-liner:** Required current_address guard in CreateRequest (Optional divider removed) and live requests_within_radius RPC feed in Home with directional COMPATIBLE_REQUEST_TYPES filter, own-request exclusion, null-coord guard, and Burmese distance/time-ago labels.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Make current_address required in CreateRequest | b28759a | src/screens/CreateRequest.tsx |
| 2 | Replace DUMMY_REQUESTS with live requests_within_radius feed in Home | 2d91a9b | src/screens/Home.tsx |

## What Was Built

### Task 1 — CreateRequest.tsx

Made `current_address` a required field (D-09):

- `postDisabled` guard updated to `!bloodType || phone.replace(/\D/g, '').length === 0 || address.trim().length === 0`
- "Optional" divider block between address and units sections removed entirely (the 28px-marginTop flex row rendering `copy.optional`)
- `optional` key removed from both `my` and `en` strings objects
- No other changes — GeoPhase state machine and `onPosted` callback unchanged; `App.handlePosted` (plan 03) performs the DB write

### Task 2 — Home.tsx

Replaced static `DUMMY_REQUESTS` with a live, proximity- and compatibility-filtered RPC feed:

**Imports restructured:**
- Value imports: `useState`, `useEffect` from react; `COMPATIBLE_REQUEST_TYPES` from `../blood`; `formatNumber` from `../i18n`; `supabase` from `../lib/supabase`
- Type-only imports (`import type`): `BloodType` from `../blood`; `Lang` from `../i18n` (verbatimModuleSyntax: true compliance)

**NearbyRequest interface refactored** to DB-derived shape:
- Dropped bilingual `Record<Lang, string>` fields: `township`, `distance`, `timeAgo`
- Added: `currentAddress: string`, `distMeters: number`, `createdAt: string`

**DUMMY_REQUESTS removed** — replaced with `useState<NearbyRequest[]>([])` state variable.

**`const DISPLAY_RADIUS_KM = 10`** declared at module scope.

**`useEffect` with `loadFeed`** keyed on `[donorLat, donorLng, donorBloodType, currentUserId]`:
- Null-coord guard: `if (!donorLat || !donorLng || !donorBloodType) { setRequests([]); return }` (Pitfall 6)
- `supabase.rpc('requests_within_radius', { lat, lng, radius_km: DISPLAY_RADIUS_KM })` — passes km, NOT meters (RPC converts — Pitfall 2 avoided)
- Filter 1: `.filter(r => r.requester_id !== currentUserId)` — own-request exclusion
- Filter 2: `.filter(r => COMPATIBLE_REQUEST_TYPES[donorBloodType].includes(r.blood_type))` — directional GEO-01 compatibility
- `.map()` into `NearbyRequest` shape (currentAddress, distMeters, createdAt, urgent, phone, bloodType)
- Cancelled flag for cleanup

**Helper functions added:**
- `formatDistanceLabel(distMeters, lang)`: `~X km` for >=1 km, `~X m` for <1 km, Burmese numerals via `formatNumber`
- `formatTimeAgo(createdAt, lang)`: min/hr ago with Burmese numerals via `formatNumber`

**RequestCard updated:**
- `req.township[lang]` → `req.currentAddress` (plain string)
- `req.distance[lang]` → `formatDistanceLabel(req.distMeters, lang)`
- `req.timeAgo[lang]` → `formatTimeAgo(req.createdAt, lang)`

**Feed section updated:**
- Empty state rendered when `requests.length === 0` using `t.emptyTitle` and `t.emptyHint`
- Live data renders via `requests.map(...)` when non-empty

**Props destructuring updated:**
- Removed `_` prefixes from `donorLat`, `donorLng`, `currentUserId`, `donorBloodType` — all four are now actively used
- Default values: `donorLat = null`, `donorLng = null`, `currentUserId = null`

## Acceptance Checks

| Check | Result |
|-------|--------|
| `grep -c "address.trim" src/screens/CreateRequest.tsx` >= 1 | 1 |
| postDisabled includes empty-address guard | ✓ |
| Optional divider removed | ✓ (`grep -c "optional" src/screens/CreateRequest.tsx` = 0) |
| `grep -c "township" src/screens/CreateRequest.tsx` = 0 | 0 |
| `grep -c "requests_within_radius" src/screens/Home.tsx` >= 1 | 1 |
| `grep -c "DUMMY_REQUESTS" src/screens/Home.tsx` = 0 | 0 |
| Own-request exclusion: `requester_id !== currentUserId` | ✓ |
| COMPATIBLE_REQUEST_TYPES filter present | ✓ |
| NearbyRequest has currentAddress, distMeters, createdAt | ✓ |
| NearbyRequest does NOT have township or Record<Lang, ...> fields | ✓ |
| RPC called with radius_km: DISPLAY_RADIUS_KM (10, not *1000) | ✓ |
| Null-coord guard exists (`!donorLat`) | ✓ |
| formatDistanceLabel and formatTimeAgo use formatNumber | ✓ |
| `grep -c "township" src/screens/Home.tsx` = 0 | 0 |
| BloodType and Lang imported via `import type` | ✓ |
| COMPATIBLE_REQUEST_TYPES and formatNumber as value imports | ✓ |
| `npm run build` passes — 0 TypeScript errors | ✓ |

## Deviations from Plan

None — plan executed exactly as written.

The null-coord guard also checks `!donorBloodType` (not specified in the plan's Pitfall 6 guard example) because the `COMPATIBLE_REQUEST_TYPES[donorBloodType]` lookup on line 237 would produce undefined if `donorBloodType` were absent. This is a Rule 2 addition (missing null check for correctness) that is consistent with Pitfall 6's intent.

## Known Stubs

None. All four feed-related props (`donorLat`, `donorLng`, `currentUserId`, `donorBloodType`) are wired through from App.tsx (plan 03 set them up). The feed is live against the real `requests_within_radius` RPC.

## Threat Surface Scan

No new network endpoints or auth paths introduced. The `supabase.rpc('requests_within_radius', ...)` call is the only new network surface — it is SECURITY DEFINER (deployed in plan 01) and returns only requester-side columns (no donor PII). The client-side filters (own-request exclusion, COMPATIBLE_REQUEST_TYPES) are defense-in-depth; RLS on the RPC handles server-side access control. No new threat surface beyond what the plan's threat_model anticipated (T-07-11 through T-07-14 all mitigated as designed).

## Self-Check: PASSED

- `src/screens/CreateRequest.tsx` — exists; `address.trim()` in postDisabled; optional divider removed
- `src/screens/Home.tsx` — exists; `requests_within_radius` called; DUMMY_REQUESTS absent; NearbyRequest has currentAddress/distMeters/createdAt
- Commit b28759a — exists (Task 1: CreateRequest required address)
- Commit 2d91a9b — exists (Task 2: Home live feed)
- `npm run build` — 0 TypeScript errors, 0 build errors
