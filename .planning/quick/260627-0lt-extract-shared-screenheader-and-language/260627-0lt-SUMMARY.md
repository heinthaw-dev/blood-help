---
quick_id: 260627-0lt
slug: extract-shared-screenheader-and-language
status: complete
date: 2026-06-27
resolves: ui-consistency-report.md §1 (ScreenHeader), §6 (LanguageToggle)
---

# Summary — Extract ScreenHeader + LanguageToggle

Behavior-preserving refactor. Replaced the ~6 bespoke per-screen header systems and the
language-toggle pill that was copy-pasted inline across 6 screens with two shared components,
and routed all 9 screens through them. No user-facing copy or callback behavior changed; only
standardized values to existing design tokens.

## What changed

### New components
- `src/components/LanguageToggle.tsx` — the မြန်မာ/ENG pill. Canonical padding `7px 12px`
  (Profile's drifted `7px 13px` is gone). `track?: 'surface' | 'bg'` preserves Profile's
  inset settings-card look.
- `src/components/ScreenHeader.tsx` — one header. `variant: 'brand' | 'nav'`, `title?`,
  `align?` (default `left`), `onBack?`, `right?`, `divider?`. One top padding `24px 20px 16px`,
  one nav-title size 18/600 (`var(--font-sans)` → Burmese renders Noto, Latin renders Inter,
  identical to the old per-lang fonts), one 40px back button.

### Screens routed (hand-written headers + inline toggles deleted)
| Screen | Header |
|---|---|
| PhoneEntry | brand/left + LanguageToggle |
| OtpVerification | nav, back + LanguageToggle (no title); also dropped now-unused `CSSProperties` import |
| IntentChoice | nav, LanguageToggle only (no back/title) |
| CreateRequest | nav, back + title + LanguageToggle + divider |
| DonorProfileSetup | nav, back + title + LanguageToggle + divider — title 15→18 fixes the 2-line wrap |
| Home | brand/left + bell |
| RequestLive | nav, back + title; back 36→40; progress subline + badge/township kept as content below header |
| Leaderboard | brand/left (was centered — intentional alignment standardization) |
| Profile | brand/left header (moved out of scroll); Settings toggle → `<LanguageToggle track="bg">` |

## Intentional standardizations (per report)
- Header top padding → `24px 20px 16px` everywhere.
- Nav titles → 18/600 (was 15/17/18).
- Back button → single 40px (RequestLive was 36).
- Brand wordmark → LEFT everywhere (Leaderboard/Profile were centered).
- Toggle padding → `7px 12px` (Profile was `7px 13px`).

## Verification
- `npm run build` (tsc -b && vite build): **exit 0, no type errors**, client bundle emitted.
- `npm run lint`: the 5 reported problems are **pre-existing baseline** (App.tsx `Date.now()` ×2,
  Home/RequestLive `setState`-in-effect, a GSD-tooling unused-disable) — none in the new components
  or changed header code. This refactor adds zero new lint problems.
- Manual visual check recommended via `npm run dev` (no Playwright per project convention).

## Follow-ups (not in scope)
Report §2–§5, §7 remain: `Card`, `PrimaryButton`, `CallButton`, `BloodTypeBadge`, type/spacing sweep.
