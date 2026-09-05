---
quick_id: 260906-hjj
status: complete
---

# Quick Task 260906-hjj — Summary

## What changed

**`src/screens/Profile.tsx`**
- Logout button dropped `tone="danger"`, so it now renders with `Button`'s
  default `tone="primary"` — same red CTA color as the OTP "Verify" / login
  button.
- Added `loggingOut?: boolean` prop (default `false`). While true: button is
  `disabled`, and its children swap from the label text to the exact
  `bh-spin`-animated ring markup already used by `OtpVerification.tsx`'s
  Verify button (20x20 ring, translucent white track, solid white top border).

**`src/App.tsx`**
- Added `loggingOut` state next to the existing `verifying` state.
- `handleLogout` now sets `loggingOut(true)` at the top and resets it in a
  `finally` block wrapping the whole body — same shape as `handleVerified`.
  This covers the real await inside it (`device_tokens` delete, which needs
  a round trip to Supabase before signOut/localStorage-clear/navigate run).
- Passed `loggingOut={loggingOut}` into the `<Profile>` call site.

## Verification

- `npm run build` — passed.
- `npm run lint` — 0 errors (1 pre-existing warning in GSD's own
  `state.cjs`, unrelated).
- Manual UAT still needed: tap Log out, confirm the button turns into a
  spinning white ring on primary-red background and is unclickable until
  the screen navigates back to Phone Entry.

## Notes

- No other screen uses `tone="danger"` for this button, so this was a
  single, isolated call site.
- The spinner may only be visible briefly since `setScreen("phone")` fires
  synchronously right after the awaited delete — the `finally` reset is
  there for correctness (covers thrown errors, matches the `verifying`
  precedent) even though the component usually unmounts before it's needed.
