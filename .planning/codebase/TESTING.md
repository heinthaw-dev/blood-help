# Testing Patterns

**Analysis Date:** 2026-06-20

## Test Framework

**Runner:**
- None installed. No test framework, test runner, or assertion library is present in `package.json` (neither in `dependencies` nor `devDependencies`).
- No `vitest.config.*`, `jest.config.*`, or any test configuration file exists in the repo.

**Assertion Library:**
- None

**Run Commands:**
```bash
# No test commands defined. package.json scripts are:
npm run dev       # Start Vite dev server
npm run build     # TypeScript type-check + Vite build
npm run lint      # ESLint check
npm run preview   # Preview production build
```

## Test File Organization

**Location:**
- No test files exist anywhere in the repository. `find` across the entire project returns zero `.test.*` or `.spec.*` files.

**Naming:**
- Not established

**Structure:**
- Not established

## Current Quality Gates

Despite having no test suite, the project has two automated quality checks that run before deployment:

**TypeScript compilation (`tsc -b`):**
- Runs as part of `npm run build`
- Enforces `noUnusedLocals: true` and `noUnusedParameters: true` — dead code is a build error
- `erasableSyntaxOnly: true` — prevents runtime-impacting TypeScript syntax
- `noFallthroughCasesInSwitch: true`
- Covers all files in `src/` (configured in `tsconfig.app.json`)

**ESLint (`npm run lint`):**
- Flat config in `eslint.config.js`
- Enforces React Hooks rules (`eslint-plugin-react-hooks`) — prevents missing deps in `useEffect`, invalid hook calls
- Enforces React Refresh rules (`eslint-plugin-react-refresh`) — component exports must be fast-refresh compatible
- `typescript-eslint` recommended ruleset

## Recommended Test Setup (Not Yet Implemented)

When testing is added, the recommended setup for this stack (Vite + React 19 + TypeScript) is:

**Framework to add:**
```bash
npm install -D vitest @vitest/ui jsdom @testing-library/react @testing-library/user-event
```

**Config to create (`vitest.config.ts`):**
```typescript
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
  },
})
```

**Test placement pattern to follow:**
- Co-locate test files with source: `src/components/Button.test.tsx`, `src/screens/PhoneEntry.test.tsx`
- Utility tests: `src/auth.test.ts`, `src/geolocation.test.ts`

## Units Most Suitable for Testing

These pure utility modules have no browser/React dependencies and are ideal first test targets:

**`src/auth.ts`:**
- `hasLoggedInBefore(phone)` — needs `localStorage` mock
- `markLoggedIn(phone)` — needs `localStorage` mock
- Test: first-time vs returning user logic; `localStorage` unavailability fallback

**`src/blood.ts`:**
- `BLOOD_TYPES` array has exactly 8 entries
- `BloodType` union covers all ABO/Rh combinations

**`src/i18n.ts`:**
- `formatNumber(n, 'my')` — converts ASCII digits to Burmese numeral characters
- `formatNumber(n, 'en')` — returns unchanged ASCII string
- Purely functional, zero dependencies

**`src/geolocation.ts`:**
- `getCurrentPosition()` — needs `navigator.geolocation` mock
- Test paths: success result, `PERMISSION_DENIED`, `TIMEOUT`, generic error, unsupported browser

## Component Testability Notes

**`src/components/Button.tsx`:**
- Stateful hover/active via mouse events — testable with `@testing-library/user-event`
- Props: `variant`, `fullWidth`, `height`, `disabled` — straightforward render tests

**`src/components/Switch.tsx`:**
- `role="switch"` and `aria-checked` — accessible and easily queryable
- `onChange` callback — verify it is called with toggled value

**`src/components/BloodTypeSelector.tsx`:**
- Renders all 8 blood type buttons — verify count and labels
- Selection state changes the selected button's styles

**`src/screens/OtpVerification.tsx`:**
- Complex state machine: countdown timer, auto-fill timeout, box-to-box focus advancement
- `useEffect` timers require `vi.useFakeTimers()` to test deterministically

**`src/screens/CreateRequest.tsx`:**
- `GeoPhase` state machine (`idle → prealert → requesting → idle/denied`)
- `AlertDialog` visibility gated on `geoPhase`
- Requires geolocation mock

## Mocking

**What to Mock:**
- `localStorage` — for `src/auth.ts` tests (use `vi.stubGlobal` or jsdom's built-in stub)
- `navigator.geolocation` — for `src/geolocation.ts` and `src/screens/CreateRequest.tsx` tests
- `setTimeout`/`setInterval` — for `OtpVerification.tsx` countdown and auto-fill timer tests

**What NOT to Mock:**
- CSS variables and design tokens — test with real DOM in jsdom; style assertions are fragile
- React state — test behavior through user interaction, not internal state directly

## Coverage

**Requirements:** None enforced (no test runner configured)

**Highest-risk untested areas (in priority order):**
1. `src/auth.ts` — localStorage logic determines first-time vs returning user flow
2. `src/geolocation.ts` — all 5 error branches + success path
3. `src/i18n.ts` — `formatNumber` Burmese digit conversion
4. `src/screens/OtpVerification.tsx` — timer-driven auto-fill + OTP box state machine
5. `src/screens/CreateRequest.tsx` — location permission state machine

## Test Types

**Unit Tests:**
- Not present. Appropriate for: `src/auth.ts`, `src/blood.ts`, `src/i18n.ts`, `src/geolocation.ts`

**Integration Tests:**
- Not present. Appropriate for: screen-level flows (phone entry → OTP → intent choice)

**E2E Tests:**
- Not present. Playwright would be the appropriate choice for the full PWA flow including push notification prompts.

---

*Testing analysis: 2026-06-20*
