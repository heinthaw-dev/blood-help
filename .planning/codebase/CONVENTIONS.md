# Coding Conventions

**Analysis Date:** 2026-06-20

## Naming Patterns

**Files:**
- PascalCase for components and screens: `Button.tsx`, `PhoneEntry.tsx`, `BloodTypeSelector.tsx`
- camelCase for utility/helper modules: `auth.ts`, `blood.ts`, `i18n.ts`, `geolocation.ts`
- All source files use `.ts` or `.tsx` extensions (no `.js` in `src/`)

**Functions:**
- Named exports for all components and utilities: `export function PhoneEntry(...)`, `export function Button(...)`
- Default export always follows the named export as an alias: `export default PhoneEntry`
- Event handlers prefixed with `handle`: `handleVerified`, `handlePost`, `handleResend`, `handleKeyDown`
- Boolean state setters use descriptive verbs: `setFocus`, `setHover`, `setActive`

**Variables:**
- camelCase for local variables and state: `isMy`, `bodyFont`, `sendDisabled`, `lh`
- SCREAMING_SNAKE_CASE for module-level constants: `OTP_LENGTH`, `RESEND_SECONDS`, `AUTOFILL_MS`, `BLOOD_TYPES`, `DUMMY`, `SEEN_KEY`
- Record objects for localization strings named `STRINGS`, `strings`, or `t`/`copy` after indexing by lang

**Types:**
- PascalCase for interfaces: `PhoneEntryProps`, `ButtonProps`, `DonorProfile`, `RequestDraft`
- PascalCase for type aliases when semantic: `Variant`, `Tab`, `Intent`, `Lang`, `BloodType`, `GeoResult`, `GeoPhase`
- Union type strings are lowercase: `'my' | 'en'`, `'primary' | 'secondary'`, `'urgent' | 'today'`
- Interfaces exported when they are the component's public contract: `export interface DonorProfile`, `export interface RequestDraft`
- Types exported when used by consumers: `export type Intent`, `export type Tab`, `export type Lang`, `export type BloodType`

## Code Style

**Formatting:**
- No Prettier config file present — formatting enforced by editor defaults and ESLint
- Single quotes for strings in `.tsx`/`.ts` files (some files use double quotes — `OtpVerification.tsx` uses double quotes throughout; most other files use single quotes)
- Semicolons: absent in most files (ASI-reliant style), but `OtpVerification.tsx` uses semicolons consistently — formatting is not enforced uniformly
- Trailing commas in multi-line structures
- No `type: 'module'` in ESM-style, but `package.json` has `"type": "module"`

**Linting:**
- ESLint via `eslint.config.js` with flat config format
- Rules enabled: `js.configs.recommended`, `tseslint.configs.recommended`, `reactHooks.configs.flat.recommended`, `reactRefresh.configs.vite`
- `noUnusedLocals: true`, `noUnusedParameters: true` enforced at TypeScript compiler level (`tsconfig.app.json`)
- `noFallthroughCasesInSwitch: true`, `erasableSyntaxOnly: true` also enforced
- `dist/` is globally ignored in lint config
- Run linting: `npm run lint`

## Import Organization

**Order:**
1. React type imports: `import type { CSSProperties, ReactNode } from 'react'`
2. React value imports: `import { useState, useEffect, useRef } from 'react'`
3. Shared components: `import { Button } from '../components/Button'`
4. Type-only component imports: `import type { Tab } from '../components/BottomNav'`
5. Domain utilities: `import type { BloodType } from '../blood'`
6. i18n/language utilities: `import type { Lang } from '../i18n'`

**Pattern:**
- Type imports are always separated with `import type` (enforced by `verbatimModuleSyntax: true` in tsconfig)
- All imports use relative paths — no path aliases configured
- `src/` is the only include in `tsconfig.app.json`

**Path Aliases:**
- None configured — all imports are relative: `'../components/Button'`, `'../blood'`, `'../i18n'`

## Localization (i18n) Pattern

**All bilingual copy is inlined per component** — no external i18n library yet (react-i18next is planned but not installed).

**Pattern used:**
```typescript
// Top-level constant (PhoneEntry.tsx style — used when copy doesn't depend on runtime state)
const STRINGS: Record<Lang, { title: string; subtitle: string }> = {
  my: { title: '...', subtitle: '...' },
  en: { title: '...', subtitle: '...' },
}
const copy = STRINGS[lang]

// Inline object (most screens — strings object defined inside the component)
const strings = {
  my: { title: '...', cta: '...' },
  en: { title: '...', cta: '...' },
}
const copy = strings[lang]  // or: }[lang]  (inline index)
```

**Rule:** Burmese (`my`) is always listed first. English (`en`) is always second.

**Language toggle** is a pill button pair `မြန်မာ / ENG` duplicated in every screen's top bar. `lang` and `onLangChange` are props passed down from App.

## Styling Pattern

**All styles are inline `CSSProperties` objects** — Tailwind utility classes are used only for layout shells (`.phone-entry-stage`, `.phone-entry-card`).

**Design token usage:**
- All colors, radii, font families, and shadows reference CSS variables: `'var(--color-primary)'`, `'var(--radius-card)'`, `'var(--font-burmese)'`
- Never hardcode hex values in component files — always use the token variables defined in `src/index.css`
- The one exception: `'#fff'` (white) and scrim `rgba(26,26,26,0.45)` appear inline in some components

**Style object pattern:**
```typescript
// Named CSSProperties constants for reuse within a component
const tabBase: CSSProperties = { fontFamily: 'var(--font-sans)', fontSize: '13px', ... }
const activeTab: CSSProperties = { ...tabBase, background: 'var(--color-primary)', color: '#fff' }

// Factory functions for state-dependent styles
const chip = (selected: boolean): CSSProperties => ({
  background: selected ? 'var(--color-primary)' : 'var(--surface-card)',
  ...
})
```

**Transitions:** Always `120ms ease` or `140ms ease` for interactive elements.

**Burmese line-height adjustment:** Components check `isMy` and adjust `lineHeight` for Burmese text (typically 1.65–1.8) vs English (1.3–1.5).

## Component Structure

**Every component follows this layout:**
1. Imports (type imports first)
2. Module-level constants (`STRINGS`, `OTP_LENGTH`, etc.)
3. Local type definitions (`type Variant = ...`, `interface Props`)
4. JSDoc comment on the exported function
5. Named export function with destructured props
6. State declarations at the top
7. Derived values (computed from state/props)
8. Localized copy object/constant lookup
9. Style objects / factory functions
10. Event handlers
11. JSX return

**Component size:** All components are self-contained with inline styles and strings — some screens are 200–430 lines.

## Error Handling

**Patterns:**
- Discriminated union result types for fallible operations: `GeoResult = { ok: true; ... } | { ok: false; reason: ... }` in `src/geolocation.ts`
- `try/catch` used for `localStorage` access in `src/auth.ts` — silent failure (returns safe default)
- No `throw` statements — errors resolve to typed error values
- Geolocation errors mapped to `'denied' | 'unavailable' | 'timeout' | 'unsupported'` reason strings
- Form submission guards: disabled state prevents invalid submissions (`postDisabled`, `sendDisabled`, `verifyDisabled`)

## Comments

**When to Comment:**
- Module-level doc comments on every exported function and component using JSDoc `/** ... */`
- Inline comments on non-obvious state machine transitions: `// Dummy flow: ...`, `// Next phase: ...`
- Section comments in JSX for major layout regions: `{/* Top bar */}`, `{/* Scrollable form */}`, `{/* Sticky footer */}`
- Constants with magic numbers get explanatory comments: `/** Dummy flow: the "SMS" code auto-fills this many ms... */`

**JSDoc style:**
```typescript
/**
 * Phone Entry screen — pixel-faithful port of Phone Entry.dc.html from the
 * Blood Help Claude Design project. Dummy phone-OTP entry: enter a number,
 * send code.
 */
export function PhoneEntry(...) { ... }
```

## Function Design

**Size:** Handler functions are kept short (3–10 lines). Complex logic is extracted to named handlers (`handlePost`, `requestLocation`).

**Parameters:** Props are destructured directly in the function signature. No intermediate prop objects.

**Async:** One async handler (`requestLocation` in `CreateRequest.tsx`) uses `async/await`. Side effects in `useEffect` use cleanup return.

**Return Values:** Components return JSX directly (no intermediate variable). Utility functions return typed union results.

## Module Design

**Exports:** Named exports are the primary export; default export re-exports the same value. Consumer code always uses named imports.

**Barrel Files:** Not used — each component is imported directly by file path.

**Pure utility modules:** `src/auth.ts`, `src/blood.ts`, `src/i18n.ts`, `src/geolocation.ts` export only pure functions and type definitions — no React dependencies.

---

*Convention analysis: 2026-06-20*
