# Summary 260702-ipw — iOS PWA install/push detection lib

**Date:** 2026-07-02
**Commit:** (see git log — feat commit on main)

## What shipped

`src/lib/pwa.ts` — pure PWA install/push detection for the iOS onboarding funnel.

- `usePwaState()` hook returns `PwaCapabilities` and recomputes on: install-prompt
  capture/consume, `display-mode` change, tab `visibilitychange`, and window `focus`.
- Module-level `beforeinstallprompt` capture (import-time side effect) → `canInstallAndroid`
  + `getDeferredInstallPrompt()` seam for the future install-action phase.
- `deriveState()` collapses all signals into one actionable `PwaState`
  (`ios-open-in-safari` | `ios-add-to-home` | `ios-enable-push` | `granted` |
  `android-install` | `hidden`).

## Decisions

- State precedence: `granted` first, then iOS funnel (Safari-gate → add-to-home →
  enable-push), then Android install, else hidden. `denied` on standalone iOS →
  `ios-enable-push`. Full table in PLAN.
- Detection only — no permission request, no install trigger, no UI (later phases).

## Verification

- `tsc -b`: `pwa.ts` clean (0 errors).
- `eslint src/lib/pwa.ts`: clean.

## Follow-ups (not done here)

1. **Required:** import `pwa.ts` early in `main.tsx` so `beforeinstallprompt` capture is
   live before the browser fires it.
2. Build the onboarding UI component consuming `usePwaState()`.
3. Implement the install action via `getDeferredInstallPrompt().prompt()`.
4. **Separate pre-existing bug:** `npm run build` is red on `PhoneEntry.tsx:53` (unused
   `titleStyle`, its `<h1>` is commented out at line 116). Unrelated to this task.
