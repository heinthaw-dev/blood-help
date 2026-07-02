# Quick Task 260703-wir — wire PushNudge into the app

**Date:** 2026-07-03
**Type:** Feature (iOS PWA onboarding, phase 4 — integration)
**Status:** Complete
**Follows:** 260702-ipw (detection), 260703-pia (actions), 260703-pnu (PushNudge UI)

## Why

Place PushNudge where donors actually see it, and arm the Android capture at launch.

## Changes

- **src/main.tsx** — `import './lib/pwa'` (side effect) so the `beforeinstallprompt`
  capture is armed at launch (it fires once, early). Required for `android-install`.
- **src/screens/DonorThankYou.tsx** — replaced the hand-rolled opt-in block (enabled
  card / iOS install guide / enable button) with `<PushNudge>` as the primary action
  under the warm message. "Continue" is now a **quiet secondary skip link** that
  **never blocks** (removed the `disabled={!isAllowed}` gate). Kept the silent
  re-register mount effect. Removed now-dead code (BellIcon, isIosSafariTab,
  enabled/needsInstall/isAllowed/canEnable/handleEnable, Card/Button/pushSupported imports).
- **src/App.tsx** — added `pushNudgeDismissed` session state; DonorThankYou `onContinue`
  now routes to `home` (was `profile`); passes `pushNudgeDismissed` + `onDismissPushNudge`
  to Home.
- **src/screens/Home.tsx** — renders `<PushNudge>` at the top of the feed when
  `donorReady && !pushNudgeDismissed`, dismissible (× via `onDismiss`).
- **src/components/PushNudge.tsx** — added optional `onDismiss` (renders a × on the
  actionable states; absent on DonorThankYou usage).

## Design decisions

- **Dismissal state lives in App, not Home.** Screens unmount on navigation, so Home-local
  state would reset every visit and re-nag. App-level state = dismissed for the session,
  re-offered on next launch (fresh App mount). Matches "re-offer … dismissible".
- **Bullets 2 & 3 → one donor-gated Home placement.** A returning donor's launch screen is
  Home, and `usePwaState()` yields `ios-enable-push` exactly when standalone+default on iOS,
  so the Home nudge satisfies both "on app launch show enable step" and "Home re-offer".
- Nudge gated on `donorReady` (registered donor) per spec; `currentUserId` (supabaseId)
  threaded for `enablePush`.

## Verification

- `tsc -b`: changed files clean (only pre-existing PhoneEntry.tsx:53 error remains).
- `eslint` changed files: no new errors (pre-existing: App.tsx Date.now purity ×2,
  Home.tsx setRequests-in-effect — all untouched code, line-shifted only).
- Manual device testing pending (iOS add-to-home → reopen → enable; Android install).

## Follow-ups / notes

- Opportunity: PushNudge could also serve requesters (alerts when donors respond); currently
  donor-gated per spec.
- Pre-existing repo reds remain (separate cleanup): PhoneEntry.tsx:53 (tsc);
  App.tsx Date.now ×2 + Home.tsx setRequests (eslint react-hooks).
