---
id: 260819-hsx
type: quick
status: planned
created: 2026-08-19
description: Fix FCM push registration — CSP connect-src missing firebaseinstallations, SW-ready timeout guard, surface enablePush failure in PushNudge
---

# Quick Task 260819-hsx — Fix FCM push registration

## Problem

Donors tap "Enable alerts" on the Donor Thank You screen, grant the iOS
permission prompt, and nothing happens: the nudge card never flips to its
success state, no push ever arrives, and `device_tokens` is empty across every
platform (verified: `select platform, count(*) from device_tokens` returns zero
rows).

### Root cause

Commit `23ee7bc` ("fix: security audit") added a `Content-Security-Policy`
meta tag to `index.html`. Its `connect-src` allowlist includes
`fcmregistrations.googleapis.com` but omits
`firebaseinstallations.googleapis.com`.

`firebase/messaging`'s `getToken()` is a two-call handshake:

1. Firebase Installations issues an app-instance identity token from
   `https://firebaseinstallations.googleapis.com/v1/projects/{id}/installations`
2. FCM Registrations exchanges that identity for the device token from
   `https://fcmregistrations.googleapis.com/v1/projects/{id}/registrations`

Step 1 is blocked by CSP, so `getToken()` throws, `enablePush()` catches at
`src/lib/push.ts` and returns `'error'`, `PushNudge.handleEnable` only sets
success on `'granted'`, and the card is left unchanged. No token row is written,
so `notify-donors` finds no recipients and the end-to-end alert loop is dead.

The host is confirmed present in the built bundle:
`grep -o "https://[a-z0-9.-]*googleapis\.com" dist/assets/*.js` →
`firebaseinstallations.googleapis.com`, `fcmregistrations.googleapis.com`.

### Secondary hazards found while tracing

- `await navigator.serviceWorker.ready` (`src/lib/push.ts`) **never rejects**.
  If the service worker fails to install — e.g. its `importScripts` of
  `storage.googleapis.com/workbox-cdn/...` fails on a poor connection — that
  await hangs forever. No error, no timeout, button frozen permanently.
- `PushNudge.handleEnable` discards every non-`'granted'` result. The user gets
  zero feedback on `denied` / `unsupported` / `error`, which is exactly why the
  failure read as "stuck".

## Tasks

### T1 — Add `firebaseinstallations.googleapis.com` to CSP connect-src

**Files:** `index.html`, `SECURITY-FIXES.md`

**Action:** Add `https://firebaseinstallations.googleapis.com` to the
`connect-src` directive of the CSP meta tag in `index.html`. Apply the identical
change to the `connect-src` line in `SECURITY-FIXES.md` (Step 9A) so a future
re-run of the security checklist cannot reintroduce the regression.

**Verify:** `npm run build`, then confirm `dist/index.html` carries the host, and
that every `googleapis.com` origin referenced by `dist/assets/*.js` appears in
the policy.

**Done:** `connect-src` in both files lists the installations host; build green.

### T2 — Timeout guard on `navigator.serviceWorker.ready`

**Files:** `src/lib/push.ts`

**Action:** Race `navigator.serviceWorker.ready` against a bounded timeout
(10s) so an SW that never installs surfaces as a real failure rather than an
indefinite hang. On timeout, log and return `'error'`. Keep the existing
`PushResult` union unchanged — callers already branch on non-`'granted'`.

**Verify:** `npm run build` and `npm run lint` green; the happy path still
awaits the real registration and passes it to `getToken`.

**Done:** `enablePush` can no longer hang; it always settles.

### T3 — Surface enable failure in PushNudge

**Files:** `src/components/PushNudge.tsx`

**Action:** Capture the `PushResult` from `enablePush` in state. On a non-
`'granted'` result render a bilingual error line beneath the button:
`'denied'` gets recovery guidance (permission was refused — re-enable in device
settings), everything else gets a retryable "couldn't turn alerts on, try
again" message. Clear the error when the user retries. Follow the existing
`STRINGS` Record<Lang, ...> pattern and design tokens — no hardcoded hex.

**Verify:** `npm run build` and `npm run lint` green; `granted` path still shows
the existing green "Alerts are on" card.

**Done:** No enable outcome is silent.

## Must-haves

- `index.html` CSP `connect-src` includes `https://firebaseinstallations.googleapis.com`
- `SECURITY-FIXES.md` connect-src matches `index.html` exactly
- `src/lib/push.ts` cannot hang on `navigator.serviceWorker.ready`
- `src/components/PushNudge.tsx` renders feedback for every `PushResult`
- `npm run build` and `npm run lint` both green

## Out of scope

- Vendoring the workbox CDN script into the service worker bundle (separate
  concern; noted as a follow-up).
- Any change to the `notify-donors` / `notify-requester` edge functions — they
  were never the failure point.

## Manual retest (user)

Permission is already `granted` on the affected device, so the nudge will not
reappear. Delete the home-screen app and reinstall (or reset website data for
the origin in iOS Safari settings), redo the donor flow, then confirm:

```sql
select profile_id, platform, created_at from device_tokens;
```
