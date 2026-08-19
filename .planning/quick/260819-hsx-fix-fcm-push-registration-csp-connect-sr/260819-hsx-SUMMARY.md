---
id: 260819-hsx
type: quick
status: complete
completed: 2026-08-19
commits:
  - fabb019 fix(push): allow firebaseinstallations.googleapis.com in CSP connect-src
  - ff720b0 fix(push): bound the serviceWorker.ready wait in enablePush
  - f881749 fix(push): surface enable failures in PushNudge instead of silent no-op
---

# Quick Task 260819-hsx — Summary

## What was broken

Push notifications had never worked for any user on any platform. `device_tokens`
held **zero rows** — verified directly against the database, not inferred.

The CSP meta tag added in `23ee7bc` ("fix: security audit") allowlisted
`fcmregistrations.googleapis.com` in `connect-src` but omitted
`firebaseinstallations.googleapis.com`. Since `getToken()` must first obtain a
Firebase Installations identity token before it can exchange it for an FCM
device token, the very first network call was blocked, `getToken()` threw,
`enablePush()` returned `'error'`, and `PushNudge` — which only reacts to
`'granted'` — showed nothing at all. The visible symptom was a permission prompt
that was granted followed by an apparently frozen "Enable alerts" button, and no
alert ever reaching a donor from the requester flow.

## Changes

### T1 — CSP connect-src (`fabb019`)

`index.html:12` now lists `https://firebaseinstallations.googleapis.com`.

The same edit was applied to the `connect-src` line in the local
`SECURITY-FIXES.md` (Step 9A), which was also brought up to date with the
`wss://` Supabase realtime origins added in `048cf34` — so the checklist and the
shipped policy are byte-identical and a re-run cannot reintroduce the
regression. That file is deliberately untracked and gitignored: the repo is
public and the report maps the app's attack surface, so it stays on disk only.

### T2 — SW-ready timeout guard (`ff720b0`)

`src/lib/push.ts` gained `SW_READY_TIMEOUT_MS` (10s) and a
`serviceWorkerReady()` helper that races `navigator.serviceWorker.ready` against
a timeout. That promise never rejects, so any service worker that fails to
install left `enablePush` hanging indefinitely with no error. It now always
settles, logging and returning `'error'` on timeout.

This matters here specifically because the service worker `importScripts` three
CDN scripts (two from gstatic, workbox from `storage.googleapis.com`) at install
time — a failed fetch on a poor mobile connection means no SW, which previously
meant a permanently frozen button.

### T3 — Failure surfacing in PushNudge (`f881749`)

`src/components/PushNudge.tsx` tracks the `PushResult` of the last enable
attempt in `enableError` state and renders a bilingual `role="alert"` line under
the button. `'denied'` gets recovery guidance pointing at device settings;
`'unsupported'`/`'error'` get a retryable message. The error clears on retry.
Copy follows the existing `STRINGS: Record<Lang, ...>` pattern; the line is
tinted with `var(--color-primary)` — no hardcoded hex.

## Verification

- `npm run build` — green (tsc + vite)
- `npm run lint` — 0 errors (1 pre-existing warning in `.claude/get-shit-done/bin/lib/state.cjs`, unrelated)
- Built `dist/index.html` CSP checked against every `googleapis.com` origin
  referenced by `dist/assets/*.js` — both `fcmregistrations` and
  `firebaseinstallations` present, no missing origins

## Still needs a human

Manual device retest. The affected iPhone already has `Notification.permission
=== 'granted'`, so `usePwaState` reports `'granted'`, `PushNudge` renders
`null`, and the enable path can't be re-triggered from the UI. To retest: delete
the home-screen app and reinstall (or reset website data for the origin in iOS
Safari settings), redo the donor flow, then confirm a row appears:

```sql
select profile_id, platform, created_at from device_tokens;
```

Then run the requester flow with a compatible blood type in range and confirm
the donor device receives the alert.

## Follow-up noted, not done

The service worker pulls workbox from `storage.googleapis.com/workbox-cdn/` at
install time. Vendoring it (via `workbox-precaching` as a build dependency
rather than a CDN import) would remove a runtime network dependency from SW
installation. Out of scope for this task.
