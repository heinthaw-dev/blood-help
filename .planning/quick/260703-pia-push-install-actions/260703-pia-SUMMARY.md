# Summary 260703-pia — push + install actions

**Date:** 2026-07-03
**Commit:** da18ab8-follow (see git log — feat commit on main)

## What shipped

The action layer for iOS PWA onboarding, on top of pwa.ts detection.

- **`enablePush(profileId)`** (renamed from `registerPushToken`) — requests permission,
  and only on `granted` registers the FCM token to `device_tokens` via the app's existing
  single service worker. Returns `PushResult` (`granted|denied|unsupported|error`).
- **`promptAndroidInstall()`** — fires the `beforeinstallprompt` captured by pwa.ts and
  clears it (single-use). Returns `InstallOutcome` (`accepted|dismissed|unavailable`).
- **`clearDeferredInstallPrompt()`** added to pwa.ts as the consume-side seam.
- Renamed all 6 call sites (App.tsx ×4, DonorThankYou ×2).
- Guarded the `controllerchange` re-register on `permission === 'granted'` — honors
  "never auto-request on load".

## Decisions

- Reused pwa.ts capture rather than adding a second listener (keeps Firebase out of the
  detection layer).
- Kept the existing 4-value `PushResult` (spec asked for 3); `error` is a real, already-handled
  failure signal.

## Verification

- `tsc -b`: changed files clean.
- `eslint` changed files: no new errors.

## Follow-ups (not done here)

1. **Still required:** import pwa.ts early in main.tsx (capture timing) — carried from 260702-ipw.
2. Onboarding UI consuming usePwaState() + these actions.
3. **Pre-existing, separate:** PhoneEntry.tsx:53 (tsc), App.tsx:532/857 `Date.now()` purity (eslint).
