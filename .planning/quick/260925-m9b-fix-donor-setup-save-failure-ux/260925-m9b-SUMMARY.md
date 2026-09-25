---
id: 260925-m9b
slug: fix-donor-setup-save-failure-ux
mode: quick
date: 2026-09-25
status: complete
commit: dc43fe9
---

# Quick Task 260925-m9b: Fix donor-setup save failure UX — Summary

## What changed

**`src/App.tsx`**

- `writeError` state gained an optional `retry: () => void`.
- The screen branch chain moved into a `renderScreen()` closure. `App` now
  returns `<>{renderScreen()}{dialogs}</>`, so the write-error dialog and the
  push pre-permission dialog mount above every screen. The duplicated copies in
  the `home`, `profile` and `request-live` branches were deleted, and the three
  fragments that became single-child were unwrapped.
- The write-error dialog's confirm button re-runs `writeError.retry` when
  present. Without a retry it renders one Dismiss button instead of two.
- `handleSaveDonor` returns `Promise<boolean>` and is wrapped in `try/catch`.
- `handlePosted`'s insert is wrapped in `try/catch`; its generic-failure branch
  carries a retry, the duplicate-request branch deliberately does not.
- Write-failure `console.error` calls no longer sit behind `import.meta.env.DEV`.

**`src/screens/DonorProfileSetup.tsx`**

- `GeoPhase` gained a `"saving"` member; a `busy` flag covers `requesting` and
  `saving` for both the overlay and the CTA's disabled state.
- `onSave` is typed `(profile: DonorProfile) => Promise<boolean>` and awaited.
  The phase resets to `"idle"` only on failure — on success the screen unmounts
  with the overlay still up, so there is no interactive gap.
- New `saveLoading` string in both languages.

## Verification

- `npm run build` (tsc -b + vite build) — passes.
- `npm run lint` — 0 errors. The single warning is pre-existing, in GSD's own
  `.claude/get-shit-done/bin/lib/state.cjs`.
- Burmese copy diffed against `HEAD` to confirm no string was altered by the
  refactor.

## Behaviour notes

- The push pre-permission dialog now uses one message for the whole app: the
  broader Home variant ("donors respond **or blood is needed nearby**"). The
  narrower request-live variant was dropped. The only caller is `maybeAskPush`
  from `handlePosted`, so the broader copy is a superset of what it replaced.
- The global dialogs use `position: absolute` against a static `#root`, so on
  desktop (≥480px) they cover the window rather than the 390px phone frame.
  This matches what the home/profile dialogs already did — not a regression,
  and irrelevant on the mobile PWA target.

## Not done

- The underlying transport failure was not reproduced on-device. Supabase edge
  logs show no request at all for the failing attempt and `postgres_logs` has no
  errors, so the write died client-side — consistent with a mobile browser
  resuming from the native location prompt and losing the first request on a
  stale connection. This change makes that failure visible and retryable rather
  than preventing it. Proving it needs `/gsd:debug` with a device console.
- `CreateRequest` still has no screen-side saving state of its own; only the
  App-side handler was touched there.
