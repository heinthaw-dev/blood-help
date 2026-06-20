<!-- GSD:project-start source:PROJECT.md -->
## Project

**Blood Help**

A free, non-profit Progressive Web App that connects people who urgently need blood with nearby compatible donors, so a donor can be reached within minutes. Built for Myanmar / Southeast Asia, Burmese-first (Noto Sans Myanmar), privacy-conscious. One unified user profile — "requesting blood" and "being available to donate" are actions a single user takes, not separate account types.

**Core Value:** A person can post a blood request and have nearby, blood-compatible donors actually receive a push alert and call them back — turning an hours-long search into help within minutes. If everything else fails, this end-to-end loop (Request → nearby compatible donor alerted → callback) must work.

### Constraints

- **Tech stack**: React 19 + Vite 8 + Tailwind CSS v4 (CSS-only config, no tailwind.config.js) + TypeScript 6
- **Platform**: PWA, mobile-first — screens must work on small viewports
- **Localization**: All user-facing text must support English and Burmese (Noto Sans Myanmar)
- **Design fidelity**: Screens must match Claude Design HTML prompts provided by the user
- **No backend this milestone**: All screens are UI-only; no Supabase, Firebase, or API calls
<!-- GSD:project-end -->

<!-- GSD:stack-start source:codebase/STACK.md -->
## Technology Stack

## Languages
- TypeScript ~6.0.2 — All application source (`src/**/*.ts`, `src/**/*.tsx`) and build config (`vite.config.ts`)
- CSS — Design system tokens and layout shell (`src/index.css`, Tailwind v4 `@theme` blocks)
- HTML — Single-page entry (`index.html`)
## Runtime
- Node.js v24.x (detected: v24.16.0) — Build tooling only; app ships as static SPA with no server runtime
- npm 11.13.0
- Lockfile: `package-lock.json` present (lockfile version 3)
## Frameworks
- React 19.2.6 — UI rendering, screen state machine in `src/App.tsx`
- React DOM 19.2.6 — DOM mounting (`src/main.tsx`, `createRoot`)
- Vite 8.0.12 — Dev server and production bundler (`vite.config.ts`)
- `@vitejs/plugin-react` 6.0.1 — Babel-based fast refresh and JSX transform
- `@tailwindcss/vite` 4.3.1 — Tailwind v4 Vite plugin (replaces PostCSS config)
- Tailwind CSS 4.3.1 — Utility classes generated from `@theme` tokens in `src/index.css`
- None installed
## Key Dependencies
- `react` 19.2.6 — Entire UI layer; all screens and components are React function components
- `tailwindcss` 4.3.1 — Styling system; design tokens live in `src/index.css` `@theme` block, not `tailwind.config.js` (v4 CSS-only config)
- `@types/react` 19.2.14 — TypeScript types for React 19
- `@types/react-dom` 19.2.3 — TypeScript types for ReactDOM
- `@types/node` 24.12.3 — Node types for Vite config file
## Configuration
- No `.env` files present — application currently uses no environment variables
- No external API keys configured; all integrations are placeholder/dummy state
- `vite.config.ts` — Vite config with `react()` and `tailwindcss()` plugins only; no special define blocks, aliases, or PWA plugin yet
- `tsconfig.json` — Root references `tsconfig.app.json` and `tsconfig.node.json`
- `tsconfig.app.json` — App source: target ES2023, `lib: ["ES2023", "DOM"]`, bundler module resolution, strict unused-locals/params, JSX via react-jsx transform, `noEmit: true`
- `tsconfig.node.json` — Vite config file: target ES2023, `lib: ["ES2023"]` (no DOM), `types: ["node"]`
- `eslint.config.js` — Flat config using `@eslint/js`, `typescript-eslint`, `eslint-plugin-react-hooks`, `eslint-plugin-react-refresh`
- Targets: `**/*.{ts,tsx}`, ignores `dist/`
- Google Fonts CDN — Inter (400/500/600) and Noto Sans Myanmar (400/500/600) loaded via `@import url(...)` in `src/index.css`
## Platform Requirements
- Node.js 24.x
- npm 11.x
- `npm run dev` → Vite dev server with HMR
- `npm run build` → `tsc -b && vite build` (type-check then bundle)
- `npm run lint` → ESLint
- `npm run preview` → Vite production preview
- Static SPA — output is `dist/index.html` + `dist/assets/` (single JS bundle + CSS bundle)
- PWA plugin NOT yet installed — `index.html` has no `<link rel="manifest">` and no service worker registration
- No server-side runtime required; can deploy to any static host (Netlify, Vercel, Firebase Hosting, Cloudflare Pages)
- No `.nvmrc` or Node version pin file present
## Not-Yet-Installed Planned Stack
| Package | Purpose |
|---------|---------|
| `@supabase/supabase-js` ^2.108.2 | Database, auth, realtime |
| `firebase` ^12.15.0 | Firebase Cloud Messaging push |
| `vite-plugin-pwa` ^1.3.0 | PWA manifest + service worker |
| `workbox-precaching` ^7.4.1 | SW precache (dev dep) |
| `react-i18next` ^17.0.8 | EN/Burmese language switching |
| `i18next` ^26.3.1 | i18n engine |
<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->
## Conventions

## Naming Patterns
- PascalCase for components and screens: `Button.tsx`, `PhoneEntry.tsx`, `BloodTypeSelector.tsx`
- camelCase for utility/helper modules: `auth.ts`, `blood.ts`, `i18n.ts`, `geolocation.ts`
- All source files use `.ts` or `.tsx` extensions (no `.js` in `src/`)
- Named exports for all components and utilities: `export function PhoneEntry(...)`, `export function Button(...)`
- Default export always follows the named export as an alias: `export default PhoneEntry`
- Event handlers prefixed with `handle`: `handleVerified`, `handlePost`, `handleResend`, `handleKeyDown`
- Boolean state setters use descriptive verbs: `setFocus`, `setHover`, `setActive`
- camelCase for local variables and state: `isMy`, `bodyFont`, `sendDisabled`, `lh`
- SCREAMING_SNAKE_CASE for module-level constants: `OTP_LENGTH`, `RESEND_SECONDS`, `AUTOFILL_MS`, `BLOOD_TYPES`, `DUMMY`, `SEEN_KEY`
- Record objects for localization strings named `STRINGS`, `strings`, or `t`/`copy` after indexing by lang
- PascalCase for interfaces: `PhoneEntryProps`, `ButtonProps`, `DonorProfile`, `RequestDraft`
- PascalCase for type aliases when semantic: `Variant`, `Tab`, `Intent`, `Lang`, `BloodType`, `GeoResult`, `GeoPhase`
- Union type strings are lowercase: `'my' | 'en'`, `'primary' | 'secondary'`, `'urgent' | 'today'`
- Interfaces exported when they are the component's public contract: `export interface DonorProfile`, `export interface RequestDraft`
- Types exported when used by consumers: `export type Intent`, `export type Tab`, `export type Lang`, `export type BloodType`
## Code Style
- No Prettier config file present — formatting enforced by editor defaults and ESLint
- Single quotes for strings in `.tsx`/`.ts` files (some files use double quotes — `OtpVerification.tsx` uses double quotes throughout; most other files use single quotes)
- Semicolons: absent in most files (ASI-reliant style), but `OtpVerification.tsx` uses semicolons consistently — formatting is not enforced uniformly
- Trailing commas in multi-line structures
- No `type: 'module'` in ESM-style, but `package.json` has `"type": "module"`
- ESLint via `eslint.config.js` with flat config format
- Rules enabled: `js.configs.recommended`, `tseslint.configs.recommended`, `reactHooks.configs.flat.recommended`, `reactRefresh.configs.vite`
- `noUnusedLocals: true`, `noUnusedParameters: true` enforced at TypeScript compiler level (`tsconfig.app.json`)
- `noFallthroughCasesInSwitch: true`, `erasableSyntaxOnly: true` also enforced
- `dist/` is globally ignored in lint config
- Run linting: `npm run lint`
## Import Organization
- Type imports are always separated with `import type` (enforced by `verbatimModuleSyntax: true` in tsconfig)
- All imports use relative paths — no path aliases configured
- `src/` is the only include in `tsconfig.app.json`
- None configured — all imports are relative: `'../components/Button'`, `'../blood'`, `'../i18n'`
## Localization (i18n) Pattern
## Styling Pattern
- All colors, radii, font families, and shadows reference CSS variables: `'var(--color-primary)'`, `'var(--radius-card)'`, `'var(--font-burmese)'`
- Never hardcode hex values in component files — always use the token variables defined in `src/index.css`
- The one exception: `'#fff'` (white) and scrim `rgba(26,26,26,0.45)` appear inline in some components
## Component Structure
## Error Handling
- Discriminated union result types for fallible operations: `GeoResult = { ok: true; ... } | { ok: false; reason: ... }` in `src/geolocation.ts`
- `try/catch` used for `localStorage` access in `src/auth.ts` — silent failure (returns safe default)
- No `throw` statements — errors resolve to typed error values
- Geolocation errors mapped to `'denied' | 'unavailable' | 'timeout' | 'unsupported'` reason strings
- Form submission guards: disabled state prevents invalid submissions (`postDisabled`, `sendDisabled`, `verifyDisabled`)
## Comments
- Module-level doc comments on every exported function and component using JSDoc `/** ... */`
- Inline comments on non-obvious state machine transitions: `// Dummy flow: ...`, `// Next phase: ...`
- Section comments in JSX for major layout regions: `{/* Top bar */}`, `{/* Scrollable form */}`, `{/* Sticky footer */}`
- Constants with magic numbers get explanatory comments: `/** Dummy flow: the "SMS" code auto-fills this many ms... */`
## Function Design
## Module Design
<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->
## Architecture

## System Overview
```text
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
- All navigation state (`screen: Screen`) and shared user data (`user: UserState`, `lang: Lang`, `phone: string`) live in `App.tsx` — screens are pure presentational components receiving props and callbacks
- Screens communicate upward via callback props (`onPosted`, `onSave`, `onVerified`, `onNavigate`); `App.tsx` decides what to render next
- No global context, no Redux, no router — intentionally minimal for prototype phase
- Language (`lang: Lang`) is `'my'` (Burmese) by default; every screen receives `lang` and `onLangChange` and renders inline copy from a local `strings`/`t` object
- Inline `CSSProperties` objects are the primary styling mechanism; Tailwind utility classes are used only for the outer layout containers (`.phone-entry-stage`, `.phone-entry-card`)
## Layers
- Purpose: Shared types, constants, and stateless helper functions
- Location: `src/blood.ts`, `src/i18n.ts`, `src/auth.ts`, `src/geolocation.ts`
- Contains: `BloodType` union type, `BLOOD_TYPES` constant, `Lang` type, `formatNumber()`, `hasLoggedInBefore()`, `markLoggedIn()`, `getCurrentPosition()`
- Depends on: Browser APIs only (`localStorage`, `navigator.geolocation`)
- Used by: Screens, components
- Purpose: Reusable UI primitives matching the Blood Help design system
- Location: `src/components/`
- Contains: `Button`, `Input`, `Switch`, `Badge`, `BottomNav`, `BloodTypeSelector`, `AlertDialog`
- Depends on: CSS custom properties from `src/index.css`, domain types (`BloodType`, `Lang`)
- Used by: Screens
- Purpose: Full-screen views, each managing its own local form/UI state
- Location: `src/screens/`
- Contains: Seven screens matching Claude Design HTML mockups
- Depends on: Shared components, domain utilities, types exported from sibling screens
- Used by: `App.tsx`
- Purpose: Screen router, global state owner, entry point
- Location: `src/App.tsx`, `src/main.tsx`
- Contains: `Screen` type union, `UserState` interface, `DEFAULT_USER`, all transition handlers
- Depends on: All screens, `BottomNav` (via type), domain utilities
## Data Flow
### Primary Auth Flow (New User)
### Donor Setup Flow
### Blood Request Flow
### Navigation (Logged-In)
- `lang: Lang` — lifted to `App`, passed down to every screen; mutated via `setLang`
- `screen: Screen` — `App`-owned string, drives which screen renders
- `user: UserState` — `App`-owned object, updated by `handleSaveDonor` and toggle change handlers
- `phone: string` — `App`-owned, set on OTP send, passed as `defaultPhone` to forms
- No persistent state after auth except `localStorage['bloodhelp.seenPhones']`
## Key Abstractions
- Purpose: Type-safe screen routing; acts as the navigation state machine
- Examples: `'phone' | 'otp' | 'intent' | 'profile' | 'leaderboard' | 'create-request' | 'donor-setup'`
- Pattern: Defined in `src/App.tsx:17`; `if (screen === '...')` guard chain with last branch as the default (`PhoneEntry`)
- Purpose: Bilingual switching across all screens
- Examples: `src/i18n.ts:2` — `'my' | 'en'`
- Pattern: Every screen holds a local `strings` or `t` object keyed by `Lang`; `formatNumber(n, lang)` renders Burmese numerals for `lang === 'my'`
- Purpose: In-memory logged-in user representation before Supabase lands
- Examples: `src/App.tsx:27`
- Pattern: Initialized as `DEFAULT_USER`, merged with `DonorProfile` on save, passed as individual props to `Profile` and `Leaderboard`
- Purpose: Blood request payload (blood type + contact + units + urgency + lat/lng)
- Examples: `src/screens/CreateRequest.tsx:14`
- Pattern: Built inside `CreateRequest` only after geolocation grant, passed to `onPosted` callback
- Purpose: Single source of truth for colors, radii, shadows, fonts
- Examples: `--color-primary`, `--radius-card`, `--font-burmese`, `--shadow-cta`
- Pattern: Defined in `src/index.css` `@theme` block (Tailwind v4); aliased in `:root` for raw `var()` references from ported screens
## Entry Points
- Location: `src/main.tsx`
- Triggers: Vite loads `index.html` → `<script src="/src/main.tsx">` → `createRoot(document.getElementById('root')).render(<App />)`
- Responsibilities: Strict mode wrapping, React DOM mount
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
### `UserState` in App does not survive reload
## Error Handling
- `src/geolocation.ts` wraps `navigator.geolocation` with a discriminated `GeoResult` type — `{ ok: true, lat, lng, accuracy }` | `{ ok: false, reason }`. `CreateRequest` uses the `ok` flag to branch to the denied state (`src/screens/CreateRequest.tsx:168`).
- `src/auth.ts` wraps `localStorage` reads/writes in try/catch — private mode or storage quota errors silently fall back to treating the user as first-time (`src/auth.ts:28`).
- No error boundaries are present. An unhandled throw inside any screen will crash the entire app.
## Cross-Cutting Concerns
<!-- GSD:architecture-end -->

<!-- GSD:skills-start source:skills/ -->
## Project Skills

| Skill | Description | Path |
|-------|-------------|------|
| blood-help-design | Use whenever building or changing any UI for the Blood Help PWA — screens, components, layouts, Tailwind styles, or copy. Enforces the app's design system (color #D13E2F, Noto Sans Myanmar, Burmese-first, mobile-first, emergency-calm tone) so every screen looks consistent and intentional, not templated. Trigger for any React/Tailwind work, new screens (auth, donor home, request-live, congrats), or microcopy in Burmese/English. | `.claude/skills/frontend-design/SKILL.md` |
<!-- GSD:skills-end -->

<!-- GSD:workflow-start source:GSD defaults -->
## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:
- `/gsd-quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd-debug` for investigation and bug fixing
- `/gsd-execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->

<!-- GSD:profile-start -->

## Developer Profile

> Profile not yet configured. Run `/gsd:profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->
