---
phase: 08-donor-response-realtime
plan: 03
subsystem: frontend
tags: [react, supabase, realtime, postgres-changes, rpc, privacy, bilingual]

# Dependency graph
requires:
  - phase: 08-01
    provides: "responders_for_request RPC + request_responses in supabase_realtime publication + regenerated types"
  - phase: 08-02
    provides: "handleRespond optimistic insert + respondedIds state + RequestCard state-machine"
provides:
  - "RequestLive renders real Will-Help responders from the owner-scoped responders_for_request RPC"
  - "Supabase Postgres Changes subscription (channel rr:<requestId>) triggers RPC refetch + toast on each INSERT"
  - "removeChannel cleanup on RequestLive unmount (T-08-12)"
  - "Truthful D-09 transparency line: '[X] nearby compatible donors can see your request'"
  - "Calm bilingual empty state (D-10) — no animated spinner"
  - "App threads activeRequestId + currentUserId into RequestLive (D-14 reopen hydration)"
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Postgres Changes subscribe-then-refetch: channel.on('postgres_changes') fires refetchResponders() via owner-scoped RPC — never reads from payload (D-11 anti-pattern guard)"
    - "Effect gate on requestId && currentUserId to avoid cold-start race (Pitfall 2)"
    - "Stable channel name rr:${requestId} + removeChannel cleanup prevents leaked sockets (Pitfall 5 / T-08-12)"
    - "Read-back pattern: bare insert in handlePosted + separate maybeSingle() query to recover the new row id (avoids chaining .select() onto the insert)"
    - "D-09 truthful count: donors_within_radius RPC filtered by COMPATIBLE_REQUEST_TYPES inverse — no 'alerted' claim"

key-files:
  created: []
  modified:
    - src/App.tsx
    - src/screens/RequestLive.tsx
    - src/screens/Home.tsx

key-decisions:
  - "Export formatPhone and formatDistanceLabel from Home.tsx rather than duplicating — single source of truth for E.164 formatting and distance labels."
  - "compatibleCount initialized from alertedCount prop so an existing request reopened before the donors_within_radius fetch completes shows a reasonable number rather than zero."
  - "hasResults/moreCount props removed from the component body — they were only used by the removed dummy arrays; the responders.length drives the branch now. Props retained in interface as optional to avoid breaking any hypothetical future callers."
  - "Props requestId/_lang/_currentUserId/_lat/_lng renamed to wired params in Task 2; Task 1 used underscore-prefixed stubs to keep the build green while the interface was extended before the implementation landed."

# Metrics
duration: ~14min
completed: 2026-06-22
---

# Phase 08 Plan 03: RequestLive Realtime — Summary

**Wired the requester's RequestLive screen to show real, live donor responses via the owner-scoped `responders_for_request` RPC and a Supabase Postgres Changes subscription, closing the live loop so a donor's "I'll help" appears on the requester's screen within seconds without a page refresh.**

## Performance

- **Duration:** ~14 min
- **Tasks:** 2 completed
- **Files modified:** 3 (`src/App.tsx`, `src/screens/RequestLive.tsx`, `src/screens/Home.tsx`)

## Accomplishments

**Task 1 — Thread activeRequestId into RequestLive (App.tsx):**
- Added `activeRequestId: string | null` state to App.
- In `hydrateUserFromDb`: reads `activeRequest?.id` and calls `setActiveRequestId(...)` so a returning requester sees current responders immediately (D-14).
- In `handlePosted`: after the bare `.insert()`, a separate `.select('id').eq(...).maybeSingle()` read-back recovers the new row id without chaining onto the insert (project bare-insert convention maintained).
- `setActiveRequestId(null)` in both `onGoHome` callback and `handleLogout`.
- RequestLive render now passes `requestId={activeRequestId}`, `currentUserId={user.supabaseId}`, `lat={requestDraft?.lat}`, `lng={requestDraft?.lng}`.

**Task 2 — Real responders + Postgres Changes subscription (RequestLive.tsx):**
- Removed `WILL_HELP` and `CAN_CALL` dummy arrays, `revealed`/`setRevealed` state, `moreLine`/`moreLineEn`, and the Can-call donor block (all out of scope per D-08).
- Added `responders: ResponderRow[]` state driven by `supabase.rpc('responders_for_request', ...)`.
- Mount effect follows the Research Code Example exactly: `cancelled` guard, `refetchResponders()` called immediately (initial + resubscribe case), `supabase.channel('rr:'+requestId).on('postgres_changes', { event:'INSERT', schema:'public', table:'request_responses', filter:'request_id=eq.'+requestId }, () => { refetchResponders(); showToast(...) }).subscribe()`, cleanup returns `() => { cancelled = true; void supabase.removeChannel(channel) }`.
- Effect gated on `!requestId || !currentUserId` guard (Pitfall 2 cold-start).
- Toast on INSERT: `showToast('သွေးလှူရှင်တစ်ဦး တုံ့ပြန်ပါပြီ', 'A donor responded')` (D-13).
- Replaced searching-spinner block with calm bilingual waiting message: "သွေးလှူရှင်များ တုံ့ပြန်မှုကို စောင့်ဆဲဖြစ်သည်" / "Waiting for donors to respond" — no spinner (D-10).
- Transparency line reframed (D-09): `[count] nearby compatible donors can see your request` via `donors_within_radius` RPC filtered by `COMPATIBLE_REQUEST_TYPES[donorType].includes(bloodType as BloodType)`. Never uses the word "alerted".
- `lang` prop wired (was `_lang` stub) for bilingual copy and Burmese numerals throughout.
- Responder rows (D-05): `name`, `formatDistanceLabel(dist_meters, lang)`, `formatPhone(phone)`, `CallButton` with `tel:` href.
- `formatPhone` and `formatDistanceLabel` exported from `Home.tsx` to avoid divergent copies.

## Task Commits

1. **Task 1: Thread activeRequestId + currentUserId into RequestLive** — `38b5b05`
2. **Task 2: Replace dummy arrays with real responders + Postgres Changes** — `2b59dcf`

## Files Created/Modified

- `src/App.tsx` — `activeRequestId` state, read-back in `handlePosted`, `setActiveRequestId` in `hydrateUserFromDb` + `onGoHome` + `handleLogout`, new props on `<RequestLive>`.
- `src/screens/RequestLive.tsx` — full rewrite of responder section; removed dummy arrays and Can-call block; added realtime effect, responders state, calm empty state, truthful transparency line, bilingual lang wiring.
- `src/screens/Home.tsx` — exported `formatPhone` and `formatDistanceLabel` (previously private helpers).

## Decisions Made

- Read-back the new request id via a separate `maybeSingle()` query after the bare insert in `handlePosted` — not by chaining `.select().single()` onto the insert (bare-insert convention from Phase 7 / RESEARCH Pitfall 1 carried forward).
- `compatibleCount` initialized from `alertedCount` prop (defaults to 0) so the transparency line renders a number immediately before the `donors_within_radius` fetch completes, rather than showing "0 nearby donors" in the brief loading window.
- `hasResults` and `moreCount` props kept in `RequestLiveProps` interface as optional (now unused internally) to avoid breaking existing callers; the component body was simplified to drive branching off `responders.length`.

## Deviations from Plan

### Auto-extended props interface (Rule 3 — blocking issue)

**1. [Rule 3 - Blocking] Extended RequestLiveProps in Task 1 to unblock build**
- **Found during:** Task 1 build verification
- **Issue:** `src/App.tsx` passes `requestId`, `currentUserId`, `lat`, `lng` to `<RequestLive>` but these props didn't exist in `RequestLiveProps` yet — TypeScript error TS2322.
- **Fix:** Added the four optional props to `RequestLiveProps` with underscore-prefixed destructuring stubs in Task 1 so the build passes; Task 2 then wired them properly.
- **Files modified:** `src/screens/RequestLive.tsx`
- **Commit:** `38b5b05`

## Known Stubs

None — the responder list is fully wired to real Supabase data via the `responders_for_request` RPC. The `donors_within_radius` count for the D-09 transparency line is a live async fetch. No hardcoded counts or placeholder copy flows to the UI.

## Threat Flags

No new threat surface beyond what is documented in the plan's `<threat_model>` block (T-08-09 through T-08-13):
- T-08-10 (donor phone via payload): mitigated — the subscription callback never reads `payload.new`; phone arrives only via the owner-guarded RPC refetch.
- T-08-12 (leaked socket): mitigated — `removeChannel(channel)` in effect cleanup.
- T-08-13 (transparency "alerted" overstating): mitigated — copy is "can see your request", never "alerted"; no FCM push occurred this phase.

## Self-Check: PASSED

- `src/App.tsx` exists and contains `activeRequestId` (5 occurrences, >= 4 required).
- `src/screens/RequestLive.tsx` exists and contains `postgres_changes` (1), `responders_for_request` (3), `removeChannel` (2); `WILL_HELP`/`CAN_CALL` not found (0).
- `src/screens/Home.tsx` exports `formatPhone` and `formatDistanceLabel`.
- Commits `38b5b05` and `2b59dcf` present in git log.
- `npm run build` exits 0 (no unused-locals/params from removed state).
- No `as any` introduced anywhere.
- No `supabase.realtime.setAuth()` call in RequestLive.tsx (only a comment).
- Transparency line contains no "alerted" claim — verified by grep.

---
*Phase: 08-donor-response-realtime*
*Completed: 2026-06-22*
