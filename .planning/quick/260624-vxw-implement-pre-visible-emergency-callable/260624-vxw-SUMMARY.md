---
phase: quick-260624-vxw
plan: 01
subsystem: database + frontend
tags: [supabase, rpc, security-definer, react, requestlive, emergency-callable, phone-reveal]

# Dependency graph
requires:
  - phase: 08-donor-response-realtime
    provides: responders_for_request pattern; donors.geog column; donors.emergency_callable column
  - phase: 09-confirmation-lifecycle
    provides: RequestLive screen with realtime responders; confirm flow wired
provides:
  - "callable_donors_for_request(p_request_id uuid) SQL migration — owner-scoped SECURITY DEFINER RPC returning compatible, available, emergency_callable donors within 10km"
  - "src/types/database.ts: callable_donors_for_request entry in Functions block"
  - "RequestLive.tsx: Available to Call section with fetch effect, dedup logic, and tel: call buttons"
affects: [src/screens/RequestLive.tsx, src/types/database.ts]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Fetch-once useEffect for stable-data RPC (callable donors don't change during a session)"
    - "visibleCallable dedup: filter callableDonors against responders to prevent double-display"
    - "Neutral grey treatment for 'Can call' state (design skill: green=Will help, grey=Can call)"

key-files:
  created:
    - supabase/migrations/20260624000000_callable_donors_for_request.sql
  modified:
    - src/types/database.ts
    - src/screens/RequestLive.tsx

key-decisions:
  - "Auth gate workaround: Supabase MCP OAuth token not accessible to executor subagent (bug #13898). Migration SQL written to supabase/migrations/ for user to apply via Supabase dashboard. database.ts hand-edited with deterministic type entry. Task 2 (UI) completes normally — no runtime impact until migration is applied."
  - "Fetch-once pattern for callable donors: donors who opted in are stable over a request session; no realtime subscription needed. Mirrors the gating pattern (requestId+currentUserId) from responders_for_request."
  - "CallButton reused from existing local component — no new component created."
  - "Section header uses var(--font-burmese) / var(--text-primary) for Burmese line, var(--text-hint) for English subline — matches existing header typography conventions."

requirements-completed: [QUICK-VXW-01]

# Metrics
duration: ~17 min
completed: 2026-06-24
---

# Quick Task 260624-vxw: Pre-Visible Emergency-Callable Donors Summary

**Deployed callable_donors_for_request SQL migration (pending manual apply) and wired a new "Available to Call" section into RequestLive — enabling requesters to call emergency-callable donors immediately on request open without waiting for a tap.**

## Performance

- **Duration:** ~17 min
- **Tasks:** 2 completed
- **Files modified:** 2 (`src/types/database.ts`, `src/screens/RequestLive.tsx`)
- **Files created:** 1 (`supabase/migrations/20260624000000_callable_donors_for_request.sql`)

## Accomplishments

1. **callable_donors_for_request SQL migration written** to `supabase/migrations/20260624000000_callable_donors_for_request.sql`. Full PLPGSQL with SECURITY DEFINER, empty search_path, owner guard, extensions-prefixed PostGIS, blood-type compatibility CASE array, and GRANT to authenticated only. Mirrors responders_for_request security pattern exactly.
2. **src/types/database.ts updated** with the callable_donors_for_request Functions entry (Args: `{ p_request_id: string }`, Returns array with blood_type/dist_meters/donor_id/name/phone).
3. **RequestLive.tsx** — added:
   - `CallableDonorRow` interface (donor_id, name, phone, blood_type, dist_meters)
   - `callableDonors` state
   - Fetch-once useEffect gated on `requestId + currentUserId`, calling `supabase.rpc('callable_donors_for_request', { p_request_id })`
   - `visibleCallable` computed (callableDonors filtered against responders for dedup)
   - "Available to Call / ခေါ်ဆိုနိုင်သောသွေးလှူရှင်များ" section above the Will-Help list, hidden when empty
   - Each row: Badge(blood_type) + name + distance subline + CallButton(tel:phone)
   - Neutral grey card style (design skill: green=Will help, grey=Can call)

## Task Commits

| Task | Commit | Description |
|------|--------|-------------|
| Task 1: RPC migration + types | 2d868d0 | feat(quick-260624-vxw-01): add callable_donors_for_request RPC + types |
| Task 2: RequestLive UI | 8645ff2 | feat(quick-260624-vxw-01): render Available to Call section in RequestLive |

## Deviations from Plan

### Authentication Gate (Task 1 DB deployment)

**[Auth Gate] Supabase MCP apply_migration unavailable in executor subagent context**
- **Found during:** Task 1
- **Issue:** Executor subagent processes do not have access to the Supabase MCP OAuth token. The token is held in-memory by the Claude Code orchestrator process and is not exposed to subagent Bash sessions (upstream bug anthropics/claude-code#13898 also strips MCP tools from agents with `tools:` frontmatter restrictions).
- **Alternative taken:** Migration SQL written to `supabase/migrations/20260624000000_callable_donors_for_request.sql`. database.ts hand-edited with the deterministic type entry (return shape is fully known from the SQL). Task 2 (UI) completes normally.
- **Action required by user:** Apply the SQL migration manually. Options:
  1. **Supabase dashboard:** Go to project dfrpqkutjsnfgkdmcadi → SQL Editor → paste contents of `supabase/migrations/20260624000000_callable_donors_for_request.sql` → Run
  2. **CLI (if linked):** `supabase db push --linked` after `supabase link --project-ref dfrpqkutjsnfgkdmcadi`
  3. **After applying:** Run `generate_typescript_types` via Supabase MCP in a full Claude Code session to re-sync the types (the hand-edited entry is correct but the regenerated file would also include any other schema changes since the last regen)
- **Runtime impact:** The `callableDonors` fetch will silently return zero rows (the RPC doesn't exist) until the migration is applied. No crash — the section simply stays hidden.

## Known Stubs

None introduced by this plan. The "Available to Call" section is fully wired to the real RPC; it renders live data once the migration is applied.

## Threat Flags

| Flag | File | Description |
|------|------|-------------|
| threat_flag: information_disclosure | callable_donors_for_request SQL | Phone numbers cross client→server trust boundary; mitigated by SECURITY DEFINER + owner guard (T-VXW-01). GRANT to authenticated only (T-VXW-02). |

All threat mitigations from the plan's STRIDE register are implemented in the SQL migration:
- T-VXW-01: Owner guard `requester_id = (SELECT auth.uid())` + IF NOT FOUND THEN RETURN
- T-VXW-02: `GRANT EXECUTE ... TO authenticated` (no anon)
- T-VXW-03: `SET search_path = ''` + all identifiers schema-qualified
- T-VXW-04: `d.profile_id <> (SELECT auth.uid())` excludes requester from own callable list

## Self-Check: PASSED

- `supabase/migrations/20260624000000_callable_donors_for_request.sql` exists in worktree
- `src/types/database.ts` contains `callable_donors_for_request` with `p_request_id` Args
- `src/screens/RequestLive.tsx` contains `callable_donors_for_request` RPC call and `visibleCallable`
- Commits 2d868d0 and 8645ff2 present in git log
- `npm run build` passes (0 TypeScript errors, vite build successful)
