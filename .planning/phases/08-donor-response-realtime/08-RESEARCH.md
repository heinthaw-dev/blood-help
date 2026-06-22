# Phase 8: Donor Response + Realtime - Research

**Researched:** 2026-06-23
**Domain:** Supabase Realtime (Postgres Changes) + RLS-gated streaming, owner-scoped SECURITY DEFINER RPC, client-side optimistic insert under unique constraint
**Confidence:** HIGH (all critical realtime/RLS claims verified against official Supabase docs + the installed supabase-js source; SQL patterns mirror the already-deployed Phase 6/7 functions verbatim)

## Summary

This is the app's first use of Supabase Realtime. The single highest-value finding: **the SELECT policy that makes the realtime stream fire for the request owner already exists.** Phase 6 deployed `request_responses` with a SELECT policy ("Responses visible to donor or requester") whose `USING` clause grants the parent request's `requester_id` read access via a subquery into `blood_requests`. Because Postgres Changes enforces that exact RLS SELECT policy on the event stream, the request owner will receive INSERT events for responses to their own request the moment the table is added to the `supabase_realtime` publication — **no new SELECT policy is required, and no `REPLICA IDENTITY FULL` is required** (INSERT events carry the full new row under the default replica identity; FULL only matters for old-row values on UPDATE/DELETE, which this phase does not consume). The one migration step for realtime enablement is a single line: `alter publication supabase_realtime add table public.request_responses;`

The second finding: the installed `@supabase/supabase-js@2.108.2` **auto-wires the authenticated session's JWT into the realtime socket** (verified in the bundled source: `onAuthStateChange` → on `SIGNED_IN`/`TOKEN_REFRESHED` it calls `this.realtime.setAuth(token)`). This app authenticates via `signInWithPassword` before reaching `RequestLive`, so the realtime connection is already RLS-authorized — **no manual `supabase.realtime.setAuth()` call is needed.** (One cold-start timing nuance is documented in Pitfalls.)

The third finding: the responder display data (name + phone + distance) must come through an **owner-scoped `SECURITY DEFINER` RPC `responders_for_request(p_request_id uuid)`** that mirrors the deployed `requests_within_radius` shape exactly — `SET search_path = ''`, `extensions.`-prefixed PostGIS calls, `radius_km * 1000` style distance math, `GRANT EXECUTE ... TO authenticated` — but with an explicit `auth.uid()`-owns-the-request guard in the body. This keeps donor phones server-gated to the single request owner (honoring spec §4.3) without loosening table RLS, and is the robust answer to D-06/D-11 ("refetch the whole list via the RPC on each event").

**Primary recommendation:** One `apply_migration` call adding (1) the `responders_for_request` RPC, (2) the publication line for `request_responses`; then `generate_typescript_types`. Client side: a bare `.insert()` for "I'll help" with 23505 rollback handling, and a `RequestLive` mount effect that does initial RPC fetch → subscribe (filtered to `request_id`) → refetch-the-whole-list on each INSERT → `removeChannel` on unmount.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Donor-side "I'll help" action (Home feed) — DNOR-01**
- **D-01:** State-driven single action slot. The feed card's existing right-side action slot is a state machine: *before responding* it is an **"I'll help" (ကူညီမည်)** labeled pill; *after responding* it becomes the **round red call button** and a small green **"✓ ကူညီမည်"** tag appears by the address (reuse the exact green responder pill from `RequestLive.tsx` line ~323). Do NOT add a second button.
- **D-02:** Hide the requester's phone number on the card until the donor responds. Number is revealed alongside the call button only after "I'll help" is tapped.
- **D-03:** Optimistic flip. Tapping "I'll help" flips the slot to the responded state immediately; if the DB insert fails, roll back the UI and surface the existing `AlertDialog` (Phase 7 D-18 error pattern).
- **D-04:** Restore responded state across reload by querying existing responses on feed load. On Home feed load, fetch the current donor's own `request_responses` rows and pre-mark matching cards as responded. The DB unique constraint is the backstop; this query is the UX layer.

**Requester live list — info & privacy (DNOR-02)**
- **D-05:** Responders show name + distance + number + call button (direct, per spec §2.3). A donor who tapped "I'll help" has actively volunteered, so direct contact is the intent.
- **D-06:** Fetch responder data via an owner-scoped `SECURITY DEFINER` RPC (e.g. `responders_for_request(request_id)`). The function verifies `auth.uid()` owns the request, then returns name + phone + `dist_meters` for `status='responding'` rows. Mirrors the Phase 7 `requests_within_radius` RPC pattern.
- **D-07:** v2 privacy posture: responder numbers are visible only to the request owner (enforced by the RPC). The full gated/logged/rate-limited reveal machinery stays deferred to v3. No reveal-audit logging this phase.

**Realtime list scope (DNOR-02)**
- **D-08:** Wire the "Will Help" responders section only. Hide the "Can call" pool and the "+Y more notified" line this phase.
- **D-09:** Reframe the transparency line to be truthful in a no-push world — e.g. **"[X] nearby compatible donors can see your request"** backed by a count of matching donors within radius. The word "alerted" overstates reality until FCM exists.
- **D-10:** Zero-responder empty state = a calm "waiting for responses" message, NOT the animated "searching for donors" spinner.

**Realtime mechanics (DNOR-02)**
- **D-11:** On each new-response realtime event, refetch the whole responder list via `responders_for_request` and replace the list. Idempotent, self-heals after a dropped/reconnected socket, no client-side dedupe/ordering logic. Also refetch on (re)subscribe.
- **D-12:** Subscription is RequestLive-only. Subscribe to `request_responses` (filtered to active `request_id`) on mount; unsubscribe on unmount. No app-wide subscription.
- **D-13:** Gentle arrival cue. When a new responder appears live, reuse the screen's existing toast to show "A donor responded" as the row updates.
- **D-14:** Closed-app gap is handled by deferral + fetch-on-reopen, not by Realtime. When the requester reopens the app, fetch current responders during the existing active-request hydration (Phase 7 already loads the user's own active request on mount).

### Claude's Discretion
- **Realtime transport choice** (Postgres Changes vs Broadcast) — discretion, but it MUST be RLS-gated. **Note:** Postgres Changes enforces RLS on the stream, so a row-level SELECT policy on `request_responses` for the request owner is required for the event to fire at all. Researcher/planner to confirm the policy + the realtime publication enablement (`request_responses` in `supabase_realtime`, REPLICA IDENTITY) as a migration step. → **RESOLVED below: use Postgres Changes; the SELECT policy already exists; only the publication line is missing; default replica identity is sufficient.**
- **RPC vs query for the responder fetch** — D-06 specifies an owner-scoped RPC; exact SQL shape (join `request_responses` → `profiles` → `donors`, compute `dist_meters`) is discretion. → **RESOLVED below.**
- **The "can see your request" count (D-09)** — how it's computed (reuse a `donors_within_radius`-style count filtered by directional compatibility + availability, vs the request's stored `alerted_count`) is discretion; it must be truthful. → **Recommendation below.**
- **Distance/number formatting** — reuse `Home.tsx` `formatPhone` (E.164 → local) and `formatDistanceLabel`/`formatNumber` (Burmese numerals) for responder rows.
- **No-op on duplicate response** — the unique `(request_id, donor_id)` constraint is the DB backstop; the UI no-op comes from D-04 (button hidden/disabled when already responded).

### Deferred Ideas (OUT OF SCOPE)
- **FCM push to requester on donor response (PUSH-04)** — its own new dedicated phase (Phase 8.5 or front of v3). Edge Function + service worker + device-token registration + notification-permission UX. The mechanism that reaches a *closed* app.
- **"Can call" nearby-donor pool + "+Y more notified" line** on `RequestLive` — computed pools; deferred.
- **Gated/logged/rate-limited phone reveal + personal-data purge on close** — v3 privacy milestone.
- **Live updates for a minimized/away requester** (app-wide subscription) — not pursued; subsumed by the FCM push phase.
- **Donor "undo my response"** — possible future refinement; not in scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| DNOR-01 | "I'll help" button on home feed request cards creates a `request_responses` row (status='responding') for the current donor; button disabled/hidden if donor already responded | Insert path (Pattern 4) + 23505 duplicate handling (Pattern 5) + responded-state restore query (Pattern 6, D-04). Existing INSERT policy `Donor can insert their own response` (`WITH CHECK auth.uid() = donor_id`) and `unique (request_id, donor_id)` constraint already deployed. |
| DNOR-02 | Request-live screen subscribes to `request_responses` for the active request via Supabase Realtime; donor list updates live without a page refresh | Realtime enablement (Pattern 1: publication line), RLS-on-stream (Pattern 2: existing SELECT policy suffices), `responders_for_request` RPC (Pattern 3), supabase-js channel lifecycle in a React effect (Pattern 7), refetch-on-event (D-11). |
</phase_requirements>

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| "I'll help" write (response row) | API / Database (RLS INSERT) | Browser (optimistic UI flip) | Postgres enforces `auth.uid()=donor_id` + unique constraint; the client only mirrors the result optimistically. |
| Duplicate prevention | Database (unique constraint) | Browser (D-04 query disables button) | The unique `(request_id, donor_id)` index is the authoritative backstop; the UI query is the UX layer. |
| Responder display data (name/phone/dist) | Database (SECURITY DEFINER RPC) | — | Donor phone is server-gated; only the owner-scoped RPC may return it. Never computed or revealed client-side from a table read. |
| Realtime "a donor responded" event | Database (WAL → publication → RLS SELECT) | Browser (subscribe + refetch) | Postgres Changes streams the WAL filtered by the table's RLS SELECT policy; the client subscribes and treats each event as a "refetch now" signal. |
| Realtime authorization | API / Auth (JWT → realtime.setAuth, auto) | — | supabase-js auto-sets the session JWT on the socket; RLS authorizes the stream server-side. |
| "Can see your request" count (D-09) | Database (count RPC/query) | Browser (Burmese-numeral format) | Truthful count of compatible donors within radius is a DB aggregate; formatting is presentational. |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@supabase/supabase-js` | 2.108.2 (installed) | Postgres CRUD, RPC calls, Realtime Postgres Changes channels, auth-token auto-wiring | Already the app's only backend client; bundles `@supabase/realtime-js@2.108.2`. No new dependency for realtime. [VERIFIED: node_modules + npm registry] |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| (none new) | — | — | Phase 8 introduces **no new npm packages.** Realtime ships inside the already-installed `supabase-js`. |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Postgres Changes | Realtime Broadcast (from-DB triggers) | Broadcast scales better at high write volume and decouples payload from row shape, but requires a DB trigger + `realtime.broadcast_changes()` and its own `realtime.messages` RLS authorization policy. Overkill at this scale and adds surface area. Postgres Changes is simpler-correct here (D-11's refetch model makes payload shape irrelevant). [CITED: supabase.com/docs/guides/realtime/postgres-changes] |
| SECURITY DEFINER RPC for responders | Loosen `request_responses` SELECT + join client-side | Would require exposing donor phone at the table level (a join into `donors`/`profiles`) — directly violates spec §4.3. The owner-scoped RPC keeps phone exposure server-gated. [CITED: blood-help-spec.md §4.3] |

**Installation:**
```bash
# No installation required — @supabase/supabase-js@2.108.2 already present.
```

**Version verification:** `npm view @supabase/supabase-js version` → `2.108.2` (matches installed). [VERIFIED: npm registry, 2026-06-23]

## Package Legitimacy Audit

> No external packages are installed this phase. The only runtime dependency used (`@supabase/supabase-js`) was vetted and installed in Phase 6.

| Package | Registry | Age | Downloads | Source Repo | slopcheck | Disposition |
|---------|----------|-----|-----------|-------------|-----------|-------------|
| `@supabase/supabase-js` | npm | mature (years) | millions/wk | github.com/supabase/supabase-js | not re-run (no new install) | Already installed Phase 6 — no action |

**Packages removed due to slopcheck [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

## Architecture Patterns

### System Architecture Diagram

```
DONOR DEVICE (Home feed)                         REQUESTER DEVICE (RequestLive)
─────────────────────────                        ──────────────────────────────
  tap "I'll help"                                   mount RequestLive(request_id)
        │                                                   │
        │ optimistic flip slot → responded (D-03)           │ 1. initial fetch
        ▼                                                    ▼
  supabase.from('request_responses')              supabase.rpc('responders_for_request',
    .insert({request_id, donor_id, status})         { p_request_id })
        │                                                    │  (SECURITY DEFINER:
        │  RLS INSERT: auth.uid()=donor_id                   │   verify auth.uid() owns req,
        │  unique(request_id,donor_id)                       │   join responses→profiles→donors,
        ▼                                                    │   return name/phone/dist_meters)
  ┌──────────────────────────────────────┐                  ▼
  │  Postgres: request_responses row      │           render "Will Help" rows
  │  status='responding'                  │                  │
  └──────────────────────────────────────┘                  │ 2. subscribe (D-12)
        │ on error 23505 → it's a dup:                        ▼
        │   keep responded state, no AlertDialog       supabase.channel('rr:'+id)
        │ on other error → rollback + AlertDialog        .on('postgres_changes',
        │                                                   {event:'INSERT', schema:'public',
        ▼                                                    table:'request_responses',
  WAL (write-ahead log)                                      filter:'request_id=eq.'+id}, cb)
        │                                                  .subscribe()
        ▼                                                        │
  supabase_realtime publication ───────────────────────────────►│  (RLS SELECT policy
        │  (Postgres Changes broker applies the                  │   "Responses visible to
        │   request_responses SELECT RLS policy per              │   donor or requester"
        │   subscriber's JWT — only the owner passes)            │   gates delivery to owner)
        │                                                        ▼
        └──────────────────────────────────────────────► cb fires (D-11):
                                                           re-run responders_for_request RPC,
                                                           replace whole list,
                                                           showToast "A donor responded" (D-13)
                                                                 │
                                                           unmount → supabase.removeChannel(ch)
```

### Recommended Project Structure
```
src/
├── lib/
│   └── supabase.ts        # singleton client (unchanged — channels created from `supabase`)
├── screens/
│   ├── Home.tsx           # RequestCard state-machine slot (D-01/D-02), responded-query (D-04)
│   └── RequestLive.tsx    # real responders from RPC, channel subscribe/unsubscribe (D-11/D-12),
│   │                      #   toast cue (D-13), reframed transparency line (D-09), calm empty (D-10)
├── App.tsx                # "I'll help" insert handler (D-03), extend mount hydration (D-14)
├── blood.ts               # COMPATIBLE_REQUEST_TYPES (for the truthful count, D-09)
└── types/database.ts      # regenerate after the migration (adds responders_for_request)
```
*(No new `src/` files are strictly required. If the subscription logic grows, a small `src/lib/realtime.ts` helper following the flat-module convention is acceptable — but a screen-local effect is simpler and matches the codebase. Discretion.)*

### Pattern 1: Enable a table for Postgres Changes (publication add — migration step)
**What:** A table only streams via Postgres Changes if it is in the `supabase_realtime` publication. `request_responses` is NOT currently in it (Phase 6 enabled RLS but never added it to the publication — realtime was out of scope until now).
**When to use:** Once, in the Phase 8 migration, before any client subscribes.
```sql
-- Source: https://supabase.com/docs/guides/realtime/postgres-changes  [CITED]
-- Idempotent guard recommended (publication add errors if the table is already a member).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'request_responses'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.request_responses;
  END IF;
END $$;
```
**REPLICA IDENTITY:** Leave at the table default. Phase 8 consumes only INSERT events, and INSERT payloads always carry the full new row regardless of replica identity. `REPLICA IDENTITY FULL` is only needed to receive *old* column values on UPDATE/DELETE — not used this phase. [CITED: supabase.com/docs/guides/realtime/postgres-changes — "By default, only new records are sent… alter table … replica identity full" is required to receive old values on UPDATE/DELETE]

### Pattern 2: RLS authorizes the realtime stream — the required SELECT policy ALREADY EXISTS
**What:** Postgres Changes applies the table's RLS SELECT policy to each subscriber's JWT; a client receives INSERT/UPDATE/DELETE events only for rows it could `SELECT`. [CITED: supabase.com/docs/guides/realtime/postgres-changes — "A client needs an applicable SELECT policy to receive INSERT, UPDATE, and DELETE events"]
**When to use:** Verify (do not recreate) the policy before enabling realtime.
```sql
-- ALREADY DEPLOYED in Phase 6 (06-RESEARCH.md lines 509-517). DO NOT recreate.
-- This is exactly what makes the owner receive INSERT events for their request's responses.
create policy "Responses visible to donor or requester"
  on public.request_responses for select
  to authenticated
  using (
    (select auth.uid()) = donor_id
    or (select auth.uid()) in (
      select requester_id from public.blood_requests where id = request_id
    )
  );
```
**Critical consequence:** Even though display data (name/phone/dist) flows through the `SECURITY DEFINER` RPC (D-06), this SELECT policy is what authorizes the *event delivery*. Without it the owner's subscription would connect but never fire. It already exists, so DNOR-02's realtime requirement needs only the publication line (Pattern 1). [VERIFIED: 06-RESEARCH.md + 06-02-SUMMARY.md confirm policy `response_parties_select` deployed]

### Pattern 3: Owner-scoped `responders_for_request` RPC (SECURITY DEFINER) — mirrors `requests_within_radius`
**What:** Returns name + phone + distance for `status='responding'` rows of a request the caller owns. The `auth.uid()`-owns-request guard is in the body; phone never leaves the server otherwise.
**When to use:** Initial fetch on `RequestLive` mount, on every realtime INSERT (D-11), and on app-reopen hydration (D-14).
```sql
-- Source pattern: deployed requests_within_radius RPC (07-PATTERNS.md lines 104-156)  [VERIFIED]
-- Hardening rules carried verbatim: SET search_path = '' ; extensions.-prefixed PostGIS ;
--   SECURITY DEFINER ; explicit GRANT to authenticated. NOTE the owner guard (new).
CREATE OR REPLACE FUNCTION public.responders_for_request(p_request_id uuid)
RETURNS TABLE (
  donor_id    uuid,
  name        text,
  phone       text,
  dist_meters double precision,
  created_at  timestamptz
)
SET search_path = ''
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_lat double precision;
  v_lng double precision;
BEGIN
  -- Owner guard: only the request's requester may read its responders' phones.
  -- Returns 0 rows for a non-owner (no error leak about existence).
  SELECT r.lat, r.lng INTO v_lat, v_lng
  FROM public.blood_requests r
  WHERE r.id = p_request_id
    AND r.requester_id = (SELECT auth.uid());

  IF NOT FOUND THEN
    RETURN;  -- not the owner (or request gone) → empty result
  END IF;

  RETURN QUERY
  SELECT
    rr.donor_id,
    p.name,
    p.phone,
    CASE
      WHEN d.lat IS NULL OR d.lng IS NULL OR v_lat IS NULL OR v_lng IS NULL THEN NULL
      ELSE extensions.st_distance(
        extensions.st_point(d.lng, d.lat)::extensions.geography,
        extensions.st_point(v_lng, v_lat)::extensions.geography
      )
    END AS dist_meters,
    rr.created_at
  FROM public.request_responses rr
  JOIN public.profiles p ON p.id = rr.donor_id
  LEFT JOIN public.donors d ON d.profile_id = rr.donor_id
  WHERE rr.request_id = p_request_id
    AND rr.status = 'responding'
  ORDER BY dist_meters NULLS LAST, rr.created_at;
END;
$$;

GRANT EXECUTE ON FUNCTION public.responders_for_request(uuid) TO authenticated;
```
**Client call (typed after `generate_typescript_types`):**
```typescript
const { data, error } = await supabase.rpc('responders_for_request', {
  p_request_id: requestId,
})
// data rows: { donor_id, name, phone, dist_meters, created_at }
```
Notes:
- A donor's `donors.lat/lng` can be NULL (a pure requester who responds without ever registering as a donor cannot happen — "I'll help" requires donor identity — but defend anyway with the NULL-safe CASE; `LEFT JOIN` keeps the responder visible even if the donors row is missing). `dist_meters NULLS LAST` keeps known-distance responders first.
- `LANGUAGE plpgsql` (not `sql`) is used because of the owner guard + early `RETURN`. This is the only intentional deviation from the `requests_within_radius` shape; all hardening rules are identical.

### Pattern 4: "I'll help" insert (bare insert, RLS-checked) — no `.select()` chain
**What:** Insert one `request_responses` row. The INSERT policy `WITH CHECK (auth.uid() = donor_id)` already exists (Phase 6). `status` defaults to `'responding'`.
```typescript
// Pattern carried from handlePosted (App.tsx:309) — bare insert, no .select()/.single() chain.
const { error } = await supabase.from('request_responses').insert({
  request_id: req.id,
  donor_id: uid,        // must equal auth.uid() or RLS rejects
  // status omitted → defaults to 'responding'
})
```
The INSERT policy and the unique index are both already deployed (Phase 6) — no migration needed for the write path itself.

### Pattern 5: Duplicate detection via Postgres error code 23505 (the no-op path)
**What:** A repeat "I'll help" tap hits `unique (request_id, donor_id)`. supabase-js surfaces this as a PostgrestError with `code === '23505'` — the exact same code/shape the app already handles in `handlePosted` for `one_open_request_per_user` (App.tsx:323). Treat 23505 as **success/no-op** (the donor already responded), NOT as a rollback.
```typescript
if (error) {
  if (error.code === '23505') {
    // Already responded — duplicate is the expected no-op (D-04 backstop).
    // Keep the optimistic "responded" state; do NOT roll back, do NOT show AlertDialog.
  } else {
    // Real failure (network/RLS) → roll back optimistic flip + AlertDialog (D-03, Phase 7 D-18).
    rollbackResponded(req.id)
    setWriteError({ title: errStrings.genericTitle, message: errStrings.genericMsg })
  }
}
```
**Distinction that matters:** Phase 7 used 23505 to mean "error, show duplicate dialog." Here 23505 means "already done, stay responded silently." Same code, opposite UX — the planner must spell this out so the executor does not copy the Phase 7 dialog branch. [VERIFIED: error.code === '23505' pattern already in App.tsx:323]

### Pattern 6: Restore responded state on feed load (D-04)
**What:** On Home feed load, fetch the current donor's own response rows and pre-mark cards. RLS already allows a donor to read their own response rows (`auth.uid() = donor_id` branch of the SELECT policy).
```typescript
const { data } = await supabase
  .from('request_responses')
  .select('request_id')
  .eq('donor_id', uid)            // RLS-allowed: donor reads own rows
  .eq('status', 'responding')
const respondedIds = new Set((data ?? []).map((r) => r.request_id))
// drive each RequestCard's slot: respondedIds.has(req.id) ? respondedState : 'I'll help'
```

### Pattern 7: Realtime channel lifecycle in a React effect (subscribe on mount / removeChannel on unmount)
**What:** Create one channel per active request, filtered to `request_id`, subscribe on mount, `removeChannel` on unmount. The auth token is already on the socket (supabase-js auto-wires it — see Pitfall 2).
```typescript
// Source: https://supabase.com/docs/guides/realtime/postgres-changes  [CITED]
useEffect(() => {
  if (!requestId) return
  let cancelled = false

  // 1. initial fetch (also covers D-11 "refetch on (re)subscribe")
  void refetchResponders()

  // 2. subscribe, filtered to this request only (D-12)
  const channel = supabase
    .channel(`rr:${requestId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'request_responses',
        filter: `request_id=eq.${requestId}`,
      },
      () => {
        if (cancelled) return
        void refetchResponders()          // D-11: refetch whole list, replace
        showToast(/* "A donor responded" */)  // D-13
      },
    )
    .subscribe()

  return () => {
    cancelled = true
    void supabase.removeChannel(channel)  // tears down the socket subscription
  }
}, [requestId])
```
- **`removeChannel(channel)`** is the documented teardown (it unsubscribes and removes from the client's channel registry). Use it in the cleanup, not a bare `channel.unsubscribe()`. [CITED: supabase.com/docs/reference/javascript/removechannel]
- **Filter syntax** is `column=eq.value` (also `neq/lt/lte/gt/gte/in`). One filter per `.on()`. [CITED: supabase.com/docs/guides/realtime/postgres-changes]
- **Refetch-on-event (not payload-apply)** is correct per D-11: the payload's `new` row contains only `request_responses` columns (no name/phone/distance — those need the RPC), and refetch self-heals after a dropped/reconnected socket. Applying the payload directly would require a second per-row RPC and lose the self-heal property.

### Anti-Patterns to Avoid
- **Recreating the SELECT policy.** It already exists from Phase 6. Re-running `create policy` with the same name errors; an unguarded `drop+create` risks a window with no policy. Verify, don't recreate.
- **Calling `supabase.realtime.setAuth()` manually.** supabase-js auto-sets the JWT on `SIGNED_IN`. A manual call is redundant and, if passed a stale token, harmful. (Cold-start nuance in Pitfall 2.)
- **Chaining `.select()`/`.single()` onto the insert.** The codebase convention (App.tsx) is a bare `.insert()`; chaining `.single()` on a 0-or-1-row insert that may 23505 complicates error handling.
- **Applying the realtime payload row directly to state.** It lacks display fields and breaks the self-heal model. Always refetch via the RPC (D-11).
- **Exposing donor phone via a table-level join.** Phone must only travel through the owner-scoped RPC. Do not loosen `request_responses`/`donors`/`profiles` SELECT policies to enable a client-side join.
- **`REPLICA IDENTITY FULL` "just in case."** Not needed for INSERT-only consumption; it increases WAL volume. Leave default.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Live "a donor responded" updates | Polling loop / `setInterval` refetch | Supabase Postgres Changes channel (Pattern 7) | Built-in WAL streaming + RLS authorization + auto-reconnect; polling wastes battery/network on weak Myanmar links and adds latency. |
| Realtime authorization | Manual token plumbing into the socket | Auto-wired session JWT (supabase-js `onAuthStateChange` → `realtime.setAuth`) | Verified in installed source; rolling your own risks stale tokens and RLS bypass attempts. |
| Donor-phone gating | Client-side filtering of a broad query | `responders_for_request` SECURITY DEFINER RPC with owner guard | Server-gated phone exposure is the only spec-compliant path (§4.3); client filtering leaks data over the wire. |
| Duplicate-response prevention | Pre-check `select … where exists` then insert | DB `unique (request_id, donor_id)` + 23505 handling | The pre-check has a TOCTOU race on double-tap; the unique index is atomic. Already deployed. |
| Distance computation | Haversine in JS over coarse coords | PostGIS `extensions.st_distance` in the RPC | Consistent with the deployed feed RPC; coords stay server-side; one source of truth for distance. |

**Key insight:** Phase 8 is almost entirely *configuration + composition of already-deployed primitives*. The unique constraint, the INSERT policy, and the owner-readable SELECT policy all exist from Phase 6. The only new DB objects are one RPC and one publication line. The realtime client is already installed and auto-authorized. The risk is not "build complex new machinery" — it is "wire the existing pieces in the correct order and don't reintroduce a phone-leak by shortcutting the RPC."

## Runtime State Inventory

> Phase 8 is additive (new RPC + publication membership + client wiring), not a rename/refactor. This inventory covers the realtime-specific live-config surface that a grep cannot find.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | `request_responses` rows: `status` enum stores `'responding'` (default). No string-key rename. The owner-readable SELECT policy and INSERT policy already exist. | None — code/SQL additions only. |
| Live service config | **`supabase_realtime` publication membership is live DB config, NOT in git.** `request_responses` must be ADDED to it via migration (Pattern 1). Realtime channel quota/settings live in the Supabase dashboard. | Migration: `ALTER PUBLICATION supabase_realtime ADD TABLE public.request_responses;` Verify membership via `pg_publication_tables` (Pattern 1 guard). |
| OS-registered state | None — web/PWA app, no OS task registration. | None — verified by absence of any scheduler/daemon in this app (Phase 8 adds no Edge Function; LIFE-02/PUSH-04 deferred). |
| Secrets/env vars | `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (existing, used by the realtime socket via `_initRealtimeClient` apikey param). No new secret. | None — existing anon key authorizes the socket; per-user RLS comes from the auto-wired session JWT. |
| Build artifacts | `src/types/database.ts` is a generated artifact; it will be **stale** after the RPC is added (missing `responders_for_request` in `Functions`). | Regenerate via Supabase MCP `generate_typescript_types` after `apply_migration`, exactly as Phase 7 did (07-01-SUMMARY). |

**The canonical question — after every file is updated, what runtime systems still hold old state?** Answer: the **`supabase_realtime` publication** (must gain `request_responses`) and the **generated types file** (must be regenerated). Both are addressed above. Nothing else.

## Common Pitfalls

### Pitfall 1: Subscription connects but never fires (publication not enabled, or SELECT policy missing)
**What goes wrong:** `RequestLive` subscribes, `.subscribe()` reports `SUBSCRIBED`, but no INSERT events ever arrive.
**Why it happens:** Two independent gates. (a) The table isn't in `supabase_realtime` — no WAL events are published. (b) The subscriber's JWT can't `SELECT` the row — RLS filters the event out.
**How to avoid:** Run Pattern 1 (publication add) in the migration. Confirm Pattern 2's SELECT policy exists (it does, from Phase 6). Both are required; either missing = silent no-events.
**Warning signs:** `.subscribe((status) => …)` shows `SUBSCRIBED` but the callback never runs even though a second device inserts a row. Verify with `select * from pg_publication_tables where pubname='supabase_realtime' and tablename='request_responses';` returning a row.

### Pitfall 2: Cold-start race — first subscription before the session JWT reaches the socket
**What goes wrong:** On a hard page reload, `App` restores the session, then `RequestLive` mounts and subscribes; if the subscription is created before `onAuthStateChange` fires `SIGNED_IN`, the socket may carry only the anon apikey and the owner's RLS-gated events won't deliver.
**Why it happens:** supabase-js sets the realtime token reactively on auth events; on cold restore there is a brief window. [VERIFIED: installed source `_handleTokenChanged` sets token only on `TOKEN_REFRESHED`/`SIGNED_IN`]
**How to avoid:** This app's flow makes it low-risk — `RequestLive` is only reached *after* `hydrateUserFromDb` confirms the session (App.tsx initAuth) and `getSession()` resolves, by which point the session restore has already triggered the auth state. Belt-and-suspenders option for the planner: gate the subscription effect on a confirmed `user.supabaseId` (already a prop in this codebase) so it never mounts pre-session. The D-11 "refetch on (re)subscribe" also means a momentarily-missed event self-heals on the next event or on reopen (D-14).
**Warning signs:** Events work on in-session navigation but not immediately after a full reload.

### Pitfall 3: Treating 23505 as an error (showing the duplicate dialog)
**What goes wrong:** Repeat "I'll help" pops the Phase-7-style "already open" AlertDialog, confusing the donor who simply re-tapped.
**Why it happens:** Copy-pasting the `handlePosted` 23505 branch, which *is* an error case there.
**How to avoid:** In the response handler, 23505 = "already responded" = keep the responded state, no dialog (Pattern 5). Only non-23505 errors roll back + dialog.
**Warning signs:** A dialog appears when tapping a card that's already in the responded state (the D-04 query should normally hide/disable the button, but the handler must still be idempotent for races).

### Pitfall 4: Stale types after the migration (TS build break or `as any` creep)
**What goes wrong:** `supabase.rpc('responders_for_request', …)` is untyped or errors at build because `database.ts` predates the RPC.
**Why it happens:** Forgetting the regenerate step.
**How to avoid:** After `apply_migration`, run Supabase MCP `generate_typescript_types` and overwrite `src/types/database.ts` (Phase 7 precedent). Verify `Functions.responders_for_request` appears with `Args: { p_request_id: string }`.
**Warning signs:** `tsc -b` fails on the `.rpc()` call, or the executor reaches for `as any`.

### Pitfall 5: Multiple channels / leaked subscriptions on re-mount
**What goes wrong:** Navigating in/out of `RequestLive` accumulates channels; events fire N times, toasts spam.
**Why it happens:** Missing/incorrect effect cleanup, or a channel name that isn't unique per request.
**How to avoid:** Return `() => supabase.removeChannel(channel)` from the effect (Pattern 7); name the channel `rr:${requestId}` so it's stable and de-dupable.
**Warning signs:** The "a donor responded" toast fires multiple times for one new responder.

### Pitfall 6: PostGIS calls unprefixed under `search_path=''`
**What goes wrong:** The RPC errors with `function st_distance does not exist`.
**Why it happens:** `SET search_path = ''` (a required hardening) means bare `st_*` names don't resolve.
**How to avoid:** Always `extensions.st_distance`, `extensions.st_point`, `::extensions.geography` — carried verbatim from the deployed `requests_within_radius` RPC.
**Warning signs:** Migration apply fails on the function body, or the RPC returns an error at call time.

## Code Examples

### Subscribe + refetch (full RequestLive effect)
```typescript
// Source: composed from https://supabase.com/docs/guides/realtime/postgres-changes [CITED]
// + installed supabase-js@2.108.2 auto-auth behavior [VERIFIED: node_modules source]
useEffect(() => {
  if (!requestId || !currentUserId) return   // gate on confirmed session (Pitfall 2)
  let cancelled = false

  async function refetchResponders() {
    const { data, error } = await supabase.rpc('responders_for_request', {
      p_request_id: requestId,
    })
    if (error || cancelled) return
    setResponders(data ?? [])
  }

  void refetchResponders()  // initial + "refetch on (re)subscribe" (D-11)

  const channel = supabase
    .channel(`rr:${requestId}`)
    .on('postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'request_responses',
        filter: `request_id=eq.${requestId}` },
      () => { if (!cancelled) { void refetchResponders(); showToast(/* D-13 */) } })
    .subscribe()

  return () => { cancelled = true; void supabase.removeChannel(channel) }
}, [requestId, currentUserId])
```

### "I'll help" handler with optimistic flip + 23505 no-op (App.tsx style)
```typescript
const handleRespond = async (req: NearbyRequest) => {
  const uid = user.supabaseId
  if (!uid) return
  setRespondedIds((s) => new Set(s).add(req.id))   // optimistic (D-03)

  const { error } = await supabase.from('request_responses').insert({
    request_id: req.id,
    donor_id: uid,
  })
  if (error && error.code !== '23505') {            // 23505 = already responded → no-op (D-04/Pattern 5)
    setRespondedIds((s) => { const n = new Set(s); n.delete(req.id); return n })  // rollback
    setWriteError({ title: errStrings.genericTitle, message: errStrings.genericMsg })  // D-18
  }
}
```

### "Can see your request" truthful count (D-09) — recommendation
```typescript
// Reuse the deployed donors_within_radius RPC, then filter by directional compatibility in JS
// (mirrors Home.tsx's feed pattern). Count = compatible + available donors within radius.
const { data } = await supabase.rpc('donors_within_radius', {
  lat: req.lat, lng: req.lng, radius_km: 10,   // DISPLAY_RADIUS_KM
})
// donors_within_radius already filters is_available=true; apply directional compat:
const count = (data ?? []).filter((d) =>
  COMPATIBLE_DONOR_FOR[req.bloodType]?.includes(d.blood_type)  // donor can donate INTO requested type
).length
// render: "[count] nearby compatible donors can see your request" with formatNumber(count, lang)
```
**Note:** `donors_within_radius` returns `blood_type` and filters `is_available=true` (07-PATTERNS.md analog). The directional matrix is `COMPATIBLE_REQUEST_TYPES` in `src/blood.ts` (donor→requestable types); for this count you want the inverse direction (which donors can serve *this* request). Confirm the exact map name/direction in `src/blood.ts` during planning. `[ASSUMED]` on the precise helper name — the directional logic exists from Phase 7 but the inverse-lookup convenience may need a one-line addition. This count is **not on the critical path** for DNOR-01/DNOR-02; if it complicates the phase, fall back to the request's stored `alerted_count` or a simpler honest phrasing.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Realtime "Replication" toggle in dashboard only | SQL `ALTER PUBLICATION supabase_realtime ADD TABLE …` (migration-as-code) | supabase-js v2 era | Enablement is a reproducible migration step, not a manual dashboard click — fits this project's MCP-migration convention. |
| Manual `realtime.setAuth(jwt)` after login | Auto-wired on `onAuthStateChange` (`SIGNED_IN`/`TOKEN_REFRESHED`) | supabase-js v2 | No manual token plumbing needed for RLS-authorized Postgres Changes when using `signInWithPassword`. [VERIFIED: installed source] |
| `channel.unsubscribe()` ad hoc | `supabase.removeChannel(channel)` for full teardown | supabase-js v2 | Cleaner registry teardown in React effect cleanup. [CITED: supabase docs] |

**Deprecated/outdated:**
- The v1 `supabase.from('table').on('INSERT', cb).subscribe()` API is gone in v2 — use `supabase.channel(name).on('postgres_changes', {…}, cb).subscribe()`. Any training-data snippet using `.from().on()` is wrong for 2.108.2. [VERIFIED: installed v2 API]

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The inverse directional-compatibility lookup for the D-09 count (which donor types can serve a given request type) is a one-line derivation from the existing `COMPATIBLE_REQUEST_TYPES` in `src/blood.ts`; exact helper name TBD at plan time. | Code Examples (D-09 count) | Low — D-09 count is not on the DNOR-01/02 critical path; can fall back to `alerted_count` or simpler copy. Planner should confirm `src/blood.ts` exports. |
| A2 | A responder always has a `donors` row (responding implies donor identity), but the RPC defends with `LEFT JOIN` + NULL-safe distance anyway. | Pattern 3 | Very low — defensive code handles the edge; worst case a responder shows with no distance. |

**Note:** All realtime/RLS/RPC-shape claims are VERIFIED or CITED, not assumed. Only the two minor items above need confirmation, neither blocking.

## Open Questions (RESOLVED)

1. **Should the subscription effect live in `RequestLive` or be lifted to `App`?**
   - What we know: D-12 says RequestLive-only; the codebase keeps global state in App but screen-local effects (like Home's feed effect) are also idiomatic.
   - What's unclear: whether the responder list state should sit in App (so the Home active-request card could also reflect a count) or stay screen-local.
   - RESOLVED: Keep the subscription + responder list **screen-local in `RequestLive`** per D-12. App only does the one-shot fetch-on-reopen (D-14) during existing hydration. This avoids an app-wide socket (explicitly deferred) and matches Home's effect-local precedent. Non-blocking; already reflected in Plan 03.

2. **Does the requester need to also see responders' distance when `donors.lat/lng` is coarse/stale?**
   - What we know: distance is computed in the RPC from the request's lat/lng vs the donor's coarse lat/lng.
   - What's unclear: acceptable staleness of `donors.location_updated_at`.
   - RESOLVED: Out of scope to refresh donor location here; show the best-known distance with the existing `~` approximation prefix (Home's `formatDistanceLabel` already conveys approximation). No phase impact.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `@supabase/supabase-js` (incl. realtime-js) | DNOR-01, DNOR-02 | ✓ | 2.108.2 | — |
| Supabase Realtime service (project) | DNOR-02 | ✓ (managed; same project as Phase 6/7) | — | — |
| Supabase MCP (`apply_migration`, `execute_sql`, `generate_typescript_types`) | RPC + publication + types | ✓ (used Phase 6/7) | — | — |
| PostGIS `extensions` schema | RPC distance | ✓ (enabled Phase 6, used by deployed RPCs) | — | — |
| Node 24 / Vite 8 dev server (HTTPS, secure context) | client | ✓ | per CLAUDE.md | — |

**Missing dependencies with no fallback:** none.
**Missing dependencies with fallback:** none.

## Project Constraints (from CLAUDE.md)

- **Tech stack locked:** React 19 + Vite 8 + Tailwind v4 (CSS-only) + TS 6. No new build tooling.
- **Styling:** inline `CSSProperties` objects; use CSS variables (`var(--color-*)` etc.), never hardcode hex (except `#fff` / scrim). Reuse the green responder pill verbatim (D-01).
- **Localization:** every user-facing string EN + Burmese (Noto Sans Myanmar); use `formatNumber` for Burmese numerals. "I'll help" = **ကူညီမည်**.
- **Naming:** PascalCase components, camelCase utils, named export + default-alias, `handle*` event handlers, `import type` for type-only imports (`verbatimModuleSyntax: true`).
- **Error handling:** Supabase calls resolve to typed results (no throws); reuse `AlertDialog` for write failures (D-03/D-18). `noUnusedLocals`/`noUnusedParameters` enforced — no dead vars.
- **GSD workflow:** all edits through a GSD command. After the phase, run the `code-quality-refactor` agent (standing user preference, MEMORY.md).
- **Migrations:** via Supabase MCP (`apply_migration` for DDL, `execute_sql` for DML), NOT local `supabase/migrations/*.sql`. Regenerate `src/types/database.ts` via MCP.
- **No test framework:** verification is manual + Supabase dashboard (see Validation Architecture).
- **Design fidelity:** match the design-system skill (`.claude/skills/frontend-design/SKILL.md`) — emergency-calm tone, mobile-first, Burmese-first.

## Validation Architecture

> This project has no automated test framework (confirmed CLAUDE.md + MEMORY.md). Verification is manual + Supabase dashboard. The hooks below are the *automatable* checks a plan can assert; behavioral verification stays manual.

### "Test" Framework
| Property | Value |
|----------|-------|
| Framework | None (no Jest/Vitest/Playwright — user tests manually) |
| Config file | none |
| Quick run command | `npm run build` (= `tsc -b && vite build`) and `npm run lint` |
| Full suite command | `npm run build && npm run lint` + manual two-device dashboard check |

### Phase Requirements → Verification Map
| Req ID | Behavior | Type | Automatable Check | Manual Check |
|--------|----------|------|-------------------|--------------|
| DNOR-01 | "I'll help" inserts a `request_responses` row, repeat = no-op | manual+SQL | `grep -c "request_responses" src/App.tsx` ≥1; `grep -c "23505" src/App.tsx` ≥1 (no-op branch); `npm run build` green | Tap "I'll help" → row appears in dashboard with `status='responding'`; tap again → no new row, no dialog |
| DNOR-02 | Live "Will Help" update without refresh | manual | `grep -c "postgres_changes" src/screens/RequestLive.tsx` ≥1; `grep -c "removeChannel" src/screens/RequestLive.tsx` ≥1; `grep -c "responders_for_request" src/screens/RequestLive.tsx` ≥1 | Device A (requester) on RequestLive; Device B (donor) taps "I'll help" → A's list updates within seconds, no refresh; toast shows |
| Migration | RPC + publication deployed | SQL | `SELECT 1 FROM pg_proc WHERE proname='responders_for_request'`; `SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND tablename='request_responses'` | Dashboard: function present; Replication shows request_responses enabled |
| Types | Regenerated | TS | `grep -c "responders_for_request" src/types/database.ts` ≥1; `npm run build` green | — |
| Security | Non-owner cannot read responders | SQL | — | Call `responders_for_request(other_users_request_id)` as a different session → 0 rows; subscribe to another request's filter → no events |

### Wave 0 Gaps
- [ ] None — no test infrastructure to create (project verifies manually by design). The automatable checks above are grep/build/SQL assertions a plan can embed in task `verify` blocks, consistent with Phase 6/7.

## Security Domain

> `security_enforcement` not disabled in config — included. ASVS L1 baseline (matches Phase 7's `<threat_model>` posture).

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | Existing phone-keyed `signInWithPassword` session; realtime JWT auto-wired. No change this phase. |
| V3 Session Management | yes | Supabase session JWT authorizes both PostgREST and the realtime socket; `removeChannel` on unmount avoids leaked authorized sockets. |
| V4 Access Control | **yes (core)** | RLS SELECT/INSERT policies on `request_responses` (deployed); owner-guard inside `responders_for_request` (`auth.uid()` owns request); RLS-on-stream gates event delivery. |
| V5 Input Validation | yes | `p_request_id uuid` is type-checked by Postgres; `donor_id` forced to `auth.uid()` by INSERT `WITH CHECK`; no free-text injected into SQL (parameterized RPC). |
| V6 Cryptography | no | No new crypto. (Existing prototype phone-derived password is a known, deferred limitation — not in scope.) |

### Known Threat Patterns for this stack (STRIDE → mitigation)
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Non-owner subscribes to another request's responder stream | Information Disclosure | Postgres Changes applies the `request_responses` SELECT RLS policy per subscriber JWT — only `donor_id` or the parent request's `requester_id` receive events. A non-owner's subscription connects but receives nothing. [CITED: supabase realtime RLS] |
| Donor phone leaked via the stream payload | Information Disclosure | Realtime payload carries only `request_responses` columns (no phone). Phone is returned ONLY by the owner-guarded `responders_for_request` RPC. Refetch-on-event (D-11) means the stream never transports PII. |
| Donor phone leaked via RPC to a non-owner | Information Disclosure | RPC body guards `r.requester_id = (SELECT auth.uid())`; non-owner gets 0 rows. SECURITY DEFINER + `SET search_path=''` prevents search-path hijack. GRANT to `authenticated` only (not `anon`). |
| Forged `donor_id` on insert (respond as someone else) | Spoofing / Elevation of Privilege | INSERT policy `WITH CHECK (auth.uid() = donor_id)` (deployed Phase 6) rejects any row whose donor_id ≠ caller. |
| Duplicate/spam responses | Tampering | `unique (request_id, donor_id)` (deployed) — second insert errors 23505; treated as no-op. (Per-request response volume is naturally bounded.) |
| RPC abuse / enumeration of others' requests | Information Disclosure | Owner guard returns 0 rows for non-owned `request_id` with no existence signal (same empty result whether the request exists or not). |
| SECURITY DEFINER privilege escalation via search_path | Elevation of Privilege | `SET search_path = ''` + `extensions.`/`public.` schema-qualified everything (carried from deployed RPCs). |
| Leaked authorized socket after navigation | Information Disclosure | `supabase.removeChannel(channel)` in effect cleanup (Pattern 7) tears the subscription down on unmount. |

**Note for the planner's `<threat_model>` block:** mirror Phase 7's `<threat_model>` format (T-08-xx IDs). The high-value items to enumerate are the four above marked Information Disclosure plus the forged-donor_id Spoofing item — all have concrete, already-mostly-deployed mitigations.

## Sources

### Primary (HIGH confidence)
- Installed `@supabase/supabase-js@2.108.2` bundled source (`node_modules/.../dist/index.mjs` `_handleTokenChanged`/`_listenForAuthEvents`) — auto-wiring of session JWT to `realtime.setAuth` on `SIGNED_IN`/`TOKEN_REFRESHED`. [VERIFIED]
- `npm view @supabase/supabase-js version` → 2.108.2 (current). [VERIFIED, 2026-06-23]
- Deployed Phase 6 RLS SQL — `06-RESEARCH.md` lines 506-522 (`request_responses` SELECT + INSERT policies); `06-02-SUMMARY.md` (policies `response_parties_select`, `donor_response_insert` confirmed live). [VERIFIED in repo]
- Deployed Phase 7 RPC pattern — `07-PATTERNS.md` lines 96-161 (`requests_within_radius` SECURITY DEFINER shape, search_path/extensions/GRANT rules). [VERIFIED in repo]
- `blood-help-spec.md` §3.4, §4.3 — privacy guardrails (donor phone never sent to clients; gated by active response; requester number shown to matched donors). [VERIFIED in repo]
- `src/types/database.ts` — confirms `request_responses` shape (`unique` via FK, `status` default `responding`), `response_status` enum, existing `requests_within_radius`/`donors_within_radius` functions. [VERIFIED in repo]
- `src/App.tsx` — existing 23505 handling (line 323), bare-insert convention, mount hydration (D-14 extension point). [VERIFIED in repo]

### Secondary (MEDIUM confidence)
- https://supabase.com/docs/guides/realtime/postgres-changes — publication enablement SQL, RLS-on-stream requirement, REPLICA IDENTITY semantics, JS `channel().on('postgres_changes', {event,schema,table,filter}, cb).subscribe()` API, filter syntax. [CITED]
- https://supabase.com/docs/guides/realtime/subscribing-to-database-changes — Broadcast auth note (confirms setAuth is explicit for Broadcast; Postgres Changes auto-auth confirmed separately via installed source). [CITED]

### Tertiary (LOW confidence)
- None used for load-bearing claims. The `removeChannel` teardown convention is from supabase docs reference; corroborated by the v2 API surface.

## Metadata

**Confidence breakdown:**
- Realtime + RLS mechanics (publication, SELECT-policy-gates-stream, replica identity): HIGH — official docs + the SELECT policy verified already deployed.
- supabase-js auto-auth on realtime: HIGH — read directly from installed bundle source.
- RPC shape + hardening: HIGH — mirrors the deployed `requests_within_radius` verbatim with one documented `plpgsql` deviation for the owner guard.
- 23505 duplicate handling: HIGH — identical code path already in App.tsx.
- D-09 truthful count helper name: MEDIUM — directional logic exists (Phase 7) but inverse lookup name TBD; non-critical (A1).

**Research date:** 2026-06-23
**Valid until:** ~2026-07-23 (Supabase Realtime API is stable; supabase-js pinned at 2.108.2 in lockfile — re-verify only if the dependency is bumped).
