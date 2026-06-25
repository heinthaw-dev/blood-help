---
phase: quick-260625-taj
plan: "01"
subsystem: database
tags: [migration, postgis, rpc, bug-fix]
dependency_graph:
  requires: []
  provides: [callable_donors_for_request-fixed]
  affects: [RequestLive.tsx, public.donors, public.callable_donors_for_request]
tech_stack:
  added: []
  patterns: [inline geography construction from lat/lng, SECURITY DEFINER RPC, owner guard]
key_files:
  created:
    - supabase/migrations/20260625143600_fix_callable_donors_geog_column.sql
  modified: []
decisions:
  - "Use extensions.st_point(lng, lat) for both donor and request points, consistent with three sibling functions"
  - "Update header comment only — every SQL line outside the two point expressions is byte-for-byte preserved"
metrics:
  duration: ~5 min
  completed: "2026-06-25"
  tasks_completed: 1
  tasks_total: 1
---

# Phase quick-260625-taj Plan 01: Fix callable_donors_for_request d.geog Reference Summary

## One-liner

Fixed error 42703 in `callable_donors_for_request` by replacing `d.geog` with `extensions.st_point(d.lng, d.lat)::extensions.geography` inline, matching the established sibling-function pattern.

## What Was Built

A new migration file `supabase/migrations/20260625143600_fix_callable_donors_geog_column.sql` containing a `CREATE OR REPLACE FUNCTION public.callable_donors_for_request(uuid)` that is identical to the previously-applied definition (`20260624171342`) except for four point-construction substitutions:

| Location | Before | After |
|----------|--------|-------|
| `st_distance` arg 1 | `d.geog` | `extensions.st_point(d.lng, d.lat)::extensions.geography` |
| `st_distance` arg 2 | `extensions.st_makepoint(v_lng, v_lat)::extensions.geography` | `extensions.st_point(v_lng, v_lat)::extensions.geography` |
| `st_dwithin` arg 1 | `d.geog` | `extensions.st_point(d.lng, d.lat)::extensions.geography` |
| `st_dwithin` arg 2 | `extensions.st_makepoint(v_lng, v_lat)::extensions.geography` | `extensions.st_point(v_lng, v_lat)::extensions.geography` |

Everything else is byte-for-byte unchanged: `RETURNS TABLE` signature, `LANGUAGE plpgsql`, `SECURITY DEFINER`, `SET search_path = ''`, owner guard, blood-type compatibility CASE expression, 10000 m radius literal, `ORDER BY dist_meters NULLS LAST`, and `GRANT EXECUTE ... TO authenticated`.

## Tasks

| # | Name | Commit | Files |
|---|------|--------|-------|
| 1 | Author the fix migration file | 9ab4240 | supabase/migrations/20260625143600_fix_callable_donors_geog_column.sql |

## Verification

Automated verify (from plan) passed:

- File exists at `supabase/migrations/20260625143600_fix_callable_donors_geog_column.sql`
- No occurrence of `d.geog` in the file
- `extensions.st_point(d.lng, d.lat)::extensions.geography` appears exactly 2 times
- `GRANT EXECUTE ON FUNCTION public.callable_donors_for_request(uuid) TO authenticated` present
- `SECURITY DEFINER` present
- `SET search_path = ''` present

## Deviations from Plan

**1. [Rule 1 - Bug] Header comment contained literal `d.geog` substring, causing automated grep to fail**

- **Found during:** Task 1 verification
- **Issue:** The initial header comment used `d.geog` in its prose, causing `! grep -q 'd\.geog'` to exit non-zero
- **Fix:** Rewrote the header comment to describe the fix without embedding the literal column reference (`d.geog` → `donors.geog column`)
- **Files modified:** supabase/migrations/20260625143600_fix_callable_donors_geog_column.sql
- **Commit:** 9ab4240 (same commit — fix applied before staging)

## Known Stubs

None. This is a pure SQL migration with no frontend stubs.

## Threat Flags

None. No new network endpoints or auth paths introduced. The function retains its SECURITY DEFINER owner guard and GRANT to `authenticated` only.

## Self-Check: PASSED

- `supabase/migrations/20260625143600_fix_callable_donors_geog_column.sql` — FOUND
- Commit `9ab4240` — FOUND

## Orchestrator-Owned Next Step

The orchestrator must apply this migration via Supabase MCP `apply_migration` (name: `fix_callable_donors_geog_column`) and verify with:

```sql
SELECT pg_get_functiondef('public.callable_donors_for_request(uuid)'::regprocedure);
-- Confirm: contains st_point(d.lng, d.lat), contains NO d.geog

SELECT * FROM public.callable_donors_for_request('00000000-0000-0000-0000-000000000000'::uuid);
-- Confirm: returns zero rows without 42703 error
```
