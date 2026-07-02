# Summary 260703-wir — wire PushNudge into the app

**Date:** 2026-07-03
**Commit:** 0483354

## What shipped

PushNudge is now live in three places, and the Android capture is armed at launch.

- **Donor thank-you:** `<PushNudge>` is the primary action under the warm message;
  "Continue to home" is a quiet skip link that never blocks (routing changed profile→home).
- **App launch / Home:** donor-gated `<PushNudge>` at the top of the feed, dismissible for
  the session and re-offered next launch. Covers the "iOS installed + reopened → enable" case
  (usePwaState yields `ios-enable-push` when standalone+default).
- **main.tsx:** `import './lib/pwa'` arms the `beforeinstallprompt` capture at launch.
- **PushNudge:** gained optional `onDismiss` (× on actionable states).

## Decisions

- Dismissal state lifted to App (survives Home remounts; resets each launch).
- Bullets 2 & 3 realized by one donor-gated Home placement (Home is the donor's launch screen).
- Removed DonorThankYou's now-redundant hand-rolled opt-in block (dedup).

## Verification

- `tsc -b`: changed files clean.
- `eslint`: no new errors (pre-existing reds only, line-shifted).

## Follow-ups

- Manual device test: iPhone (add-to-home → reopen → enable) + Android (install prompt).
- Pre-existing repo reds (separate): PhoneEntry.tsx:53 tsc; App.tsx Date.now ×2 + Home.tsx
  setRequests eslint. A small cleanup task would get build/lint green.
