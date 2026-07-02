# Summary 260703-pnu — PushNudge UI

**Date:** 2026-07-03
**Commit:** a9787ba

## What shipped

`src/components/PushNudge.tsx` — a self-hiding onboarding card driven by
`usePwaState()`, composed from Card + Button, Burmese-first.

- Renders the single next step per `state`: iOS add-to-home guidance (Share + down
  arrow, no button), iOS open-in-Safari (+ copy-link), iOS enable-push (red button →
  `enablePush`), Android install (red button → `promptAndroidInstall`).
- `granted`/`hidden` → renders nothing.
- Green "Alerts are on" confirmation on success (local `succeeded` flag for instant feedback).
- Tokens only; copy reuses DonorThankYou wording for consistency; no system jargon.

## Decisions

- "Burmese primary" implemented as the app-standard lang-driven pattern (Burmese default),
  not stacked dual-language. **Confirm if stacked was intended.**
- Enable button disabled when `!supabaseId`; install stays enabled (needs no id).
- Kept the Android "Alerts are on" success copy per spec, though install ≠ push-enabled on
  Android — **flagged**: may want distinct install-success vs alerts-on copy later.

## Verification

- `tsc -b`: PushNudge clean.
- `eslint`: clean.

## Follow-ups

1. Wire `<PushNudge lang={lang} supabaseId={user.supabaseId} />` into Home (and/or Profile),
   plus the still-pending `import './lib/pwa'` in main.tsx (from 260702-ipw) for Android capture.
2. Opportunity: retire DonorThankYou's hand-rolled opt-in block in favor of PushNudge.
3. Pre-existing repo reds (separate): PhoneEntry.tsx:53 (tsc), App.tsx:532/857 Date.now (eslint).
