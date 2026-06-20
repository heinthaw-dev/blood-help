<!-- refreshed: 2026-06-20 -->
# Architecture

**Analysis Date:** 2026-06-20

## System Overview

```text
┌─────────────────────────────────────────────────────────────┐
│                     Browser / PWA Shell                      │
│  `index.html` → `src/main.tsx`                               │
└────────────────────────────┬────────────────────────────────┘
                             │ mounts
                             ▼
┌─────────────────────────────────────────────────────────────┐
│                     App.tsx — Router + State                 │
│  Holds: screen, lang, phone, user (UserState)                │
│  Controls: which screen renders, all inter-screen callbacks  │
└──────┬──────────────┬──────────────┬───────────────┬────────┘
       │              │              │               │
       ▼              ▼              ▼               ▼
┌──────────┐  ┌─────────────┐  ┌──────────┐  ┌──────────────┐
│ Auth     │  │ Onboarding  │  │ Donor    │  │ Logged-in    │
│ Screens  │  │ Screen      │  │ Setup    │  │ Screens      │
│PhoneEntry│  │IntentChoice │  │Donor     │  │Profile       │
│OtpVerif. │  │             │  │ProfileSet│  │Leaderboard   │
│`screens/`│  │`screens/`   │  │up        │  │`screens/`    │
└──────────┘  └─────────────┘  └──────────┘  └──────────────┘
       │              │              │               │
       └──────────────┴──────────────┴───────────────┘
                             │ use shared
                             ▼
┌─────────────────────────────────────────────────────────────┐
│                    Shared Components                         │
│  `src/components/`                                           │
│  Button · Input · Switch · Badge · BottomNav                 │
│  BloodTypeSelector · AlertDialog                             │
└─────────────────────────────────────────────────────────────┘
                             │ use domain modules
                             ▼
┌─────────────────────────────────────────────────────────────┐
│                    Domain / Utility Layer                    │
│  `src/blood.ts`  — BloodType enum + BLOOD_TYPES constant     │
│  `src/i18n.ts`   — Lang type + formatNumber()                │
│  `src/auth.ts`   — localStorage-based returning-user check   │
│  `src/geolocation.ts` — getCurrentPosition() wrapper         │
└─────────────────────────────────────────────────────────────┘
                             │ state stored in
                             ▼
┌─────────────────────────────────────────────────────────────┐
│  Browser localStorage  (auth.ts: `bloodhelp.seenPhones`)    │
│  In-memory React state (`App.tsx` useState)                  │
└─────────────────────────────────────────────────────────────┘
```

## Component Responsibilities

| Component | Responsibility | File |
|-----------|----------------|------|
| `App` | Screen router, global state (lang, phone, user), all inter-screen callbacks | `src/App.tsx` |
| `PhoneEntry` | Phone number capture, country code prefix, "Send code" CTA | `src/screens/PhoneEntry.tsx` |
| `OtpVerification` | 6-box OTP input, dummy auto-fill, resend countdown | `src/screens/OtpVerification.tsx` |
| `IntentChoice` | First-time intent picker ("need blood" vs "donate") | `src/screens/IntentChoice.tsx` |
| `CreateRequest` | Blood request form, geolocation gate, AlertDialog for permission | `src/screens/CreateRequest.tsx` |
| `DonorProfileSetup` | Donor profile form (name, blood type, phone, toggles) | `src/screens/DonorProfileSetup.tsx` |
| `Profile` | Logged-in home: stats, settings (availability, show number, lang, edit, logout) | `src/screens/Profile.tsx` |
| `Leaderboard` | Top-donors list, personalised "You" row with dummy static data | `src/screens/Leaderboard.tsx` |
| `BottomNav` | Three-tab navigation (Home · Leaderboard · Profile), bilingual labels | `src/components/BottomNav.tsx` |
| `Button` | Primary/secondary CTA with hover/press states and disabled opacity | `src/components/Button.tsx` |
| `Input` | Text input with optional leading prefix chip and red focus ring | `src/components/Input.tsx` |
| `Switch` | Accessible toggle switch (48×28, primary red when on) | `src/components/Switch.tsx` |
| `Badge` | Pill label — primary (blood-type), success, neutral variants | `src/components/Badge.tsx` |
| `BloodTypeSelector` | 4-column grid of 8 blood-type chips, single-select | `src/components/BloodTypeSelector.tsx` |
| `AlertDialog` | Centered modal over scrim, used for pre-permission warnings | `src/components/AlertDialog.tsx` |

## Pattern Overview

**Overall:** Flat screen-stack managed by a single top-level state machine in `App.tsx`. No routing library; `screen` is a discriminated union string.

**Key Characteristics:**
- All navigation state (`screen: Screen`) and shared user data (`user: UserState`, `lang: Lang`, `phone: string`) live in `App.tsx` — screens are pure presentational components receiving props and callbacks
- Screens communicate upward via callback props (`onPosted`, `onSave`, `onVerified`, `onNavigate`); `App.tsx` decides what to render next
- No global context, no Redux, no router — intentionally minimal for prototype phase
- Language (`lang: Lang`) is `'my'` (Burmese) by default; every screen receives `lang` and `onLangChange` and renders inline copy from a local `strings`/`t` object
- Inline `CSSProperties` objects are the primary styling mechanism; Tailwind utility classes are used only for the outer layout containers (`.phone-entry-stage`, `.phone-entry-card`)

## Layers

**Domain / Utility Layer:**
- Purpose: Shared types, constants, and stateless helper functions
- Location: `src/blood.ts`, `src/i18n.ts`, `src/auth.ts`, `src/geolocation.ts`
- Contains: `BloodType` union type, `BLOOD_TYPES` constant, `Lang` type, `formatNumber()`, `hasLoggedInBefore()`, `markLoggedIn()`, `getCurrentPosition()`
- Depends on: Browser APIs only (`localStorage`, `navigator.geolocation`)
- Used by: Screens, components

**Shared Component Library:**
- Purpose: Reusable UI primitives matching the Blood Help design system
- Location: `src/components/`
- Contains: `Button`, `Input`, `Switch`, `Badge`, `BottomNav`, `BloodTypeSelector`, `AlertDialog`
- Depends on: CSS custom properties from `src/index.css`, domain types (`BloodType`, `Lang`)
- Used by: Screens

**Screen Layer:**
- Purpose: Full-screen views, each managing its own local form/UI state
- Location: `src/screens/`
- Contains: Seven screens matching Claude Design HTML mockups
- Depends on: Shared components, domain utilities, types exported from sibling screens
- Used by: `App.tsx`

**App Shell:**
- Purpose: Screen router, global state owner, entry point
- Location: `src/App.tsx`, `src/main.tsx`
- Contains: `Screen` type union, `UserState` interface, `DEFAULT_USER`, all transition handlers
- Depends on: All screens, `BottomNav` (via type), domain utilities

## Data Flow

### Primary Auth Flow (New User)

1. Mount → `screen = 'phone'` — `PhoneEntry` renders (`src/screens/PhoneEntry.tsx`)
2. User taps "Send code" → `onSend(digits)` → `App` sets `phone = digits`, `screen = 'otp'`
3. `OtpVerification` auto-fills a random code after 3s; user taps Verify → `onVerified(code)` (`src/screens/OtpVerification.tsx:146`)
4. `App.handleVerified()` calls `hasLoggedInBefore(phone)` (`src/auth.ts`) → first-time: `screen = 'intent'`, returning: `screen = 'profile'`
5. `markLoggedIn(phone)` writes to `localStorage['bloodhelp.seenPhones']` (`src/auth.ts:29`)

### Donor Setup Flow

1. User on `IntentChoice` picks "donate" → `onChoose('donate')` → `App` sets `screen = 'donor-setup'`
2. `DonorProfileSetup` collects name, blood type, phone, toggles → `onSave(profile)` (`src/screens/DonorProfileSetup.tsx:287`)
3. `App.handleSaveDonor()` merges profile into in-memory `user` state → `screen = 'profile'`
4. Supabase persistence is **not yet implemented** — `console.log('donor profile saved (dummy)', profile)` at `src/App.tsx:76`

### Blood Request Flow

1. User on `Profile` taps "Create Request" (or from IntentChoice → 'need') → `screen = 'create-request'`
2. `CreateRequest` collects blood type, phone, units, urgency → "Post request" triggers geolocation gate
3. `AlertDialog` warns user before the native permission prompt → user confirms → `getCurrentPosition()` (`src/geolocation.ts`)
4. On grant: `onPosted(draft)` where `draft` includes `lat`/`lng` → `App.handlePosted()` logs and goes to `screen = 'profile'`
5. Supabase fan-out push is **not yet implemented** — `console.log('request posted (dummy)', draft)` at `src/App.tsx:69`

### Navigation (Logged-In)

1. `BottomNav` emits `onNavigate(tab)` → `App.handleNavigate()` maps tab to screen
2. Home tab is a **future phase** (no screen exists) — Profile and Leaderboard are wired

**State Management:**
- `lang: Lang` — lifted to `App`, passed down to every screen; mutated via `setLang`
- `screen: Screen` — `App`-owned string, drives which screen renders
- `user: UserState` — `App`-owned object, updated by `handleSaveDonor` and toggle change handlers
- `phone: string` — `App`-owned, set on OTP send, passed as `defaultPhone` to forms
- No persistent state after auth except `localStorage['bloodhelp.seenPhones']`

## Key Abstractions

**`Screen` Union Type:**
- Purpose: Type-safe screen routing; acts as the navigation state machine
- Examples: `'phone' | 'otp' | 'intent' | 'profile' | 'leaderboard' | 'create-request' | 'donor-setup'`
- Pattern: Defined in `src/App.tsx:17`; `if (screen === '...')` guard chain with last branch as the default (`PhoneEntry`)

**`Lang` Type:**
- Purpose: Bilingual switching across all screens
- Examples: `src/i18n.ts:2` — `'my' | 'en'`
- Pattern: Every screen holds a local `strings` or `t` object keyed by `Lang`; `formatNumber(n, lang)` renders Burmese numerals for `lang === 'my'`

**`UserState` Interface:**
- Purpose: In-memory logged-in user representation before Supabase lands
- Examples: `src/App.tsx:27`
- Pattern: Initialized as `DEFAULT_USER`, merged with `DonorProfile` on save, passed as individual props to `Profile` and `Leaderboard`

**`RequestDraft` Interface:**
- Purpose: Blood request payload (blood type + contact + units + urgency + lat/lng)
- Examples: `src/screens/CreateRequest.tsx:14`
- Pattern: Built inside `CreateRequest` only after geolocation grant, passed to `onPosted` callback

**Design Token CSS Variables:**
- Purpose: Single source of truth for colors, radii, shadows, fonts
- Examples: `--color-primary`, `--radius-card`, `--font-burmese`, `--shadow-cta`
- Pattern: Defined in `src/index.css` `@theme` block (Tailwind v4); aliased in `:root` for raw `var()` references from ported screens

## Entry Points

**App Bootstrap:**
- Location: `src/main.tsx`
- Triggers: Vite loads `index.html` → `<script src="/src/main.tsx">` → `createRoot(document.getElementById('root')).render(<App />)`
- Responsibilities: Strict mode wrapping, React DOM mount

**App Router:**
- Location: `src/App.tsx`
- Triggers: Renders on every state change
- Responsibilities: Determines which screen to render via `screen` state; owns all cross-screen data

## Architectural Constraints

- **No router library:** Navigation is a single `useState<Screen>` in `App.tsx`. URL does not change between screens — there are no deep-linkable URLs.
- **Global state pattern:** All cross-screen state (`lang`, `screen`, `user`, `phone`) lives in `App.tsx` via `useState`. No context providers, no stores.
- **Dummy auth:** `src/auth.ts` uses `localStorage` only. No Supabase session yet. The OTP flow accepts any code without server verification.
- **Dummy persistence:** `handleSaveDonor` and `handlePosted` in `src/App.tsx` only update in-memory state and log to console. Data is lost on page refresh.
- **Inline styles dominant:** Components use `CSSProperties` objects, not Tailwind utility classes, because they are ported verbatim from Claude Design HTML. Tailwind classes appear only in the two layout containers (`.phone-entry-stage`, `.phone-entry-card` in `src/index.css`).
- **No service worker:** `vite.config.ts` uses plain `@vitejs/plugin-react` + `@tailwindcss/vite` — no `vite-plugin-pwa`. PWA manifest, push, and SW are planned but not yet present.

## Anti-Patterns

### Language strings defined inside component bodies

**What happens:** Each screen declares its own `strings` or `t` object as a plain JS object literal inside the component function (`src/screens/PhoneEntry.tsx:6`, `src/screens/DonorProfileSetup.tsx:46`, etc.)

**Why it's wrong:** Strings are not extracted into a shared i18n system (no `react-i18next`). Adding a new language or changing a string requires touching every screen file. There is also a mismatch: the project CLAUDE.md prescribes `react-i18next` and `i18next`, but they are not installed.

**Do this instead:** Install `i18next` + `react-i18next`, create `src/locales/my.json` and `src/locales/en.json`, initialize in `src/i18n.ts`, and replace per-screen string maps with `useTranslation()` hooks.

### `UserState` in App does not survive reload

**What happens:** `user` state in `src/App.tsx:54` is initialised to `DEFAULT_USER` on every mount and merged only via `handleSaveDonor`. A page refresh loses the donor profile.

**Why it's wrong:** The user must re-enter their profile every session until Supabase persistence lands. Currently there is nothing bridging `localStorage` or a Supabase profile table.

**Do this instead:** When Supabase is integrated, seed `user` from the profile row on session load (`supabase.from('profiles').select(...).eq('id', session.user.id)`).

## Error Handling

**Strategy:** Minimal. Geolocation errors are handled explicitly; all other errors are unguarded.

**Patterns:**
- `src/geolocation.ts` wraps `navigator.geolocation` with a discriminated `GeoResult` type — `{ ok: true, lat, lng, accuracy }` | `{ ok: false, reason }`. `CreateRequest` uses the `ok` flag to branch to the denied state (`src/screens/CreateRequest.tsx:168`).
- `src/auth.ts` wraps `localStorage` reads/writes in try/catch — private mode or storage quota errors silently fall back to treating the user as first-time (`src/auth.ts:28`).
- No error boundaries are present. An unhandled throw inside any screen will crash the entire app.

## Cross-Cutting Concerns

**Logging:** `console.log` only, for dummy action confirmations in `App.tsx` (`handlePosted`, `handleSaveDonor`). No structured logger.

**Validation:** Inline — `sendDisabled` in `PhoneEntry`, `verifyDisabled` in `OtpVerification`, `saveDisabled` in `DonorProfileSetup`, `postDisabled` in `CreateRequest` — all computed from local state.

**Authentication:** Dummy only (`src/auth.ts`). No Supabase session, no JWT. Returning-user detection via `localStorage['bloodhelp.seenPhones']` array.

**Localization:** Manual per-screen string maps keyed by `Lang`. `formatNumber()` in `src/i18n.ts` handles Burmese digit rendering. No `react-i18next` yet.

---

*Architecture analysis: 2026-06-20*
