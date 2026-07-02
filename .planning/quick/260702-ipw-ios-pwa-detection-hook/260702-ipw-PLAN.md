# Quick Task 260702-ipw — iOS PWA install/push detection lib

**Date:** 2026-07-02
**Type:** Feature (new capability — iOS PWA onboarding, phase 1 of N)
**Status:** Complete

## Why

iOS users cannot receive FCM web push in a normal browser tab. On iOS they must
add the app to the Home Screen and open it standalone (iOS 16.4+) before push is
even available. To guide them, the UI first needs to know *where each visitor is
in that funnel*. This task builds the detection layer only — no UI, no permission
request, no install action.

## Scope (this task)

Create `src/lib/pwa.ts` exporting:
- `usePwaState(): PwaCapabilities` — reactive hook.
- `PwaCapabilities` — `{ isIOS, isIOSSafari, isIOSNonSafari, isStandalone, canInstallAndroid, notifPermission, state }`.
- `PwaState` union, `NotifPermission` type.
- `getDeferredInstallPrompt()` — seam exposing the captured Android prompt for the later install-action phase.

## Detection rules (from user spec)

- `isIOS`: `/iPad|iPhone|iPod/.test(ua)` OR (`platform === 'MacIntel'` && `maxTouchPoints > 1`) — catches iPadOS 13+.
- `isStandalone`: `matchMedia('(display-mode: standalone)').matches` OR `navigator.standalone === true`.
- `isIOSNonSafari`: `isIOS && /CriOS|FxiOS|EdgiOS|OPiOS/.test(ua)`.
- `isIOSSafari`: `isIOS && !isIOSNonSafari`.
- `notifPermission`: `Notification.permission` or `'unsupported'`.
- `canInstallAndroid`: `true` once a `beforeinstallprompt` has been captured.

## `state` precedence — DECISIONS (user left this to Claude)

Evaluated most-terminal first:

1. `notifPermission === 'granted'` → `'granted'` (push works; nothing to prompt, any platform).
2. iOS:
   - not standalone + non-Safari → `'ios-open-in-safari'`
   - not standalone + Safari → `'ios-add-to-home'`
   - standalone + `notifPermission === 'unsupported'` (iOS < 16.4) → `'hidden'` (can't push)
   - standalone + not granted (`default` **or** `denied`) → `'ios-enable-push'`
3. non-iOS: `canInstallAndroid && !isStandalone` → `'android-install'`
4. else → `'hidden'`

**Assumptions worth confirming:**
- `denied` on standalone iOS still routes to `'ios-enable-push'` (the enable UI can carry
  "turn on in Settings" copy) rather than a dedicated denied state — the spec's state set has none.
- Android "installed but push not granted" has no state in the spec's set → falls to `'hidden'`.
- `'android-install'` also fires for desktop Chromium (which emits `beforeinstallprompt`); acceptable.

## Architecture note (correctness)

`beforeinstallprompt` fires once, early, and is lost if unheard. Capture is therefore a
**module-level** side effect (runs on import), `preventDefault()`'d and stashed; hook
instances subscribe via a module `Set`. The hook's `useEffect` only *subscribes* + listens
for display-mode/visibility/focus changes to recompute (`Notification.permission` has no event).

## Out of scope (later phases)

- Wiring an Install/Enable-Push onboarding component into the UI.
- Calling `getDeferredInstallPrompt().prompt()` (install action).
- Importing `pwa.ts` early in `main.tsx` so capture is active before the browser fires the
  event — **required follow-up** for `canInstallAndroid` to work reliably.
- Consolidating the ad-hoc `display-mode` check in `DonorThankYou.tsx` onto this lib.

## Verification

- `tsc -b`: no errors in `pwa.ts` (one PRE-EXISTING unrelated error in `PhoneEntry.tsx:53`
  — commented-out `<h1 style={titleStyle}>` leaves `titleStyle` unused; flagged separately).
- `eslint src/lib/pwa.ts`: clean.
