---
gsd_plan_version: 1.0
quick_id: 260629-pjl
slug: fix-logout-button-vertically-squashed-on
title: Fix logout button vertically squashed on Profile screen
date: 2026-06-29
mode: quick
---

# Quick Task 260629-pjl: Fix logout button vertically squashed on Profile screen

## Problem

On the Profile screen, the "Log out" (ထွက်ရန်) button renders much shorter than
its intended 54px height — it looks like a thin pill instead of a full CTA.

**Root cause (flexbox shrink):** The logout `<Button>` is the last child of the
scrolling flex column `.bh-scroll` (`display: flex; flex-direction: column`) in
`src/screens/Profile.tsx`. The Button sets an inline `height: 54px`
(`src/components/Button.tsx` `base` styles) but never sets `flex-shrink`, so it
inherits the default `flex-shrink: 1`. In a column flex container, `height` acts
as the item's `flex-basis`; when the combined height of all children exceeds the
container, the flex algorithm distributes the negative space by shrinking
shrinkable items. The button has the smallest `min-content` height (one short
text line, `line-height: 1`), so its `min-height: auto` floor is tiny and it
absorbs almost all of the shrinkage — collapsing well below 54px. `overflow-y:
auto` does not save it: flex sizes items to fit the container before overflow is
considered, so the item is silently squashed instead of producing a scrollbar.

## Fix

Add `flexShrink: 0` to the shared `base` `CSSProperties` object in
`src/components/Button.tsx`. This pins every Button at its declared height inside
flex columns and lets the container scroll instead of compressing the CTA.
`flex-shrink` only affects flex items, so this is a no-op in the sticky-footer /
non-flex contexts where Button is used elsewhere — it immunizes all screens
against this class of bug without changing any existing layout.

## Tasks

### Task 1 — Pin Button height against flex shrink

- **files:** `src/components/Button.tsx`
- **action:** In the `base: CSSProperties` object, add `flexShrink: 0` (placed
  next to `height` so the intent is co-located).
- **verify:** `npm run build` (tsc + vite) passes; logout button on Profile
  renders at full 54px height; other screens' CTAs unchanged.
- **done:** Button keeps its height inside the Profile scroll column; the column
  scrolls when content overflows instead of squashing the button.

## Notes

- Behavior-preserving everywhere except the squashed-button case being fixed.
- No new dependencies, no API changes, no token changes.
