# Quick Task 260703-pia — push + install actions

**Date:** 2026-07-03
**Type:** Feature (iOS PWA onboarding, phase 2 — the action layer)
**Status:** Complete
**Follows:** 260702-ipw (pwa.ts detection lib)

## Why

pwa.ts (260702-ipw) detects *where* a visitor is in the install/push funnel. This
task adds the *actions* that move them along: enable push, and fire the Android
one-tap install. Per user spec: reuse the existing single service worker, register
the token only after permission is granted, and never auto-request on load.

## Reconciliation with existing code (user confirmed both)

The spec described creating push.ts fresh + capturing beforeinstallprompt in it, but
both already existed. Decisions taken (via AskUserQuestion):

1. **enablePush naming** → RENAME the existing `registerPushToken` to `enablePush`
   and update all 6 call sites (App.tsx ×4, DonorThankYou ×2). One canonical name,
   no duplicated permission/token logic.
2. **Install capture** → REUSE the capture already in pwa.ts via `getDeferredInstallPrompt()`.
   Do NOT add a second `beforeinstallprompt` listener (would double-register and pull
   Firebase into the light detection layer).

## Changes

- **src/lib/push.ts**
  - `registerPushToken` → `enablePush(profileId)` (same body: guard `pushSupported()`,
    `Notification.requestPermission()`, on granted fetch FCM token via existing SW
    (`navigator.serviceWorker.ready`) + VAPID key, upsert `device_tokens`).
  - Kept 4-value `PushResult` (`granted|denied|unsupported|error`) — superset of the
    spec's 3; `error` carries real signal (token/VAPID failure) and is already handled
    at call sites. **Deviation-with-rationale.**
  - Added `promptAndroidInstall(): Promise<InstallOutcome>` (`accepted|dismissed|unavailable`)
    — fires `getDeferredInstallPrompt()`, then clears it (single-use).
- **src/lib/pwa.ts** — added `clearDeferredInstallPrompt()` (nulls the captured event +
  notifies subscribers so `canInstallAndroid` flips false after firing).
- **src/App.tsx** — renamed 4 calls + import; added a `Notification.permission === 'granted'`
  guard to the `controllerchange` handler (line ~399) so an SW controller change on first
  load can't trigger a permission prompt (honors "never auto-request on load").
- **src/screens/DonorThankYou.tsx** — renamed import + 2 calls.

## "Never auto-request on load" — audit result

All silent-register call sites gate on `permission === 'granted'` (App.tsx maybeAskPush,
DonorThankYou mount effect) or fire only after the user taps "Allow" (pre-dialog).
The one ungated site was the `controllerchange` handler — now guarded. Compliant.

## Out of scope (later phases)

- Import pwa.ts early in main.tsx (still required for capture timing — carried from 260702-ipw).
- Onboarding UI component consuming usePwaState() + calling enablePush/promptAndroidInstall.

## Verification

- `tsc -b`: changed files clean (only pre-existing PhoneEntry.tsx:53 error remains).
- `eslint` on changed files: no new errors (2 pre-existing `Date.now()` purity errors in
  App.tsx:532/857 are untouched code).
- Manual testing pending (user tests manually — no automated browser tests).

## Pre-existing repo issues flagged (NOT this task)

1. `PhoneEntry.tsx:53` — unused `titleStyle` (its `<h1>` commented at line 116) → tsc red.
2. `App.tsx:532` & `857` — `Date.now()` called during render → `react-hooks/purity` eslint red.
