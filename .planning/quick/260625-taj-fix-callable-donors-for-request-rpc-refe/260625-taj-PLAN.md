---
phase: quick-260625-taj
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - supabase/migrations/20260625143600_fix_callable_donors_geog_column.sql
autonomous: true
requirements:
  - QUICK-260625-taj
user_setup: []

must_haves:
  truths:
    - "The callable_donors_for_request RPC executes without error 42703 (no reference to d.geog)"
    - "Distance and radius filtering use a geography point constructed inline from d.lng/d.lat"
    - "The function's signature, security model, owner guard, blood-type compatibility, radius, ordering, and grant are byte-for-byte unchanged from the live definition"
  artifacts:
    - path: "supabase/migrations/20260625143600_fix_callable_donors_geog_column.sql"
      provides: "CREATE OR REPLACE FUNCTION migration fixing the geog column reference"
      contains: "CREATE OR REPLACE FUNCTION public.callable_donors_for_request"
  key_links:
    - from: "supabase/migrations/20260625143600_fix_callable_donors_geog_column.sql"
      to: "public.donors (lat, lng columns)"
      via: "extensions.st_point(d.lng, d.lat)::extensions.geography"
      pattern: "st_point\\(d\\.lng, d\\.lat\\)::extensions\\.geography"
---

<objective>
Fix the `public.callable_donors_for_request(uuid)` Postgres RPC, which fails at runtime with `42703: column d.geog does not exist`. The `public.donors` table stores location as plain `lat`/`lng` doubles and has no `geog` column. Construct the geography point inline from `d.lng`/`d.lat`, matching the established pattern already used by three sibling functions (`donors_within_radius`, `requests_within_radius`, `responders_for_request`).

Purpose: Restore the core "request → nearby compatible donor" loop. RequestLive.tsx calls this RPC; it currently errors out, breaking emergency-callable donor matching.
Output: A single new migration file `supabase/migrations/20260625143600_fix_callable_donors_geog_column.sql` containing a `CREATE OR REPLACE FUNCTION` that is identical to the current definition except the three `geog`/point references.
</objective>

<execution_context>
@/Users/bhoneak/Desktop/Learning/VibeCodeTour/blood-help-old/.claude/get-shit-done/workflows/execute-plan.md
@/Users/bhoneak/Desktop/Learning/VibeCodeTour/blood-help-old/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@CLAUDE.md

<!-- The CURRENT (broken) function definition. The fix is a copy of this with exactly three lines changed. -->
@supabase/migrations/20260624000000_callable_donors_for_request.sql

<!--
LOCKED ROOT CAUSE (verified against the live database):
1. public.callable_donors_for_request references d.geog twice — inside extensions.st_distance(...) and extensions.st_dwithin(...).
2. The live public.donors table HAS NO geog column. Location is stored as lat (double precision) and lng (double precision).
3. Three working sibling functions construct the geography point inline: extensions.st_point(<lng>, <lat>)::extensions.geography.

THE FIX — exactly three substitutions, everything else byte-for-byte identical:
  - d.geog inside st_distance  →  extensions.st_point(d.lng, d.lat)::extensions.geography
  - the request point inside st_distance: extensions.st_makepoint(v_lng, v_lat)::extensions.geography  →  extensions.st_point(v_lng, v_lat)::extensions.geography
  - d.geog inside st_dwithin   →  extensions.st_point(d.lng, d.lat)::extensions.geography
  - (the request point inside st_dwithin also becomes extensions.st_point(v_lng, v_lat)::extensions.geography for consistency with the three sibling functions)

KEEP UNCHANGED: RETURNS TABLE signature, LANGUAGE plpgsql, SECURITY DEFINER, SET search_path = '',
the owner guard (SELECT r.lat, r.lng, r.blood_type ... IF NOT FOUND THEN RETURN), the full blood-type
compatibility CASE expression, the st_dwithin 10000 radius, ORDER BY dist_meters NULLS LAST, and the
GRANT EXECUTE ... TO authenticated.

MIGRATION NAMING: The live-applied version of the broken function is 20260624171342 (applied via MCP,
not present as a local file). The new migration MUST sort strictly after it. Use 20260625143600.
-->
</context>

<tasks>

<task type="auto">
  <name>Task 1: Author the fix migration file</name>
  <files>supabase/migrations/20260625143600_fix_callable_donors_geog_column.sql</files>
  <action>
    Create a NEW migration file at supabase/migrations/20260625143600_fix_callable_donors_geog_column.sql.

    Copy the full definition from supabase/migrations/20260624000000_callable_donors_for_request.sql (the CREATE OR REPLACE FUNCTION ... AS $$ ... $$; block plus the trailing GRANT). Reproduce it byte-for-byte EXCEPT for these substitutions inside the RETURN QUERY body:

    1. In the st_distance(...) call: replace the first argument d.geog with extensions.st_point(d.lng, d.lat)::extensions.geography
    2. In the st_distance(...) call: replace the second argument extensions.st_makepoint(v_lng, v_lat)::extensions.geography with extensions.st_point(v_lng, v_lat)::extensions.geography
    3. In the st_dwithin(...) call: replace the first argument d.geog with extensions.st_point(d.lng, d.lat)::extensions.geography
    4. In the st_dwithin(...) call: replace the request-point argument extensions.st_makepoint(v_lng, v_lat)::extensions.geography with extensions.st_point(v_lng, v_lat)::extensions.geography

    Do NOT change anything else: keep the RETURNS TABLE column list, LANGUAGE plpgsql, SECURITY DEFINER, SET search_path = '', the owner guard block, the blood-type compatibility CASE, the 10000 radius literal, the ORDER BY dist_meters NULLS LAST, and the GRANT EXECUTE ON FUNCTION public.callable_donors_for_request(uuid) TO authenticated; line.

    Update the leading header comment to note this migration fixes the d.geog reference by constructing the geography point inline from lat/lng (matching donors_within_radius / requests_within_radius / responders_for_request). Use extensions.st_point for both donor and request points so all four functions are consistent.

    DO NOT attempt to apply this migration to the live Supabase database. You do not have Supabase MCP tools and the CLI is not confirmed linked to the remote. The orchestrator owns applying and verifying the migration after execution (see Orchestrator-Owned Step below). Your deliverable is the file only.
  </action>
  <verify>
    <automated>test -f supabase/migrations/20260625143600_fix_callable_donors_geog_column.sql && ! grep -q 'd\.geog' supabase/migrations/20260625143600_fix_callable_donors_geog_column.sql && [ "$(grep -c 'extensions\.st_point(d\.lng, d\.lat)::extensions\.geography' supabase/migrations/20260625143600_fix_callable_donors_geog_column.sql)" -eq 2 ] && grep -q 'GRANT EXECUTE ON FUNCTION public\.callable_donors_for_request(uuid) TO authenticated' supabase/migrations/20260625143600_fix_callable_donors_geog_column.sql && grep -q 'SECURITY DEFINER' supabase/migrations/20260625143600_fix_callable_donors_geog_column.sql && grep -q "SET search_path = ''" supabase/migrations/20260625143600_fix_callable_donors_geog_column.sql && echo OK</automated>
  </verify>
  <done>
    File exists at supabase/migrations/20260625143600_fix_callable_donors_geog_column.sql. It contains NO reference to d.geog. It uses extensions.st_point(d.lng, d.lat)::extensions.geography exactly twice (once in st_distance, once in st_dwithin). The owner guard, blood-type CASE, 10000 radius, ORDER BY, SECURITY DEFINER, SET search_path = '', and GRANT to authenticated are all preserved unchanged. The executor has NOT pushed to the remote DB.
  </done>
</task>

</tasks>

<orchestrator_owned_step>
## Apply + Verify (ORCHESTRATOR ONLY — NOT the executor)

After the executor commits the migration file, the orchestrator (which has Supabase MCP tools) performs:

1. **Apply:** Use MCP `apply_migration` with name `fix_callable_donors_geog_column` and the body of the new migration file.
2. **Verify the function no longer references d.geog and resolves cleanly:**
   - Run `execute_sql`: `SELECT pg_get_functiondef('public.callable_donors_for_request(uuid)'::regprocedure);` — confirm output contains `st_point(d.lng, d.lat)` and contains NO `d.geog`.
   - Smoke-test resolution (should return zero rows without a 42703 error for a non-owner / arbitrary uuid): `SELECT * FROM public.callable_donors_for_request('00000000-0000-0000-0000-000000000000'::uuid);` — success = no `42703 column d.geog does not exist` error.
3. If MCP apply fails for environment reasons, fall back to the Supabase CLI (`supabase db push`) only if the project is confirmed linked; otherwise report the file is ready and apply must be done manually.

The executor MUST NOT attempt steps 1–3.
</orchestrator_owned_step>

<verification>
- The new migration file exists and sorts strictly after the live-applied version 20260624171342 (20260625143600 > 20260624171342).
- No occurrence of `d.geog` anywhere in the new file.
- `extensions.st_point(d.lng, d.lat)::extensions.geography` appears exactly twice (st_distance + st_dwithin).
- The function still grants EXECUTE to `authenticated` only, retains SECURITY DEFINER, SET search_path = '', the owner guard, and the blood-type compatibility CASE.
- No frontend files touched — src/screens/RequestLive.tsx already calls the RPC correctly and is out of scope.
</verification>

<success_criteria>
- A single new migration file `supabase/migrations/20260625143600_fix_callable_donors_geog_column.sql` is authored and committed.
- The function definition is identical to the live version except the geography point is built inline from d.lng/d.lat (and v_lng/v_lat) via extensions.st_point, eliminating the d.geog reference that caused error 42703.
- After the orchestrator applies it, `callable_donors_for_request` runs without the 42703 error and returns ordered, compatible, within-10km, emergency-callable donors for the request owner.
</success_criteria>

<output>
Create `.planning/quick/260625-taj-fix-callable-donors-for-request-rpc-refe/260625-taj-SUMMARY.md` when done.
</output>
