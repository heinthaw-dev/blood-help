# Phase 7: Data Persistence + Geo-Matching - Context

**Gathered:** 2026-06-22
**Status:** Ready for planning

<domain>
## Phase Boundary

Wire the donor-profile form and the blood-request form to write real rows to Supabase, and replace the home feed's static `DUMMY_REQUESTS` with a live DB query filtered by directional blood-type compatibility and PostGIS proximity (10 km). By the end of this phase:

- Saving the donor profile creates/updates real rows (identity → `profiles`, donor attributes → new `donors` table) including coarsened GPS.
- Posting a blood request inserts a real `blood_requests` row with `status='active'`, `expires_at = now()+24h`, coarsened live GPS, and a required `current_address`.
- The home feed shows real active requests within `DISPLAY_RADIUS_KM` (10 km), filtered to types the viewing donor can donate into (directional, spec §3.1) — not static placeholders.
- Returning users are fully hydrated from the DB (Profile screen shows real data; the donor edit form prefills; the user's own active request is loaded).

**This phase includes a schema revision** (a deliberate deviation from `blood-help-spec.md §4`, signed off per D-16): normalize `profiles` into `profiles` + `donors`, drop `is_donor`, remove `township` from `profiles`, and rename `blood_requests.township` → `current_address`. This ALTERs the schema Phase 6 already deployed; RLS policies, the geo RPC, and `src/types/database.ts` must follow.

**Out of scope (deferred):** Leaderboard wiring to real `donation_count`; FCM push (v3); donor response flow + Realtime (Phase 8); QR/code confirmation + lifecycle (Phase 9); gated phone reveal & data purge (v3 privacy).

</domain>

<decisions>
## Implementation Decisions

### Schema Redesign — Normalize profiles into profiles + donors

- **D-01:** Split the user model. `profiles` becomes the **shared identity table for every user** (requester and donor alike): `id` (uuid PK → `auth.users`), `name`, `phone`, `language`, `created_at`, `updated_at`. Nothing donor-specific remains on `profiles`.
- **D-02:** Create a new **`donors`** table holding all donor-only attributes, keyed by `profile_id` (uuid FK → `profiles.id`, unique/one-to-one): `blood_type`, `donor_code`, `is_available`, `emergency_callable`, `donation_count`, `last_donation_date`, `available_after`, `lat`, `lng`, `location_updated_at`, `created_at`, `updated_at`.
- **D-03:** "Is this user a donor?" = **the existence of a `donors` row** for that `profile_id`. Drop the `is_donor` boolean entirely. A requester "becomes a donor" by inserting one `donors` row — no profile rewrite, no column toggling.
- **D-04:** **Remove `township` from `profiles`** completely — there is no UI that fills a donor township, and donors store only coarsened GPS for matching.
- **D-05:** **Rename `blood_requests.township` → `current_address`.** This column is the human-readable, donor-facing location label the requester types (e.g., "Yangon General Hospital" or "Sanchaung Township"). It remains `NOT NULL`.
- **D-06:** Donor last-known location (`lat`, `lng`, `location_updated_at`) lives on the **`donors`** table (not `profiles`) — it is donor-matching data; a pure requester's location goes per-request into `blood_requests`.
- **D-07:** This is a `blood-help-spec.md §4` deviation, signed off by the user (D-16 from Phase 6). The migration ALTERs the already-deployed `profiles` table, creates `donors`, and renames the request column. RLS policies (spec §4.3), the `donors_within_radius` RPC, generated `src/types/database.ts`, and all code reading `is_donor`/`township`/donor columns must be updated to match.

### Form → Column Mapping

- **D-08:** The donor form's **"Show my number to requesters" toggle (`showNumber`) maps to `donors.emergency_callable`** — the form's hint ("On — people who need blood can call you directly. Off — you get notified and choose") matches the schema's intent for that column exactly.
- **D-09:** The request form's single free-text address field maps to `blood_requests.current_address` and is now **required** (flip the form's current "Optional" marking — donors depend on this label to locate the requester). `blood_requests.hospital_name` stays in the schema but is unused this phase (nullable).

### Location Capture

- **D-10:** **Donors:** request GPS when the user taps Confirm/Save on the donor registration form, using the **same pre-permission `AlertDialog` flow `CreateRequest` already implements**. Note: this flow is currently **NOT present in `DonorProfileSetup.tsx`** and must be added (the user believed it existed). Coarsen via `coarsenCoordinates()` before writing to `donors.lat/lng`.
- **D-11:** **Requesters:** GPS prompt on request submit (already built in `CreateRequest`) writes coarsened live GPS to `blood_requests.lat/lng`, **plus** the manual `current_address` field for the readable label.
- **D-12:** The app heavily depends on location. Mirror `CreateRequest`'s existing behavior: if the user denies the permission, show the denied `AlertDialog` and do not complete the write (no silent null-location save path is being added).

### Returning-User Hydration

- **D-13:** **Full hydration** on session restore. The `App` mount effect must load the `profiles` row + the `donors` row (if any) into `App` state, replacing `DEFAULT_USER`, so the **Profile screen shows the user's real saved data** (name, blood type, donation_count, availability, emergency_callable) and the donor edit form prefills from real values.
- **D-14:** Also **load the user's own active request** on restore: query `blood_requests WHERE requester_id = me AND status='active'`. If found, set the open-request state so Home shows the "active request" card and request-live is reachable across reloads.
- **D-15:** Saving the donor profile is an **upsert**: upsert identity fields on `profiles`, then upsert the `donors` row keyed by `profile_id`. The "requester → donor" upgrade path is just an insert into `donors`.

### One-Open-Request Rule & Error UX

- **D-16:** **Primary prevention is UI-gating:** hide the "Request Blood" CTA on Home whenever the user has an active request (driven by D-14's loaded active request — Home already renders the active-request card instead of the CTA via `hasOpenRequest`). A user therefore cannot reach the create form while a request is open.
- **D-17:** The DB unique index `one_open_request_per_user` remains as the **backstop** (defense in depth against double-submit/races). If an insert still hits it, surface the error per D-18.
- **D-18:** Generic write failures (network, RLS denial, unique-violation backstop) surface via the **existing `AlertDialog` component with a retry/dismiss action** — consistent with the geo-permission dialogs already in the app. No toast/inline system is introduced.

### Claude's Discretion (spec-locked or no product choice)

- **Inverse feed query (GEO-02):** the existing `donors_within_radius` RPC finds donors near a point, but the feed needs **requests near the donor**. Build the inverse — a new RPC (e.g., `requests_within_radius(lat, lng, radius_km)`) returning requests + `dist_meters`, or an equivalent. Researcher/planner to decide RPC vs query.
- **Where directional compatibility filtering runs** (SQL in the RPC vs JS after a radius fetch) — discretion, but it MUST implement the spec §3.1 directional matrix (donor's type can donate *into* the requested type), never exact-match.
- **Distance / time-ago formatting** for feed cards (km from `dist_meters`, relative time from `created_at`), including Burmese numerals via existing `formatNumber`.
- **Exclude the user's own active request** from their nearby feed (`requester_id != me`).
- **Availability toggle** does not gate what a donor *sees* in the feed (that gates push/matching in Phase 8); discretion on whether to filter.
- **`donor_code` generation** (5-char Base32, unique) at `donors`-row creation — DB default/trigger or client-side. Needed now since the donor row is created here; consumed in Phase 9.
- **Phone normalization** to E.164 (`+95...`) before writing `contact_phone` / `phone`, since `Home`'s `formatPhone` expects that form.
- RLS policy SQL for the new `donors` table (follow spec §4.3 rules: a user manages only their own donor row; donor contact details not exposed to others).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Data Model & Schema (being revised this phase)
- `blood-help-spec.md` §4 — Original SQL schema (enums, 5 tables, constraints). **Phase 7 deviates from this** per D-01–D-07 (profiles/donors split, drop `is_donor`, remove `profiles.township`, rename `blood_requests.township` → `current_address`). The spec remains the baseline; the deviations above are the authoritative override.
- `blood-help-spec.md` §4.3 — RLS high-level rules (who can read what); extend to the new `donors` table.
- `blood-help-spec.md` §3.4 — Privacy guardrails (coarsened GPS; donor numbers not printed in lists).

### Geo-Matching
- `blood-help-spec.md` §3.1 — Blood type compatibility table (directional — donor donates *into* requested type). Drives GEO-01.
- `blood-help-spec.md` §3.2 — Location & radius logic (`DISPLAY_RADIUS_KM` 10, `ALERT_RADIUS_KM` 25, widen-once on sparse). Drives GEO-02.

### Prior Phase Decisions (locked, carry forward)
- `.planning/phases/06-foundation/06-CONTEXT.md` — D-10 (coarsen to 2dp), D-11/D-12 (`coarsenCoordinates()` before every write), D-13/D-14 (Supabase client + env), D-15 (use Supabase MCP for migrations/seed), D-16 (schema deviations need sign-off — invoked here), D-17 (two-radius approach: 10 km display / 25 km alert).

### Current Codebase (files being modified)
- `src/App.tsx` — `UserState`, `DEFAULT_USER`, mount auth `useEffect`, `handleVerified`, `handleSaveDonor`, `handlePosted`, hydration & active-request load go here.
- `src/screens/DonorProfileSetup.tsx` — add GPS pre-permission flow + write to `profiles`/`donors`; prefill on edit.
- `src/screens/CreateRequest.tsx` — make `current_address` required; write `blood_requests` row (already coarsens GPS).
- `src/screens/Home.tsx` — replace `DUMMY_REQUESTS` with live query; rename the feed type's `township` field; keep CTA-hide-on-active-request behavior.
- `src/geolocation.ts` — `getCurrentPosition()` + `coarsenCoordinates()` (reuse, do not duplicate).
- `src/types/database.ts` — regenerate after the migration (via Supabase MCP `generate_typescript_types`).
- `blood.ts` — `BLOOD_TYPES` / `BloodType`; add the directional compatibility map here if filtering client-side.

### Planning Context
- `.planning/REQUIREMENTS.md` — BACK-05, BACK-06, GEO-01, GEO-02.
- `.planning/ROADMAP.md` Phase 7 — success criteria.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/geolocation.ts` — `getCurrentPosition()` (pre-permission-driven) and `coarsenCoordinates()` (2dp). All Phase 7 location writes MUST route through `coarsenCoordinates()`.
- `src/components/AlertDialog.tsx` — already used for geo pre-permission/denied; reuse for write-failure errors (D-18).
- `CreateRequest.tsx`'s `GeoPhase` state machine (`idle | prealert | requesting | denied`) is the pattern to copy into `DonorProfileSetup` (D-10).
- `Home.tsx`'s `formatPhone` (E.164 → local display) and existing empty-state copy — keep; feed just needs real data behind it.
- `Home.tsx` already swaps the "Request Blood" CTA for the active-request card based on `hasOpenRequest` — this is the D-16 prevention mechanism; wire `hasOpenRequest` from the loaded active request.

### Established Patterns
- All global state lives in `App.tsx` via `useState` (no context/store). Supabase session UUID is already in `user.supabaseId`. Hydrated profile/donor data goes into the same `UserState`.
- Domain utilities are flat stateless modules in `src/*.ts` (`blood.ts`, `geolocation.ts`, `auth.ts`). A blood-compatibility helper and any DB-access helpers should follow this pattern.
- Error handling uses discriminated unions (`GeoResult`); Supabase calls should resolve to typed results, not throw, consistent with the codebase.
- No test framework — verification is manual + Supabase dashboard checks (per Phase 6).

### Integration Points
- `App` mount `useEffect` → after session confirmed → hydrate `profiles` + `donors` + own active `blood_requests` → set `UserState` + open-request state → route.
- `DonorProfileSetup.onSave` → `App.handleSaveDonor` → upsert `profiles` + upsert `donors` (with coarsened GPS).
- `CreateRequest.onPosted` → `App.handlePosted` → insert `blood_requests` (status active, expires_at now()+24h, coarsened GPS, current_address).
- `Home` feed → new requests-near-donor query (RPC) filtered by directional compatibility + 10 km radius, excluding own request.

</code_context>

<specifics>
## Specific Ideas

- The schema split is explicitly the user's senior-architecture call: avoid the "sparse row" smell where a pure requester carries ~10 NULL donor columns. `profiles` = identity for all; `donors` = role data; membership-by-row-existence.
- `current_address` examples the user gave: "Yangon General Hospital" or "Sanchaung Township" — a free-text label, hospital OR township, hence the rename away from `township`.
- The app "heavily depends on location" — both donor and requester are expected to grant GPS; donor on registration Confirm, requester on submit.
- Use Supabase MCP tools (`apply_migration`, `execute_sql`, `generate_typescript_types`) for the schema migration and re-seeding dummy data so the feed has real rows to query against (carried from Phase 6 D-15).

</specifics>

<deferred>
## Deferred Ideas

- Leaderboard wiring to real `donation_count` — deferred; counts stay 0 until donations exist (Phase 9). Note `donation_count` now lives on `donors`, which the Leaderboard query must account for when wired.
- Gated/logged/rate-limited phone reveal and personal-data purge on request close — v3 privacy milestone (not this phase).
- FCM push to nearby compatible donors on new request — v3 (Phase 8/9 cover response + lifecycle without push).
- Cross-device session linking (same phone, new anonymous UUID) — v3 (accepted limitation, from Phase 6 D-06).

</deferred>

---

*Phase: 7-Data Persistence + Geo-Matching*
*Context gathered: 2026-06-22*
