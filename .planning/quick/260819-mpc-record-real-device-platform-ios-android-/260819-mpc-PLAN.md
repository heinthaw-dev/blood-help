---
id: 260819-mpc
type: quick
status: complete
created: 2026-08-19
description: Record real device platform (ios/android/web) in device_tokens instead of hardcoded 'web'
---

# Quick Task 260819-mpc — Record the real device platform

## Why

`device_tokens.platform` was written as the literal string `'web'` for every
row, so the table could not answer "which of this user's devices is this
token?" — the exact question that made the Android investigation in
`260819-me4` slower than it needed to be, and the follow-up flagged there.

## Safety check performed before changing anything

| Concern | Finding |
|---|---|
| Writers | Exactly one — `src/lib/push.ts:91` |
| Readers / filters | None. `notify-donors` and `notify-requester` select `fcm_token` only; the one filter that existed (`.eq('platform','web')` in the old cleanup delete) was removed in `260819-me4` |
| Column type | `text`, nullable, free-form — `src/types/database.ts` types it `string \| null`, so no literal union to widen |
| Constraints | No CHECK constraint on `device_tokens` — any value is accepted |

So this is additive metadata with no behavioural coupling.

## Tasks

### T1 — Add platform detection

**Files:** `src/lib/pwa.ts`

**Action:** Export `DevicePlatform = 'ios' | 'android' | 'web'` and
`detectPlatform()`. Placed in `pwa.ts` because it already owns device detection
(`detectIOS`, `detectStandalone`) and `detectIOS` is reused directly — including
its iPadOS-13+-reports-as-MacIntel handling.

`'web'` stays the catch-all for desktop and anything unrecognised, so the value
is truthful rather than a guess.

**Done:** `detectPlatform()` exported and covered by the existing iOS detection.

### T2 — Write it on registration

**Files:** `src/lib/push.ts`

**Action:** Replace the hardcoded `platform: 'web'` in the `device_tokens`
upsert with `platform: detectPlatform()`.

**Done:** New and refreshed rows carry the real platform.

## Deliberately not done

- **No backfill.** The single pre-existing row self-corrects: the upsert is
  `onConflict: 'fcm_token'`, so re-registering the same device updates the row
  in place — and after `260819-me4` registration runs on every app open for a
  device with permission granted. Rewriting it by hand would mean asserting a
  platform the data does not prove.
- **No CHECK constraint.** It would be good hygiene, but a value outside the
  allowed set would fail the upsert and make `enablePush` return `'error'` —
  turning a cosmetic mismatch into broken push registration. Given this
  session's history of silent push breakage, that trade is not worth it.
- **No standalone/browser distinction.** Values like `ios-pwa` would be more
  informative but muddy the column's meaning and are awkward to query. The OS
  family is what was asked for.

## Verification

- `npm run build` green, `npm run lint` 0 errors
- Single write site confirmed at `src/lib/push.ts:91`

## Manual check (user)

After the deploy, open the app on each device, then:

```sql
select platform, count(*), max(created_at) from device_tokens group by platform;
```

The iPhone's existing row should flip from `web` to `ios` on its next app open;
Android should arrive as `android`.
