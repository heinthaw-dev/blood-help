# Phase 8: Donor Response + Realtime - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-23
**Phase:** 8-Donor Response + Realtime
**Areas discussed:** Feed "I'll help" action, Requester live list (info & privacy), Realtime list scope, Realtime mechanics

---

## Feed "I'll help" action

| Option | Description | Selected |
|--------|-------------|----------|
| State-driven action slot | Card's single right-side action means "I'll help" first, becomes call button after responding. No new button. | ✓ |
| Tap card → detail view | Card becomes a summary; tapping opens a new request-detail screen with I'll help + call. | |
| Keep call + add small pill | Keep call button, add a compact "I'll help" pill beside it. | |

**User's choice:** State-driven action slot.
**Notes:** User reviewed the live Home feed screenshot and confirmed the card has no room/affordance for "I'll help" today (only a phone-call icon). Explicit instruction: don't add another action button — it would damage the UX on an already-full card. The state-driven slot was chosen specifically to avoid adding a button.

| Option | Description | Selected |
|--------|-------------|----------|
| Hide number until responded | Requester's number appears only after the donor taps "I'll help". | ✓ |
| Always show number | Keep the number visible on every card. | |

**User's choice:** Hide number until responded.

| Option | Description | Selected |
|--------|-------------|----------|
| Optimistic flip | Flip instantly; roll back + AlertDialog on failure. | ✓ |
| Wait for DB confirm | Loading state, flip after insert succeeds. | |

**User's choice:** Optimistic flip.
**Notes:** User confirmed the preference but flagged (in the layout question) the need to first decide *where* the trigger lives — resolved by the state-driven slot.

| Option | Description | Selected |
|--------|-------------|----------|
| Query existing responses on load | Fetch donor's request_responses on feed load; pre-mark responded cards. | ✓ |
| Session-only | Track responded state only in React memory. | |

**User's choice:** Query existing responses on load.

---

## Requester live list (info & privacy)

| Option | Description | Selected |
|--------|-------------|----------|
| Name + distance + number, call button | Show responder contact directly (spec §2.3). | ✓ |
| Name + distance, number reveal-on-tap | Hide number until requester taps call. | |

**User's choice:** Name + distance + number, call button.

| Option | Description | Selected |
|--------|-------------|----------|
| SECURITY DEFINER RPC, owner-scoped | Function verifies caller owns request; returns responder name/phone/dist. | ✓ |
| Broaden RLS + client-side joins | RLS lets owner SELECT joined fields; join client-side. | |

**User's choice:** SECURITY DEFINER RPC, owner-scoped.

| Option | Description | Selected |
|--------|-------------|----------|
| Direct to request owner only; full gating in v3 | Numbers visible only to request owner via RPC; gating machinery stays v3. | ✓ |
| Add basic logging now | Start recording reveal events this phase. | |

**User's choice:** Direct to request owner only; full gating in v3.

---

## Realtime list scope

| Option | Description | Selected |
|--------|-------------|----------|
| Will Help only | Wire realtime responders only; hide Can Call + "+Y more". | ✓ |
| Will Help + Can Call pool | Also compute the nearby opted-in pool + real "+Y" count. | |

**User's choice:** Will Help only.

| Option | Description | Selected |
|--------|-------------|----------|
| Reframe to "can see your request" | Truthful computed count instead of "alerted". | ✓ |
| Hide the line until push lands | Remove transparency line until FCM exists. | |
| Keep wording, back with computed count | Keep "alerted X" wording over a computed count. | |

**User's choice:** Reframe to "can see your request".

| Option | Description | Selected |
|--------|-------------|----------|
| Calm "waiting for responses" state | Gentle waiting message, no spinner. | ✓ |
| Keep the searching spinner | Existing animated searching spinner. | |

**User's choice:** Calm "waiting for responses" state.

---

## Realtime mechanics

| Option | Description | Selected |
|--------|-------------|----------|
| Refetch whole list via RPC | Re-call responders_for_request on each event; replace list. | ✓ |
| Incremental append from payload | Fetch the single new donor and append. | |

**User's choice:** Refetch whole list via RPC.

| Option | Description | Selected |
|--------|-------------|----------|
| RequestLive-only | Subscribe on live-screen mount, unsubscribe on unmount. | ✓ |
| App-wide live subscription | Keep a socket alive app-wide (minimized Home card live). | |

**User's choice:** RequestLive-only.
**Notes:** User raised that a requester may close the app after posting and should be notified when a donor taps "I'll help". This is the closed-app gap (see Deferred Ideas + the follow-up below).

| Option | Description | Selected |
|--------|-------------|----------|
| Gentle toast + list update | Reuse toast: "A donor responded". | ✓ |
| Silent list update | Row appears, no toast. | |

**User's choice:** Gentle toast + list update.

### Follow-up — closed-app notification gap

| Option | Description | Selected |
|--------|-------------|----------|
| Defer push to v3; fetch-on-reopen now | Realtime while open + fetch-on-reopen; push stays v3. | |
| Pull FCM push into Phase 8 | Build full FCM stack now. | (initially chosen) |
| New dedicated push phase | Phase 8 stays Realtime; FCM push becomes its own phase. | ✓ |

**User's choice:** Initially selected "Pull FCM push into Phase 8", then — after Claude surfaced that FCM is a phase-sized infra chunk that also crosses the v2.0→v3.0 milestone boundary (Edge Function sender, service worker, device-token registration, notification UX) — chose **New dedicated push phase**.
**Notes:** Underlying goal (reach a requester who left the app) is validated and preserved; it's routed to its own phase rather than bolted onto Phase 8. Fetch-on-reopen (below) is the v2 stopgap.

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — fetch responders on reopen | Fetch current responders during active-request hydration. | ✓ |
| Only on opening the live screen | Load responders only when drilling into the live screen. | |

**User's choice:** Yes — fetch responders on reopen.

---

## Claude's Discretion

- Realtime transport (Postgres Changes vs Broadcast) — must be RLS-gated; Postgres Changes requires a request_responses SELECT policy for the request owner for events to fire.
- Exact RPC SQL shape for `responders_for_request` (joins + dist_meters computation).
- How the "can see your request" count is computed (compatibility + radius count vs stored alerted_count) — must be truthful.
- Reuse of existing formatters (formatPhone, formatDistanceLabel, formatNumber).
- UI no-op on duplicate response (DB unique constraint is the backstop).

## Deferred Ideas

- FCM push to requester on response (PUSH-04) → its own new dedicated phase (insert 8.5 or front of v3).
- "Can call" nearby-donor pool + "+Y more notified" line on RequestLive.
- Gated/logged/rate-limited phone reveal + personal-data purge on close (v3 privacy).
- App-wide / minimized-requester live updates (subsumed by the FCM push phase).
- Donor "undo my response" — possible future refinement.
