---
id: 260925-m9b
slug: fix-donor-setup-save-failure-ux
mode: quick
date: 2026-09-25
status: complete
commit: dc43fe9
follow_up_commits: [fedd22d, a856908]
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

## Follow-up quality pass (fedd22d, a856908)

Ran the `code-quality-refactor` agent over the diff, then extended its findings.

**fedd22d — shared payload + log hygiene**

- `genericWriteError(lang, retry)` replaces the identical dialog-payload literal
  that `handleSaveDonor` and `handlePosted` each built inline.
- `describeThrown(err)` normalises what the two new catch blocks log. They were
  printing the raw thrown value, breaking this file's convention of logging only
  `error.message` — PostgREST puts the offending row value in `details`, and
  these logs now ship in the production PWA build. The error *name* is kept:
  `"Load failed"` alone does not say which layer died.
- `DonorProfileSetup` guards the awaited `onSave` with try/catch. `Promise<boolean>`
  does not forbid rejection, and a rejection would strand the saving overlay with
  no dialog and no enabled CTA. Dead code today.

**a856908 — full convergence**

- `genericWriteError`'s `retry` is now optional. All eight `setWriteError` sites
  go through it except the duplicate-request branch, whose copy differs.
- Retry added where re-running the same call is safe and sufficient:
  `handleVerified` (both auth-failure paths), `handleRespond`, `handleExtend`.
- Retry deliberately withheld from `handleResolveClosed` — its returned boolean
  drives RequestLive's navigation home, which a dialog-driven re-run cannot
  reproduce. Single dismiss button; the user retries from the screen's own button.
- `handleExtend` is safe to retry because its rollback restores the original
  expiry first, so a re-run recomputes +12h from the same base, not compounding.
- Logging rule made uniform: `console.error` is never DEV-guarded, `console.log`
  chatter stays DEV-only. Unguards the hydrate-user, verify-time profile create,
  availability and emergency-callable failures, plus the two FCM notify warnings.
- The two brace-less `if (error) if (DEV) ...` statements now have braces.
- `handleVerified` gained an explicit `Promise<void>` return type — it now
  references itself in a retry closure, which would otherwise be circular.

## Not done

- The underlying transport failure was not reproduced on-device. Supabase edge
  logs show no request at all for the failing attempt and `postgres_logs` has no
  errors, so the write died client-side — consistent with a mobile browser
  resuming from the native location prompt and losing the first request on a
  stale connection. This change makes that failure visible and retryable rather
  than preventing it. Proving it needs `/gsd:debug` with a device console.
- `CreateRequest` still has no screen-side saving state of its own; only the
  App-side handler was touched there.
- `handleAvailableChange` and `handleEmergencyChange` still swallow write
  failures: they flip local state optimistically, never roll back, and never
  raise the dialog. They now log unconditionally, so the failure is at least
  visible in a device console — but a donor can still believe they are marked
  unavailable while the DB says otherwise. Needs its own decision (roll back?
  dialog? both?), so it was left out rather than folded into a quality pass.
