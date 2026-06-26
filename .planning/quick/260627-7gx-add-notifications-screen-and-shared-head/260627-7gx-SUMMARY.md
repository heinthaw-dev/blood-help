---
quick_id: 260627-7gx
slug: add-notifications-screen-and-shared-head
status: complete
date: 2026-06-27
builds_on: 260627-0lt (ScreenHeader + LanguageToggle)
---

# Summary — Notifications screen + shared header bell

The notification bell now appears on all three tab screens (Home, Leaderboard, Profile) and
opens a new Notifications screen showing a calm centered empty state.

## What changed

### New files
- `src/components/NotificationBell.tsx` — reusable tappable bell button (ScreenHeader `right` slot).
  Keeps the bell from being re-inlined three times.
- `src/screens/Notifications.tsx` — full screen using the shared `ScreenHeader` (nav variant) +
  a centered muted empty line. Bilingual:
  - my: title "သတိပေးချက်များ", empty "လောလောဆယ် သတိပေးချက် မရှိသေးပါ။"
  - en: title "Notifications", empty "There are no notifications for now."
  No BottomNav — the back button returns to the originating tab.

### Navigation (`src/App.tsx`)
- `'notifications'` added to the Screen union.
- `notificationsReturn` state remembers which tab opened it; `handleOpenNotifications` records the
  current `screen` then navigates. Back returns there.
- Render branch + `onOpenNotifications` threaded to Home, Leaderboard, Profile.

### Tab screens
- Home: inline bell SVG → `<NotificationBell onClick={onOpenNotifications} />`.
- Leaderboard + Profile: `right={<NotificationBell …/>}` added to their brand/left `ScreenHeader`.
- All three gained an `onOpenNotifications: () => void` prop.

## Verification
- `npm run build`: **exit 0, no type errors**, bundle emitted.
- `npm run lint`: **5 problems — unchanged pre-existing baseline** (App.tsx Date.now ×2, Home/RequestLive
  setState-in-effect, state.cjs unused-disable). Zero new problems in the new/changed files.
- Manual check (recommended via `npm run dev`): bell visible on all 3 tabs → tap → empty Notifications
  screen → back returns to the originating tab. Both languages.

## Commits
- `feat(ui): add Notifications screen + NotificationBell component`
- `feat(home/leaderboard/profile): wire header bell → notifications screen`
