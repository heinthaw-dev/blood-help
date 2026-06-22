---
phase: 08
slug: donor-response-realtime
status: verified
threats_open: 0
asvs_level: 1
created: 2026-06-23
---

# Phase 8 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.
> Register authored at plan time (all 3 PLAN.md files carried `<threat_model>` blocks).
> Verification mode: **verify mitigations exist** — DB-side threats checked against the
> **live database** via Supabase MCP (the function body, RLS policies, unique constraint,
> publication membership, and grants), client-side threats checked against source.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| client → PostgREST RPC (`responders_for_request`) | Authenticated browser calls the RPC; `p_request_id` is attacker-controllable | Donor name + **phone** + distance (sensitive) |
| client → Realtime socket (`request_responses` Postgres Changes) | Authenticated browser subscribes filtered to one `request_id`; the JWT identifies the subscriber | `request_responses` row columns only (id, request_id, donor_id, status, created_at) — **no phone** |
| RPC body → tables (SECURITY DEFINER) | Function runs with elevated rights; `search_path` + schema qualification are the containment boundary | All joined tables (blood_requests, profiles, donors) |
| client → `request_responses` INSERT | Browser submits a response row; `donor_id` is attacker-suppliable in the body | Donor identity binding |
| client → `request_responses` SELECT (own rows) | Browser reads its own responses to restore card state | Own response rows |
| effect lifecycle → realtime socket | An unclosed channel is an authorized socket left open after navigation | Live event stream |

---

## Threat Register

| Threat ID | Category | Component | Disposition | Mitigation | Status |
|-----------|----------|-----------|-------------|------------|--------|
| T-08-01 | Information Disclosure | `responders_for_request` called with another user's `request_id` (enumerate others' responders/phones) | mitigate | Owner guard in body `requester_id = (SELECT auth.uid())` + `IF NOT FOUND THEN RETURN` → identical empty result for non-owner vs nonexistent (no existence signal). `REVOKE EXECUTE FROM PUBLIC, anon` → authenticated-only. | closed |
| T-08-02 | Information Disclosure | Donor phone leaked via the realtime stream payload | mitigate | The publication streams only `request_responses` columns; the table has **no phone column** (verified live). Phone is returned only by the owner-guarded RPC. | closed |
| T-08-03 | Information Disclosure | Non-owner subscribes to another request's `request_responses` Postgres Changes stream | mitigate | Postgres Changes applies the existing Phase 6 SELECT policy `response_parties_select` per subscriber JWT (donor OR the request's requester only). This phase only ADDED the table to the publication; policy unchanged. | closed |
| T-08-04 | Elevation of Privilege | SECURITY DEFINER `search_path` hijack | mitigate | Deployed function has `prosecdef=true`, `proconfig = search_path=""`, and every PostGIS/table identifier schema-qualified (`extensions.`, `public.`) — verified live. | closed |
| T-08-05 | Spoofing / Elevation of Privilege | Forged `donor_id` on insert (respond as someone else) | mitigate | Phase 6 INSERT policy `donor_response_insert` `WITH CHECK ((SELECT auth.uid()) = donor_id)` rejects any mismatched row (verified live). Client sends `donor_id: user.supabaseId`; the DB is the authoritative enforcer. | closed |
| T-08-06 | Tampering | Duplicate / spam responses via double-tap or repeated taps | mitigate | `UNIQUE (request_id, donor_id)` constraint (verified live) → second insert errors 23505; client treats 23505 as a silent no-op. Optimistic flip also hides the action once responded. | closed |
| T-08-07 | Information Disclosure | Requester phone shown on the card before the donor commits | mitigate | `Home.tsx` gates the phone row behind `responded === true` (RequestCard:142→148); pre-response cards never render the number. | closed |
| T-08-08 | Information Disclosure (UX-correctness) | 23505 surfacing the wrong dialog / leaking confusing state | mitigate | `handleRespond` 23505 branch is an empty no-op (App.tsx:393) — keeps responded state, no AlertDialog (the OPPOSITE of `handlePosted`). | closed |
| T-08-09 | Information Disclosure | Non-owner subscribes to another request's stream (client filter is spoofable) | mitigate | Same as T-08-03 — `response_parties_select` applied per JWT on the stream; a spoofed filter connects but delivers nothing. | closed |
| T-08-10 | Information Disclosure | Donor phone leaked via the realtime payload | mitigate | The subscription callback never reads `payload.new` (verified: **0** payload reads in `RequestLive.tsx`); phone arrives only via the owner-guarded RPC refetch. | closed |
| T-08-11 | Information Disclosure | Requester calls `responders_for_request` for a request they do not own | mitigate | RPC owner guard returns 0 rows for a non-owner (verified live: non-owner call returned 0). RequestLive only ever passes its own threaded `activeRequestId`. | closed |
| T-08-12 | Information Disclosure | Leaked authorized socket after navigating away from RequestLive | mitigate | Effect cleanup calls `supabase.removeChannel(channel)` (RequestLive.tsx:182); stable channel name `rr:${requestId}` (161) prevents duplicate channels on re-mount. | closed |
| T-08-13 | Spoofing (UX-correctness) | Transparency line overstates reality ("alerted") implying a push that never happened | mitigate | Copy is the truthful "[X] nearby compatible donors can see your request" (RequestLive.tsx:242); the word "alerted" never appears in the transparency line. | closed |
| T-08-SC | Tampering | npm/pip/cargo installs (supply chain) | mitigate | No package installs this phase — `package.json` / `package-lock.json` untouched across all Phase 8 commits (verified). Realtime ships inside the already-vetted `@supabase/supabase-js`. | closed |

*Status: open · closed*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|

No accepted risks specific to Phase 8 — all 14 threats are mitigated with verified controls.

> **Inherited context (not a Phase 8 threat):** the deterministic phone-keyed prototype
> auth risks (AUTH-01/02/04) were project-lead-ratified in `07-SECURITY.md`. The deployment
> constraint stands: **private/test only — no public/real users — until the planned
> real-OTP auth-hardening phase ships.** Phase 8's RPC/RLS controls assume an authenticated
> session whose `auth.uid()` is the user's stable identity, which that auth model provides.

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-06-23 | 14 | 14 | 0 | Claude (orchestrator, inline — live-DB verification via Supabase MCP) |

**Method note:** DB-side threats (T-08-01/02/03/04/05/06/09/11) were verified against the
**live database** (deployed function `prosecdef`/`proconfig`/owner-guard, INSERT + SELECT
policy expressions, unique constraint, publication membership, role grants, and a live
non-owner RPC call returning 0 rows) rather than from plan intent — because the
`gsd-security-auditor` subagent has no `mcp__supabase__*` access and could not have
inspected the live schema. Client-side threats were verified against source.

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log (none for Phase 8)
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-06-23
