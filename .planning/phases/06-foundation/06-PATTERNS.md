# Phase 6: Foundation - Pattern Map

**Mapped:** 2026-06-21
**Files analyzed:** 6 new/modified source files
**Analogs found:** 5 / 6 (1 truly novel: `src/lib/supabase.ts` has no direct codebase analog)

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/lib/supabase.ts` | utility (singleton) | request-response | `src/blood.ts` (module-scoped constant export) | partial — same module shape, no auth precedent |
| `src/auth.ts` | utility (session helpers) | request-response | `src/auth.ts` itself (file being replaced) | exact — same file path, same discriminated-union error pattern |
| `src/geolocation.ts` | utility | transform | `src/geolocation.ts` itself (file being extended) | exact — add alongside existing exports |
| `src/App.tsx` | component (root router) | event-driven | `src/App.tsx` itself (file being modified) | exact — same file, additive `useEffect` |
| `.env.local` | config | — | `vite.config.ts` (Vite project config) | partial — no prior `.env` file exists |
| `src/vite-env.d.ts` | config (type declaration) | — | `tsconfig.app.json` `"types": ["vite/client"]` entry | partial — declaration augments Vite's built-in types |

---

## Pattern Assignments

### `src/lib/supabase.ts` (utility singleton, request-response)

**Analog:** `src/blood.ts` — module-level constant exported for project-wide consumption; no class, no default export, named export only.

**Module shape pattern** (`src/blood.ts` lines 1–5):
```typescript
/** The 8 ABO/Rh blood types. */
export const BLOOD_TYPES = ['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'] as const

export type BloodType = (typeof BLOOD_TYPES)[number]
```

**Key conventions to copy:**
- JSDoc `/** ... */` module-level comment
- Named export (no default export)
- Module-scoped constant, not a class

**Import convention** — `verbatimModuleSyntax: true` is enforced in `tsconfig.app.json`, so type imports must use `import type`:
```typescript
// CORRECT — follows verbatimModuleSyntax
import { createClient } from '@supabase/supabase-js'
import type { Database } from '../types/database'

// WRONG — would fail lint
import { createClient, Database } from '@supabase/supabase-js'
```

**Core pattern for this file:**
```typescript
// src/lib/supabase.ts
/**
 * Supabase client singleton. Import `supabase` from this module everywhere —
 * never call createClient() directly elsewhere or multiple Auth instances will exist.
 */
import { createClient } from '@supabase/supabase-js'
import type { Database } from '../types/database'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey)
```

**No error handling needed here** — `createClient` is synchronous and does not throw; missing env vars will surface at runtime when the first network call is made.

---

### `src/auth.ts` (utility, request-response) — **full replacement**

**Analog:** `src/auth.ts` itself (current file being replaced) + `src/geolocation.ts` (discriminated-union error pattern).

**Discriminated union pattern to copy** (`src/geolocation.ts` lines 1–4):
```typescript
/** Result of a geolocation request. */
export type GeoResult =
  | { ok: true; lat: number; lng: number; accuracy: number }
  | { ok: false; reason: 'denied' | 'unavailable' | 'timeout' | 'unsupported' }
```

**Error handling pattern to copy** (`src/auth.ts` lines 11–18 — existing try/catch style):
```typescript
function readSeen(): string[] {
  try {
    const raw = localStorage.getItem(SEEN_KEY)
    return raw ? (JSON.parse(raw) as string[]) : []
  } catch {
    return []
  }
}
```

The new `src/auth.ts` adopts the same discriminated-union return style as `GeoResult`, applied to async Supabase auth calls.

**JSDoc comment style** (`src/auth.ts` lines 21–22, 26–27):
```typescript
/** True if this phone number has logged in before (returning user). */
export function hasLoggedInBefore(phone: string): boolean {

/** Record that this phone number has now completed login at least once. */
export function markLoggedIn(phone: string): void {
```

**Core pattern for the new file:**
```typescript
// src/auth.ts (full replacement)
/**
 * Supabase session helpers. Replaces the dummy localStorage auth.
 * Exports thin wrappers around supabase.auth that return discriminated unions,
 * consistent with the GeoResult pattern in geolocation.ts.
 */
import { supabase } from './lib/supabase'
import type { Session, AuthError } from '@supabase/supabase-js'

export type SessionResult =
  | { ok: true; session: Session }
  | { ok: false; error: AuthError | null }

/** Get the current Supabase session (from localStorage). */
export async function getSession(): Promise<SessionResult> {
  const { data: { session }, error } = await supabase.auth.getSession()
  if (error || !session) return { ok: false, error }
  return { ok: true, session }
}

/** Subscribe to auth state changes. Returns an unsubscribe function. */
export function onAuthStateChange(
  callback: (session: Session | null) => void,
): () => void {
  const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
    callback(session)
  })
  return () => subscription.unsubscribe()
}
```

**What to remove:** `SEEN_KEY`, `readSeen()`, `hasLoggedInBefore()`, `markLoggedIn()` — all deleted, not preserved.

---

### `src/geolocation.ts` (utility, transform) — **additive extension**

**Analog:** `src/geolocation.ts` itself — add `coarsenCoordinates()` alongside the existing `getCurrentPosition()` and `GeoResult` exports. Do not modify existing code.

**Existing exports to preserve verbatim** (`src/geolocation.ts` lines 1–38):
```typescript
/** Result of a geolocation request. */
export type GeoResult =
  | { ok: true; lat: number; lng: number; accuracy: number }
  | { ok: false; reason: 'denied' | 'unavailable' | 'timeout' | 'unsupported' }

export function getCurrentPosition(): Promise<GeoResult> { ... }
```

**JSDoc + function shape to match** (copy the pattern from lines 9–11):
```typescript
/**
 * Request the device's current position via the browser geolocation API.
 * Triggers the native permission prompt if not yet granted. The caller should
 * warn the user beforehand (pre-permission dialog) so they know it's coming.
 */
export function getCurrentPosition(): Promise<GeoResult> {
```

**New function to append at the bottom of the file:**
```typescript
/**
 * Coarsen GPS coordinates to ~1km grid (~2 decimal places) for privacy.
 * MUST be called before writing any lat/lng to the database.
 * Raw GeoResult coordinates are never written to Supabase directly.
 */
export function coarsenCoordinates(lat: number, lng: number): { lat: number; lng: number } {
  return {
    lat: Math.round(lat * 100) / 100,
    lng: Math.round(lng * 100) / 100,
  }
}
```

**Naming pattern:** `camelCase` function name, no leading underscore, trailing comma in multi-line object literals — consistent with the `getCurrentPosition` return object at lines 19–24.

---

### `src/App.tsx` (component, event-driven) — **additive modification**

**Analog:** `src/App.tsx` itself. The modification is additive: add one `useEffect` import, one `supabaseId` field to `UserState`, and one `initAuth` async function inside a `useEffect(() => { ... }, [])`.

**Existing import style to match** (`src/App.tsx` lines 1–19):
```typescript
import { useState } from 'react'
import { PhoneEntry } from './screens/PhoneEntry'
// ...
import { hasLoggedInBefore, markLoggedIn } from './auth'
import type { BloodType } from './blood'
import type { Lang } from './i18n'
```

**Changes to import block:**
- Add `useEffect` to the React import: `import { useState, useEffect } from 'react'`
- Replace `import { hasLoggedInBefore, markLoggedIn } from './auth'` with new auth helpers: `import { getSession } from './auth'`
- Add: `import { supabase } from './lib/supabase'`
- `verbatimModuleSyntax` is active — keep `import type` for type-only imports

**Existing state pattern to extend** (`src/App.tsx` lines 34–45):
```typescript
/** Dummy user profile state until Supabase persistence lands. */
interface UserState {
  name: string
  bloodType: BloodType
  available: boolean
  showNumber: boolean
  emergencyCallable: boolean
  donationCount: number
  lastDonation: string | null
  donorSetupComplete: boolean
  donorCode: string
}
```
Add `supabaseId: string | null` field to `UserState`. Add `supabaseId: null` to `DEFAULT_USER`.

**Existing `handleVerified` to replace** (`src/App.tsx` lines 71–77):
```typescript
const handleVerified = () => {
  // Dummy flow: no real verification. First-time numbers see Intent Choice;
  // returning numbers go to the Home feed.
  const returning = hasLoggedInBefore(phone)
  markLoggedIn(phone)
  setScreen(returning ? 'home' : 'intent')
}
```
Replace with a Supabase `profiles` lookup by phone.

**`useEffect` mount pattern** — follows React convention; place after all `useState` declarations, before all handler functions, consistent with how the file is structured today:
```typescript
const [sessionLoading, setSessionLoading] = useState(true)

useEffect(() => {
  async function initAuth() {
    // Check for existing session first (D-03; avoids creating new anon user)
    const { data: { session } } = await supabase.auth.getSession()

    if (!session) {
      // No session — create anonymous one (D-01, D-02)
      const { error } = await supabase.auth.signInAnonymously()
      if (error) {
        console.error('Anonymous sign-in failed:', error.message)
        setSessionLoading(false)
        return
      }
    }

    // Re-fetch after potential sign-in to get the confirmed session
    const { data: { session: confirmedSession } } = await supabase.auth.getSession()
    if (confirmedSession) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('id, is_donor')
        .eq('id', confirmedSession.user.id)
        .maybeSingle()

      if (profile) {
        setUser((u) => ({ ...u, supabaseId: confirmedSession.user.id }))
        setScreen('home')  // returning user — skip phone entry (D-03)
      }
    }

    setSessionLoading(false)
  }
  void initAuth()
}, [])

// Splash / loading guard — avoids PhoneEntry flash for returning users (Pitfall 7)
if (sessionLoading) return null
```

**Handler pattern** — all handler functions use `const handleX = () => {` naming (lines 79, 83, 90, 104, 110). New async handlers follow the same shape:
```typescript
const handleVerified = async () => {
  // Query profiles WHERE phone = $phone (D-04)
  const { data: profile } = await supabase
    .from('profiles')
    .select('id')
    .eq('phone', phone)
    .maybeSingle()

  setScreen(profile ? 'home' : 'intent')
}
```

**JSDoc inline comment style** (lines 85–86, 92–93 — use `// Next phase:` pattern):
```typescript
// Dummy flow: persist to Supabase + fan out push. For now, open request session.
```
New comments should follow the same `// [context]: [what]` inline style.

---

### `.env.local` (config, no analog)

**No codebase analog** — no `.env` file exists in the project.

**Vite convention (from `vite.config.ts` + RESEARCH.md):**
```bash
# .env.local — gitignored by Vite by default; never commit this file
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon-key>
```

**Source of values:** Fetch via Supabase MCP `get_project_url` and `get_publishable_keys` during Wave 0. Do not hardcode placeholder values — use actual MCP-fetched credentials.

---

### `src/vite-env.d.ts` (type declaration, no analog)

**No codebase analog** — no `.d.ts` file exists in `src/` yet.

**Constraint from `tsconfig.app.json` line 7:** `"types": ["vite/client"]` — the Vite client types are already included via tsconfig, so `vite-env.d.ts` augments the existing `ImportMetaEnv` interface rather than introducing it.

**Pattern from Vite docs (RESEARCH.md Pattern 2):**
```typescript
// src/vite-env.d.ts
/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_ANON_KEY: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
```

**Critical rule:** This file MUST NOT contain any `import` or `export` statements — doing so turns it into a module, which breaks the ambient declaration augmentation. The `/// <reference types="vite/client" />` triple-slash directive is sufficient.

---

## Shared Patterns

### Discriminated Union Error Handling
**Source:** `src/geolocation.ts` lines 1–4 and `src/auth.ts` lines 11–18 (existing try/catch)
**Apply to:** `src/auth.ts` (new `SessionResult` type), and any future Supabase wrapper utilities

The project's established error convention is to **never throw** — instead resolve to a typed discriminated union:
```typescript
// Pattern: { ok: true; <data> } | { ok: false; <reason> }
// Examples already in codebase:
export type GeoResult =
  | { ok: true; lat: number; lng: number; accuracy: number }
  | { ok: false; reason: 'denied' | 'unavailable' | 'timeout' | 'unsupported' }
```

New `SessionResult` in `src/auth.ts` follows this exact shape.

### JSDoc on Every Exported Symbol
**Source:** Every file in `src/*.ts` — `src/geolocation.ts` lines 9–11, `src/auth.ts` lines 21–22, `src/i18n.ts` lines 1 and 7
**Apply to:** All new exports in `src/lib/supabase.ts`, `src/auth.ts`, `src/geolocation.ts`

```typescript
/** Single-line JSDoc for simple exports. */
export const supabase = ...

/**
 * Multi-line JSDoc for functions with meaningful behavior to explain.
 * Second sentence adds caller guidance.
 */
export function getSession(): Promise<SessionResult> {
```

### `import type` for Type-Only Imports
**Source:** `src/App.tsx` lines 5–7, 16, 18–19 — every type-only import uses `import type`
**Apply to:** All new files (`src/lib/supabase.ts` importing `Database`, `src/auth.ts` importing `Session`/`AuthError`)

```typescript
// CORRECT (verbatimModuleSyntax enforced)
import type { Database } from '../types/database'
import type { Session, AuthError } from '@supabase/supabase-js'
```

### Named Exports + No Default Export (utility modules)
**Source:** `src/blood.ts`, `src/i18n.ts`, `src/geolocation.ts`, `src/auth.ts` — all use only named exports
**Apply to:** `src/lib/supabase.ts`, `src/auth.ts` (replacement)

Exception: `src/App.tsx` uses `export default App` — but that is the sole React component entry point, not a utility module.

### Trailing Commas in Multi-Line Structures
**Source:** `src/geolocation.ts` lines 19–24 (object return), `src/App.tsx` lines 47–57 (DEFAULT_USER)
**Apply to:** All multi-line object literals and function parameter lists in new files

```typescript
// Existing pattern in geolocation.ts:
resolve({
  ok: true,
  lat: pos.coords.latitude,
  lng: pos.coords.longitude,
  accuracy: pos.coords.accuracy,  // <-- trailing comma
})
```

---

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `src/lib/supabase.ts` | utility singleton | request-response | No external SDK client singletons exist in the project yet; blood.ts provides the module shape but not the createClient pattern |
| `.env.local` | config | — | No environment variable files exist; Vite convention applies directly |
| `src/vite-env.d.ts` | type declaration | — | No `.d.ts` ambient declaration files exist; Vite's own type docs are the reference |

---

## Metadata

**Analog search scope:** `src/*.ts`, `src/App.tsx`, `vite.config.ts`, `tsconfig.app.json`
**Files scanned:** 7 source files read in full (`src/auth.ts`, `src/geolocation.ts`, `src/App.tsx`, `src/main.tsx`, `src/blood.ts`, `src/i18n.ts`, `vite.config.ts`, `tsconfig.app.json`)
**Pattern extraction date:** 2026-06-21
