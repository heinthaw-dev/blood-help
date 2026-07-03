# Summary 260703-grn — clear pre-existing build/lint reds

**Date:** 2026-07-03
**Commit:** 34bf6d2

## What shipped

`npm run build` and `npm run lint` are green again. Five pre-existing issues fixed across
four files, all behavior-preserving, no lint suppression:

- PhoneEntry.tsx — removed dead `titleStyle` + commented `<h1>` (tsc noUnusedLocals).
- App.tsx — extracted `isoHoursFromNow` + `isWithinExtendWindow` module helpers (Date.now
  out of render scope; react-hooks/purity ×2).
- Home.tsx — moved the null-coords `setRequests([])` into async `loadFeed`
  (react-hooks/set-state-in-effect).
- RequestLive.tsx — replaced the prop→state sync effect with the adjust-during-render
  previous-prop-guard pattern (react-hooks/set-state-in-effect).

## Verification

- `tsc -b`: exit 0.
- `eslint .`: exit 0 — 0 errors, 1 warning (unused eslint-disable in vendored
  `.claude/get-shit-done/…/state.cjs`, not app code).
- `npm run build`: ✓ built, PWA generated.

## Notes

- The `.claude/` warning is in GSD framework tooling; left untouched (warning, exits 0). Fix
  with `eslint --fix` or by ignoring `.claude` in eslint config if a zero-warning lint is wanted.
- Bundle >500 kB chunk-size advisory remains (pre-existing perf note, not an error).
