---
plan: 07-03
phase: 07-data-persistence-geo-matching
status: complete
completed_at: 2026-06-22
subsystem: frontend-persistence
tags: [supabase, upsert, geolocation, gps, hydration, e164, alert-dialog, donor-profile, blood-requests]

dependency_graph:
  requires: [07-01]
  provides: [real handleSaveDonor dual-upsert, real handlePosted insert, expanded initAuth hydration, GeoPhase donor GPS flow, UserState lat/lng, Home donor props for plan 04]
  affects: [src/App.tsx, src/screens/DonorProfileSetup.tsx, src/screens/Home.tsx]

tech_stack:
  added: []
  patterns:
    - GeoPhase state machine (idle/prealert/requesting/denied) in DonorProfileSetup
    - Supabase dual upsert (profiles then donors, onConflict by pk)
    - Bare .insert() without .select()/.single() + 23505 error branching
    - .maybeSingle() three-query hydration pattern in initAuth
    - E.164 phone normalization via normalizePhone()
    - AlertDialog write-error surface (no toasts, no inline errors)
    - coarsenCoordinates() called before every lat/lng DB write

key_files:
  modified:
    - src/App.tsx — UserState lat/lng, normalizePhone, dual-upsert handleSaveDonor, insert handlePosted with 23505/generic error dialogs, expanded initAuth hydration, writeError AlertDialog, Home donor props
    - src/screens/DonorProfileSetup.tsx — DonorProfile lat/lng, GeoPhase state machine, handleSave/requestLocationAndSave, pre-permission/denied AlertDialogs, 7 new bilingual geo strings
    - src/screens/Home.tsx — HomeProps extended with donorLat/donorLng/currentUserId/donorBloodType (optional, plan 04 wires them)

decisions:
  - Write-error AlertDialog mounted alongside Home and Profile screens so it surfaces regardless of which screen triggered the error
  - donor_code deliberately absent from donors upsert payload (DB trigger owns assignment; sending it would overwrite on UPDATE)
  - normalizePhone is private to App.tsx — called only from handleSaveDonor and handlePosted
  - HomeProps new fields declared optional to avoid breaking the existing call sites in other screens; plan 04 will pass real values
  - Home.tsx destructures new props with _ prefix so noUnusedParameters: true does not fail tsc

metrics:
  duration: ~25 minutes
  completed_date: 2026-06-22
  tasks_completed: 2
  files_modified: 3
---

# Phase 07 Plan 03: Supabase Writes, GPS Flow, and Hydration Summary

**One-liner:** GeoPhase donor GPS flow (pre-permission AlertDialog → coarsen → onSave with lat/lng), real dual-upsert handleSaveDonor and bare-insert handlePosted with 23505 duplicate branching, and full three-query initAuth hydration (profiles + donors + active request).

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Add GeoPhase GPS flow + lat/lng to DonorProfileSetup | d69b929 | src/screens/DonorProfileSetup.tsx |
| 2 | Wire real App handlers, hydration, write-error dialog, E.164, UserState lat/lng | 943be34 | src/App.tsx, src/screens/Home.tsx |

## What Was Built

### Task 1 — DonorProfileSetup.tsx

Added the full `GeoPhase = 'idle' | 'prealert' | 'requesting' | 'denied'` state machine to the donor profile save flow, mirroring the pattern from CreateRequest.tsx:

- `DonorProfile` interface extended with `lat: number` and `lng: number` (Pitfall 8 coupling — required by handleSaveDonor)
- Save button's `onClick` replaced with `handleSave()` which guards form validity then sets `geoPhase('prealert')`
- `requestLocationAndSave()`: awaits `getCurrentPosition()`, coarsens via `coarsenCoordinates()`, calls `onSave({...profile, lat, lng})` on success; sets `geoPhase('denied')` on failure — does NOT call `onSave` (D-12)
- Two `AlertDialog` mounts: pre-permission (open on `prealert | requesting`) and denied (open on `denied`)
- Save button disabled when `saveDisabled || geoPhase === 'requesting'`
- 7 new strings in both `my` and `en` objects: `geoTitle`, `geoMsg`, `geoConfirm`, `geoCancel`, `deniedTitle`, `deniedMsg`, `deniedConfirm`
- Imports: `AlertDialog` (value), `getCurrentPosition` and `coarsenCoordinates` (value); existing `BloodType` and `Lang` already used `import type`

### Task 2 — App.tsx + Home.tsx

**UserState expansion:**
- Added `lat: number | null` and `lng: number | null`; `DEFAULT_USER` sets both to `null`

**normalizePhone:**
- Private function: strips non-digits from user input, prepends `+95` for Myanmar E.164 format

**initAuth hydration (D-13, D-14):**
- After session restore, loads `profiles/*`, `donors/*` (may be null — pure requester), and own active `blood_requests` via `.maybeSingle()` (never throws; null = 0 rows)
- `setUser()` maps profile + donor fields; `setRequestDraft()` maps active request to `RequestDraft` — drives `hasOpenRequest` and Home CTA-hide (D-16)

**handleSaveDonor (BACK-05, D-15):**
- Step 1: `supabase.from('profiles').upsert({id, name, phone: normalizePhone(...), language, updated_at}, {onConflict: 'id'})`
- Step 2: `supabase.from('donors').upsert({profile_id, blood_type, emergency_callable, is_available, lat, lng, location_updated_at, updated_at}, {onConflict: 'profile_id'})`
- `donor_code` is never sent — trigger assigns on INSERT, silent on UPDATE (Pitfall 3)
- Each step: on error → `setWriteError(...)` and `return`; no throw

**handlePosted (BACK-06):**
- Bare `.insert({requester_id, blood_type, current_address, lat, lng, contact_phone: normalizePhone(...), units_needed, urgency, status: 'active', expires_at: now()+24h})`
- `error.code === '23505'` → duplicate-request dialog (D-17 backstop)
- Other errors → generic write-failure dialog (D-18)
- No `.select()` or `.single()` chained (Pitfall 1)

**writeError AlertDialog:**
- `useState<{title:string;message:string} | null>(null)` drives a single `AlertDialog` mounted in both `home` and `profile` render branches
- Bilingual error strings: `duplicateTitle`, `duplicateMsg`, `genericTitle`, `genericMsg`, `retry`, `dismiss`

**Home props for plan 04:**
- `HomeProps` extended with optional `donorLat`, `donorLng`, `currentUserId`, `donorBloodType`
- App passes `donorLat={user.lat}`, `donorLng={user.lng}`, `currentUserId={user.supabaseId}`, `donorBloodType={user.bloodType}` — exact names plan 04 consumes
- Home.tsx destructures with `_` prefix to satisfy `noUnusedParameters: true`

## Acceptance Checks

| Check | Result |
|-------|--------|
| `grep -c "GeoPhase" src/screens/DonorProfileSetup.tsx` >= 2 | 9 (type def + state + 4 comparisons + 3 setGeoPhase calls) |
| DonorProfile interface contains lat: number and lng: number | ✓ |
| getCurrentPosition + coarsenCoordinates imported as values | ✓ |
| AlertDialog imported in DonorProfileSetup | ✓ |
| onSave called only on res.ok path; denied path does NOT call onSave | ✓ |
| `grep -c "coarsenCoordinates" src/screens/DonorProfileSetup.tsx` >= 1 | 2 |
| Save button disabled includes `geoPhase === 'requesting'` | ✓ |
| 7 geo strings in both my and en | ✓ |
| UserState has lat/lng; DEFAULT_USER sets both null | ✓ |
| `grep -c "normalizePhone" src/App.tsx` >= 3 | 3 (definition + handleSaveDonor + handlePosted) |
| handleSaveDonor has two .upsert() calls; no donor_code in payload | ✓ |
| handlePosted bare .insert() with status:'active' + expires_at + 23505 branch | ✓ |
| initAuth has .from('donors') + .from('blood_requests') via .maybeSingle() with requester_id + status filters | ✓ |
| AlertDialog driven by writeError state; two distinct setWriteError paths in handlePosted | ✓ |
| Home render passes donorLat/donorLng/currentUserId/donorBloodType (exact names) | ✓ |
| `grep -c "township" src/App.tsx` = 0 | 0 |
| `npm run build` passes — 0 TypeScript errors | ✓ |

## Deviations from Plan

### Auto-added — HomeProps for plan 04 coupling

**Found during:** Task 2

**Issue:** App.tsx passes `donorLat`, `donorLng`, `currentUserId`, `donorBloodType` to `<Home />` but `HomeProps` interface had no such fields — TypeScript would fail.

**Fix:** Extended `HomeProps` in `Home.tsx` with the four optional fields; destructured them with `_` prefix to satisfy `noUnusedParameters: true` until plan 04 wires the live feed logic.

**Files modified:** src/screens/Home.tsx

**Commit:** 943be34 (included in Task 2 commit — same file, same task boundary)

## Known Stubs

The `Home.tsx` feed still renders `DUMMY_REQUESTS` — plan 04 replaces this with the live `requests_within_radius` RPC feed using the four new props. This is intentional and tracked in the plan sequence.

## Threat Surface Scan

No new network endpoints, auth paths, or schema changes introduced in this plan. All DB writes are gated by `user.supabaseId` (returns early if null). The donor upsert uses `profile_id = uid` and RLS `donors_insert_own` / `donors_update_own` policies (deployed in plan 07-01) enforce this server-side. The blood_requests insert uses `requester_id = uid` and the existing requester RLS policies. No new threat surface beyond what the plan's threat_model anticipated.

## Self-Check: PASSED

- `src/screens/DonorProfileSetup.tsx` — exists and modified (GeoPhase, lat/lng, AlertDialogs)
- `src/App.tsx` — exists and modified (handleSaveDonor, handlePosted, initAuth, UserState, writeError)
- `src/screens/Home.tsx` — exists and modified (HomeProps extended)
- Commit d69b929 — exists (`git log --oneline | grep d69b929`)
- Commit 943be34 — exists (`git log --oneline | grep 943be34`)
- `npm run build` — 0 TypeScript errors, 0 build errors
