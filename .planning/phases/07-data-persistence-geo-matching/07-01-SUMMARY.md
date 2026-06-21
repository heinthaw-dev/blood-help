---
plan: 07-01
phase: 07-data-persistence-geo-matching
status: complete
completed_at: 2026-06-22
migration: phase7_profiles_donors_split
---

# Plan 07-01: Schema Migration + Type Regeneration

## What Was Built

Applied the Phase 7 schema revision to the live Supabase project (`dfrpqkutjsnfgkdmcadi.supabase.co`), regenerated `src/types/database.ts` from the live DB, and seeded 3 donor rows with auto-generated donor codes.

## Tasks Completed

| Task | Status | Notes |
|------|--------|-------|
| Task 1: Pre-migration audit | ✓ | A4 confirmed; no policies reference dropped columns |
| Task 1.5: Human checkpoint | ✓ | Approved by user |
| Task 2: Apply migration, regenerate types, re-seed | ✓ | Single apply_migration call; all acceptance checks passed |

## Pre-Migration Audit (Task 1)

- **profiles baseline**: 3 rows with all 12 donor columns present (confirmed pre-migration)
- **donors table**: did not exist (confirmed)
- **blood_requests**: `township` column present (2 rows)
- **A4 CONFIRMED**: policies on `profiles` (`own_profile_select/insert/update`) and `blood_requests` (`active_requests_select`, `requester_insert/update`) reference only `id`, `requester_id`, and `status` — zero references to any of the 12 columns being dropped
- **donors_within_radius signature**: `lat double precision, lng double precision, radius_km double precision` — matched DROP FUNCTION exactly
- **one_open_request_per_user baseline**: `USING btree (requester_id) WHERE (status = 'active')` — no `township` reference, confirmed safe to survive RENAME COLUMN

## Migration Applied

Migration name: `phase7_profiles_donors_split`

Steps applied (all in single `apply_migration` call):
1. ✓ `ALTER TABLE public.profiles DROP COLUMN IF EXISTS` × 12 donor columns
2. ✓ `CREATE TABLE public.donors` with 13 columns + FK + UNIQUE + RLS enabled
3. ✓ `generate_donor_code()` function + `set_donor_code_on_insert()` trigger → `donors_set_donor_code` BEFORE INSERT trigger
4. ✓ `ALTER TABLE public.blood_requests RENAME COLUMN township TO current_address`
5. ✓ `public.set_updated_at()` trigger function + `profiles_set_updated_at` + `donors_set_updated_at` BEFORE UPDATE triggers
6. ✓ `DROP FUNCTION public.donors_within_radius(double precision, double precision, double precision)` + recreated querying `public.donors`
7. ✓ `CREATE FUNCTION public.requests_within_radius(...)` — new GEO-02 RPC; SECURITY DEFINER; GRANT to authenticated
8. ✓ `donors_select_own` / `donors_insert_own` / `donors_update_own` RLS policies on `public.donors`

## Acceptance Checks (all passed)

| Check | Result |
|-------|--------|
| `blood_requests.current_address` column exists | ✓ 1 row |
| `blood_requests.township` column does NOT exist | ✓ 0 rows |
| `one_open_request_per_user` index survived RENAME | ✓ 1 row |
| `profiles_set_updated_at` trigger — BEFORE UPDATE on profiles | ✓ |
| `donors_set_updated_at` trigger — BEFORE UPDATE on donors | ✓ |
| `set_updated_at` function in pg_proc | ✓ |
| `requests_within_radius` in pg_proc; callable without error | ✓ |
| `donors_within_radius` in pg_proc (recreated against donors) | ✓ |
| `donors_select_own`, `donors_insert_own`, `donors_update_own` policies | ✓ 3 rows |
| 3 seed donor rows with non-null 5-char donor_codes | ✓ SZNVL / TXBPZ / EX6DG |
| `src/types/database.ts` contains `requests_within_radius` | ✓ |
| `src/types/database.ts` contains `donors:` block | ✓ |
| `src/types/database.ts` contains `current_address` | ✓ 4 refs |
| `src/types/database.ts` has 0 `township` references | ✓ |
| `npm run build` succeeds | ✓ 0 TypeScript errors |

## Expected tsc Errors for Plans 03/04

**None found.** The build passed cleanly with 0 errors. The existing App.tsx and Home.tsx code does not directly reference the renamed `township` column by the typed DB path (they use in-memory dummy state). Plans 03/04 will introduce the live Supabase calls, at which point the type system will guide correct column naming.

## Key Files

### Modified
- `src/types/database.ts` — regenerated from live DB (+77 / -36 lines): added `donors` table block, `requests_within_radius` function, replaced `township` with `current_address` throughout

## Deviations

- **Inline execution**: Plan 07-01 has Supabase MCP dependencies and a blocking human checkpoint, so it was executed inline by the orchestrator rather than delegated to a gsd-executor subagent.

## Self-Check: PASSED
