# Codebase Structure

**Analysis Date:** 2026-06-20

## Directory Layout

```
blood-help-old/
├── src/                    # All application source code
│   ├── main.tsx            # React DOM entry point — mounts <App />
│   ├── App.tsx             # Root component: screen router + global state
│   ├── index.css           # Design tokens (@theme), layout classes
│   ├── App.css             # Unused placeholder (Vite scaffold remnant)
│   │
│   ├── screens/            # Full-screen view components (one file per screen)
│   │   ├── PhoneEntry.tsx
│   │   ├── OtpVerification.tsx
│   │   ├── IntentChoice.tsx
│   │   ├── CreateRequest.tsx
│   │   ├── DonorProfileSetup.tsx
│   │   ├── Profile.tsx
│   │   └── Leaderboard.tsx
│   │
│   ├── components/         # Shared UI primitives
│   │   ├── Button.tsx
│   │   ├── Input.tsx
│   │   ├── Switch.tsx
│   │   ├── Badge.tsx
│   │   ├── BottomNav.tsx
│   │   ├── BloodTypeSelector.tsx
│   │   └── AlertDialog.tsx
│   │
│   ├── blood.ts            # BloodType union + BLOOD_TYPES constant
│   ├── i18n.ts             # Lang type + formatNumber()
│   ├── auth.ts             # Dummy auth helpers (localStorage)
│   ├── geolocation.ts      # getCurrentPosition() wrapper
│   │
│   └── assets/             # Static assets bundled by Vite
│       ├── hero.png
│       ├── react.svg       # Vite scaffold remnant
│       └── vite.svg        # Vite scaffold remnant
│
├── public/                 # Files served verbatim (not bundled)
│   ├── favicon.svg
│   └── icons.svg
│
├── dist/                   # Build output (gitignored)
│   └── assets/
│
├── .planning/              # GSD planning artifacts
│   └── codebase/           # Codebase analysis documents
│
├── .claude/                # Claude / GSD tooling configuration
│   ├── agents/
│   ├── commands/
│   ├── get-shit-done/
│   ├── hooks/
│   └── skills/
│       └── frontend-design/
│
├── index.html              # HTML shell — mounts #root, loads /src/main.tsx
├── vite.config.ts          # Vite config (react + tailwindcss plugins only)
├── tsconfig.json           # TypeScript project references root
├── tsconfig.app.json       # App source TS config (strict, bundler module)
├── tsconfig.node.json      # Vite config TS config (node types)
├── package.json            # Deps: react 19, tailwindcss 4, vite 8
├── eslint.config.js        # ESLint flat config
├── CLAUDE.md               # Project brief, stack spec, conventions
└── README.md               # Vite scaffold readme (not project-specific)
```

## Directory Purposes

**`src/screens/`:**
- Purpose: One file per full-screen view; each screen is a self-contained presentational component
- Contains: Screen components, exported TypeScript interfaces for their output data (e.g., `DonorProfile`, `RequestDraft`, `Intent`)
- Key files: `App.tsx` imports every screen here

**`src/components/`:**
- Purpose: Shared, reusable UI primitives matching the Blood Help design system
- Contains: Low-level building blocks (Button, Input, Switch, Badge, BottomNav, BloodTypeSelector, AlertDialog)
- Key files: Used by multiple screens; never import from `src/screens/`

**`src/` (root-level `.ts` files):**
- Purpose: Domain utilities and type definitions shared across screens and components
- Contains: `blood.ts`, `i18n.ts`, `auth.ts`, `geolocation.ts`
- Key files: `blood.ts` and `i18n.ts` are imported by almost every screen

**`src/assets/`:**
- Purpose: Static assets that Vite will bundle and hash
- Contains: `hero.png` (used in early designs), `react.svg` and `vite.svg` (Vite scaffold remnants — can be deleted)

**`public/`:**
- Purpose: Assets served at their literal path, not processed by Vite
- Contains: `favicon.svg`, `icons.svg` (SVG sprite referenced by screens via `<use>` or directly)

**`dist/`:**
- Purpose: Vite build output
- Generated: Yes
- Committed: No (in `.gitignore`)

**`.planning/codebase/`:**
- Purpose: GSD codebase map documents consumed by `/gsd:plan-phase` and `/gsd:execute-phase`
- Generated: By `/gsd:map-codebase`
- Committed: Yes

## Key File Locations

**Entry Points:**
- `index.html`: HTML shell; sets `<div id="root">` and loads `src/main.tsx`
- `src/main.tsx`: React DOM bootstrap — `createRoot('#root').render(<App />)`
- `src/App.tsx`: Root component, screen state machine, global state

**Design Tokens / CSS:**
- `src/index.css`: All design tokens (`@theme`), token aliases (`:root`), layout classes (`.phone-entry-stage`, `.phone-entry-card`). This is the single source of truth for colors, radii, shadows, typography, and spacing.

**Domain Types:**
- `src/blood.ts`: `BloodType` union and `BLOOD_TYPES` constant
- `src/i18n.ts`: `Lang` type and `formatNumber()`
- `src/auth.ts`: `hasLoggedInBefore()` / `markLoggedIn()` using `localStorage`
- `src/geolocation.ts`: `getCurrentPosition()` returning `GeoResult`

**Configuration:**
- `vite.config.ts`: Vite build config (react + tailwindcss plugins, no PWA yet)
- `tsconfig.app.json`: TypeScript settings for app source (strict, `bundler` module resolution)
- `eslint.config.js`: ESLint flat config with react-hooks and react-refresh plugins
- `CLAUDE.md`: Project brief and stack constraints (the authoritative spec for this project)

**Testing:**
- Not yet set up. No test files, no test runner config found.

## Naming Conventions

**Files:**
- Screen components: `PascalCase.tsx` matching the screen name — `PhoneEntry.tsx`, `OtpVerification.tsx`
- Shared components: `PascalCase.tsx` matching the component name — `Button.tsx`, `BottomNav.tsx`
- Domain utilities: `camelCase.ts` — `blood.ts`, `i18n.ts`, `auth.ts`, `geolocation.ts`
- CSS: `camelCase.css` — `index.css`, `App.css`

**Directories:**
- Lowercase plural: `screens/`, `components/`, `assets/`

**Exports:**
- Named exports for all components and utilities: `export function Button(...)`, `export type Lang`, `export function getCurrentPosition()`
- Default exports added as aliases only (`export default Button`) — the named export is canonical

**Interfaces and Types:**
- Data shapes exported from the screen that owns them: `DonorProfile` from `DonorProfileSetup.tsx`, `RequestDraft` from `CreateRequest.tsx`, `Intent` from `IntentChoice.tsx`, `Tab` from `BottomNav.tsx`
- Prop interfaces are local and not exported (only data-shape interfaces are exported)

## Where to Add New Code

**New Screen:**
- Create: `src/screens/NewScreenName.tsx`
- Props: Accept `lang: Lang`, `onLangChange: (lang: Lang) => void`, and any callbacks
- Export: Named export `export function NewScreenName(...)` + default alias
- Wire: Add the new `Screen` value to the union type in `src/App.tsx:17`, add the `if (screen === '...')` guard in `App.tsx`, import the component

**New Shared Component:**
- Create: `src/components/ComponentName.tsx`
- Pattern: Use CSS custom properties from `src/index.css` via `var(--token-name)` in inline `CSSProperties` objects
- Export: Named export + default alias
- Import: From screens as `import { ComponentName } from '../components/ComponentName'`

**New Domain Utility / Type:**
- Add to an existing `src/*.ts` file if it belongs to an existing domain (e.g., add blood compatibility logic to `src/blood.ts`)
- Create a new `src/domainname.ts` file for genuinely new domains (e.g., `src/push.ts` for FCM token management)
- Keep utility files free of React imports — plain TypeScript only

**New Design Token:**
- Add to the `@theme {}` block in `src/index.css`
- Add a `:root` alias immediately below if the token is referenced via raw `var()` in ported screen code

**Supabase Integration (planned):**
- Client singleton: `src/supabase.ts` (create when integrating)
- Database types: `src/database.types.ts` (generated by Supabase CLI)
- Profile queries: Either inline in `App.tsx` initially or extracted to `src/profile.ts`

**Firebase / PWA (planned):**
- Service worker: `src/sw.ts` (merged PWA + FCM worker, compiled by vite-plugin-pwa)
- FCM token management: `src/push.ts`
- Update `vite.config.ts` to add `vite-plugin-pwa` with `injectManifest` strategy

**i18n Migration (planned):**
- Locale files: `src/locales/my.json`, `src/locales/en.json`
- i18n init: Expand `src/i18n.ts` to initialize `i18next` + `react-i18next`

## Special Directories

**`dist/`:**
- Purpose: Vite production build output (`tsc -b && vite build`)
- Generated: Yes (by `npm run build`)
- Committed: No

**`.claude/`:**
- Purpose: GSD workflow configuration, agent definitions, command scripts, project skills
- Generated: Partially (managed by GSD tooling)
- Committed: Yes

**`.planning/`:**
- Purpose: GSD planning state — codebase maps, phase plans, project config
- Generated: By GSD commands
- Committed: Yes

---

*Structure analysis: 2026-06-20*
