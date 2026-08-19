---
phase: quick-260627-8gf
plan: 01
type: summary
status: complete
requirements: [QUICK-8gf]
files_modified:
  - src/screens/DonorThankYou.tsx
  - src/screens/Profile.tsx
  - src/screens/Home.tsx
---

# Summary — Remove leaking English secondary translation lines

## Outcome

Three screens now render **only the active language**. Previously each carried a
secondary "translation" line (the *other* language) under its primary copy, so
Burmese mode always painted an English echo — violating the Burmese-first
constraint. Removed the secondary JSX and their now-dead backing fields.

## Changes

### `src/screens/DonorThankYou.tsx`
- Removed secondary lines under headline, subheadline, body, CTA.
- Deleted fields `headlineSub`, `subheadlineSub`, `bodySub`, `ctaSub` from both `my`/`en`.
- Deleted the now-unused `altFont` variable (would have tripped `noUnusedLocals`).

### `src/screens/Profile.tsx`
- Removed five `…En` guarded blocks (donation count, last donation, cooldown,
  QR caption, emergency help) and the donor-nudge subtitle.
- Deleted fields `donatedLineEn`, `lastLineEn`, `cooldownLineEn`, `qrCaptionEn`,
  `emergencyHelpEn`, `nudgeSub` from both `my`/`en`.
- Left `editSub` untouched (legitimate single-language subtitle, not a leak).

### `src/screens/Home.tsx`
- `availOn`/`availOff` in `my` changed from `'Available to donate · …'` to
  Burmese-only (`'အသင့်ရှိသည်'` / `'မရရှိနိုင်ပါ'`).
- Removed setup-nudge, active-request, and activity secondary lines, plus the
  `lang === 'my'` feed sub-label.
- Empty-state hint now renders `emptySub` (Burmese in `my`, English in `en`)
  instead of the always-English `emptyHint`.
- Deleted fields `setupSub`, `activeSub`, `activitySub`, `feedSub`, `emptyHint`
  from both `my`/`en`.

## Verification

- Plan greps return 0 for all removed fields. (DonorThankYou grep returns 1, but
  that single hit is the harmless `{/* Subheadline */}` JSX section comment — no
  `Sub` field or `altFont` remains.)
- `npm run build` (`tsc -b && vite build`) — **passes**. The `tsc -b` step is the
  real gate here: any field/JSX/variable left dangling after removal would fail
  `noUnusedLocals`/`noUnusedParameters`. Clean.
- `npm run lint` — 4 errors + 1 warning, **all pre-existing** and confirmed by
  re-linting the clean tree (stash-and-lint produced the identical 5 problems).
  They are `react-hooks/set-state-in-effect` findings in `App.tsx`,
  `Home.tsx` (line 284 feed effect), and `RequestLive.tsx` — untouched by this
  change and out of scope.

## Manual check (no automated browser test per project convention)
- Burmese mode on Home / Profile / Donor Thank You → no English under any label.
- English mode → English primary copy still renders on all three screens.
