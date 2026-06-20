---
status: partial
phase: 06-foundation
source: [06-VERIFICATION.md]
started: 2026-06-21T00:00:00Z
updated: 2026-06-21T00:00:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. Anonymous session creation — live Supabase Auth check

**Steps:** Load the app in a browser (`npm run dev`), open Supabase dashboard > Authentication > Users, observe the Users list before and after the first load.
expected: A new anonymous user row appears in the Supabase Auth Users list within seconds of the app loading — confirming `signInAnonymously()` is firing against the real project credentials in `.env.local`
result: [pending]

### 2. Session restore on reload — no session duplication

**Steps:** Load the app, let `initAuth` run (observe console), reload the page, observe Supabase Auth dashboard.
expected: No second anonymous user is created on reload — the existing session is detected by `getSession()` and reused; the user remains on the same session UUID
result: [pending]

### 3. CR-02 QR viewport bug — code bypass via dark area tap

**Steps:** On the RequestLive screen, open the code sub-sheet. Without entering any 5-character code, tap/click the dark QR scanner viewport area.
expected: Nothing should happen — but the current code calls `handleConfirmInApp` unconditionally on that button click, bypassing the `confirmReady` guard
result: [pending]

### 4. CR-03 async handleVerified — unhandled rejection on network failure

**Steps:** Disable network (DevTools > Network > Offline), complete OTP entry on the OTP screen, observe app behavior when `handleVerified` fires and the Supabase profiles query fails.
expected: App should fall back gracefully (e.g., route to 'intent' with an error log), not freeze or throw an unhandled Promise rejection
result: [pending]

## Summary

total: 4
passed: 0
issues: 0
pending: 4
skipped: 0
blocked: 0

## Gaps
