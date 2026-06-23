# Phase 9: Confirmation + Lifecycle - Context

**Gathered:** 2026-06-23
**Status:** Ready for planning

<domain>
## Phase Boundary

Wire the **full request lifecycle end-to-end** on the existing UI. By the end of this phase:

- A requester confirms a donation by scanning the donor's **QR (real camera scan)** or typing the donor's **5-char Base32 code**. A valid confirm — only for a donor who actually tapped **"I'll help"** (a `responding` participant) — creates a `donations` row, increments the donor's `donation_count` + `last_donation_date`, and increments the request's `units_collected`.
- When `units_collected >= units_needed`, the request auto-**fulfills** (`status='fulfilled'`, `closed_at` set). The donor sees the **congrats screen** triggered by a Realtime event on their own new `donations` row, wherever they are in the app.
- The requester can **manually close** the request: "got it outside" → `fulfilled`; "no longer needed" → `cancelled`.
- A **pg_cron** job auto-flips stale `active` requests to `expired` after their 24h window.
- **(Added this phase, beyond LIFE-02):** an in-app **"expiring soon — Extend +12h"** flow lets the requester keep a still-needed request alive once.

Almost every UI surface already exists (resolve sheet, 5-char input, QR viewport, progress subtitle, `DonorCongrats` screen) — this phase is **backend wiring + honest behavior**, not new screens, except the real QR scanner and the extend banner.

**Out of scope (deferred):** all FCM/push (see consolidated backlog in Deferred Ideas), v2 one-time QR codes, and v3 personal-data purge on close.

</domain>

<decisions>
## Implementation Decisions

### Resolve paths & status mapping (LIFE-01)
- **D-01:** **Status mapping for the three resolve exits:** in-app code-confirm → `'fulfilled'` (auto, when units met); **"got it outside the app" → `'fulfilled'`** + `closed_at`; **"cancel / no longer needed" → `'cancelled'`** + `closed_at`. Semantics: **`fulfilled` = "I got the blood I needed"** (in-app or outside); **`cancelled` = "I no longer need it."**
  - ⚠️ **This REVISES ROADMAP Phase 9 success criterion #3**, which currently states the outside path writes `status='cancelled'`. The user deliberately chose `'fulfilled'` for the outside path. **Update ROADMAP criterion #3 to match**, and the verifier must check against this mapping, not the old wording.
- **D-02:** **No personal-data purge in Phase 9.** On close, **retain** `blood_requests` and `request_responses` rows (incl. `contact_phone`, `lat/lng`) for later use. This is an explicit product retention decision — it **supersedes the v3 "purge on close" plan** for now. RLS still gates who can read those rows; this is not a leak, but a privacy reviewer should treat it as intentional.
- **D-03:** **Honest copy.** The existing "outside" closed-screen copy claims *"Your personal data was purged."* — now false. Rewrite it to drop the purge claim (e.g. EN: *"Marked as received. Glad you got the blood you needed."*; MY equivalent). Same honesty principle as Phase 8 D-09 ("alerted" line).

### Code confirmation & errors (CONF-02)
- **D-04:** **Anti-fraud participant check KEPT** exactly as spec §4.2 / CONF-02: a QR or 5-char confirm is **only valid for a donor who is a `responding` participant on this request**. (The user briefly considered relaxing this for off-app/friend-relayed donors, then reverted: a real donor can register + tap "I'll help" in seconds, so the guardrail costs almost nothing.)
- **D-05:** **Confirm via an owner-scoped `SECURITY DEFINER` RPC** (mirrors Phase 8 D-06 `responders_for_request`). Atomically: verify `auth.uid()` owns the request → donor (looked up by `donor_code`) is a `responding` participant → donor not already confirmed → insert `donations` row → increment donor `donation_count` + set `last_donation_date` → increment request `units_collected` → auto-fulfill if `units_collected >= units_needed`. Exact SQL shape is planner discretion.
- **D-06:** **Error granularity:** one **generic** `"Invalid or unrecognized code"` for **both** unknown-code and not-a-participant (so a requester can't probe which 5-char codes are real); a **specific** `"This donor is already confirmed"` for the duplicate case.
- **D-07:** **No separate blood-type compatibility check at confirm time.** Participation already implies compatibility (the Home feed only surfaces directionally-compatible requests, Phase 7 GEO-01), so an incompatible donor could never have become a participant. Just record the donor's actual `blood_type` on the `donations` row.
- **D-08:** **Real camera-based QR scan ships this phase** (not the current placeholder viewport). Needs a new scanner dependency + camera-permission UX. The QR encodes the donor's **5-char `donor_code`** (same value as manual entry). Library choice + exact payload format = researcher/planner. ⚠️ This pulls v2-flavored scope forward at the user's explicit request.
- **D-09:** **Duplicate confirm blocked** by a unique `(request_id, donor_id)` constraint on `donations`; second entry of the same donor's code surfaces the D-06 "already confirmed" message.

### Fulfillment & congrats (CONF-02 / CONF-03)
- **D-10:** **Multi-unit progress is already built** in `RequestLive.tsx` (the `{collected} / {unitsNeeded} unit ရရှိပြီး` subtitle, `showProgress = unitsNeeded > 1`, and `handleConfirmInApp`'s increment + auto-fulfill + "still searching for the rest" toast) — all **dummy local state today**. Phase 9 replaces `setCollected(next)` with a call to the **real confirm RPC (D-05)** and drives `collected` from the DB's `units_collected`; the confirm flow stays open across multiple donors until the target is met, then auto-fulfills. (Screenshot from the user confirms the progress subtitle design.) Consider a Realtime subscription on the `blood_requests` row so the count reflects DB truth.
- **D-11:** **Donor congrats = full-screen takeover via an app-wide Realtime subscription** on the donor's **own** `donations` rows, owned in `App.tsx` (the global-state owner). When a new donation row for the current user arrives, `DonorCongrats` takes over whatever screen they're on. ⚠️ This deliberately **departs from Phase 8 D-12** ("subscription only on RequestLive") because the confirmed donor is never on the live screen.
- **D-12:** **Closed-app congrats = check-on-open**, not Realtime (a websocket can't reach a closed app — same gap as Phase 8 D-14). On app mount, query for any **unseen** `donations` row for this donor → show congrats. Requires a small **"unseen" marker** (e.g. last-seen donation id/timestamp in `localStorage`) — planner detail. The FCM backup push is deferred.

### Auto-expiry (LIFE-02)
- **D-13:** **pg_cron (in-DB), every 15 minutes.** A single `UPDATE blood_requests SET status='expired', closed_at=now() WHERE expires_at < now() AND status='active'`. Chosen over a scheduled Edge Function because expiry **only flips status this phase** (no FCM), removing the Edge Function's main justification. Deploy + test via Supabase MCP. The pg_cron `cron.schedule` granularity is 1 min; 15 min is the chosen cadence.
- **D-14:** **Dummy seed to verify without waiting 24h:** insert (via Supabase MCP) a `blood_requests` row with `expires_at` in the past and `status='active'`, run/await the job, confirm it flips to `expired`. (ROADMAP success criterion #4.)
- **D-15:** **No expiry notification this phase.** Spec §4.2 says expiry should also notify the request's responders — deferred with all other FCM (see backlog).

### Extend request (NEW — added this phase, beyond LIFE-02)
- **D-16:** **In-app extend ships in Phase 9; the closed-app warning push is deferred to the FCM phase.** ⚠️ This is a **new capability beyond LIFE-02** (which only covered auto-expire). Phase 9 scope is intentionally extended to include it (in-app portion only).
- **D-17:** **Pre-expiry warning** shows when `status='active'` AND **not yet extended** AND within **~4h of `expires_at`** (the user's "from 20 hours of 24" example; threshold adjustable). Surfaces: a **banner on the RequestLive screen** and the **Home active-request card**. Computed client-side from `expires_at` — no push.
- **D-18:** **"Extend +12h" sets `expires_at = current expires_at + 12h`** (a full 12h regardless of when tapped, pushing a 24h request to 36h).
- **D-19:** **Once only.** A single extension per request — requires an **`extended` boolean flag** on `blood_requests` (or equivalent) so the warning hides and a second extend is blocked afterward. RLS must allow the request owner to `UPDATE` `expires_at` + the `extended` flag on their own row (direct update or small RPC = planner discretion).

### Claude's Discretion (spec-locked or no product choice)
- Exact `SECURITY DEFINER` confirm-RPC SQL shape (joins, increments, auto-fulfill branch) — D-05 fixes the contract; the SQL is discretion.
- QR scanner **library** and **payload encoding** (D-08) — researcher to evaluate (e.g. `@zxing/browser`, `html5-qrcode`, `jsQR`); payload is the bare 5-char code unless a wrapping URL is clearly better.
- The **"unseen donation" marker** mechanism for D-12 (localStorage id vs timestamp) — discretion.
- **pg_cron** deployment specifics (`cron.schedule` call, extension enablement) via Supabase MCP — discretion within D-13.
- Whether extend (D-19) is a direct owner `UPDATE` vs a tiny RPC — discretion.
- Reuse existing formatters (`toMyanmarDigits`, `formatPhone`, `formatDistanceLabel`) and the `AlertDialog` write-error pattern — do not duplicate.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Spec — Confirmation, Lifecycle, Data Model, Server Logic
- `blood-help-spec.md` §2.3 (steps 6–7) — Close/resolve flow: "Did you get blood from the app or outside?", the in-app confirm path (scan QR / type 5-char code, valid only for donors who responded to *this* request), donation recording + increments + auto-fulfill, and the resolution notice to responders (FCM — deferred). Drives D-01, D-04, D-05, D-10.
- `blood-help-spec.md` §3.4 — Privacy guardrails, incl. "purge personal data on close (both paths)." **Phase 9 deliberately does NOT purge (D-02)** — note this deviation.
- `blood-help-spec.md` §4 — Data model: `donations` table (`request_id`, `donor_id`, `recipient_id`, `blood_type`, `confirmed_via` 'qr'|'manual'), `profiles.donor_code` (5-char Base32, unique), `blood_requests` (`units_needed`/`units_collected`/`status`/`expires_at`/`closed_at`), `request_status` enum (`active|fulfilled|cancelled|expired`). NOTE: Phase 7 split `profiles`/`donors` — **researcher must confirm whether `donor_code`, `donation_count`, `last_donation_date` live on `profiles` or `donors`** in the live schema.
- `blood-help-spec.md` §4.2 — Server-side logic: confirm flow increments + auto-fulfill + "manual code only valid for a `responding` participant" (anti-fraud, D-04); on-close resolution FCM (deferred); donor congrats via Realtime on own donations row (D-11); **scheduled job flips `active → expired`** (D-13). The MOST important section for this phase.
- `blood-help-spec.md` §4.3 — RLS: donations visible only to the two parties; donor phone never sent to clients. Drives the owner-scoped confirm RPC (D-05).
- `blood-help-spec.md` §3.1 — Directional compatibility (why D-07 needs no extra check; feed already filters compatible).

### Prior Phase Decisions (locked, carry forward)
- `.planning/phases/08-donor-response-realtime/08-CONTEXT.md` — owner-scoped `SECURITY DEFINER` RPC pattern (D-06 there → model for the confirm RPC); RequestLive-only subscription rule (D-12 there — **Phase 9 D-11 departs from it**); honest-copy principle (D-09 there → D-03 here); closed-app = fetch/check-on-open, FCM deferred (D-14 there → D-12 here); FCM push backlog origin (PUSH-04).
- `.planning/phases/07-data-persistence-geo-matching/07-CONTEXT.md` — `profiles`/`donors` schema split, `requests_within_radius` RPC pattern, `AlertDialog` write-error pattern (D-18), full active-request hydration on mount (extend here for congrats check-on-open + extend banner).
- `.planning/phases/06-foundation/06-CONTEXT.md` — Supabase MCP for migrations/seed (D-15 there), `donations` + `blood_requests` tables deployed, coarsened GPS.

### Planning Context
- `.planning/REQUIREMENTS.md` — CONF-02, CONF-03, LIFE-01, LIFE-02 (this phase).
- `.planning/ROADMAP.md` Phase 9 — four success criteria. ⚠️ **Criterion #3 must be updated** to reflect D-01 (outside path → `fulfilled`, not `cancelled`).

### Current Codebase (files being modified)
- `src/screens/RequestLive.tsx` — resolve sheet (`Sheet='resolve'|'code'`), 5-char Base32 input (`handleCodeInput`, line ~230), QR viewport placeholder (→ real scanner, D-08), `handleConfirmInApp` (lines ~212–225, dummy → real RPC, D-10), `ClosedReason` mapping + closed-screen copy (D-01/D-03), progress subtitle (line ~317, D-10), add the extend warning banner (D-17/D-18).
- `src/App.tsx` — confirm handler wiring; **app-wide donations subscription + congrats takeover** (D-11); check-on-open congrats (D-12); active-request hydration extended for the extend banner; `Screen` union already has `request-live`, congrats screens exist.
- `src/screens/DonorCongrats.tsx` — the full-screen congrats target (D-11).
- `src/screens/Home.tsx` — active-request card gains the expiring-soon warning + Extend button (D-17).
- `src/lib/supabase.ts` — Realtime channel for the donations subscription.
- `src/types/database.ts` — regenerate after the confirm RPC + `extended` column + any RLS/policy changes (Supabase MCP `generate_typescript_types`).
- Migration (Supabase MCP): confirm `SECURITY DEFINER` RPC, `donations` unique `(request_id, donor_id)`, `blood_requests.extended` flag + owner UPDATE policy, `pg_cron` job + extension, `donations` on `supabase_realtime` publication (+ REPLICA IDENTITY) so the congrats event fires under RLS.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`RequestLive.tsx` resolve/code sheets + 5-char Base32 input + QR viewport** — fully designed; wire `handleConfirmInApp` to the real RPC rather than rebuild.
- **`RequestLive.tsx` progress subtitle + auto-fulfill + toast** (lines ~213–317) — already implements the multi-unit UX as dummy local state (D-10).
- **`DonorCongrats.tsx`** — existing congrats screen, the D-11 takeover target.
- **`responders_for_request` SECURITY DEFINER RPC (Phase 8)** — template for the owner-scoped confirm RPC (D-05).
- **`AlertDialog`** — reuse for confirm/extend write errors (Phase 7/8 pattern).
- **Formatters** `toMyanmarDigits` (RequestLive), `formatPhone`/`formatDistanceLabel`/`formatNumber` (Home) — reuse, don't duplicate.

### Established Patterns
- All global state in `App.tsx` via `useState` (no context/store); the app-wide donations subscription (D-11) and confirm handler hang off App, consistent with Phase 8.
- Privileged/gated DB access goes through owner-scoped `SECURITY DEFINER` RPCs, not loosened table RLS (Phase 8 D-06).
- Supabase calls resolve to typed results, not throws; optimistic UI + `AlertDialog` rollback on write failure.
- Migrations + seed via **Supabase MCP**; types regenerated after schema changes.
- **No test framework** — verification is manual + Supabase dashboard checks. Run the `code-quality-refactor` agent after execution (user's standing preference).

### Integration Points
- Requester resolve → code sheet → confirm RPC (D-05) → optimistic progress flip (D-10); auto-fulfill closes the request.
- App mount + ongoing: app-wide subscription on own `donations` (D-11) + check-on-open for unseen donations (D-12) → `DonorCongrats` takeover.
- RequestLive mount + Home active-request hydration → compute expiring-soon state from `expires_at` (D-17); Extend tap → owner `UPDATE` `expires_at` + `extended` (D-19).
- pg_cron job (DB-side) flips `active → expired` every 15 min (D-13); dummy past-dated seed verifies it (D-14).

</code_context>

<specifics>
## Specific Ideas

- **Progress subtitle screenshot** (user-provided): `B+` request titled `သွေး တောင်းခံချက်` with `၀ / ၂ unit ရရှိပြီး` directly under the title, and a green footer button `သွေး ရရှိပြီး — တောင်းခံချက် ပိတ်ရန်` ("Blood received — close request"). Confirms the progress placement (D-10) and the resolve trigger.
- The user reasoned through and **rejected** relaxing the participant anti-fraud check: even a friend-relayed real donor "can register and search for the nearby request and hit 'will help' immediately" — low friction, so keep the guardrail (D-04).
- **`fulfilled` vs `cancelled` semantics** matter to the user: getting blood (even outside the app) is a *fulfilled* need; only "no longer needed" is *cancelled* (D-01).
- Honest copy continues to matter — the "data purged" line must not claim something that doesn't happen (D-03), consistent with Phase 8's "alerted" correction.
- **Extend feature** is a real-world need the user surfaced: a still-needed request shouldn't silently die at 24h — warn at ~20h and let them add 12h once (D-16–D-19).

</specifics>

<deferred>
## Deferred Ideas

### FCM-phase backlog (consolidated — implement all in the dedicated FCM/push phase)
1. **Core donor alert** — FCM push to nearby compatible + available donors when a new request is posted (spec §3.3; the "We've alerted X donors" core value). The single most important push.
2. **Requester-on-response push (PUSH-04)** — FCM to the requester when a donor taps "I'll help" (originated Phase 8 deferred).
3. **Resolution notice on close** — FCM to `responding` donors when a request is fulfilled/cancelled ("no longer needed — thank you"; spec §2.3 step 7, §4.2).
4. **Resolution notice on expiry** — FCM to `responding` donors when a request auto-expires (spec §4.2; pairs with D-13/D-15).
5. **Donor congrats backup push** — FCM when a donor is confirmed but their app is closed (fallback for D-11/D-12).
6. **Pre-expiry extend-warning push** — FCM to the requester nearing expiry when the app is closed (the closed-app half of the Phase 9 extend feature, D-16).
7. **Infrastructure for all of the above** — service worker (`vite-plugin-pwa`) + `firebase` SDK + `device_tokens` registration + notification-permission UX + an Edge Function FCM sender (holds credentials) + DB webhooks/triggers to invoke sends.

### Other deferred
- **v2 one-time QR codes** — this phase ships a reusable `donor_code` QR; rotating one-time codes are a later hardening step.
- **v3 personal-data purge on close** — explicitly NOT done (D-02); the user wants to retain `blood_requests` + `request_responses` records. Revisit if/when a privacy milestone reintroduces purge.
- **Switching expiry to a scheduled Edge Function** — natural migration when expiry needs to also send FCM (backlog #4); pg_cron is sufficient until then.

</deferred>

---

*Phase: 9-Confirmation + Lifecycle*
*Context gathered: 2026-06-23*
