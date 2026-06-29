---
gsd_summary_version: 1.0
quick_id: 260629-pjl
slug: fix-logout-button-vertically-squashed-on
title: Fix logout button vertically squashed on Profile screen
date: 2026-06-29
status: complete
commit: f378859
---

# Quick Task 260629-pjl — Summary

## What changed

`src/components/Button.tsx` — added `flexShrink: 0` to the shared `base`
`CSSProperties` object.

## Why

The "Log out" button on the Profile screen rendered far shorter than its
intended 54px. It is the last child of the scrolling flex column `.bh-scroll`
(`display: flex; flex-direction: column`) in `src/screens/Profile.tsx`. The
Button declared `height: 54px` but no `flex-shrink`, inheriting the default
`flex-shrink: 1`. In a column flex container `height` acts as `flex-basis`, so
when the children's combined height exceeded the container the flex algorithm
shrank the most-shrinkable item — the button, whose `min-content` height (one
short text line, `line-height: 1`) is tiny — collapsing it well below 54px.
`overflow-y: auto` did not help because flex sizes items to fit before overflow
is considered. Pinning `flex-shrink: 0` keeps the declared height and lets the
column scroll instead.

## Scope decision

Fixed at the shared component (`Button.base`) rather than the single Profile
call site. `flex-shrink` only affects flex items, so it is a no-op in the
sticky-footer / non-flex contexts where Button is used elsewhere — this fixes
the Profile case and immunizes all current and future screens without altering
any working layout.

## Verification

- `tsc -b` reports the Button change as type-clean (`flexShrink` is a valid
  `CSSProperties` field). The only `npm run build` error is a **pre-existing,
  unrelated** `TS6133 'titleStyle' is declared but its value is never read` in
  `src/screens/PhoneEntry.tsx` (part of separate uncommitted in-progress work,
  not touched by this task).
- Visual confirmation of the rendered button height was not run here: the
  configured `chrome-devtools` MCP server is not loaded in this session, so live
  DOM inspection was unavailable.

## Follow-ups

- Pre-existing build break: unused `titleStyle` in `src/screens/PhoneEntry.tsx:53`
  (owner's in-progress edits) — resolve separately to get a green `npm run build`.
- Optional: load the `chrome-devtools` MCP (restart Claude Code) and confirm the
  computed height of the logout button is 54px.

## Commit

- `f378859` — fix: pin Button height with flex-shrink:0 so logout CTA isn't squashed
