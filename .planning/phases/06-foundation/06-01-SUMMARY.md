---
phase: 06-foundation
plan: "01"
subsystem: database
tags: [supabase, schema, postgresql, postgis, migration]
dependency_graph:
  requires: []
  provides: [schema, enums, tables]
  affects: [06-02, 06-03, 06-04, 06-05]
tech_stack:
  added: []
  patterns: []
key_files:
  created: []
  modified: []
decisions:
  - "PostGIS enabled under extensions schema (not public)"
  - "5 enums created: blood_type, request_status, response_status, urgency, lang"
  - "5 tables created in FK-safe order: profiles → device_tokens → blood_requests → request_responses → donations"
  - "partial unique index one_open_request_per_user on blood_requests WHERE status='active'"
metrics:
  duration: "~5 minutes"
  completed: "2026-06-21"
  tasks_completed: 2
  tasks_total: 2
  files_changed: 0
---

# Phase 6 Plan 01: Enable PostGIS and Create Tables Summary

**One-liner:** Full Postgres schema deployed — PostGIS, 5 enums, 5 tables, partial unique index.

## What Was Built

### Task 1: Enable PostGIS and create all enums ✓

Migration `enable_postgis_and_enums` applied successfully:
- `postgis` extension enabled under `extensions` schema
- 5 enums created: `blood_type`, `request_status`, `response_status`, `urgency`, `lang`

**Verification passed:**
- `pg_extension` contains `postgis` ✓
- `pg_type WHERE typtype='e'` returns all 5 project enums alongside system enums ✓

### Task 2: Create all 5 tables and constraints ✓

Migration `create_tables` applied successfully. Tables created in FK-dependency order:
1. `profiles` — 18 columns, PK references `auth.users(id)` on delete cascade, `donor_code` unique
2. `device_tokens` — FK to `profiles(id)` on delete cascade, `fcm_token` unique
3. `blood_requests` — FK to `profiles(id)` on delete cascade, `expires_at timestamptz not null` (no default)
4. `request_responses` — FKs to `blood_requests(id)` and `profiles(id)`, unique `(request_id, donor_id)`
5. `donations` — FK to `blood_requests(id)` on delete set null, dual FK to `profiles(id)` for donor/recipient

Partial unique index: `one_open_request_per_user ON blood_requests (requester_id) WHERE status = 'active'`

**Verification passed:**
- `list_tables` returns all 5 tables ✓
- `pg_indexes` contains `one_open_request_per_user` ✓
- `profiles` columns verified: all 18 columns match spec §4 exactly ✓

## Deviations from Plan

None. Schema matches blood-help-spec.md §4 verbatim.

## Threat Surface Scan

No application code changed. Schema deployed via MCP. Threats T-06-01 through T-06-03 mitigated by schema structure (spec-exact DDL, correct partial index, profiles FK cascade). RLS not yet enabled — addressed in Plan 06-02.

## Self-Check: PASSED

- ✓ PostGIS enabled in extensions schema
- ✓ All 5 enums exist
- ✓ All 5 tables exist with correct columns, types, defaults, and FKs
- ✓ `one_open_request_per_user` partial unique index exists
- ✓ No deviations from spec §4
