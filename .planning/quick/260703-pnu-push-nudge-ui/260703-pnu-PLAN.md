# Quick Task 260703-pnu — PushNudge UI

**Date:** 2026-07-03
**Type:** Feature (iOS PWA onboarding, phase 3 — the UI)
**Status:** Complete
**Follows:** 260702-ipw (detection lib), 260703-pia (action layer)

## Why

Surface the ONE next step a visitor needs to receive alerts, driven by
`usePwaState()`, using the enable/install actions from lib/push. Composed from the
shared Card + Button so it looks identical to the rest of the app.

## Scope

Create `src/components/PushNudge.tsx`. Props: `{ lang, supabaseId, style? }`.
Reads `usePwaState()`, renders per `state`:

| state | render |
|-------|--------|
| `ios-add-to-home` | Share → "Add to Home Screen" guidance + down-arrow to Safari's Share button. No button (iOS has no install API). |
| `ios-open-in-safari` | "Open in Safari" + secondary **Copy link** button (`navigator.clipboard`, → "Copied"). |
| `ios-enable-push` | Red **Enable alerts** button → `enablePush(supabaseId)`. |
| `android-install` | Red **Install** button → `promptAndroidInstall()`. |
| `granted` / `hidden` | `return null`. |

On success (enable `granted` / install `accepted`) → green "Alerts are on" card.

## Design decisions

- **Design skill loaded** (frontend-design). Tokens only (18 confirmed in index.css),
  Card + Button reused, no parallel primitives. Copy mirrors DonorThankYou wording
  (`enabledLabel` = "Alerts are on" verbatim) for app-wide consistency.
- **Burmese primary = lang-driven** (`t[lang]`, Burmese default) — matches every other
  screen, not stacked dual-language. Flagged for confirmation.
- **Local `succeeded` flag** shows the confirmation instantly (Notification.permission
  has no change event, so usePwaState won't re-derive `granted` until next focus).
- **Enable button disabled when `!supabaseId`** — no token target = dead prompt; install
  needs no id so it stays enabled.
- **One loud red action per state:** enable/install are primary red; copy-link is secondary.
  Never expose system terms — "alerts", not "push/FCM".

## Out of scope (later)

- Wiring `<PushNudge>` into Home/Profile (needs the main.tsx `import './lib/pwa'` too —
  carried from 260702-ipw).
- Refactoring DonorThankYou's hand-rolled opt-in block onto PushNudge (dedupe opportunity).

## Verification

- `tsc -b`: PushNudge clean (only pre-existing PhoneEntry.tsx:53 error remains).
- `eslint src/components/PushNudge.tsx`: clean.
- Manual device testing pending (real iOS Safari + Android Chrome).
