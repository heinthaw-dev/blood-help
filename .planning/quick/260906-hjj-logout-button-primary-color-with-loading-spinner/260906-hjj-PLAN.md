---
quick_id: 260906-hjj
status: planned
mode: quick
---

# Quick Task 260906-hjj: Logout button -> primary color + loading spinner

## Problem

Profile screen's "Log out" button uses `tone="danger"` (neutral bg, red text/border
on hover). User wants it to match the "login" CTA (OTP Verify button): primary
red background, and a loading spinner in place of the label while the async
logout work runs, mirroring the existing `verifying` pattern used for
`handleVerified` in App.tsx / OtpVerification.tsx.

## Reference pattern (OtpVerification + App.tsx)

- App.tsx owns a boolean (`verifying`), set true before the async work, reset
  in a `finally` block.
- The boolean is passed down as a prop and used to (a) disable the Button and
  (b) swap its children for an inline `bh-spin`-animated ring instead of text.
- Button defaults to `tone="primary"` when no `tone` prop is passed — the
  Verify button relies on this default rather than passing `tone="primary"`
  explicitly, so removing `tone="danger"` from the logout button (not adding
  `tone="primary"`) matches codebase convention.

## Tasks

### Task 1 — Add `loggingOut` state + wire into handleLogout (App.tsx)

- files: `src/App.tsx`
- action:
  - Add `const [loggingOut, setLoggingOut] = useState(false);` next to the
    existing `verifying` state declaration.
  - In `handleLogout`, set `setLoggingOut(true)` at the top, wrap the existing
    body in `try {...} finally { setLoggingOut(false); }` (mirrors
    `handleVerified`'s try/finally shape exactly).
  - Pass `loggingOut={loggingOut}` to the `<Profile ... />` call site.
- verify: `npm run build` passes; state resets even if the delete/signOut
  calls throw (finally block).
- done: `loggingOut` is true for the duration of `handleLogout`'s body.

### Task 2 — Profile.tsx: accept prop, restyle button, render spinner

- files: `src/screens/Profile.tsx`
- action:
  - Add `loggingOut?: boolean` to `ProfileProps`, destructure with default
    `false`.
  - On the Log out `<Button>`: remove `tone="danger"`, add
    `disabled={loggingOut}`.
  - Render children conditionally: when `loggingOut`, render the same inline
    spinner `<span>` markup used in `OtpVerification.tsx` (20x20,
    `border: 2.5px solid rgba(255,255,255,0.35)`, `borderTopColor: '#fff'`,
    `animation: 'bh-spin 0.8s linear infinite'`); otherwise render
    `t.logoutLabel` as today.
- verify: `npm run build` / `npm run lint` pass.
- done: Button is primary-red, shows a spinning ring instead of "Log out" /
  "ထွက်ရန်" while `loggingOut` is true, and is disabled during that time.

## Out of scope

- Changing what `handleLogout` actually does (FCM token cleanup, signOut,
  localStorage clears, navigation) — only the loading-state instrumentation
  around it.
- Any other danger-toned buttons elsewhere in the app.

## Must haves

- truths: Logout button is primary-toned; shows the bh-spin spinner and is
  disabled while `handleLogout`'s async body runs.
- artifacts: `src/App.tsx`, `src/screens/Profile.tsx`
