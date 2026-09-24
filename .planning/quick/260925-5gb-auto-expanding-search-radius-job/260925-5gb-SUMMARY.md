---
id: 260925-5gb
status: complete
date: 2026-09-25
---

# Quick Task 260925-5gb: Auto-expanding search radius job

## What was wrong

The auto-expanding radius shipped as state without a mover. `20260924190500`
added `search_radius_km`, `radius_last_expanded_at` and `radius_cap_notified`;
`20260924190600` added `donors_in_ring()`. Nothing ever wrote the columns or
called the RPC. Verified against the live database before starting: `cron.job`
held only `auto-expire-requests`, no `expand_request_radius` function existed,
and every open request — including one 66 minutes old — read
`search_radius_km = 10` with `radius_last_expanded_at = NULL`.

`RequestLive` was correct the whole time. It polls the column every 30 s and
reported the 10 it was given.

## What was built

**`20260924213139_radius_expansion_job.sql`**

- `pg_net` enabled.
- `public.radius_expansion_events` — durable queue, one row per widening,
  recording the band that widening newly reached. RLS on with no policies: the
  service role bypasses it, everyone else sees nothing.
- `public.expand_request_radius()` — widens every due request by 5 km toward the
  30 km cap and queues its ring, in one statement. `FOR UPDATE SKIP LOCKED` so
  overlapping ticks cannot double-bump.
- `public.run_radius_expansion()` — cron entry point. Widens first, always;
  contacts the delivery worker second, only if a ring is owed.
- `cron.schedule('expand-request-radius', '* * * * *', ...)`.

**`20260924213647_radius_job_token.sql`**

- The job mints its own bearer token via `gen_random_bytes` into Vault. The
  first cut had the cron present the project's service-role key, which would
  have needed a human to copy it into Vault — a setup step easy to skip, and one
  whose omission shows up only as silently undelivered alerts.
- `claim_radius_expansion_events(p_token, p_limit)` verifies the token *inside*
  the claim, so no code path drains the queue without it. The unauthenticated
  overload is dropped.

**`supabase/functions/expand-radius/index.ts`** — the delivery worker. Claims up
to 50 rings (incrementing `attempts` in the claiming statement), re-checks each
request is still active with zero responders, calls `donors_in_ring`, filters by
directional compatibility, and pushes the same data-only `donor_alert` shape the
service worker already renders. Settles on every terminal outcome; leaves
genuinely failed sends owed for the next tick, capped at 5 attempts.

**`supabase/functions/_shared/compatibility.ts`** — `COMPATIBLE_DONOR_TYPES`
extracted from `notify-donors` and now imported by both. Two copies of a blood
compatibility matrix that can drift is not a duplication worth keeping in this
app. `notify-donors` redeployed with the import, no behaviour change.

## Verified on the live project

| Check | Result |
|---|---|
| `expand_request_radius()` moves due rows | 5 requests 10 → 15 km, 5 rings queued at `[10,15]` |
| 3-minute gate | immediate second call moved 0 |
| cron runs unattended | requests reached 20 km at 21:35 with no manual call |
| worker drains | `{"drained":10,"settled":10,"retrying":0,"sent":0}` — all settled `no compatible donors in ring`, correct for a database with no donors in those bands |
| cap | 25 → 30 returns `hit_cap: true`; a 30 km request with an overdue clock moves 0 |
| unauthenticated worker call | `POST` with no token → 401, wrong token → 401, `GET` → 405 |

## Not built, deliberately

- **No push for the 30 km cap.** `SearchRadiusRings` already renders a bilingual
  `capped` headline ("Searched the full 30 km") and only never fired because the
  radius never reached 30. `radius_cap_notified` is left unused, reserved for a
  future push.
- No client change of any kind. `RequestLive`'s existing poll picks the new
  values up.

## Known gaps

- `donors_in_ring` does not exclude the requester, so a requester who is also an
  available donor can be alerted to their own request. `donors_within_radius`
  has the same gap, so this is pre-existing rather than introduced here.
- `notify-requester` queries `request_responses.responder_id`, a column that
  does not exist — the table has `donor_id`. Spotted while reading the schema;
  out of scope for this task, but it would stop the requester's "someone will
  help" push from ever being sent.
- Remote migration `20260924190553 fix_donors_in_ring_param_shadowing` has no
  local file. Pre-existing drift, not introduced here.
