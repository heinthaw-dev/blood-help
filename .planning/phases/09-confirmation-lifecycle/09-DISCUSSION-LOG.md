# Phase 9: Confirmation + Lifecycle - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-23
**Phase:** 9-Confirmation + Lifecycle
**Areas discussed:** Resolve paths & data purge, Code confirmation & errors, Fulfillment & congrats, Auto-expiry mechanism, Extend request (added)

---

## Resolve paths & data purge

### Status mapping for non-confirm exits

| Option | Description | Selected |
|--------|-------------|----------|
| Both → 'cancelled' | Outside + cancel both write status='cancelled'. Matches ROADMAP crit #3. | |
| 'cancelled' + closed_reason note | Both cancelled but record the reason. | |
| Outside → 'fulfilled' | Outside = successful fulfillment; only cancel → cancelled. | ✓ |

**User's choice:** Outside → 'fulfilled' (only "no longer needed" → cancelled).
**Notes:** Revises ROADMAP criterion #3. User's semantics: fulfilled = "I got the blood I needed" (in-app or outside); cancelled = "I no longer need it."

### Data purge on close

| Option | Description | Selected |
|--------|-------------|----------|
| Defer purge, fix copy now | Keep purge in v3; fix the dishonest "data purged" copy. | |
| Implement purge now | Null out phone/lat/lng + delete responder rows on close. | |
| Defer purge, keep copy | Leave false copy as-is. | |

**User's choice (free text):** Don't purge any data — keep `request_responses` and `blood_requests` records even after fulfilled, for later use.
**Notes:** Supersedes the v3 purge plan. Implies the false "data was purged" copy must be rewritten (D-03).

---

## Code confirmation & errors

### Error message granularity (initial)

| Option | Description | Selected |
|--------|-------------|----------|
| Generic a/b, specific c | Generic for unknown + non-participant; specific for already-confirmed. | ✓ (final) |
| All three distinct | Tell exactly which case failed. | |
| Single generic for all | One message for everything. | |

**User's choice:** Generic a/b, specific c — *after* a mind-change round (below).
**Notes:** User first proposed relaxing the participant check (off-app/friend-relayed donor scenario), then **reverted**: a real donor can register + tap "I'll help" in seconds, so keep the spec §4.2 anti-fraud guardrail. Final state = participant check kept; granularity = generic a/b, specific c.

### QR scope

| Option | Description | Selected |
|--------|-------------|----------|
| 5-char functional, QR placeholder | Wire manual code; keep QR viewport visual. | |
| Implement real QR scan now | Camera-based scanner + permission UX. | ✓ |
| Drop QR viewport entirely | Only 5-char input. | |

**User's choice:** Implement real QR scan now.
**Notes:** Pulls v2-flavored scope forward at user's explicit request. QR encodes the donor's 5-char code.

### Same-donor re-entry

| Option | Description | Selected |
|--------|-------------|----------|
| Block as 'already confirmed' | Unique (request_id, donor_id) on donations. | ✓ |
| Allow re-counting | Same donor counts for multiple units. | |

**User's choice:** Block as 'already confirmed'.

### Blood-type check at confirm

| Option | Description | Selected |
|--------|-------------|----------|
| No hard block, record actual type | Rely on upstream gates; record type. | ✓ |
| Block incompatible types | Reject mismatches at confirm. | |

**User's choice:** Yes, no separate check (after clarifying example).
**Notes:** Participation already implies compatibility (feed only shows compatible requests), so the check is redundant.

---

## Fulfillment & congrats

### Multi-unit requester flow

| Option | Description | Selected |
|--------|-------------|----------|
| Progress + confirm next | Show "X of Y units" + keep confirming. | ✓ |
| Stay open, no progress UI | Keep live, no counter. | |
| Treat every request as 1 unit | Auto-close on first confirm. | |

**User's choice:** Progress + confirm next.
**Notes:** User provided a screenshot showing the `၀ / ၂ unit ရရှိပြီး` progress subtitle already in the RequestLive design (and it's already coded as dummy local state).

### Donor congrats delivery

| Option | Description | Selected |
|--------|-------------|----------|
| Full-screen takeover | App-wide subscription; congrats takes over current screen. | ✓ |
| Show on next app open | Don't interrupt; show later. | |
| Toast + tap to view | Small toast → open congrats. | |

**User's choice:** Full-screen takeover.
**Notes:** Departs from Phase 8 D-12 (RequestLive-only subscription) — the confirmed donor isn't on the live screen.

### Closed-app congrats fallback

| Option | Description | Selected |
|--------|-------------|----------|
| Check-on-open now, FCM later | Show on app open; FCM backup deferred. | ✓ |
| Accept the gap for now | No catch-up on reopen. | |

**User's choice:** Check-on-open now, FCM later.

---

## Auto-expiry mechanism

### Mechanism

| Option | Description | Selected |
|--------|-------------|----------|
| pg_cron (in-DB) | Postgres cron runs a single UPDATE. | ✓ |
| Scheduled Edge Function | Deno function on cron; extensible for FCM. | |

**User's choice:** pg_cron (in-DB).

### Frequency

| Option | Description | Selected |
|--------|-------------|----------|
| Every 15 minutes | Prompt + cheap. | ✓ |
| Hourly | Lightest; up to ~1h lag. | |
| Every minute | Near-instant; overkill. | |

**User's choice:** Every 15 minutes.

---

## Extend request (added by user)

### Scope

| Option | Description | Selected |
|--------|-------------|----------|
| In-app part in Phase 9 | Banner + Extend +12h + expires_at update now; push to FCM phase. | ✓ |
| Defer whole feature | Keep Phase 9 to close + auto-expire only. | |

**User's choice:** In-app part in Phase 9.
**Notes:** New capability beyond LIFE-02. User: warn the requester before 24h (e.g. from 20h), let them extend to keep the request alive; closed-app warning is an FCM push for the FCM phase.

### Extend amount

| Option | Description | Selected |
|--------|-------------|----------|
| +12h from current expiry | new expires_at = current + 12h. | ✓ |
| +12h from now | new expires_at = now() + 12h. | |

**User's choice:** +12h from current expiry.

### Repeatability

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, repeatable | Warn + extend again each cycle. | |
| Once only | Single +12h extension. | ✓ |

**User's choice:** Once only.
**Notes:** Needs an `extended` flag on blood_requests to block a second extension and hide the warning.

---

## Claude's Discretion

- Exact confirm `SECURITY DEFINER` RPC SQL shape.
- QR scanner library + payload encoding.
- "Unseen donation" marker mechanism for check-on-open congrats.
- pg_cron deployment specifics (cron.schedule, extension enablement) via Supabase MCP.
- Extend as a direct owner UPDATE vs a small RPC.

## Deferred Ideas

- **FCM-phase backlog (6 features + infra):** core donor alert; requester-on-response push (PUSH-04); resolution notice on close; resolution notice on expiry; donor congrats backup push; pre-expiry extend-warning push; plus service worker + firebase + device_tokens + permission UX + Edge Function sender + DB triggers.
- v2 one-time QR codes (this phase ships reusable donor_code QR).
- v3 personal-data purge on close (explicitly not done; records retained).
- Switching expiry to a scheduled Edge Function once expiry needs FCM.
