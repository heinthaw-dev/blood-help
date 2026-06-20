# Roadmap: Blood Help — UI Milestone

## Overview

This milestone completes the full UI layer for Blood Help. Nine screens remain: two celebration/confirmation screens to close the emotional loop after donor registration and donation, a home dashboard that gives donors a feed of nearby requests, the requester's live request session with a resolve flow, a QR/code confirmation screen, and refreshes of the existing Profile and CreateRequest screens to match new Claude Design prompts. Every phase is React + Tailwind v4, UI-only — no backend wiring. When this milestone ships, every user flow has a screen.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Celebration Screens** - Thank-you and congrats screens close the emotional loop after donor registration and donation confirmation
- [ ] **Phase 2: Home Dashboard** - Donors see a feed of nearby blood requests with bottom navigation
- [ ] **Phase 3: Request Session** - Requesters see their live request screen and can resolve/close the request
- [ ] **Phase 4: Confirmation Flow** - Requester confirms donation via QR scan or 5-char code entry
- [ ] **Phase 5: Screen Refreshes** - Profile and CreateRequest screens updated to match new Claude Design prompts

## Phase Details

### Phase 1: Celebration Screens
**Goal**: Users see emotionally resonant confirmation screens after completing donor registration and after a donation is confirmed
**Mode:** mvp
**Depends on**: Nothing (first phase)
**Requirements**: CELE-01, CELE-02
**Success Criteria** (what must be TRUE):
  1. After completing donor registration, user lands on a heart-warming thank-you screen (not a blank state or generic success toast)
  2. After donation is confirmed, donor sees a distinct congratulations celebration screen
  3. Both screens render correctly in English and Burmese
  4. Both screens are reachable from App.tsx screen routing
**Plans**: TBD
**UI hint**: yes

### Phase 2: Home Dashboard
**Goal**: Donors can view a home/dashboard screen with a feed of nearby blood requests and navigate the app via bottom navigation
**Mode:** mvp
**Depends on**: Phase 1
**Requirements**: HOME-01, HOME-02
**Success Criteria** (what must be TRUE):
  1. User sees a Home screen with a visible feed of blood request cards (static/placeholder data)
  2. Each request card displays blood type, location/township, and urgency indicators
  3. Bottom navigation bar (Profile, Home, Leaderboard) is present and switches between screens correctly
  4. Home screen renders correctly in English and Burmese
**Plans**: TBD
**UI hint**: yes

### Phase 3: Request Session
**Goal**: Requesters can view their live request session screen and close/resolve a request with an outcome choice
**Mode:** mvp
**Depends on**: Phase 2
**Requirements**: SESS-01, SESS-02
**Success Criteria** (what must be TRUE):
  1. Requester sees a request-live screen showing blood type, township header, and transparency line ("We've alerted X nearby donors")
  2. Donor list layout is visible with Will Help / Can Call / +N more state placeholders
  3. Requester can tap a close/resolve action that presents "Did you get blood from the app or outside?" choice
  4. Both resolution paths (app / outside) lead to a distinct outcome screen or state
  5. All text on the request session and resolve flow renders in English and Burmese
**Plans**: TBD
**UI hint**: yes

### Phase 4: Confirmation Flow
**Goal**: Requesters can confirm a donation by scanning a donor's QR code or typing a 5-character code
**Mode:** mvp
**Depends on**: Phase 3
**Requirements**: CONF-01
**Success Criteria** (what must be TRUE):
  1. Requester sees a confirmation screen with a QR scan option and a manual 5-char code entry field
  2. Entering a valid 5-char code advances to the next screen (no real validation required — static flow)
  3. Screen renders correctly in English and Burmese
**Plans**: TBD
**UI hint**: yes

### Phase 5: Screen Refreshes
**Goal**: Existing Profile and CreateRequest screens are updated to match the new Claude Design prompts
**Mode:** mvp
**Depends on**: Phase 4
**Requirements**: UPDT-01, UPDT-02
**Success Criteria** (what must be TRUE):
  1. Profile screen visually matches the new Claude Design prompt provided by the user
  2. CreateRequest screen visually matches the new Claude Design prompt provided by the user
  3. Both refreshed screens retain English/Burmese bilingual support
  4. No regressions in existing shared components (BottomNav, BloodTypeSelector, etc.)
**Plans**: TBD
**UI hint**: yes

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Celebration Screens | 0/TBD | Not started | - |
| 2. Home Dashboard | 0/TBD | Not started | - |
| 3. Request Session | 0/TBD | Not started | - |
| 4. Confirmation Flow | 0/TBD | Not started | - |
| 5. Screen Refreshes | 0/TBD | Not started | - |
