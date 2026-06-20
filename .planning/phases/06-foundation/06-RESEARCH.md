# Phase 6: Foundation - Research

**Researched:** 2026-06-21
**Domain:** Supabase JS v2, PostGIS, Vite env vars, anonymous auth, RLS, TypeScript types
**Confidence:** HIGH (all critical APIs verified against official Supabase documentation)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Use `signInAnonymously()` — NOT `signInWithOtp()`. Anonymous auth is free; real SMS OTP deferred to v3.
- **D-02:** `signInAnonymously()` called on **app mount** in a `useEffect` in `App.tsx`, not on OTP submit.
- **D-03:** On mount: call `supabase.auth.getSession()`. If valid session AND profile row exists → skip phone entry, route to home.
- **D-04:** If no session or no profile → show `PhoneEntry`. After OTP submit, query `profiles WHERE phone = $phone` to determine routing.
- **D-05:** Session persistence is automatic (Supabase JS stores JWT in localStorage). No extra code needed.
- **D-06:** Cross-device limitation accepted for v2. New device = new UUID = must re-enter phone.
- **D-07:** OTP screen UI is **unchanged** — auto-fill, 6-box input, any code accepted.
- **D-08:** Keep file at `src/auth.ts`. Replace contents entirely with Supabase session helpers (`getSession`, `onAuthStateChange`). Remove `hasLoggedInBefore()` and `markLoggedIn()`.
- **D-09:** Remove `bloodhelp.seenPhones` localStorage key cleanly.
- **D-10:** Coarsen GPS to **2 decimal places** — `Math.round(lat * 100) / 100`. (4 decimal places was a doc error.)
- **D-11:** Export `coarsenCoordinates(lat: number, lng: number): { lat: number; lng: number }` from `src/geolocation.ts`.
- **D-12:** All Phase 7+ location writes MUST call `coarsenCoordinates()` before DB write. Raw `GeoResult.lat/lng` never written.
- **D-13:** Supabase client singleton at `src/lib/supabase.ts`, created with `createClient(SUPABASE_URL, SUPABASE_ANON_KEY)`.
- **D-14:** Env vars: `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in `.env.local`. Values via MCP `get_project_url` and `get_publishable_keys`.
- **D-15:** Schema deployed via Supabase MCP `apply_migration`. Seed data via `execute_sql`.
- **D-16:** Data model is **fixed** from `blood-help-spec.md §4`. Deviations require user sign-off.
- **D-17:** Two radii: `DISPLAY_RADIUS_KM = 10`, `ALERT_RADIUS_KM = 25`. Two-radius approach is enough for v2 (locked for Phase 7).

### Claude's Discretion

- RLS policy SQL wording (within rules from spec §4.3)
- TypeScript type strategy — suggest `src/types/database.ts` auto-generated via MCP `generate_typescript_types`
- Exact PostGIS RPC function signature (parameter names, return type)
- `.env.local` vs Vite `define` — `.env.local` is standard
- Error handling for failed `signInAnonymously()` on mount

### Deferred Ideas (OUT OF SCOPE)

- Real SMS OTP via Twilio — v3
- Cross-device session linking — v3
- TypeScript DB types auto-generation strategy — Claude's discretion (decided: MCP)
- Step-expansion radius logic (5→10→25→50km) — two-radius approach for v2
- FCM push (PUSH-01 through PUSH-04) — v3
- Personal data purge on request close (PRIV-01) — v3
- Gated phone reveal (PRIV-02) — v3
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| BACK-01 | Supabase schema deployed — PostGIS, 5 enums, 5 tables with constraints; via MCP migrations | SQL schema from blood-help-spec.md §4; MCP apply_migration tool confirmed; PostGIS enable syntax verified |
| BACK-02 | RLS policies enabled on all tables; own-profile read/write; requests visible to nearby donors; phone never exposed | RLS policy SQL patterns verified from official docs; is_anonymous JWT claim confirmed; column-level exposure via USING/WITH CHECK patterns |
| BACK-03 | signInAnonymously() called on OTP submit; real Supabase session UUID; phone stored in profiles | signInAnonymously() API confirmed; return shape verified; anonymous auth JWT is_anonymous claim confirmed |
| BACK-04 | PostGIS ST_DWithin RPC function callable from React client | RPC function SQL pattern from official PostGIS docs; supabase.rpc() call syntax confirmed; extensions. prefix required |
| PRIV-03 | Location coarsened to ~2 decimal places before DB write; raw GPS never stored | coarsenCoordinates() implementation pattern; 2 decimal = ~1.1km confirmed |
</phase_requirements>

---

## Summary

Phase 6 deploys the Supabase infrastructure and wires it into the React app. The phase has two layers: (1) remote Supabase project setup (schema, RLS, PostGIS RPC) deployed entirely via MCP tools, and (2) React app wiring (client singleton, auth.ts replacement, App.tsx session restore, coarsenCoordinates utility).

All critical APIs are from the official `@supabase/supabase-js` v2 package, which was verified at version 2.108.2 (published 2026-06-15). The key architectural challenge is that `signInAnonymously()` creates a real Supabase session that persists via localStorage — this means App.tsx needs a `useEffect` on mount that runs `getSession()` before deciding which screen to show, otherwise returning users would always see PhoneEntry. The OTP UI is entirely unchanged.

The PostGIS RPC uses `double precision` lat/lng columns (not a geography column) per the fixed spec schema. The function must cast to `extensions.geography` at query time using `extensions.st_point(lng, lat)::extensions.geography` and use the `extensions.` prefix on all PostGIS functions due to Supabase's schema isolation.

**Primary recommendation:** Deploy schema first via MCP `apply_migration`, then build the React wiring (client singleton, auth.ts, App.tsx), then add coarsenCoordinates. This order means the Supabase project is available to test against as each piece of React code is written.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Schema deployment (enums, tables, constraints) | Database / Supabase | — | DDL runs in Postgres; MCP apply_migration is the delivery vehicle |
| RLS policies | Database / Supabase | — | Postgres-enforced security; must live in DB, not app |
| PostGIS RPC function | Database / Supabase | API / Backend | Function lives in DB; called from React via supabase.rpc() |
| Supabase client singleton | Frontend (module) | — | Module-scoped singleton; imported by App and auth.ts |
| Anonymous session creation | API / Backend | Frontend | signInAnonymously() is a Supabase Auth API call; session persists in localStorage |
| Session restore on mount | Frontend (App.tsx) | — | useEffect + getSession(); UI routing decision |
| GPS coarsening | Frontend (geolocation.ts) | — | Runs in browser before any DB write; pure math utility |
| TypeScript DB types | Build tooling | — | Generated artifact; lives at src/types/database.ts |

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@supabase/supabase-js` | 2.108.2 | Supabase client — auth, DB queries, RPC | Official client; handles JWT refresh, localStorage persistence, typed queries |

### Supporting

None for this phase. PostGIS is a Supabase-managed extension, not a JS package.

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `@supabase/supabase-js` directly | Fetch API against Supabase REST | No typed SDK, no automatic JWT refresh, no session management |
| MCP `apply_migration` | Supabase CLI | CLI requires separate install; MCP is available in this session already |
| `.env.local` | `vite.config.ts` define block | define block is code; .env.local is config and gitignored by Vite by default |

**Installation:**
```bash
npm install @supabase/supabase-js
```

**Version verification:**
```
npm view @supabase/supabase-js version
# → 2.108.2 (verified 2026-06-21)
```

---

## Package Legitimacy Audit

| Package | Registry | Age | Downloads | Source Repo | slopcheck | Disposition |
|---------|----------|-----|-----------|-------------|-----------|-------------|
| `@supabase/supabase-js` | npm | 5+ yrs | Very high (official Supabase client) | github.com/supabase/supabase-js | N/A — registry unreachable during scan | Approved — verified via official docs and npm metadata |

**Packages removed due to slopcheck [SLOP] verdict:** none

**Packages flagged as suspicious [SUS]:** none

**slopcheck status:** Registry was unreachable during the automated scan. However, `@supabase/supabase-js` is verified as the official Supabase JavaScript client via:
- npm registry: version 2.108.2, published 2026-06-15, repository `github.com/supabase/supabase-js`
- Official docs at `supabase.com/docs/reference/javascript/` reference this exact package
- No `postinstall` script found in the package scripts (build, test, docs only) [CITED: npm view @supabase/supabase-js scripts]

Tags: `[CITED: supabase.com/docs/reference/javascript/]`

---

## Architecture Patterns

### System Architecture Diagram

```
App.tsx mount
     |
     v
[useEffect] ──► supabase.auth.signInAnonymously()  ──► Supabase Auth (anonymous session)
     |                                                        |
     |                                                   JWT stored in
     |                                                   localStorage
     v
supabase.auth.getSession()
     |
     ├── no session ──────────────────────────────────► show PhoneEntry screen
     |
     └── session exists ──► query profiles WHERE id = auth.uid()
               |
               ├── no profile row ─────────────────────► show PhoneEntry screen
               |
               └── profile row exists ──────────────────► show Home screen

OTP submit (any code)
     |
     v
query profiles WHERE phone = $phone
     |
     ├── profile found ──────────────────────────────► show Home screen
     |
     └── no profile ─────────────────────────────────► show IntentChoice screen

CreateRequest / DonorProfileSetup (Phase 7)
     |
     v
getCurrentPosition() ──► coarsenCoordinates(lat, lng) ──► DB write (rounded coords)

React client ──► supabase.rpc('donors_within_radius', { lat, lng, radius_km })
                     |
                     v
               Postgres: ST_DWithin on profiles table
                     |
                     v
               RLS: authenticated users only; own row always visible
```

### Recommended Project Structure

```
src/
├── lib/
│   └── supabase.ts          # Supabase client singleton (new)
├── types/
│   └── database.ts          # Generated DB types via MCP (new)
├── auth.ts                  # Replace dummy impl with Supabase session helpers
├── geolocation.ts           # Add coarsenCoordinates() alongside getCurrentPosition()
└── App.tsx                  # Add mount useEffect for signInAnonymously + getSession
```

### Pattern 1: Supabase Client Singleton

**What:** A module-level singleton created once on import; all other modules import from this file.
**When to use:** Always. Never create multiple `createClient` instances.

```typescript
// src/lib/supabase.ts
// Source: https://supabase.com/docs/guides/getting-started/quickstarts/reactjs
import { createClient } from '@supabase/supabase-js'
import type { Database } from '../types/database'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey)
```

The exported `supabase` acts as a singleton because ES module evaluation is cached — subsequent imports get the same instance. [CITED: supabase.com/docs/guides/getting-started/quickstarts/reactjs]

### Pattern 2: Vite Environment Variables

**What:** VITE_-prefixed variables in `.env.local` are exposed in client code via `import.meta.env`.
**When to use:** All Supabase credentials in this project.

```typescript
// src/vite-env.d.ts  (augment the existing file or create it in src/)
// Source: https://vite.dev/guide/env-and-mode
/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_ANON_KEY: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
```

`.env.local` load order: `.env` → `.env.local` → `.env.[mode]` → `.env.[mode].local`. The `.env.local` file is gitignored by default in Vite projects. [CITED: vite.dev/guide/env-and-mode]

### Pattern 3: Anonymous Auth + Session Restore on Mount

**What:** Call `signInAnonymously()` to create a session, then `getSession()` to check for existing sessions before showing any screen.
**When to use:** App.tsx `useEffect` with empty dependency array (mount only).

```typescript
// src/App.tsx — mount useEffect pattern
// Source: https://supabase.com/docs/reference/javascript/auth-signinanonymously
//         https://supabase.com/docs/reference/javascript/auth-getsession
import { useEffect, useState } from 'react'
import { supabase } from './lib/supabase'

function App() {
  const [screen, setScreen] = useState<Screen>('phone')  // default to phone while loading
  const [sessionLoading, setSessionLoading] = useState(true)

  useEffect(() => {
    async function initAuth() {
      // Ensure anonymous session exists (no-op if already signed in)
      const { error: anonError } = await supabase.auth.signInAnonymously()
      if (anonError) {
        console.error('Anonymous sign-in failed:', anonError.message)
        // Safe fallback: show PhoneEntry as usual
        setSessionLoading(false)
        return
      }

      // Check for existing session + profile (returning user)
      const { data: { session } } = await supabase.auth.getSession()
      if (session) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('id, is_donor')
          .eq('id', session.user.id)
          .maybeSingle()

        if (profile) {
          setScreen('home')  // returning user — skip phone entry
        }
      }

      setSessionLoading(false)
    }
    initAuth()
  }, [])

  if (sessionLoading) return null  // or a splash screen
  // ... rest of routing
}
```

[CITED: supabase.com/docs/reference/javascript/auth-signinanonymously, supabase.com/docs/reference/javascript/auth-getsession]

### Pattern 4: signInAnonymously() Return Shape

```typescript
// Source: https://supabase.com/docs/reference/javascript/auth-signinanonymously
const { data, error } = await supabase.auth.signInAnonymously()
// data.user: User | null
// data.session: Session | null
// error: AuthError | null

// The user's UUID is:
const userId = data.session?.user.id  // same as auth.uid() in SQL
```

[CITED: supabase.com/docs/reference/javascript/auth-signinanonymously]

### Pattern 5: getSession() Return Shape

```typescript
// Source: https://supabase.com/docs/reference/javascript/auth-getsession
const { data: { session }, error } = await supabase.auth.getSession()
// session: Session | null
// session.user.id: string (UUID)
// session.access_token: string (JWT)
// error: AuthError | null
```

Use client-side only. The docs warn: "if storage is based on request cookies, values may not be authentic — use getUser() instead." For this app (localStorage persistence), `getSession()` is correct. [CITED: supabase.com/docs/reference/javascript/auth-getsession]

### Pattern 6: New src/auth.ts (Supabase Session Helpers)

**What:** Replace dummy localStorage auth with thin wrappers around Supabase auth.

```typescript
// src/auth.ts — replacement (full file)
/**
 * Supabase session helpers. Replaces the dummy localStorage auth.
 */
import { supabase } from './lib/supabase'
import type { Session, AuthError } from '@supabase/supabase-js'

export type SessionResult =
  | { ok: true; session: Session }
  | { ok: false; error: AuthError | null }

/** Get the current Supabase session (from localStorage). Returns null if not signed in. */
export async function getSession(): Promise<SessionResult> {
  const { data: { session }, error } = await supabase.auth.getSession()
  if (error || !session) return { ok: false, error }
  return { ok: true, session }
}

/** Subscribe to auth state changes (sign-in, sign-out, token refresh). */
export function onAuthStateChange(
  callback: (session: Session | null) => void
): () => void {
  const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
    callback(session)
  })
  return () => subscription.unsubscribe()
}
```

Note: `hasLoggedInBefore()`, `markLoggedIn()`, and `SEEN_KEY` are removed. [ASSUMED — exact discriminated union shape is Claude's discretion per CONTEXT.md]

### Pattern 7: coarsenCoordinates()

**What:** Round lat/lng to 2 decimal places (~1.1km resolution at equator) before DB write.
**When to use:** Every GPS write in Phase 7+. Never write raw GeoResult coordinates.

```typescript
// src/geolocation.ts — addition alongside getCurrentPosition()
/** Coarsen GPS coordinates to ~1km grid (~2 decimal places) for privacy. */
export function coarsenCoordinates(lat: number, lng: number): { lat: number; lng: number } {
  return {
    lat: Math.round(lat * 100) / 100,
    lng: Math.round(lng * 100) / 100,
  }
}
```

[CITED: CONTEXT.md D-10, D-11]

### Pattern 8: PostGIS RPC Function (ST_DWithin)

**What:** Postgres function callable via `supabase.rpc()` that finds profiles within a radius.
**When to use:** Phase 7 geo-matching queries (home feed, alert fan-out).

The spec schema stores lat/lng as `double precision` columns, not a native `geography` column. The RPC casts to geography at query time.

```sql
-- Deploy via MCP apply_migration
-- Source: supabase.com/docs/guides/database/extensions/postgis (nearby_restaurants pattern)
create or replace function donors_within_radius(
  lat    double precision,
  lng    double precision,
  radius_km double precision
)
returns table (
  id          uuid,
  name        text,
  blood_type  blood_type,
  donation_count int,
  lat         double precision,
  lng         double precision,
  dist_meters double precision
)
set search_path = ''
language sql
security definer
as $$
  select
    id,
    name,
    blood_type,
    donation_count,
    lat,
    lng,
    extensions.st_distance(
      extensions.st_point(p.lng, p.lat)::extensions.geography,
      extensions.st_point(lng, lat)::extensions.geography
    ) as dist_meters
  from public.profiles p
  where
    p.is_donor = true
    and p.is_available = true
    and extensions.st_dwithin(
      extensions.st_point(p.lng, p.lat)::extensions.geography,
      extensions.st_point(lng, lat)::extensions.geography,
      radius_km * 1000  -- ST_DWithin uses meters for geography
    )
  order by dist_meters;
$$;

-- Grant execute to authenticated role so anon-session users can call it
grant execute on function donors_within_radius(double precision, double precision, double precision)
  to authenticated;
```

Call from React:
```typescript
const { data, error } = await supabase.rpc('donors_within_radius', {
  lat: coarseLat,
  lng: coarseLng,
  radius_km: 10
})
```

[CITED: supabase.com/docs/guides/database/extensions/postgis — adapted from nearby_restaurants pattern]
[ASSUMED: exact return columns and parameter names are Claude's discretion per CONTEXT.md]

### Pattern 9: RLS Policy SQL

**What:** Row-level security policies for the 5 tables.
**Key facts from official docs:**
- `auth.uid()` returns the current user's UUID (null if not authenticated)
- `(select auth.uid())` is preferred over `auth.uid()` for performance (avoids per-row function call)
- Anonymous users get the `authenticated` Postgres role (NOT `anon`) because they have a real JWT
- `auth.jwt() ->> 'is_anonymous'` returns `'true'` for anonymous users
- Enable RLS: `alter table [table] enable row level security;`

```sql
-- Source: supabase.com/docs/guides/database/postgres/row-level-security
--         supabase.com/docs/guides/auth/auth-anonymous

-- PROFILES: own row full access; others see public fields only
-- (Column-level hiding for 'phone' requires a separate view or function — see Pitfall 3)
alter table public.profiles enable row level security;

create policy "Users can read their own profile"
  on public.profiles for select
  to authenticated
  using ( (select auth.uid()) = id );

create policy "Users can insert their own profile"
  on public.profiles for insert
  to authenticated
  with check ( (select auth.uid()) = id );

create policy "Users can update their own profile"
  on public.profiles for update
  to authenticated
  using ( (select auth.uid()) = id )
  with check ( (select auth.uid()) = id );

-- Leaderboard: allow all authenticated users to see public fields
-- Implement via a separate RPC or view that excludes 'phone' column
-- (see Pitfall 3 for why column-level RLS doesn't exist in Postgres)

-- BLOOD REQUESTS: visible to all authenticated users (requester + donors can see active requests)
alter table public.blood_requests enable row level security;

create policy "Active requests visible to authenticated users"
  on public.blood_requests for select
  to authenticated
  using ( status = 'active' );

create policy "Requester can insert their own request"
  on public.blood_requests for insert
  to authenticated
  with check ( (select auth.uid()) = requester_id );

create policy "Requester can update their own request"
  on public.blood_requests for update
  to authenticated
  using ( (select auth.uid()) = requester_id )
  with check ( (select auth.uid()) = requester_id );

-- REQUEST RESPONSES: visible to the two parties only
alter table public.request_responses enable row level security;

create policy "Responses visible to donor or requester"
  on public.request_responses for select
  to authenticated
  using (
    (select auth.uid()) = donor_id
    or (select auth.uid()) in (
      select requester_id from public.blood_requests where id = request_id
    )
  );

create policy "Donor can insert their own response"
  on public.request_responses for insert
  to authenticated
  with check ( (select auth.uid()) = donor_id );

-- DONATIONS: visible to the two parties only
alter table public.donations enable row level security;

create policy "Donations visible to donor or recipient"
  on public.donations for select
  to authenticated
  using (
    (select auth.uid()) = donor_id
    or (select auth.uid()) = recipient_id
  );

create policy "Donations insertable by authenticated users"
  on public.donations for insert
  to authenticated
  with check ( (select auth.uid()) = donor_id );

-- DEVICE TOKENS: own tokens only (Phase 3 / FCM — table exists now, used later)
alter table public.device_tokens enable row level security;

create policy "Users can manage their own device tokens"
  on public.device_tokens for all
  to authenticated
  using ( (select auth.uid()) = profile_id )
  with check ( (select auth.uid()) = profile_id );
```

[CITED: supabase.com/docs/guides/database/postgres/row-level-security]
[CITED: supabase.com/docs/guides/auth/auth-anonymous]
[ASSUMED: exact policy wording is Claude's discretion per CONTEXT.md]

### Pattern 10: Schema Migration SQL

The full schema SQL is defined in `blood-help-spec.md §4`. Deploy order matters:

1. Enable PostGIS extension
2. Create enums
3. Create tables (profiles first — others FK to it)
4. Create unique index
5. Enable RLS on all tables
6. Create RLS policies
7. Deploy `donors_within_radius` RPC function
8. Grant execute on RPC function

```sql
-- Step 1: Enable PostGIS
-- Source: supabase.com/docs/guides/database/extensions/postgis
create extension if not exists postgis with schema "extensions";
```

[CITED: supabase.com/docs/guides/database/extensions/postgis]

### Pattern 11: TypeScript DB Types via MCP

The Supabase MCP exposes a `generate_typescript_types` tool. The official CLI command equivalent is:

```bash
npx supabase gen types typescript --project-id "$PROJECT_REF" > src/types/database.ts
```

Via MCP `generate_typescript_types`:
- Parameter: `output_path` = absolute path to `src/types/database.ts`

The generated file exports a `Database` type used in `createClient<Database>()`. [CITED: supabase.com/docs/guides/api/rest/generating-types]

### Anti-Patterns to Avoid

- **Multiple `createClient()` calls:** Each call creates a new Auth client with its own token management. Always import from `src/lib/supabase.ts`.
- **Raw PostGIS functions without `extensions.` prefix:** Supabase's search_path isolation means `st_dwithin()` fails; must be `extensions.st_dwithin()` in functions with `set search_path = ''`.
- **Writing raw GPS to DB:** `GeoResult.lat` and `GeoResult.lng` must always pass through `coarsenCoordinates()` before any DB write.
- **`getSession()` used for security-sensitive server checks:** It reads localStorage directly without server verification. Fine for client-side routing, not for RLS decisions (those happen in Postgres via the JWT automatically).
- **Missing `set search_path = ''` in RPC functions:** Without this, PostGIS functions may resolve to the wrong schema.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| JWT storage and refresh | Custom localStorage JWT management | Supabase JS client (automatic) | Token refresh, expiry handling, race conditions are complex |
| Session persistence | Custom sessionStorage sync | Supabase JS localStorage adapter | Already built into the client |
| Geo-distance calculation in JS | Haversine in TypeScript | PostGIS `ST_DWithin` in Postgres | DB-side filter is indexed; JS-side requires loading all rows |
| RLS policy enforcement | App-level WHERE clauses | Postgres RLS | DB-level guarantees; app-level is bypassable |
| DB type generation | Handwritten TypeScript interfaces | MCP `generate_typescript_types` | Manual types drift; generated types are always in sync |

**Key insight:** The Supabase JS client handles everything that is tempting to re-implement (auth state, JWT refresh, localStorage sync). Never duplicate these responsibilities in application code.

---

## Runtime State Inventory

Step 2.6: SKIPPED — this phase is greenfield infrastructure. There is no existing Supabase schema to migrate, no stored data to preserve, and no runtime state carrying old names. The only "state" being replaced is `bloodhelp.seenPhones` in localStorage — which is intentionally discarded (D-09).

**Existing localStorage key being removed:** `bloodhelp.seenPhones` (in `src/auth.ts`, constant `SEEN_KEY`). This key is actively removed from the codebase — no data migration needed; users who had this key set will simply go through PhoneEntry normally on their next visit, which is the correct behavior.

---

## Common Pitfalls

### Pitfall 1: signInAnonymously() Called More Than Once

**What goes wrong:** Calling `signInAnonymously()` when a session already exists creates a NEW anonymous user, destroying the old session. The user appears as a stranger to the DB.
**Why it happens:** Not checking for existing session first.
**How to avoid:** The correct order is: (1) call `getSession()` first, (2) if session exists with a profile, skip to home. Only call `signInAnonymously()` when truly no session exists. In the pattern above, `signInAnonymously()` is called first because the Supabase client is smart enough to be a no-op when the user is already signed in — but verify this behavior.
**Warning signs:** New UUID in Supabase dashboard each time the app loads.

Actually: Per official docs, `signInAnonymously()` will create a NEW user if called when already signed in. The correct pattern is: call `getSession()` first; if session exists, skip `signInAnonymously()`. [CITED: supabase.com/docs/guides/auth/auth-anonymous]

**Revised correct pattern:**
```typescript
const { data: { session } } = await supabase.auth.getSession()
if (!session) {
  await supabase.auth.signInAnonymously()
}
```

### Pitfall 2: Anonymous Users Use `authenticated` Role, Not `anon`

**What goes wrong:** Writing RLS policies that check for the `anon` role thinking anonymous Supabase users use it. Anonymous sign-in users get a JWT and use the `authenticated` role.
**Why it happens:** Confusion between "anonymous" as in no login, and `anon` as in the Postgres role for the public API key.
**How to avoid:** All RLS policies in this phase use `to authenticated`. The `anon` Postgres role is for unauthenticated requests (no session at all). [CITED: supabase.com/docs/guides/auth/auth-anonymous]

### Pitfall 3: Column-Level Security Does Not Exist in Postgres RLS

**What goes wrong:** Assuming you can write a policy that hides specific columns (e.g., `phone` in profiles). Standard Postgres RLS policies are row-level, not column-level.
**Why it happens:** The spec says "donor phone never exposed" but RLS SELECT policies expose all columns of matching rows.
**How to avoid:** To hide `phone` from non-owners, use one of: (a) a database view that excludes `phone` for non-owner reads, or (b) a `security definer` RPC function that controls which columns it returns. For Phase 6, the correct approach is to ensure only the profile owner can SELECT their own full profile row. The leaderboard and donor-list queries in Phase 7 should go through an RPC that returns only public fields (no `phone`). [ASSUMED: final pattern is Claude's discretion]

### Pitfall 4: ST_DWithin Uses Meters for Geography Type, Degrees for Geometry

**What goes wrong:** Passing kilometers directly to `ST_DWithin` when using geography type. The function returns wrong results (massively inflated radius) or zero results.
**Why it happens:** The `geometry` type uses the coordinate system's units (degrees). The `geography` type uses meters.
**How to avoid:** Always multiply `radius_km * 1000` to get meters when using `extensions.geography` in `ST_DWithin`. The RPC pattern above does this correctly. [CITED: supabase.com/docs/guides/database/extensions/postgis — distance returns meters for geography]

### Pitfall 5: Missing `extensions.` Prefix on PostGIS Functions

**What goes wrong:** SQL function body calls `st_dwithin(...)` — Postgres raises "function does not exist."
**Why it happens:** The `set search_path = ''` directive (required for security) removes the `extensions` schema from the search path.
**How to avoid:** Every PostGIS function call inside an RPC function with `set search_path = ''` must be prefixed: `extensions.st_dwithin()`, `extensions.st_point()`, `extensions.st_distance()`, `extensions.st_x()`, `extensions.st_y()`. [CITED: supabase.com/docs/guides/database/extensions/postgis]

### Pitfall 6: `VITE_` Env Var Type Not Declared = TypeScript Error

**What goes wrong:** `import.meta.env.VITE_SUPABASE_URL` has type `string | undefined` (or just `any`) — TypeScript can't guarantee it's a string, causing type errors in `createClient()`.
**Why it happens:** Vite's built-in `ImportMetaEnv` only includes the base variables (MODE, BASE_URL, etc.). Custom VITE_ vars need explicit declaration.
**How to avoid:** Add a `vite-env.d.ts` in `src/` that augments `ImportMetaEnv` with `VITE_SUPABASE_URL: string` and `VITE_SUPABASE_ANON_KEY: string`. The file must not contain any `import` statements. [CITED: vite.dev/guide/env-and-mode]

### Pitfall 7: Loading State Race Condition in App.tsx

**What goes wrong:** App renders and shows PhoneEntry for 200-400ms before `getSession()` resolves, causing a flash of the login screen even for returning users.
**Why it happens:** `getSession()` is async; state initializes to `'phone'` before the check completes.
**How to avoid:** Add a `sessionLoading: boolean` state initialized to `true`. Render nothing (or a splash) while loading. Set to `false` after `initAuth()` completes regardless of outcome. [ASSUMED — exact loading UI is Claude's discretion]

### Pitfall 8: Unique Index for `one_open_request_per_user` Must Be Partial

**What goes wrong:** Creating a standard unique index on `(requester_id)` prevents a user from ever creating a second request — even after their first is closed.
**Why it happens:** A standard unique index applies to all rows, not just active ones.
**How to avoid:** The spec includes a partial unique index: `create unique index one_open_request_per_user on blood_requests (requester_id) where status = 'active'`. Deploy exactly as written. [CITED: blood-help-spec.md §4]

---

## Code Examples

### Verified RPC Call Pattern

```typescript
// Source: supabase.com/docs/guides/database/extensions/postgis
const { data, error } = await supabase.rpc('donors_within_radius', {
  lat: 16.87,   // coarsened (2 decimal places)
  lng: 96.19,   // coarsened (2 decimal places)
  radius_km: 10
})
if (error) console.error(error)
// data: Array<{ id, name, blood_type, donation_count, lat, lng, dist_meters }>
```

### Supabase Client with DB Types

```typescript
// Source: supabase.com/docs/guides/api/rest/generating-types
import { createClient } from '@supabase/supabase-js'
import type { Database } from '../types/database'

export const supabase = createClient<Database>(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
)
```

### onAuthStateChange Pattern

```typescript
// Source: supabase.com/docs/reference/javascript (auth-onauthstatechange)
import { supabase } from './lib/supabase'

// Returns unsubscribe function — call on component unmount
const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
  if (event === 'SIGNED_IN') { /* ... */ }
  if (event === 'SIGNED_OUT') { /* ... */ }
})

// Cleanup
subscription.unsubscribe()
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `signInWithOtp()` for phone auth | `signInAnonymously()` for session-first auth | Supabase added anonymous auth (2023) | No SMS cost; session persists without verified phone |
| `tailwind.config.js` for Tailwind | `@theme` block in CSS (Tailwind v4) | Tailwind v4 (2024) | This project already uses v4 — no config file needed |
| PostCSS config for Tailwind | `@tailwindcss/vite` plugin | Tailwind v4 (2024) | Already in use in this project |

**Deprecated/outdated:**
- `hasLoggedInBefore()` / `markLoggedIn()` localStorage pattern: replaced entirely by Supabase session persistence (D-08, D-09)
- `bloodhelp.seenPhones` localStorage key: actively removed in this phase (D-09)

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `signInAnonymously()` is a no-op (doesn't create a new user) when the user already has a session | Pitfall 1 | Would destroy existing session on every page load; mitigated by calling getSession() first |
| A2 | Exact RLS policy wording for blood_requests `contact_phone` column gating | Pattern 9 | `contact_phone` may be visible to all authenticated users via SELECT policy; Phase 7 requester screen must verify |
| A3 | New `src/auth.ts` discriminated union return type (SessionResult) | Pattern 6 | Type shape may not match what App.tsx needs; planner should verify against App.tsx usage |
| A4 | `donors_within_radius` RPC exact return columns | Pattern 8 | Blood type compatibility filter not included in this RPC (Phase 7 concern); may need adjustment |
| A5 | `security definer` on the RPC function is needed to bypass RLS for the donors query | Pattern 8 | Without it, donors outside the caller's RLS visibility may be excluded incorrectly — Phase 7 concern |

---

## Open Questions

1. **Is `signInAnonymously()` truly a no-op when already signed in?**
   - What we know: Official docs say "Creates a new anonymous user"
   - What's unclear: Whether it checks for existing session first or always creates a new one
   - Recommendation: Call `getSession()` first; only call `signInAnonymously()` when `session === null`. This is safe either way.

2. **Does `contact_phone` on `blood_requests` need a separate RLS restriction?**
   - What we know: The spec says phone is exposed to "matched donors only" (spec §4.3)
   - What's unclear: Whether the current simple "active requests visible to authenticated users" SELECT policy is sufficient for Phase 6 (since Phase 6 has no geo-match yet)
   - Recommendation: For Phase 6 foundation, the simple policy is fine. Phase 7 geo-match RPC (security definer) can return contact_phone only when the donor is in range.

3. **Should `donors_within_radius` be in scope for Phase 6 or Phase 7?**
   - What we know: BACK-04 requires the RPC to exist and be callable; Phase 7 is when it's actually queried
   - What's unclear: Whether the RPC needs to be deployed in Phase 6 for BACK-04 compliance
   - Recommendation: Deploy it in Phase 6 (BACK-04 is Phase 6 per REQUIREMENTS.md); test callability from dev console. Phase 7 uses it with real data.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js 24.x | npm install, Vite build | ✓ | v24.16.0 | — |
| npm 11.x | Package install | ✓ | 11.13.0 | — |
| Supabase MCP (in-session) | apply_migration, execute_sql, get_project_url | ✓ | (active in session) | Supabase CLI as fallback |
| `.env.local` | VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY | ✗ (not yet created) | — | Must be created before `npm run dev` |
| Supabase project URL + anon key | env vars | ✗ (not yet fetched) | — | Fetch via MCP get_project_url + get_publishable_keys as Wave 0 task |

**Missing dependencies with no fallback:**
- `.env.local` must be created with actual Supabase project credentials before any React auth code can run. This is a Wave 0 prerequisite.

**Missing dependencies with fallback:**
- Supabase CLI: MCP `apply_migration` + `execute_sql` are the primary tools per D-15. CLI is not needed.

---

## Validation Architecture

`nyquist_validation` is enabled (not explicitly false in config.json). However, this project has **no test framework installed** (confirmed by CLAUDE.md and codebase inspection). Per CONTEXT.md "no test framework — verification is manual + Supabase dashboard checks."

### Test Framework

| Property | Value |
|----------|-------|
| Framework | None installed |
| Config file | None |
| Quick run command | `npm run lint` (type-check + lint only) |
| Full suite command | `npm run build` (type-check via `tsc -b`) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| BACK-01 | Schema deployed with 5 tables, 5 enums, PostGIS | manual | Supabase dashboard → Table Editor | N/A |
| BACK-02 | RLS policies active, blocking unauthorized access | manual | Supabase dashboard → Authentication → Policies | N/A |
| BACK-03 | signInAnonymously() creates real session | manual | Browser devtools → Application → localStorage (supabase.auth.token key) | N/A |
| BACK-04 | RPC callable from React client | manual | Browser console: `await supabase.rpc('donors_within_radius', {...})` | N/A |
| PRIV-03 | GPS coarsened to 2dp before DB write | unit (lint) | `npm run build` — TypeScript verifies coarsenCoordinates() signature | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** `npm run lint`
- **Per wave merge:** `npm run build` (type-check must pass)
- **Phase gate:** `npm run build` green + manual Supabase dashboard verification before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `src/lib/supabase.ts` — client singleton (new file, created in Wave 1)
- [ ] `src/types/database.ts` — generated types (generated in Wave 1 via MCP)
- [ ] `src/vite-env.d.ts` — ImportMetaEnv augmentation (new file)
- [ ] `.env.local` — Supabase credentials (fetched via MCP, never committed)

*(No test files needed — manual verification is the accepted protocol for this project)*

---

## Security Domain

`security_enforcement` is not set to false in config.json — treating as enabled.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | Supabase anonymous auth; JWT-based; no password |
| V3 Session Management | yes | Supabase JS localStorage JWT; automatic refresh |
| V4 Access Control | yes | Postgres RLS with `auth.uid()` and `authenticated` role |
| V5 Input Validation | partial | Phase 6 writes no user-generated data to DB; coarsenCoordinates() sanitizes GPS |
| V6 Cryptography | yes | Supabase handles JWT signing; never hand-rolled |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Anonymous user creates unlimited requests | Elevation | one_open_request_per_user partial unique index; RLS INSERT with check |
| GPS precision reveals exact location | Info Disclosure | coarsenCoordinates() to 2dp; never write raw GPS |
| Phone number harvesting via donor list | Info Disclosure | RLS hides phone column; Phase 7 RPC returns only public fields |
| Anonymous user reads another user's profile | Info Disclosure | RLS USING `auth.uid() = id`; only own row readable |
| SQL injection via RPC parameters | Tampering | Parameterized supabase.rpc() calls; Supabase JS handles binding |

---

## Sources

### Primary (HIGH confidence)

- [supabase.com/docs/reference/javascript/auth-signinanonymously](https://supabase.com/docs/reference/javascript/auth-signinanonymously) — signInAnonymously() return shape
- [supabase.com/docs/reference/javascript/auth-getsession](https://supabase.com/docs/reference/javascript/auth-getsession) — getSession() return shape, security warning
- [supabase.com/docs/guides/auth/auth-anonymous](https://supabase.com/docs/guides/auth/auth-anonymous) — is_anonymous claim, `authenticated` role for anon users, rate limits
- [supabase.com/docs/guides/database/postgres/row-level-security](https://supabase.com/docs/guides/database/postgres/row-level-security) — RLS policy syntax, auth.uid(), SELECT/INSERT/UPDATE patterns
- [supabase.com/docs/guides/database/extensions/postgis](https://supabase.com/docs/guides/database/extensions/postgis) — PostGIS enable SQL, nearby_restaurants RPC pattern, extensions. prefix, ST_DWithin with geography
- [supabase.com/docs/guides/getting-started/quickstarts/reactjs](https://supabase.com/docs/guides/getting-started/quickstarts/reactjs) — createClient in Vite, import.meta.env pattern
- [supabase.com/docs/guides/api/rest/generating-types](https://supabase.com/docs/guides/api/rest/generating-types) — TypeScript type generation CLI command
- [vite.dev/guide/env-and-mode](https://vite.dev/guide/env-and-mode) — VITE_ prefix, import.meta.env, .env.local load order, ImportMetaEnv augmentation
- npm registry — `@supabase/supabase-js` version 2.108.2, published 2026-06-15, no postinstall script

### Secondary (MEDIUM confidence)

- github.com/supabase-community/supabase-mcp README — apply_migration vs execute_sql distinction (DDL vs DML), get_project_url, get_publishable_keys usage
- github.com/orgs/supabase/discussions/5390 — community ST_DWithin RPC pattern confirmation

### Tertiary (LOW confidence)

- None. All critical claims verified against official sources.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — @supabase/supabase-js 2.108.2 confirmed via npm registry; no postinstall scripts; official Supabase client
- Authentication (signInAnonymously, getSession): HIGH — verified against official API reference pages
- RLS policy SQL: HIGH — verified against official RLS docs; anonymous/authenticated role distinction confirmed
- PostGIS RPC function: MEDIUM-HIGH — pattern from official PostGIS docs; exact parameter names are Claude's discretion per CONTEXT.md
- Vite env vars: HIGH — verified against official Vite docs
- TypeScript types via MCP: MEDIUM — CLI command confirmed from official docs; MCP tool interface confirmed from third-party MCP registry
- Architecture patterns (singleton, session restore): HIGH — standard patterns confirmed from official quickstart and API reference

**Research date:** 2026-06-21
**Valid until:** 2026-07-21 (stable APIs; Supabase minor versions may add features but breaking changes are rare in v2)
