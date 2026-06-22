# Phase 8: Donor Response + Realtime - Context

**Gathered:** 2026-06-23
**Status:** Ready for planning

<domain>
## Phase Boundary

Wire the live donor-response loop on Supabase Realtime. A donor taps **"I'll help"** on a nearby request → a `request_responses` row (`status='responding'`) is created → the **requester's live screen shows that donor in the "Will Help" section within seconds, no page refresh**. This is the app's first use of Supabase Realtime.

By the end of this phase:
- The Home feed card gains a state-driven **"I'll help"** action that writes a real `request_responses` row (duplicate-blocked by the existing `unique (request_id, donor_id)` constraint from Phase 6).
- The `RequestLive` "Will Help" section is driven by **real responders** (replacing the hardcoded `WILL_HELP`/`CAN_CALL` dummy arrays) via a Supabase Realtime subscription on `request_responses` for the active request.
- Responder display data (name, distance, number) is fetched through an **owner-scoped `SECURITY DEFINER` RPC**, keeping donor phones server-gated.
- A returning requester sees current responders fetched on app reopen (covering the "came back to the app" case while FCM push is deferred).

**Out of scope (deferred):**
- **FCM push to the requester on response (PUSH-04)** — explicitly routed to its **own new dedicated phase** (insert 8.5 or front of v3). Realtime cannot reach a closed app; push is a separate transport (Edge Function sender + service worker + device-token registration). See Deferred Ideas.
- The **"Can call" nearby-donor pool** and **"+Y more notified"** line on `RequestLive` (computed pools, overlap push/matching — not wired this phase).
- QR / 5-char code confirmation + donation crediting + request lifecycle (Phase 9).
- Gated / logged / rate-limited phone reveal and personal-data purge (v3 privacy milestone).

</domain>

<decisions>
## Implementation Decisions

### Donor-side "I'll help" action (Home feed) — DNOR-01

- **D-01:** **State-driven single action slot.** The feed card is already content-dense (blood badge, address, distance·time, number, round action button). Do **not** add a second button. Instead, the card's existing right-side action slot is a **state machine**:
  - *Before responding:* the slot is an **"I'll help" (ကူညီမည်)** button (labeled pill, not just an icon — clearer in Burmese).
  - *After responding:* the slot becomes the **round red call button** (the current `tel:` affordance), and a small green **"✓ ကူညီမည်"** tag appears by the address — reuse the exact green responder pill already in `RequestLive.tsx` (line ~323) for one consistent visual language across screens.
- **D-02:** **Hide the requester's phone number on the card until the donor responds.** The number is revealed alongside the call button only after "I'll help" is tapped. Reinforces commit-then-contact and declutters the pre-response card. (Spec §3.4: the requester's number is meant for matched donors — revealing on response is consistent.)
- **D-03:** **Optimistic flip.** Tapping "I'll help" flips the slot to the responded state immediately; if the DB insert fails, **roll back** the UI and surface the existing `AlertDialog` (Phase 7 D-18 error pattern). Chosen for snappiness on weak Myanmar networks.
- **D-04:** **Restore responded state across reload by querying existing responses on feed load.** When the Home feed loads, fetch the current donor's own `request_responses` rows and pre-mark matching cards as responded (so the button starts in the correct state after any reload/app reopen). The DB unique constraint is the backstop; this query is the UX layer.

### Requester live list — info & privacy (DNOR-02)

- **D-05:** **Responders show name + distance + number + call button** (direct, per spec §2.3 — "name, distance, number shown"). A donor who tapped "I'll help" has actively volunteered, so direct contact is the intent. (Reveal-on-tap gating is only for the not-yet-responded "Can call" pool, which is out of scope this phase.)
- **D-06:** **Fetch responder data via an owner-scoped `SECURITY DEFINER` RPC** (e.g. `responders_for_request(request_id)`). The function verifies `auth.uid()` owns the request, then returns name + phone + `dist_meters` for `status='responding'` rows. This honors spec §4.3 ("a donor's phone is never sent to clients") via its documented exception ("gated by … an active response"), while keeping phone exposure **server-gated to the single request owner** rather than loosening table-level RLS. Mirrors the Phase 7 `requests_within_radius` RPC pattern.
- **D-07:** **v2 privacy posture: responder numbers are visible only to the request owner** (enforced by the RPC). The full gated / logged / rate-limited reveal machinery stays **deferred to the v3 privacy milestone** (PROJECT.md Out of Scope). No reveal-audit logging is added this phase.

### Realtime list scope (DNOR-02)

- **D-08:** **Wire the "Will Help" responders section only.** Hide the "Can call" pool and the "+Y more notified" line this phase (they are computed pools overlapping push/matching). This avoids mixing real responder data with dummy data and matches the success criteria exactly.
- **D-09:** **Reframe the transparency line to be truthful in a no-push world.** Replace "We've alerted [X] nearby donors" with a computed, honest line — e.g. **"[X] nearby compatible donors can see your request"** — backed by a count of matching donors within radius (compatible + within `DISPLAY_RADIUS_KM`). The word "alerted" overstates reality until FCM exists.
- **D-10:** **Zero-responder empty state = a calm "waiting for responses" message**, not the animated "searching for donors" spinner (which implies active background work that isn't happening). The request is live; donors may respond.

### Realtime mechanics (DNOR-02)

- **D-11:** **On each new-response realtime event, refetch the whole responder list via `responders_for_request`** and replace the list. At this scale it's the simpler-correct choice: idempotent, self-heals after a dropped/reconnected socket, no client-side dedupe/ordering logic. Also refetch on (re)subscribe.
- **D-12:** **Subscription is RequestLive-only.** Subscribe to `request_responses` (filtered to the active `request_id`) when the live screen mounts; unsubscribe on unmount. No app-wide subscription (it wouldn't help the closed-app case anyway — see D-14).
- **D-13:** **Gentle arrival cue.** When a new responder appears live, reuse the screen's existing toast to show "A donor responded" as the row updates — meaningful reassurance for an anxious waiting requester.
- **D-14:** **Closed-app gap is handled by deferral + fetch-on-reopen, not by Realtime.** A websocket cannot reach a closed/backgrounded app; reaching a closed app requires FCM push (PUSH-04), which is deferred to its own phase. For Phase 8, when the requester reopens the app, **fetch current responders during the existing active-request hydration** (Phase 7 already loads the user's own active request on mount) so the Home active-request card / live screen immediately reflect who responded while away. (Spec §2.3: "updates every time the requester opens the app.")

### Claude's Discretion (spec-locked or no product choice)

- **Realtime transport choice** (Supabase Postgres Changes vs Broadcast) — discretion, but it MUST be **RLS-gated**: a request owner only receives events for responses to *their own* request. **Note:** Postgres Changes enforces RLS on the stream, so even though display data comes via the `SECURITY DEFINER` RPC (D-06), a **row-level SELECT policy on `request_responses` for the request owner** is required for the event to fire at all. Researcher/planner to confirm the policy + the realtime publication enablement (`request_responses` in `supabase_realtime`, REPLICA IDENTITY) as a migration step.
- **RPC vs query for the responder fetch** — D-06 specifies an owner-scoped RPC; exact SQL shape (join `request_responses` → `profiles` → `donors`, compute `dist_meters` from the request's stored lat/lng vs each donor's coarse lat/lng) is discretion.
- **The "can see your request" count (D-09)** — how it's computed (reuse a `donors_within_radius`-style count filtered by directional compatibility + availability, vs the request's stored `alerted_count`) is discretion; it must be truthful.
- **Distance/number formatting** — reuse `Home.tsx` `formatPhone` (E.164 → local) and `formatDistanceLabel` / `formatNumber` (Burmese numerals) for responder rows.
- **No-op on duplicate response** — the unique `(request_id, donor_id)` constraint is the DB backstop; the UI no-op comes from D-04 (button hidden/disabled when already responded).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Spec — Response Flow, Realtime, Privacy, Data Model
- `blood-help-spec.md` §2.2 — Donor path ("tap **I'll help** → call the requester"); commit-then-contact ordering that drives D-01/D-02.
- `blood-help-spec.md` §2.3 — Requester live screen: the three donor states (Will help / Can call / +Y more), what each shows ("name, distance, number shown, call button"), minimize behavior, "updates when the requester opens the app." Drives D-05, D-08, D-09, D-14.
- `blood-help-spec.md` §3.4 — Privacy guardrails (donor numbers never printed in lists; revealed only for opted-in or responding donors; requester number shown to matched donors). Drives D-02, D-05, D-07.
- `blood-help-spec.md` §4 — Data model: `request_responses` (`unique (request_id, donor_id)`, `status` default `'responding'`, `donor_id` → `profiles.id`), `response_status` enum (`responding` | `declined`).
- `blood-help-spec.md` §4.1 — Persisted vs computed-live (responder rows persist; "Can call" pool + alerted count are computed) — basis for D-08.
- `blood-help-spec.md` §4.2 — Server-side logic: "**On donor response: FCM push to the requester**" — this is the deferred PUSH-04 piece (own phase), NOT Phase 8.
- `blood-help-spec.md` §4.3 — RLS high level: "Responses and donations are visible only to the two parties involved"; "a donor's phone is never sent to clients … gated by `emergency_callable` or an active response." Drives D-06's owner-scoped RPC + the required SELECT policy.

### Matching / Geo (for the truthful count + distances)
- `blood-help-spec.md` §3.1 — Directional blood compatibility matrix (donor donates *into* the requested type). Implemented in Phase 7 `COMPATIBLE_REQUEST_TYPES` in `src/blood.ts`.
- `blood-help-spec.md` §3.2 — Radius logic (`DISPLAY_RADIUS_KM` 10, `ALERT_RADIUS_KM` 25). Relevant to D-09's count.

### Prior Phase Decisions (locked, carry forward)
- `.planning/phases/07-data-persistence-geo-matching/07-CONTEXT.md` — schema split (`profiles` identity / `donors` role; "is donor" = donors row exists), `current_address` rename, the `requests_within_radius` RPC pattern (model for the new responders RPC), `AlertDialog` write-error pattern (D-18), full active-request hydration on mount (D-13/D-14 there — extend it here for responders).
- `.planning/phases/06-foundation/06-CONTEXT.md` — coarsened GPS (2dp), Supabase MCP for migrations/seed (D-15), `request_responses` table + `unique (request_id, donor_id)` already deployed.

### Planning Context
- `.planning/REQUIREMENTS.md` — DNOR-01, DNOR-02 (this phase). PUSH-04, DNOR-03 (push) deferred.
- `.planning/ROADMAP.md` Phase 8 — three success criteria (response row + no-op; live Will-Help update; DB-level duplicate prevention).

### Current Codebase (files being modified)
- `src/screens/Home.tsx` — `RequestCard` (line ~76) gains the state-driven "I'll help" action (D-01); add the responded-state query (D-04) and number-hide logic (D-02). `formatPhone`/`formatDistanceLabel`/`formatNumber` reused.
- `src/screens/RequestLive.tsx` — replace hardcoded `WILL_HELP`/`CAN_CALL` arrays (lines 23–31) with real responders from the RPC; add the Realtime subscription (D-11/D-12), the toast cue (D-13 — toast system already present, lines 117–121), the reframed transparency line (D-09), and the calm empty state (D-10).
- `src/App.tsx` — `handle*` for "I'll help" insert (D-03 optimistic); extend mount-time active-request hydration to also fetch responders (D-14).
- `src/lib/supabase.ts` — Supabase client (Realtime channel created from here).
- `src/types/database.ts` — regenerate after adding the `responders_for_request` RPC + any new RLS/publication (via Supabase MCP `generate_typescript_types`).
- `src/blood.ts` — `COMPATIBLE_REQUEST_TYPES` for the truthful "can see your request" count (D-09).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`RequestLive.tsx` green responder pill** (line ~323, "ကူညီမည်") — reuse verbatim as the Home card "✓ responded" tag (D-01) for cross-screen consistency.
- **`RequestLive.tsx` toast system** (`showToast`, lines 117–121) — already built; reuse for the "a donor responded" arrival cue (D-13).
- **`Home.tsx` formatters** — `formatPhone` (E.164 → `09-XXX-XXX-XXX`), `formatDistanceLabel`, `formatTimeAgo`, `formatNumber` (Burmese numerals). Reuse for responder rows; do not duplicate.
- **`requests_within_radius` RPC (Phase 7)** — the template for the new owner-scoped `responders_for_request` RPC (D-06).
- **`AlertDialog`** — reuse for "I'll help" write failures (D-03), consistent with Phase 7.

### Established Patterns
- All global state in `App.tsx` via `useState` (no context/store); Supabase session UUID already on `user.supabaseId`. The "I'll help" insert and responder fetch hang off App handlers / screen-local effects following this pattern.
- Domain utilities are flat stateless `src/*.ts` modules; any new realtime/DB-access helper should follow (e.g. a `src/lib/` helper for the subscription if extracted).
- Supabase calls resolve to typed results (discriminated unions like `GeoResult`), not throws.
- No test framework — verification is manual + Supabase dashboard checks (Phase 6/7 convention).
- After phase execution, run the `code-quality-refactor` agent (user's standing preference).

### Integration Points
- `Home` feed load → query current donor's `request_responses` to set responded state (D-04); "I'll help" tap → insert `request_responses` (status `responding`), optimistic flip (D-03).
- `RequestLive` mount → initial responder fetch via RPC + subscribe to `request_responses` for `request_id` (D-11/D-12); event → refetch + toast (D-13).
- `App` mount hydration (Phase 7 active-request load) → also fetch responders so a returning requester sees activity (D-14).
- Migration (Supabase MCP): `responders_for_request` RPC + `request_responses` SELECT policy for the request owner + enable `request_responses` on the `supabase_realtime` publication.

</code_context>

<specifics>
## Specific Ideas

- The card is genuinely full (user reviewed the live Home screenshot) — the explicit instruction was "don't add another action button; it damages the UX." The state-driven single slot (D-01) is the direct answer to that constraint.
- "I'll help" label in Burmese is **ကူညီမည်** (matching the existing `RequestLive` responder pill).
- The user cares about the requester being reachable after they close the app — that real need is captured as the dedicated FCM push phase (Deferred), with fetch-on-reopen (D-14) as the v2 stopgap.
- Honesty of copy matters to the user: the "alerted" transparency line must not claim a push happened when none did (D-09).

</specifics>

<deferred>
## Deferred Ideas

- **FCM push to requester on donor response (PUSH-04)** — **its own new dedicated phase** (recommend inserting Phase 8.5 via `/gsd:phase`, or front of v3). Scope: a Supabase Edge Function holding FCM credentials, triggered by a DB webhook/trigger on `request_responses` insert; a service worker (`vite-plugin-pwa` + `firebase`, both not yet installed); device-token registration into the existing `device_tokens` table; notification-permission UX. This is the mechanism that reaches a *closed* app — the gap Realtime structurally cannot cover.
- **"Can call" nearby-donor pool + "+Y more notified" line** on `RequestLive` — computed pools (donors_within_radius filtered by `emergency_callable` + compatibility, excluding responders); deferred because they overlap push/matching and aren't required by Phase 8's success criteria.
- **Gated / logged / rate-limited phone reveal + personal-data purge on close** — v3 privacy milestone.
- **Live updates for a minimized/away requester** (app-wide subscription) — not pursued; even an app-wide socket dies when the app closes, so this is subsumed by the FCM push phase.
- **Donor "undo my response"** — not raised as needed; note as a possible future refinement.

None of the above block Phase 8.

</deferred>

---

*Phase: 8-Donor Response + Realtime*
*Context gathered: 2026-06-23*
