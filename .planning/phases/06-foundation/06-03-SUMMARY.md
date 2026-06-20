---
phase: 06-foundation
plan: "03"
subsystem: database
tags: [supabase, postgis, rpc, seed-data, migration]
dependency_graph:
  requires: [06-01, 06-02]
  provides: [donors_within_radius_rpc, seed_data]
  affects: [06-04, 06-05]
tech_stack:
  added: []
  patterns: []
key_files:
  created: []
  modified: []
decisions:
  - "donors_within_radius uses security definer + set search_path = '' (PostGIS extensions. prefix required)"
  - "Function granted to authenticated role only (not anon)"
  - "Seed data uses fixed UUIDs (000...001 through 003) — idempotent, dev-only"
  - "Seed coordinates are pre-coarsened to 2dp per D-10 (16.82, 96.15 etc.)"
  - "Ko Kyaw (seed3) has is_available=false — correctly excluded from RPC results"
  - "Seed blood_requests use ON CONFLICT matching the partial unique index"
metrics:
  duration: "~5 minutes"
  completed: "2026-06-21"
  tasks_completed: 2
  tasks_total: 2
  files_changed: 0
---

# Phase 6 Plan 03: donors_within_radius RPC + Seed Data Summary

**One-liner:** PostGIS RPC deployed and callable; 3 donor profiles and 2 active blood requests seeded for Phase 7 dev testing.

## What Was Built

### Task 1: Deploy donors_within_radius RPC ✓

Migration `donors_within_radius_rpc` applied:
- Function `public.donors_within_radius(lat, lng, radius_km)` created
- Returns: id, name, blood_type, donation_count, lat, lng, dist_meters
- `set search_path = ''` + `extensions.` prefix on all PostGIS calls (Pitfall 5)
- `radius_km * 1000` for meters conversion (Pitfall 4)
- `security definer` — reads profiles table bypassing per-row RLS for geo-query; phone not in return columns (T-06-09)
- Granted to `authenticated` role

**Verification:**
- `information_schema.routines` contains `donors_within_radius` in public schema ✓
- `has_function_privilege('authenticated', ...)` = true ✓

### Task 2: Seed dummy data ✓

Inserted via `execute_sql` (DML, not DDL):
- 3 auth.users rows (seed1@dev.local, seed2@dev.local, seed3@dev.local) with is_anonymous=true
- 3 profile rows: Zaw Htike (O+, Bahan, is_available=true), Aye Myint (A-, Tamwe, is_available=true), Ko Kyaw (B+, Sanchaung, is_available=false)
- 2 active blood_requests: one per unique requester_id (respects one_open_request_per_user partial index)
- All coordinates pre-coarsened to 2dp per D-10

**Verification:**
- `count(*) FROM profiles WHERE is_donor=true` = 3 ✓
- `count(*) FROM blood_requests WHERE status='active'` = 2 ✓
- `SELECT * FROM donors_within_radius(16.82, 96.15, 10.0)` returns 2 rows (Zaw Htike + Aye Myint; Ko Kyaw excluded because is_available=false) ✓

## RPC Callability Confirmed

The RPC is callable from SQL and will be callable from `supabase.rpc('donors_within_radius', {...})` once the React client is wired in Plan 06-04/05.

## Deviations from Plan

None.

## Self-Check: PASSED

- ✓ donors_within_radius function exists in public schema
- ✓ Function uses extensions. prefix with set search_path = ''
- ✓ authenticated role has execute privilege
- ✓ 3 donor profiles seeded with 2dp-coarsened Yangon coordinates
- ✓ 2 active blood_requests seeded (1 per requester — respects partial unique index)
- ✓ RPC returns correct results (is_available filter working)
