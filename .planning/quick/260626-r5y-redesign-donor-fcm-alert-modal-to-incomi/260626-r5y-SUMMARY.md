---
quick_id: 260626-r5y
title: Redesign donor FCM alert modal to "Incoming Request Alert"
status: complete
date: 2026-06-26
commits:
  - beb448b  # feat(home): redesign donor FCM alert to Incoming Request Alert modal
---

# Quick Task 260626-r5y — Summary

## What was done

Replaced the donor FCM alert (previously an inline bottom-sheet in Home.tsx)
with the Claude Design **"Incoming Request Alert"** — a centered, two-state
modal with a gated phone reveal.

### New component — `src/components/IncomingRequestAlert.tsx`
- Centered modal over scrim: pulsing 78px blood-type token, optional urgent
  pill + headline, a detail card (location / units / distance, each row hidden
  if its data is unavailable), a phone row, a helping-confirmation strip, and
  the action buttons.
- **Two states:** locked (default) → phone masked `09 •••• ••••` + "tap I'll
  help to see the number"; revealed (after "I'll help") → `formatPhone` number
  + Call button.
- "I'll help" calls `onHelp(requestId)` (records the response via the existing
  path, notifies requester) and flips to revealed **without closing**.
- Units / contact phone / coords are fetched by request id in a
  cancellation-guarded `useEffect` (RLS `active_requests_select` permits reading
  active requests); distance computed client-side via inline haversine from the
  donor's coords → `formatDistanceLabel`.
- Per-alert state reset comes from `key={requestId}` in Home (fresh mount), so
  the fetch effect has no synchronous in-effect `setState` (lint-clean).

### Animations — `src/index.css`
- Added `@keyframes bh-ring-pulse` (token ring) + `@keyframes bh-modal-in`
  (entrance) and `.bh-ring-pulse` / `.bh-modal-in` classes, with a
  `@media (prefers-reduced-motion: reduce)` override (accessibility floor).
  Named with the codebase's `bh-` hyphen convention (not the mockup's camelCase).

### Wiring — `src/screens/Home.tsx`
- Replaced the inline overlay with `<IncomingRequestAlert key=… alert lang
  donorLat donorLng onHelp={onRespond} onClose={onDismissFcmDonorAlert} />`.
  `Badge` import retained (still used by the request feed card).

## Privacy
- Requester phone is never rendered before `helped === true` — both the number
  text and the `tel:` link are inside the revealed branch (verified by the
  code-quality pass). Consistent with the Home feed's existing reveal-after-
  respond model. No GPS shown (only a coarse "~N km" estimate).

## Verification
- `npm run build` — clean (tsc + vite).
- `npm run lint` — new component is clean; the one remaining error
  (Home.tsx:289 setRequests in the feed effect) is pre-existing and untouched.
- `code-quality-refactor` agent: inlined a single-use font constant; flagged the
  empty-`tel:` edge case → **fixed** (disabled Call placeholder + "getting
  number…" text while the fetch is in flight).

## Deviations / follow-ups
- "Can't help right now" dismisses only — it does NOT write a `request_responses`
  row with status='declined'. Recording declines is inert until re-ping
  suppression exists; left as a follow-up.
- Type duplication: the 4-field donor-alert shape now exists in App.tsx,
  Home.tsx, and this component (structurally compatible). A future cleanup could
  export one shared type. [[reference]]
- Executed directly by the orchestrator (design is a DesignSync MCP resource;
  frontend-only, no migration).
