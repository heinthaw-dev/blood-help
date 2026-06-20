---
phase: 06-foundation
reviewed: 2026-06-21T00:00:00Z
depth: standard
files_reviewed: 7
files_reviewed_list:
  - src/vite-env.d.ts
  - src/lib/supabase.ts
  - src/types/database.ts
  - src/auth.ts
  - src/geolocation.ts
  - src/App.tsx
  - src/screens/RequestLive.tsx
findings:
  critical: 3
  warning: 4
  info: 2
  total: 9
status: issues_found
---

# Phase 6: Code Review Report

**Reviewed:** 2026-06-21
**Depth:** standard
**Files Reviewed:** 7
**Status:** issues_found

## Summary

Phase 6 wires Supabase auth into the React PWA. The overall auth scaffolding (singleton client, discriminated-union result types, `getSession`-before-`signInAnonymously` ordering) is structurally sound. However three blockers were found:

1. The primary privacy requirement — coarsening GPS coordinates to 2dp before any DB write — is implemented in `geolocation.ts` but **never called**. Raw high-precision coordinates are passed verbatim to `onPosted`.
2. The fake QR-scan viewport in `RequestLive` calls `handleConfirmInApp` unconditionally, bypassing the 5-char code guard and allowing a zero-code confirmation.
3. The `handleVerified` async function is assigned to an `onVerified` prop typed as `() => void`, silently swallowing any errors thrown inside it as unhandled Promise rejections.

Four warnings and two informational items follow.

---

## Critical Issues

### CR-01: `coarsenCoordinates` is defined but never called — raw GPS written to `RequestDraft`

**File:** `src/screens/CreateRequest.tsx:176`
**Issue:** The project's stated privacy rule is that GPS coordinates MUST be coarsened to 2 decimal places (~1 km grid) before any database write. `coarsenCoordinates()` was added to `geolocation.ts` for exactly this purpose. However, `CreateRequest.tsx` calls `getCurrentPosition()` and forwards `res.lat` / `res.lng` directly to `onPosted(...)` without calling `coarsenCoordinates`. The full-precision coordinates (potentially 6+ decimal-place accuracy) are passed into `RequestDraft`, which is stored in `App` state as `requestDraft` and will flow into the future Supabase INSERT. As of the current search across all `src/` files, `coarsenCoordinates` has zero call sites — it is a dead export.

**Fix:** Call `coarsenCoordinates` before constructing the draft:

```typescript
// src/screens/CreateRequest.tsx — inside requestLocation()
if (res.ok && bloodType) {
  setGeoPhase('idle')
  const { lat, lng } = coarsenCoordinates(res.lat, res.lng)   // <-- add this
  onPosted({ bloodType, phone, address, units, urgency, lat, lng })
}
```

Also add the import:
```typescript
import { getCurrentPosition, coarsenCoordinates } from '../geolocation'
```

---

### CR-02: QR viewport button calls `handleConfirmInApp` without checking `confirmReady` — bypasses 5-char code requirement

**File:** `src/screens/RequestLive.tsx:550`
**Issue:** The code sub-sheet contains two ways to confirm a donation: a fake QR-scanner viewport (a styled `<button>`) and an explicit "Confirm" button below the code input. The "Confirm" button (line 604) is correctly gated with `disabled={!confirmReady}`. However, the QR viewport button at line 550 is `onClick={handleConfirmInApp}` with no `confirmReady` check. A user can open the code sheet, tap the dark QR area without entering any code, and `handleConfirmInApp` fires immediately with `code === ''`, incrementing `collected` and potentially marking the request as fulfilled with zero verification. This is a logic bug that makes the donation confirmation code entirely bypassable.

**Fix:** Either disable the QR button when no code is present, or (for the current dummy implementation) simply remove the `onClick` from the viewport button until real camera scanning is implemented:

```tsx
{/* QR scanner viewport — no onClick; real camera integration pending */}
<div
  style={{
    position: 'relative', width: '100%', height: 188, marginTop: 16,
    border: 'none', borderRadius: 16, background: 'var(--text-primary)',
    overflow: 'hidden',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  }}
>
  {/* … corner decorations … */}
</div>
```

Alternatively, if the intent is "scanning completes instantly in the dummy flow", add the guard:
```tsx
onClick={confirmReady ? handleConfirmInApp : undefined}
```

---

### CR-03: `handleVerified` is async but `onVerified` prop is typed `(code: string) => void` — errors are unhandled Promise rejections

**File:** `src/App.tsx:111` / `src/App.tsx:168`
**Issue:** `OtpVerification` declares its prop as `onVerified: (code: string) => void` (sync, no return). `App.tsx` defines:

```typescript
const handleVerified = async () => {  // returns Promise<void>
  const { data: profile } = await supabase.from('profiles')...
  setScreen(profile ? 'home' : 'intent')
}
```

TypeScript allows assigning `() => Promise<void>` to `() => void` because `void` is permissive — so the compiler does not catch this. The consequence is:
- If the Supabase query inside `handleVerified` throws (network error, RLS rejection, etc.), the Promise rejects with no `.catch()` handler, producing an unhandled rejection that is silently swallowed at the call site (`if (code.length === OTP_LENGTH) onVerified(code)`).
- The prop signature also declares a `code: string` parameter that `handleVerified` ignores — a mismatch that will matter once real OTP verification validates the code server-side.

**Fix:** Update `OtpVerification`'s prop type to accept an async handler, and add error handling in `handleVerified`:

```typescript
// src/screens/OtpVerification.tsx — prop interface
onVerified: (code: string) => void | Promise<void>
```

```typescript
// src/App.tsx — guard the async handler
const handleVerified = async (_code: string) => {
  try {
    const { data: profile } = await supabase
      .from('profiles')
      .select('id')
      .eq('phone', phone)
      .maybeSingle()
    setScreen(profile ? 'home' : 'intent')
  } catch (err) {
    console.error('Profile lookup failed:', err)
    // Fall back to intent choice so the user is not stuck
    setScreen('intent')
  }
}
```

---

## Warnings

### WR-01: `initAuth` never sets `supabaseId` for brand-new anonymous users — new user always starts with `supabaseId: null`

**File:** `src/App.tsx:98-101`
**Issue:** In `initAuth`, after `signInAnonymously()` succeeds, the code runs:

```typescript
const { data: profile } = await supabase
  .from('profiles')
  .select('id, is_donor')
  .eq('id', confirmedSession.user.id)
  .maybeSingle()
if (profile) {
  setUser((u) => ({ ...u, supabaseId: confirmedSession.user.id }))
  setScreen('home')
}
```

A brand-new anonymous user has no profile row yet (it is created later by donor/request setup flows), so `profile` is `null`, the `if (profile)` block is skipped, and `supabaseId` is never set. `user.supabaseId` will remain `null` for the entire first session, even though a valid Supabase user ID exists. Any downstream code that gates writes on `supabaseId !== null` will silently fail to persist data for new users.

**Fix:** Always set `supabaseId` from the confirmed session, regardless of whether a profile row exists:

```typescript
if (result.ok) {
  const { session: confirmedSession } = result
  // Always record the Supabase UID — profile row may not exist yet for new users
  setUser((u) => ({ ...u, supabaseId: confirmedSession.user.id }))

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, is_donor')
    .eq('id', confirmedSession.user.id)
    .maybeSingle()
  if (profile) {
    setScreen('home')  // returning user — skip phone entry
  }
}
```

---

### WR-02: `is_donor` fetched from `profiles` but never read — wasted network bytes and dead code

**File:** `src/App.tsx:95`
**Issue:** The `initAuth` select query fetches `'id, is_donor'`, but only `confirmedSession.user.id` is used. `profile.is_donor` is never read. This is dead data: it adds a column to the DB response for nothing, and the `is_donor` value (which should drive routing — a returning donor skips intent-choice) is ignored. The user is routed to `'home'` unconditionally for any returning user with a profile, whether they are a donor or not. The intent choice distinction is therefore lost for returning users.

**Fix:** Either actually use `is_donor` for routing, or drop the column from the select to keep the query minimal:

```typescript
// Option A: drop unused column
.select('id')

// Option B: use it (when routing logic is ready)
if (profile) {
  setUser((u) => ({
    ...u,
    supabaseId: confirmedSession.user.id,
    donorSetupComplete: profile.is_donor ?? false,
  }))
  setScreen('home')
}
```

---

### WR-03: `supabase.ts` passes `undefined` to `createClient` when env vars are absent — produces an opaque runtime crash

**File:** `src/lib/supabase.ts:8-11`
**Issue:** `import.meta.env.VITE_SUPABASE_URL` and `import.meta.env.VITE_SUPABASE_ANON_KEY` are typed as `string` in `vite-env.d.ts`, which satisfies TypeScript. But Vite injects `undefined` at runtime for any missing env variable. `createClient(undefined, undefined)` does not throw immediately — it creates a client object that fails on every network call with a confusing "invalid URL" error that is hard to trace to the missing env file.

**Fix:** Add a runtime guard at module load time:

```typescript
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    '[blood-help] Missing env vars: VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY must be set in .env.local'
  )
}

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey)
```

---

### WR-04: `onAuthStateChange` is exported from `auth.ts` but has no call site — and carries a subscription leak risk if ever used without the returned unsubscribe function

**File:** `src/auth.ts:21-26`
**Issue:** `onAuthStateChange` is exported but not imported anywhere in the codebase. If it is ever used without calling the returned `() => void` unsubscribe function (e.g., in a `useEffect` without a cleanup return), Supabase will hold a persistent listener across remounts. The function is also unnecessary given that `App.tsx` drives all session logic via the `initAuth` one-shot pattern and `supabase.auth.onAuthStateChange` is already available directly.

**Fix:** If the subscription listener is not planned for this phase, remove it from `auth.ts` to avoid dead exports (TypeScript `noUnusedLocals` does not catch exported dead code). If it will be used, document the required usage pattern:

```typescript
// Must be used inside useEffect with cleanup:
useEffect(() => {
  return onAuthStateChange((session) => { ... })  // returns unsubscribe
}, [])
```

---

## Info

### IN-01: `lang` prop in `RequestLive` suppressed with eslint-disable comment instead of TypeScript `_` convention

**File:** `src/screens/RequestLive.tsx:69`
**Issue:** The component uses `lang: _lang, // eslint-disable-line @typescript-eslint/no-unused-vars` to silence an unused-variable error. The project enforces `noUnusedLocals` at the TypeScript compiler level (tsconfig.app.json). The `_` prefix convention (`_lang`) is the standard TypeScript way to declare an intentionally unused parameter without needing an ESLint suppress comment. The eslint-disable comment is redundant alongside the `_` prefix and adds noise.

**Fix:** The `_` prefix alone is sufficient — remove the eslint-disable comment:

```typescript
export function RequestLive({
  lang: _lang,   // intentionally unused until i18n is wired
  bloodType = 'B+',
  ...
```

---

### IN-02: `getSession` from `auth.ts` is used redundantly in `initAuth` — duplicates a direct `supabase.auth.getSession()` call made two lines above

**File:** `src/App.tsx:78` and `src/App.tsx:90`
**Issue:** `initAuth` calls `supabase.auth.getSession()` directly on line 78, then calls the `getSession()` wrapper from `auth.ts` on line 90, which internally calls `supabase.auth.getSession()` again. This makes two round-trips to the same localStorage-backed session store when one is enough. The `getSession` import is used only for this redundant second call — the wrapping adds no value here because the `ok: false` path is not acted on differently than checking the result inline.

**Fix:** Replace the second call with a direct inline check (as shown in the PATTERNS.md reference implementation), eliminating the redundant import:

```typescript
// After signInAnonymously succeeds or session existed:
const { data: { session: confirmedSession } } = await supabase.auth.getSession()
if (confirmedSession) {
  // ... profile lookup
}
```

If `getSession` from `auth.ts` is not used elsewhere, remove the import from `App.tsx`.

---

_Reviewed: 2026-06-21_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
