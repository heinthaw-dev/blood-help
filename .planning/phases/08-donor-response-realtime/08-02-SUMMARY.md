---
phase: 08-donor-response-realtime
plan: 02
subsystem: frontend
tags: [react, supabase, optimistic-ui, donor-response, request_responses, realtime]

# Dependency graph
requires:
  - phase: 08-01
    provides: "responders_for_request RPC + request_responses added to supabase_realtime publication + regenerated types"
provides:
  - "handleRespond(reqId) in App.tsx: optimistic insert into request_responses, 23505 no-op, rollback + AlertDialog on real failure"
  - "respondedIds Set<string> state + restore query in hydrateUserFromDb (D-04)"
  - "RequestCard state-driven action slot: I'll help pill (before) / call button + green tag (after), number-hide until responded"
affects: [08-03-requestlive-realtime]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Optimistic UI flip with rollback: setRespondedIds before await, rollback on non-23505 error"
    - "23505 silent no-op: opposite of Phase 7 handlePosted duplicate-dialog branch (Pitfall 3)"
    - "State-driven single action slot: responded boolean drives I'll help pill vs round call button"
    - "Number-hide (D-02): phone row gated behind responded === true"
    - "Green responder pill reused verbatim from RequestLive.tsx (D-01 cross-screen consistency)"

key-files:
  created: []
  modified:
    - src/App.tsx
    - src/screens/Home.tsx

key-decisions:
  - "23505 in handleRespond is a silent no-op (keep optimistic state, no dialog) — opposite of handlePosted's 23505 branch which shows the duplicate dialog. Pitfall 3 explicitly avoided."
  - "respondedIds and onRespond declared as optional props on HomeProps (with ?:) so existing callers without the props compile; defaults to empty set / no-op."
  - "Tasks were committed separately (Task 1: App.tsx, Task 2: Home.tsx) even though build only passes when both are applied — the logical separation follows the plan's intent."

patterns-established:
  - "Restore responded-card state on feed load via hydrateUserFromDb: fetches own request_responses rows and seeds Set<string> before Home renders."

requirements-completed: [DNOR-01]

# Metrics
duration: ~20min
completed: 2026-06-23
---

# Phase 08 Plan 02: Donor "I'll Help" Action Summary

**Wired the donor-side "I'll help" state machine on the Home feed card: an optimistic insert into `request_responses` with 23505 no-op and rollback, a state-driven action slot (labeled pill → call button + green tag), phone-hide until responded, and responded-state restore across reload.**

## Performance

- **Duration:** ~20 min
- **Tasks:** 2 completed
- **Files modified:** 2 (`src/App.tsx`, `src/screens/Home.tsx`)

## Accomplishments

- `handleRespond(reqId: string)` added to App.tsx: optimistically adds `reqId` to `respondedIds` Set, inserts a `request_responses` row with `donor_id = user.supabaseId` (no status — defaults to `'responding'`), treats 23505 as a silent no-op (D-04 backstop, Pitfall 3), and on any other error rolls back the optimistic flip and surfaces the existing `AlertDialog` via `setWriteError` (D-03/D-18).
- `respondedIds Set<string>` state added at App-level; restored in `hydrateUserFromDb` via a `request_responses.select('request_id').eq('donor_id', uid).eq('status','responding')` query (D-04).
- `respondedIds` and `onRespond` wired as props into the `screen === 'home'` Home render block.
- `RequestCard` converted to a state-driven action slot (D-01): when `responded === false`, renders an "I'll help" labeled pill button (`ကူညီမည်` in Burmese / `"I'll help"` in English); when `responded === true`, renders the round red call `<a>` and a green "✓ ကူညီမည်" tag by the address (verbatim pill markup from `RequestLive.tsx` — `var(--color-success)` / `var(--color-success-tint)` / `var(--radius-pill)` / `4px 8px` padding).
- Phone row gated behind `responded === true` (D-02): number never renders in the not-responded state.
- `requests.map(...)` passes `responded={respondedIds?.has(req.id) ?? false}` and `onRespond={() => onRespond?.(req.id)}` to each `RequestCard`.

## Task Commits

1. **Task 1: handleRespond + respondedIds in App.tsx** — `058d772`
2. **Task 2: RequestCard state machine in Home.tsx** — `80fad53`

## Files Created/Modified

- `src/App.tsx` — added `respondedIds` state, `handleRespond` handler, restore query in `hydrateUserFromDb`, new props on `<Home>`.
- `src/screens/Home.tsx` — extended `RequestCardProps` + `HomeProps`, converted action slot to state machine, added phone-hide, added green responded tag, updated `requests.map`.

## Decisions Made

- 23505 in `handleRespond` is a **silent no-op** — keep the optimistic responded state, no `setWriteError`, no dialog. This is the OPPOSITE of `handlePosted`'s 23505 branch (which shows the "already open" duplicate dialog). Pitfall 3 explicitly honored.
- `respondedIds` and `onRespond` declared as optional on `HomeProps` (`Set<string> | undefined`, `((reqId: string) => void) | undefined`) so the interface is additive and no other callers break.
- Green pill markup reused verbatim from `RequestLive.tsx` lines ~318–324 for cross-screen visual consistency (D-01).

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — the action slot is fully wired to real Supabase inserts and real respondedIds state. No placeholder copy or hardcoded data flows to the UI.

## Threat Flags

No new network endpoints, auth paths, file access patterns, or schema changes introduced. The `request_responses` INSERT and SELECT are mediated entirely by the already-deployed RLS policies (Phase 6: `donor_response_insert` + `response_parties_select`) and the DB-level unique `(request_id, donor_id)` constraint.

## Security Verification (T-08-05 through T-08-08)

- **T-08-05 (forged donor_id):** `handleRespond` sends `donor_id: user.supabaseId` (the session UID); the DB INSERT policy `WITH CHECK (auth.uid() = donor_id)` is the authoritative enforcer.
- **T-08-06 (duplicate/spam):** unique `(request_id, donor_id)` constraint makes the second insert 23505; client treats it as a no-op silently. Optimistic flip also hides the button once responded.
- **T-08-07 (phone-before-commit):** Phone row is `{responded && (...)}` — never rendered in the not-responded state.
- **T-08-08 (wrong 23505 dialog):** 23505 in `handleRespond` is a no-op, NOT the Phase-7 duplicate dialog. The else branch (real failures) calls `setWriteError`; the 23505 branch body is empty.

## Self-Check: PASSED

- `src/App.tsx` exists and contains `handleRespond` (2 occurrences), `request_responses` (4 occurrences), `23505` (3 occurrences).
- `src/screens/Home.tsx` exists and contains `responded` (14 occurrences), `ကူညီမည်` (2 occurrences).
- Commits `058d772` and `80fad53` present in git log.
- `npm run build` exits 0.

---
*Phase: 08-donor-response-realtime*
*Completed: 2026-06-23*
