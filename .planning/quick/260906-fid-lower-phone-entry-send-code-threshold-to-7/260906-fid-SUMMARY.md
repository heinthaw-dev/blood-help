---
quick_id: 260906-fid
status: complete
---

# Quick Task 260906-fid — Summary

## What changed

`src/screens/PhoneEntry.tsx` only. The "Send code" CTA now enables at **7**
digits instead of 9, via a named constant:

```ts
const MIN_PHONE_DIGITS = 7;
const sendDisabled = digits.length < MIN_PHONE_DIGITS;
```

The stale `onSend` JSDoc ("normalized 9–13 digit national number") was corrected
— the 9 floor moved and the 13 ceiling was never enforced on digits in the first
place (the `.slice(0, 13)` cap counts characters, and spaces are allowed input).

No leading-digit constraint was added: numbers need not begin with `9`.

## Verification

- `npm run build` (tsc -b && vite build) — passed.
- `npm run lint` — 0 errors. One pre-existing warning in
  `.claude/get-shit-done/bin/lib/state.cjs`, unrelated to this change.
- Manual UAT still needed: type `5417941` → CTA enabled; delete one digit → disabled.

## Blast radius checked

Grepped for other places the 9-digit rule could be duplicated:

- `App.tsx` — `normalizePhone` just prepends `+95`; auth derives an email
  (`<digits>@bloodhelp.local`) and a password hash. No length validation. A
  7-digit sign-in authenticates normally.
- No Supabase-side length constraint on the phone column path.
- `src/format.ts` — **known display-only consequence.** Both `formatPhone` and
  `formatPhoneIntl` match `/^\+95(9\d{9,10})$/`, which a 7-digit number cannot
  satisfy. Their `if (!m) return e164` guard means no crash, but such a number
  renders raw (`+955417941`) rather than grouped (`09-XXX-XXX-XXX`) wherever a
  donor's contact number is displayed.

## Deferred (not in scope, flagged for the user)

1. `format.ts` grouping for short / non-9-leading numbers — cosmetic.
2. Placeholder still reads `9 7XX XXX XXX`, implying a leading 9.
3. `.slice(0, 13)` caps characters, not digits — with spaces typed, fewer than
   13 digits are accepted. Pre-existing.
