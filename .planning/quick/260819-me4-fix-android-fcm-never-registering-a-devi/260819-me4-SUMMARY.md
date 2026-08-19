---
id: 260819-me4
type: quick
status: complete
completed: 2026-08-19
commits:
  - ddf965d fix(push): give Android a path that actually registers a token
  - 2be8444 fix(push): register the FCM token as soon as the session is known
  - 48051b7 fix(push): stop one device's registration deleting another's token
---

# Quick Task 260819-me4 — Summary

## What was broken

After `260819-hsx` unblocked the CSP, iOS registered and received push. Android
still received nothing and `device_tokens` held exactly one row.

Android was never a delivery problem — **no code path on Android ever called
`enablePush`**, so there was no token to deliver to.

### A. `PushNudge` had no Android enable path

`handleEnable` — the only function that calls `enablePush` — was wired to
exactly one state, `case 'ios-enable-push'`.

`case 'android-install'` called `promptAndroidInstall()` and then set
`succeeded`, rendering the green **"Alerts are on"** card. Installing a PWA
requests no notification permission and registers no token, so that message was
simply false.

And `deriveState` returned `'granted'` as soon as OS permission existed, which
makes `PushNudge` render `null`. So an Android user who had already allowed
notifications — exactly this user's state — saw no nudge at all and had **no
way to trigger registration from anywhere in the UI**.

The `'granted'` state name was the conceptual error: it means *permission
granted*, not *alerts working*. The token can be missing in either case.

### B. The silent recovery raced auth hydration

`src/App.tsx` attached a `controllerchange` listener guarded on
`user.supabaseId`. The service worker calls `clients.claim()` on activate, so
that event fires during boot — before `initAuth` hydrates `supabaseId`. The
guard saw `null` and no-oped. When `supabaseId` later arrived the effect re-ran,
but only to re-attach the listener; nothing fired. The one always-on heal path
was reliably missed.

### C. `enablePush` reported success on a failed write

It logged the upsert error and returned `'granted'` anyway — so the UI showed
the success card while no row existed, and the error message was discarded.

### D. Registering one device deleted the other — would have broken iOS

```ts
.delete().eq('profile_id', profileId).eq('platform', 'web').neq('fcm_token', token)
```

Every row is written with `platform: 'web'`, so this deleted the user's *other
devices*. Latent only because Android never registered. Fixing A–C without this
would have converted "Android broken" into "whichever phone registered last" —
the iPhone token would have been deleted the first time Android succeeded.

## Changes

### Android enable path (`ddf965d`)

- New `'android-enable-push'` state in `src/lib/pwa.ts` for non-iOS with a
  usable Notification API and permission still `'default'`; shares the existing
  enable card in `PushNudge`.
- `handleInstall` now chains into `handleEnable` after an accepted install, so
  the success card only appears once a token is really registered.
- `deriveState` gained an explicit `'unsupported'` bail for non-iOS.

### Registration on session (`2be8444`)

The effect now calls `registerIfGranted()` directly once a uid exists, and keeps
the `controllerchange` listener for post-update token rotation. Safe because
`Notification.requestPermission()` resolves without a dialog under a standing
grant — the function's contract already relied on this.

This is the general recovery for **both** platforms and every screen: any
logged-in user with permission granted converges to a registered token on next
app open.

### Multi-device (`48051b7`)

- Removed the per-profile delete from `enablePush`.
- Added `supabase/functions/_shared/prune.ts` — deletes only tokens FCM reports
  as `registration-token-not-registered` / `invalid-registration-token` /
  `invalid-argument`, from the positionally-aligned `sendEachForMulticast`
  responses. Best-effort, never throws.
- `notify-donors` prunes on failure.
- `notify-requester` rewritten from `send()` on the single newest token to
  `sendEachForMulticast` over **all** the requester's tokens. The old form both
  ignored other devices and 500'd the entire call when that one token was stale.
- `enablePush` returns `'error'` when the upsert fails, and logs the message.

## Verification

- `npm run build` and `npm run lint` green (1 pre-existing warning in GSD tooling)
- Edge functions deployed via the linked CLI: `notify-donors` v5 → **v6**,
  `notify-requester` v4 → **v5**, both ACTIVE
- `verify_jwt: false` preserved on both — they perform their own in-code JWT
  verification (security-audit Fix 1); flipping it would have double-gated them

## Still needs a human

Device retest after the Vercel deploy. On Android, open the app logged in — with
permission already granted a token should appear with no interaction:

```sql
select profile_id, platform, created_at, left(fcm_token, 12) as prefix
from device_tokens order by created_at desc;
```

Expect **two rows for the same profile_id**, one per device, and both to survive
the other registering. Then post a matching request and confirm both phones
alert.

## Follow-up not done

`device_tokens.platform` is hardcoded to `'web'` for every row, so the table
cannot answer "which device is this?" — the question that started this
investigation. Recording `'android'` / `'ios'` would help debugging. Deferred
because it is a data-semantics change and `notify-donors` does not filter on the
column, so it is not needed for delivery.
