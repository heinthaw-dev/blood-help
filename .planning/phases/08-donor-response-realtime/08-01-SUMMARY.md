---
phase: 08-donor-response-realtime
plan: 01
subsystem: database
tags: [postgres, supabase, rpc, security-definer, realtime, postgrest, typescript]

# Dependency graph
requires:
  - phase: 07-data-persistence-geo-matching
    provides: requests_within_radius / donors_within_radius SECURITY DEFINER RPC pattern; request_responses table + RLS policies + unique constraint (Phase 6)
provides:
  - "responders_for_request(p_request_id uuid) owner-scoped SECURITY DEFINER RPC returning donor name/phone/dist for status='responding' rows"
  - "request_responses added to supabase_realtime publication (Postgres Changes INSERT events)"
  - "regenerated src/types/database.ts including the responders_for_request RPC signature"
affects: [08-02-donor-ill-help, 08-03-requestlive-realtime]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Owner-scoped SECURITY DEFINER RPC: owner guard via SELECT ... WHERE requester_id = auth.uid() + IF NOT FOUND THEN RETURN (no existence leak)"
    - "Phone-returning RPC hardened to authenticated-only via REVOKE EXECUTE FROM PUBLIC, anon"

key-files:
  created: []
  modified:
    - src/types/database.ts

key-decisions:
  - "REVOKE EXECUTE FROM PUBLIC, anon on responders_for_request (beyond the plan's literal SQL) to satisfy threat T-08-01 'authenticated only — never anon'; the function returns phone numbers, so stricter gating than the Phase 7 distance RPCs is warranted. authenticated retains EXECUTE via its explicit grant."
  - "Single migration (apply_migration via Supabase MCP), no local supabase/migrations file, per plan + Phase 7 precedent."
  - "Default REPLICA IDENTITY left as-is (INSERT-only consumption needs no FULL)."

patterns-established:
  - "NULL-safe distance: CASE returns NULL::double precision when any coord is NULL; ORDER BY dist_meters NULLS LAST, created_at."

requirements-completed: [DNOR-02]

# Metrics
duration: ~15min
completed: 2026-06-23
---

# Phase 08 Plan 01: DB Foundation Summary

**Deployed the owner-scoped `responders_for_request` RPC and added `request_responses` to the realtime publication — the blocking DB foundation Plans 02 and 03 build on — and hardened the phone-returning RPC to authenticated-only.**

## Performance

- **Duration:** ~15 min
- **Tasks:** 2 completed
- **Files modified:** 1 (`src/types/database.ts`)

## Accomplishments
- `responders_for_request(p_request_id uuid)` deployed: `LANGUAGE plpgsql`, `SECURITY DEFINER`, `SET search_path = ''`, extensions-prefixed PostGIS distance, owner guard, GRANT to `authenticated`.
- `public.request_responses` added to the `supabase_realtime` publication via an idempotent `DO` block (Postgres Changes INSERT foundation for Plan 03).
- `src/types/database.ts` regenerated — `responders_for_request` typed with `Args: { p_request_id: string }`; both Phase 7 RPCs preserved; `npm run build` green; no `as any`.

## Task Commits

1. **Task 1: Deploy RPC + realtime publication membership** — DB-only via Supabase MCP `apply_migration` (`phase8_responders_rpc_and_realtime` + `phase8_responders_rpc_revoke_public`); no working-tree artifact (no local migrations file, per plan).
2. **Task 2: Regenerate types + confirm build** — `a93a69f` (feat)

## Files Created/Modified
- `src/types/database.ts` — regenerated client types; adds `responders_for_request` to the `Functions` block.

## Decisions Made
- Added `REVOKE EXECUTE ... FROM PUBLIC, anon` (not in the plan's literal SQL) to honor threat T-08-01's "authenticated only — never anon." Postgres grants `EXECUTE` to `PUBLIC` by default on new functions, which silently includes `anon`; the explicit revoke removes that. `authenticated` keeps access via its explicit grant. Justified because this RPC returns phone numbers — more sensitive than the Phase 7 distance-only RPCs.

## Deviations from Plan

### Hardening beyond plan SQL

**1. [Security — T-08-01] Revoke inherited PUBLIC/anon EXECUTE**
- **Found during:** Task 1 verification (`get_advisors` + grant inspection showed inherited `anon`/`PUBLIC` EXECUTE).
- **Issue:** New functions inherit `EXECUTE` to `PUBLIC` (incl. `anon`); the plan's threat model requires authenticated-only.
- **Fix:** `REVOKE EXECUTE ON FUNCTION public.responders_for_request(uuid) FROM PUBLIC; ... FROM anon;` (migration `phase8_responders_rpc_revoke_public`).
- **Verification:** `role_routine_grants` now lists only authenticated/postgres/service_role; security advisor no longer flags the function as anon-executable (it still flags the two Phase 7 RPCs).

**Total deviations:** 1 (security hardening)
**Impact on plan:** Strengthens the stated mitigation; no scope creep. The owner guard already prevented data leakage to non-owners; this removes anon's ability to invoke at all.

## Issues Encountered
None. The owner guard was validated live: calling the RPC from the MCP session (anon, `auth.uid()` NULL) returned 0 rows.

## Security Verification
- `responders_for_request` NOT in `anon_security_definer_function_executable` advisor list (revoke confirmed).
- `authenticated_security_definer_function_executable` WARN on the function is by design — it must be callable by signed-in owners; the in-body owner guard is the access control (same posture as the reviewed Phase 7 RPCs).
- All other advisor WARNs are pre-existing from Phases 6–7.

## User Setup Required
None — no external service configuration required.

## Next Phase Readiness
- Plan 02 can `supabase.from('request_responses').insert(...)` and read its own responses (existing RLS).
- Plan 03 can `supabase.rpc('responders_for_request', { p_request_id })` (typed) and subscribe to `request_responses` Postgres Changes.

---
*Phase: 08-donor-response-realtime*
*Completed: 2026-06-23*
