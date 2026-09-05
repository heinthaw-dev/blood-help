---
quick_id: 260906-fid
status: planned
mode: quick
---

# Quick Task 260906-fid: Lower PhoneEntry send-code threshold from 9 to 7 digits

## Problem

`PhoneEntry` disables the "Send code" CTA until the user has typed 9 digits
(`digits.length < 9`). Valid Myanmar numbers exist that are only 7 digits and
that do not begin with a `9` — e.g. `5417941`. Those users cannot sign in at all:
the CTA never enables, and there is no error message explaining why (this codebase
uses disabled-CTA as its only validation feedback).

## Decision

Minimum accepted length becomes **7 digits**. 6 or fewer stays disabled.
No constraint is added on the leading digit — a number need not start with `9`.

## Tasks

### Task 1 — Lower the guard

- files: `src/screens/PhoneEntry.tsx`
- action: Change `sendDisabled` from `digits.length < 9` to `digits.length < 7`.
  Extract the threshold to a named module constant (`MIN_PHONE_DIGITS`) so the
  rule is greppable and self-documenting, matching the file's existing
  SCREAMING_SNAKE_CASE constant convention (`OTP_LENGTH`, `RESEND_SECONDS`).
- verify: `npm run build` (tsc + vite) and `npm run lint` pass.
- done: A 7-digit entry enables the CTA; a 6-digit entry does not.

### Task 2 — Correct the now-false JSDoc

- files: `src/screens/PhoneEntry.tsx`
- action: The `onSend` prop doc claims "normalized 9–13 digit national number".
  The 9 floor is changing and the 13 ceiling was never actually enforced on
  digits (the `.slice(0, 13)` cap applies to the raw string, which may contain
  spaces). Restate the doc to describe what the code actually guarantees.
- verify: doc matches the constant.
- done: No stale numeric claim left in the file.

## Out of scope

- The `.slice(0, 13)` character-vs-digit cap mismatch (pre-existing, separate concern).
- The `9 7XX XXX XXX` placeholder, which still implies a leading 9.
- `src/format.ts` display formatters (`^\+95(9\d{9,10})$`) do not match short
  numbers and will fall through to `return e164`. Non-crashing, display-only.

## Must haves

- truths: CTA enables at exactly 7 digits; disabled at 6; no leading-digit rule.
- artifacts: `src/screens/PhoneEntry.tsx`
