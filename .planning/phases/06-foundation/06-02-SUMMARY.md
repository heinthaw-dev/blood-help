---
phase: 06-foundation
plan: "02"
subsystem: database
tags: [supabase, rls, security, policies, migration]
dependency_graph:
  requires: [06-01]
  provides: [rls_policies]
  affects: [06-03, 06-04, 06-05]
tech_stack:
  added: []
  patterns: []
key_files:
  created: []
  modified: []
decisions:
  - "All policies use `to authenticated` (anonymous auth users hold authenticated role — Pitfall 2)"
  - "All policies use (select auth.uid()) form for performance (avoids per-row function call)"
  - "profiles SELECT restricted to own row only — prevents phone column exposure to other users"
  - "blood_requests SELECT allows all active requests (contact_phone gating to within-range donors deferred to Phase 7 per spec §4.3)"
  - "request_responses visible to donor_id and the requester of the linked blood_request"
  - "donations visible to donor_id and recipient_id only"
metrics:
  duration: "~5 minutes"
  completed: "2026-06-21"
  tasks_completed: 2
  tasks_total: 2
  files_changed: 0
---

# Phase 6 Plan 02: Enable RLS and Deploy Policies Summary

**One-liner:** RLS enabled on all 5 tables; 11 policies deployed locking down access at the database layer.

## What Was Built

### Task 1: RLS on profiles, blood_requests, device_tokens ✓

Migration `rls_profiles_requests_tokens` applied:

- **profiles** — RLS enabled; 3 policies (own_profile_select, own_profile_insert, own_profile_update). SELECT restricted to own row — prevents any user from reading another's phone number.
- **blood_requests** — RLS enabled; 3 policies (active_requests_select, requester_insert, requester_update). All authenticated users can read active requests; only the requester can insert/update.
- **device_tokens** — RLS enabled; 1 policy (own_tokens_all). Owner-only access via profile_id.

**Verification:** `pg_tables WHERE schemaname='public'` — blood_requests, device_tokens, profiles all show `rowsecurity: true` ✓

### Task 2: RLS on request_responses and donations ✓

Migration `rls_responses_donations` applied:

- **request_responses** — RLS enabled; 2 policies (response_parties_select, donor_response_insert). Visible only to donor_id and the requester of the linked blood_request (subquery into blood_requests).
- **donations** — RLS enabled; 2 policies (donation_parties_select, donation_insert). Visible only to donor_id and recipient_id.

**Verification:**
- `pg_tables WHERE schemaname='public'` — all 5 tables show `rowsecurity: true` ✓
- `count(*) FROM pg_policies WHERE schemaname='public'` = 11 ✓ (meets minimum requirement)

## Security Posture

| Table | Access Model |
|-------|-------------|
| profiles | Own row only — phone column protected by row-level restriction |
| blood_requests | Active requests readable by all authenticated; mutations by requester only |
| device_tokens | Owner only |
| request_responses | Donor + blood request's requester |
| donations | Donor + recipient |

**Accepted posture (Phase 6):** `blood_requests.contact_phone` accessible to all authenticated users. Within-range-donor gating deferred to Phase 7 geo-match RPC per spec §4.3 — this is NOT a Phase 6 gap.

## Deviations from Plan

None.

## Self-Check: PASSED

- ✓ RLS enabled on all 5 tables
- ✓ 11 policies total
- ✓ All policies use `to authenticated` (handles anonymous auth users correctly)
- ✓ All policies use `(select auth.uid())` performance form
- ✓ profiles SELECT restricted to own row (phone protection)
- ✓ No deviations from spec §4.3
