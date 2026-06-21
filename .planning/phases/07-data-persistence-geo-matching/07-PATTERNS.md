# Phase 7: Data Persistence + Geo-Matching — Pattern Map

**Mapped:** 2026-06-22
**Files analyzed:** 9 (new/modified)
**Analogs found:** 9 / 9

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| Supabase migration SQL (new) | migration | CRUD + DDL | `.planning/phases/06-foundation/06-03-PLAN.md` (donors_within_radius SQL) | exact — same RPC pattern, same extensions. prefix, same SECURITY DEFINER shape |
| `requests_within_radius` RPC (SQL, inside migration) | migration | request-response | existing `donors_within_radius` RPC (Phase 6 deployed) | exact — mirrors the function's signature, body, and GRANT pattern verbatim |
| `src/App.tsx` (expand initAuth + handlers) | component | request-response + CRUD | `src/App.tsx` lines 75–107 (existing `initAuth` useEffect) | self-analog — expand in-place |
| `src/screens/DonorProfileSetup.tsx` (add GeoPhase + write) | component | request-response + CRUD | `src/screens/CreateRequest.tsx` lines 33–181 (GeoPhase state machine + requestLocation) | exact — copy GeoPhase type, state, handleSave, requestLocationAndSave verbatim |
| `src/screens/CreateRequest.tsx` (make address required) | component | request-response | `src/screens/CreateRequest.tsx` line 52 (`postDisabled` guard) | self-analog — minimal change, add `address.trim().length === 0` to guard |
| `src/screens/Home.tsx` (replace DUMMY_REQUESTS with live feed) | component | request-response | `src/screens/Home.tsx` lines 10–51 (`NearbyRequest` type + `DUMMY_REQUESTS`) + `src/auth.ts` (discriminated-union async result pattern) | role-match — type refactor + useEffect live query replaces static const |
| `src/blood.ts` (add `COMPATIBLE_REQUEST_TYPES`) | utility | transform | `src/blood.ts` lines 1–4 (`BLOOD_TYPES`, `BloodType`) | exact — add `Record<BloodType, BloodType[]>` const in the same flat-module pattern |
| `src/types/database.ts` (regenerate post-migration) | config | n/a | `src/types/database.ts` (current generated file) | exact — same auto-generated structure; regenerated via MCP `generate_typescript_types` |
| `src/lib/supabase.ts` (unchanged singleton) | utility | request-response | `src/lib/supabase.ts` (current file) | unchanged — referenced by all new patterns |

---

## Pattern Assignments

### Supabase Migration SQL (new migration file)

**Analog:** `.planning/phases/06-foundation/06-03-PLAN.md` Task 1 (donors_within_radius RPC)

**Migration application pattern** — how to run it (from 06-03-PLAN.md):
Use Supabase MCP `apply_migration` tool with a single migration name. DDL steps go into `apply_migration`; DML seed steps go into `execute_sql`. The migration for Phase 7 is a single `apply_migration` call covering all schema DDL in dependency order (ALTER TABLE, CREATE TABLE, CREATE FUNCTION, CREATE TRIGGER, CREATE POLICY, GRANT, RENAME COLUMN).

**RPC body pattern** (from 06-03-PLAN.md Task 1 + 07-RESEARCH.md Step 5):
```sql
-- Pattern: set search_path = '' + extensions. prefix + SECURITY DEFINER + radius_km * 1000
CREATE OR REPLACE FUNCTION public.donors_within_radius(
  lat double precision,
  lng double precision,
  radius_km double precision
)
RETURNS TABLE (...)
SET search_path = ''
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT
    d.id,
    extensions.st_distance(
      extensions.st_point(d.lng, d.lat)::extensions.geography,
      extensions.st_point(lng, lat)::extensions.geography
    ) AS dist_meters
  FROM public.donors d
  WHERE
    d.is_available = true
    AND extensions.st_dwithin(
      extensions.st_point(d.lng, d.lat)::extensions.geography,
      extensions.st_point(lng, lat)::extensions.geography,
      radius_km * 1000   -- ALWAYS multiply by 1000: geography uses meters
    )
  ORDER BY dist_meters;
$$;

GRANT EXECUTE ON FUNCTION public.donors_within_radius(double precision, double precision, double precision) TO authenticated;
```

**RLS policy pattern** (from `src/types/database.ts` — existing `profiles` RLS pattern via 06-CONTEXT.md + 07-RESEARCH.md Step 7):
```sql
-- Pattern: (SELECT auth.uid()) subquery for init-plan optimization
-- Apply to new donors table
CREATE POLICY "donors_select_own"
  ON public.donors FOR SELECT TO authenticated
  USING (profile_id = (SELECT auth.uid()));

CREATE POLICY "donors_insert_own"
  ON public.donors FOR INSERT TO authenticated
  WITH CHECK (profile_id = (SELECT auth.uid()));

CREATE POLICY "donors_update_own"
  ON public.donors FOR UPDATE TO authenticated
  USING (profile_id = (SELECT auth.uid()))
  WITH CHECK (profile_id = (SELECT auth.uid()));
```

**Seed data DML pattern** (from 06-03-PLAN.md Task 2):
```sql
-- Use execute_sql (not apply_migration) for DML seed data
-- Use ON CONFLICT ... DO NOTHING for idempotency
INSERT INTO public.donors (profile_id, blood_type, is_available, emergency_callable, donation_count, lat, lng, location_updated_at)
VALUES (...)
ON CONFLICT (profile_id) DO NOTHING;
```

---

### `requests_within_radius` RPC (SQL inside migration)

**Analog:** `donors_within_radius` (Phase 6 deployed RPC, mirrored in 07-RESEARCH.md Step 6)

This is the inverse of `donors_within_radius`: given a donor's coordinates, return nearby active blood requests with `dist_meters`. The body pattern is identical to the analog — only the source table changes from `donors` to `blood_requests`, and the WHERE clause filters `status = 'active' AND expires_at > now()` instead of `is_available = true`.

**Core pattern** (07-RESEARCH.md Step 6):
```sql
CREATE OR REPLACE FUNCTION public.requests_within_radius(
  lat double precision,
  lng double precision,
  radius_km double precision
)
RETURNS TABLE (
  id uuid,
  requester_id uuid,
  blood_type public.blood_type,
  current_address text,
  contact_phone text,
  units_needed int,
  units_collected int,
  urgency public.urgency,
  status public.request_status,
  created_at timestamptz,
  expires_at timestamptz,
  dist_meters double precision
)
SET search_path = ''
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT
    r.id,
    r.requester_id,
    r.blood_type,
    r.current_address,
    r.contact_phone,
    r.units_needed,
    r.units_collected,
    r.urgency,
    r.status,
    r.created_at,
    r.expires_at,
    extensions.st_distance(
      extensions.st_point(r.lng, r.lat)::extensions.geography,
      extensions.st_point(lng, lat)::extensions.geography
    ) AS dist_meters
  FROM public.blood_requests r
  WHERE
    r.status = 'active'
    AND r.expires_at > now()
    AND extensions.st_dwithin(
      extensions.st_point(r.lng, r.lat)::extensions.geography,
      extensions.st_point(lng, lat)::extensions.geography,
      radius_km * 1000
    )
  ORDER BY dist_meters;
$$;

GRANT EXECUTE ON FUNCTION public.requests_within_radius(double precision, double precision, double precision) TO authenticated;
```

**Critical rules carried from analog (06-03-PLAN.md Pitfalls):**
- Always `extensions.st_dwithin`, `extensions.st_point`, `extensions.st_distance` — never bare `ST_*` names when `set search_path = ''`
- Always `radius_km * 1000` — geography type uses meters
- Never chain `.select()` or `.single()` onto `supabase.rpc()` calls that insert/modify rows

---

### `src/App.tsx` — expand `initAuth` + update handlers

**Analog:** `src/App.tsx` lines 75–107 (existing `initAuth` useEffect) and lines 125–143 (dummy `handlePosted`, `handleSaveDonor`)

**Imports pattern** (lines 1–20 — carry forward, no changes to imports except possible addition of `coarsenCoordinates`):
```typescript
import { useState, useEffect } from 'react'
import { supabase } from './lib/supabase'
import type { BloodType } from './blood'
import type { Lang } from './i18n'
// Add when handleSaveDonor/handlePosted go live:
// import { COMPATIBLE_REQUEST_TYPES } from './blood'   // if used in App
```

**Existing initAuth pattern** (lines 75–107 — EXPAND, do not replace structure):
```typescript
useEffect(() => {
  async function initAuth() {
    // Check for existing session FIRST — only sign in anonymously when there is none
    const { data: { session } } = await supabase.auth.getSession()

    if (!session) {
      const { error } = await supabase.auth.signInAnonymously()
      if (error) {
        console.error('Anonymous sign-in failed:', error.message)
        setSessionLoading(false)
        return
      }
    }

    const result = await getSession()
    if (result.ok) {
      const { session: confirmedSession } = result
      // Phase 6: only checked profiles.id
      // Phase 7: also load donors row + active request (D-13, D-14)
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')           // was 'id, is_donor' — now full select
        .eq('id', confirmedSession.user.id)
        .maybeSingle()
      if (profile) {
        // NEW: load donors row (may be null — pure requester)
        const { data: donor } = await supabase
          .from('donors')
          .select('*')
          .eq('profile_id', confirmedSession.user.id)
          .maybeSingle()

        // NEW: load own active request
        const { data: activeRequest } = await supabase
          .from('blood_requests')
          .select('*')
          .eq('requester_id', confirmedSession.user.id)
          .eq('status', 'active')
          .maybeSingle()

        setUser({ ... })           // map profile + donor fields into UserState
        setRequestDraft(activeRequest ? { ... } : null)
        setScreen('home')
      }
    }

    setSessionLoading(false)
  }
  void initAuth()
}, [])
```

**Discriminated-union error handling pattern** (from `src/auth.ts` lines 7–18 and `src/geolocation.ts` lines 1–4):
```typescript
// Pattern: .maybeSingle() returns { data, error }
// data === null means 0 rows (expected for new user) — NOT an error
// Non-null error should be logged but routing must still complete (graceful degradation)
const { data: donor, error: donorErr } = await supabase
  .from('donors')
  .select('*')
  .eq('profile_id', uid)
  .maybeSingle()
if (donorErr) console.error('donor load error:', donorErr.message)
// donor === null is fine — user is a pure requester
```

**UserState expansion pattern** (lines 36–47 — add `lat`, `lng` fields):
```typescript
// Current UserState (lines 36-47):
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
  supabaseId: string | null
  // ADD for Phase 7 (D-06, Pitfall 6):
  lat: number | null
  lng: number | null
}
```

**handleSaveDonor pattern** (lines 132–144 currently dummy — replace with real upsert):
```typescript
// Pattern: two sequential upserts, each with { onConflict } specified
// Step 1: profiles upsert keyed by id
const { error: profileErr } = await supabase
  .from('profiles')
  .upsert({
    id: uid,
    name: profile.name,
    phone: normalizePhone(profile.phone),
    language: lang,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'id' })
if (profileErr) { /* show AlertDialog (D-18) */ return }

// Step 2: donors upsert keyed by profile_id — NEVER include donor_code (Pitfall 3)
const { error: donorErr } = await supabase
  .from('donors')
  .upsert({
    profile_id: uid,
    blood_type: profile.bloodType,
    emergency_callable: profile.showNumber,
    is_available: profile.available,
    lat: profile.lat,
    lng: profile.lng,
    location_updated_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }, { onConflict: 'profile_id' })
if (donorErr) { /* show AlertDialog (D-18) */ return }
```

**handlePosted pattern** (lines 125–129 currently dummy — replace with real insert):
```typescript
// Pattern: bare .insert() without chaining .select() or .single() (Pitfall 1)
// Check error.code === '23505' for unique-index violation (D-17 backstop)
const { error } = await supabase
  .from('blood_requests')
  .insert({
    requester_id: uid,
    blood_type: draft.bloodType,
    current_address: draft.address,   // D-05: renamed from township
    lat: draft.lat,
    lng: draft.lng,
    contact_phone: normalizePhone(draft.phone),
    units_needed: draft.units,
    urgency: draft.urgency,
    status: 'active',
    expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
  })
if (error) {
  if (error.code === '23505') { /* "already have active request" AlertDialog */ }
  else { /* generic write-failure AlertDialog (D-18) */ }
  return
}
```

**AlertDialog write-failure pattern** — same component used in CreateRequest for geo-denied (existing, lines 424–444 of CreateRequest.tsx). Add `[writeError, setWriteError]` state in App.tsx:
```typescript
// Pattern: reuse AlertDialog for write failures (D-18)
// Add to App.tsx state:
const [writeError, setWriteError] = useState<string | null>(null)

// In JSX alongside existing screens:
<AlertDialog
  open={writeError !== null}
  title={strings.errorTitle}
  message={writeError ?? ''}
  confirmLabel={strings.retry}
  onConfirm={() => setWriteError(null)}
  onCancel={() => setWriteError(null)}
/>
```

---

### `src/screens/DonorProfileSetup.tsx` — add GeoPhase + DB write

**Analog:** `src/screens/CreateRequest.tsx` lines 33–181 (complete GeoPhase state machine)

**Imports to add** (copy from CreateRequest.tsx lines 7–8):
```typescript
import { AlertDialog } from '../components/AlertDialog'
import { getCurrentPosition, coarsenCoordinates } from '../geolocation'
```

**GeoPhase type and state** (copy from CreateRequest.tsx lines 33 and 47):
```typescript
type GeoPhase = 'idle' | 'prealert' | 'requesting' | 'denied'
const [geoPhase, setGeoPhase] = useState<GeoPhase>('idle')
```

**DonorProfile interface expansion** (current lines 11–17 — add lat/lng, Pitfall 8):
```typescript
export interface DonorProfile {
  name: string
  bloodType: BloodType
  phone: string
  showNumber: boolean
  available: boolean
  // ADD — required by handleSaveDonor for donor GPS (D-10):
  lat: number
  lng: number
}
```

**Save handler with GeoPhase** (replaces current inline onClick at lines 287–289):
```typescript
// Replaces: onClick={() => { if (bloodType) onSave({...}) }}
// With the same pattern as CreateRequest.tsx lines 169–180:

const handleSave = () => {
  // guard: form fields (saveDisabled already handles this but be explicit)
  if (!bloodType || !name.trim() || phone.replace(/\D/g, '').length === 0) return
  setGeoPhase('prealert')   // open the pre-permission AlertDialog
}

const requestLocationAndSave = async () => {
  setGeoPhase('requesting')
  const res = await getCurrentPosition()
  if (res.ok && bloodType) {
    setGeoPhase('idle')
    const { lat, lng } = coarsenCoordinates(res.lat, res.lng)
    onSave({ name: name.trim(), bloodType, phone, showNumber, available, lat, lng })
  } else {
    setGeoPhase('denied')
  }
}
```

**AlertDialog placement** (copy structure from CreateRequest.tsx lines 423–444, closing inside the outer `phone-entry-card` div):
```typescript
{/* Pre-permission warning before native location prompt */}
<AlertDialog
  open={geoPhase === 'prealert' || geoPhase === 'requesting'}
  bodyFont={bodyFont}
  title={copy.geoTitle}
  message={copy.geoMsg}
  confirmLabel={copy.geoConfirm}
  cancelLabel={copy.geoCancel}
  onConfirm={requestLocationAndSave}
  onCancel={() => setGeoPhase('idle')}
/>

{/* Permission denied */}
<AlertDialog
  open={geoPhase === 'denied'}
  bodyFont={bodyFont}
  title={copy.deniedTitle}
  message={copy.deniedMsg}
  confirmLabel={copy.deniedConfirm}
  onConfirm={() => setGeoPhase('idle')}
  onCancel={() => setGeoPhase('idle')}
/>
```

**Button disabled during requesting** (copy from CreateRequest.tsx line 416):
```typescript
// Current:
disabled={saveDisabled}
// Change to:
disabled={saveDisabled || geoPhase === 'requesting'}
```

**Strings to add** — mirror CreateRequest.tsx's `geoTitle`, `geoMsg`, `geoConfirm`, `geoCancel`, `deniedTitle`, `deniedMsg`, `deniedConfirm` in both `my` and `en` objects.

---

### `src/screens/CreateRequest.tsx` — make `current_address` required

**Analog:** `src/screens/CreateRequest.tsx` line 52 (existing `postDisabled` guard)

**Current guard** (line 52):
```typescript
const postDisabled = !bloodType || phone.replace(/\D/g, '').length === 0
```

**Updated guard** (D-09 — address is now required):
```typescript
const postDisabled = !bloodType || phone.replace(/\D/g, '').length === 0 || address.trim().length === 0
```

**Remove "Optional" divider** — lines 326–342 render the `{copy.optional}` divider between address and units. Since address is now required (above the divider), the "Optional" label and divider should be removed entirely (or repositioned to mark only units/urgency as optional). The divider structure to remove:
```typescript
// Lines 327-342 — remove or reposition the optional divider
<div style={{ marginTop: 28, display: 'flex', alignItems: 'center', gap: 12 }}>
  <div style={{ flex: 1, height: 1, background: 'var(--border-card)' }} />
  <span style={{ ... }}>{copy.optional}</span>
  <div style={{ flex: 1, height: 1, background: 'var(--border-card)' }} />
</div>
```

**Address label strings** — remove `optional: 'ချန်လှပ်နိုင်သည်'` / `optional: 'Optional'` from `strings` objects (lines 55–99) or repurpose to mark only the units/urgency section.

No other changes to CreateRequest.tsx in Phase 7 — the GeoPhase state machine and `onPosted` callback are already wired; `App.handlePosted` now performs the DB write.

---

### `src/screens/Home.tsx` — replace DUMMY_REQUESTS with live feed

**Analog:** `src/screens/Home.tsx` lines 10–51 (existing `NearbyRequest` type + `DUMMY_REQUESTS`) and `src/auth.ts` lines 7–18 (discriminated-union async result pattern for useEffect load)

**Imports to add** (follow existing import pattern — relative paths, `import type` for types):
```typescript
import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { COMPATIBLE_REQUEST_TYPES } from '../blood'
import { formatNumber } from '../i18n'
```

**NearbyRequest type refactor** (replace lines 11–19):
```typescript
// Current (lines 11-19) — bilingual record fields for static dummy data:
interface NearbyRequest {
  id: string
  bloodType: BloodType
  township: Record<Lang, string>
  distance: Record<Lang, string>
  timeAgo: Record<Lang, string>
  urgent: boolean
  phone: string
}

// Replace with DB-derived shape (07-RESEARCH.md Pattern 9):
interface NearbyRequest {
  id: string
  bloodType: BloodType
  currentAddress: string   // single free-text field from blood_requests.current_address
  distMeters: number       // raw float from RPC dist_meters — format at render time
  createdAt: string        // ISO timestamp from blood_requests.created_at
  urgent: boolean
  phone: string            // E.164 contact_phone
}
```

**Remove DUMMY_REQUESTS** (lines 23–51) and replace with `useState<NearbyRequest[]>([])`.

**Feed load function pattern** (new, follows `supabase.rpc()` call pattern from `src/lib/supabase.ts`):
```typescript
const DISPLAY_RADIUS_KM = 10

// Props additions needed in HomeProps: currentUserId, donorLat, donorLng, donorBloodType
// (passed down from App.tsx after hydration)

useEffect(() => {
  if (!donorLat || !donorLng) return   // guard: Pitfall 6

  let cancelled = false
  async function loadFeed() {
    const { data, error } = await supabase.rpc('requests_within_radius', {
      lat: donorLat,
      lng: donorLng,
      radius_km: DISPLAY_RADIUS_KM,
    })
    if (error || !data || cancelled) return

    const filtered = data
      .filter((r) => r.requester_id !== currentUserId)          // exclude own request
      .filter((r) => COMPATIBLE_REQUEST_TYPES[donorBloodType].includes(r.blood_type))
      .map((r) => ({
        id: r.id,
        bloodType: r.blood_type as BloodType,
        currentAddress: r.current_address,
        distMeters: r.dist_meters,
        createdAt: r.created_at,
        urgent: r.urgency === 'urgent',
        phone: r.contact_phone,
      }))
    setRequests(filtered)
  }
  void loadFeed()
  return () => { cancelled = true }
}, [donorLat, donorLng, donorBloodType, currentUserId])
```

**RequestCard render updates** — the card currently reads `req.township[lang]`, `req.distance[lang]`, `req.timeAgo[lang]`. Replace with derived values at render time:

```typescript
// In RequestCard, replace static bilingual accessors with derived labels:
// req.township[lang] → req.currentAddress   (plain string, same for both langs)
// req.distance[lang] → formatDistanceLabel(req.distMeters, lang)
// req.timeAgo[lang]  → formatTimeAgo(req.createdAt, lang)

function formatDistanceLabel(distMeters: number, lang: Lang): string {
  const km = distMeters / 1000
  const n = km < 1 ? Math.round(distMeters) : Math.round(km * 10) / 10
  const unit = km < 1 ? (lang === 'my' ? 'မီတာ' : 'm') : 'km'
  return `~${formatNumber(n, lang)} ${unit}`
}

function formatTimeAgo(createdAt: string, lang: Lang): string {
  const diffMs = Date.now() - new Date(createdAt).getTime()
  const diffMin = Math.floor(diffMs / 60000)
  if (diffMin < 60) {
    return lang === 'my'
      ? `${formatNumber(diffMin, lang)} မိနစ်က`
      : `${formatNumber(diffMin, lang)} min ago`
  }
  const diffHr = Math.floor(diffMin / 60)
  return lang === 'my'
    ? `${formatNumber(diffHr, lang)} နာရီက`
    : `${formatNumber(diffHr, lang)} hr ago`
}
```

**`formatPhone` stays unchanged** (lines 54–61) — already expects E.164 input, which the DB stores.

**`hasOpenRequest` wiring** (lines 199 + 241 + 368) — behavior unchanged; `App.tsx` now derives it from `requestDraft !== null` which is set from the DB-loaded active request during hydration (D-14).

---

### `src/blood.ts` — add `COMPATIBLE_REQUEST_TYPES`

**Analog:** `src/blood.ts` lines 1–4 (existing `BLOOD_TYPES` + `BloodType` pattern)

**Current file** (lines 1–4):
```typescript
export const BLOOD_TYPES = ['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'] as const
export type BloodType = (typeof BLOOD_TYPES)[number]
```

**Pattern: add `Record<BloodType, BloodType[]>` in the same flat-module style** — no class, no default export, plain named export constant with JSDoc:
```typescript
// ADD after the existing exports — same module, no new file needed

/**
 * Directional blood-type compatibility map (blood-help-spec.md §3.1).
 * Key: donor's blood type. Value: request blood types the donor can donate into.
 * Usage: COMPATIBLE_REQUEST_TYPES[donorBloodType].includes(requestBloodType)
 */
export const COMPATIBLE_REQUEST_TYPES: Record<BloodType, BloodType[]> = {
  'O-':  ['O-', 'O+', 'A-', 'A+', 'B-', 'B+', 'AB-', 'AB+'],
  'O+':  ['O+', 'A+', 'B+', 'AB+'],
  'A-':  ['A-', 'A+', 'AB-', 'AB+'],
  'A+':  ['A+', 'AB+'],
  'B-':  ['B-', 'B+', 'AB-', 'AB+'],
  'B+':  ['B+', 'AB+'],
  'AB-': ['AB-', 'AB+'],
  'AB+': ['AB+'],
}
```

**Key verification:** `O-` maps to all 8 types (universal donor). `AB+` maps only to `['AB+']` (can only donate to AB+). The direction is donor → recipient, not recipient → donor (the RESEARCH.md matrix above is presented recipient-first; the code map is donor-first, which is the consuming pattern in `Home.tsx`).

---

### `src/types/database.ts` — regenerated post-migration

**Analog:** `src/types/database.ts` (current generated file, lines 1–433)

This file is fully regenerated by Supabase MCP `generate_typescript_types` after the migration runs. Do not hand-edit it. The structure will be identical to the current file but with:
- `blood_requests.Row.township: string` → `blood_requests.Row.current_address: string`
- `blood_requests.Insert.township: string` → `blood_requests.Insert.current_address: string`
- `blood_requests.Update.township?: string` → `blood_requests.Update.current_address?: string`
- `profiles.Row` — all donor columns (`blood_type`, `donor_code`, `is_donor`, `is_available`, `emergency_callable`, `donation_count`, `last_donation_date`, `available_after`, `township`, `lat`, `lng`, `location_updated_at`) removed
- New `donors` table added with `Row`, `Insert`, `Update`, `Relationships` sections
- `Functions.donors_within_radius.Returns` updated (now returns `profile_id uuid` instead of `name text`)
- New `Functions.requests_within_radius` added with `Args` and `Returns` matching the new RPC

**Pattern for consuming generated types** (from `src/lib/supabase.ts` line 11):
```typescript
// createClient<Database> — the generic parameter comes from the generated file
// After regeneration, TypeScript will flag any stale column references automatically
export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey)
```

---

## Shared Patterns

### Discriminated-Union Result Pattern
**Source:** `src/geolocation.ts` lines 1–4 and `src/auth.ts` lines 7–9
**Apply to:** All async DB operations in `App.tsx` handlers and `Home.tsx` feed load

The codebase never throws — all fallible operations resolve to typed results. Supabase JS returns `{ data, error }` which naturally maps to this pattern:
```typescript
// Pattern — from src/geolocation.ts:
export type GeoResult =
  | { ok: true; lat: number; lng: number; accuracy: number }
  | { ok: false; reason: 'denied' | 'unavailable' | 'timeout' | 'unsupported' }

// Pattern — from src/auth.ts:
export type SessionResult =
  | { ok: true; session: Session }
  | { ok: false; error: AuthError | null }

// Apply same discipline to DB calls:
// { data: T | null, error: PostgrestError | null }
// data === null + error === null → 0 rows (use .maybeSingle(), not .single())
// data !== null + error === null → success
// error !== null → failure → log + show AlertDialog
```

### AlertDialog for Errors
**Source:** `src/screens/CreateRequest.tsx` lines 423–444 (geo pre-permission + denied dialogs)
**Apply to:** All write-failure surfaces in Phase 7 — `handleSaveDonor` errors, `handlePosted` errors including the unique-violation backstop (D-18)

The `AlertDialog` component is already imported in `CreateRequest.tsx` and already used for two dialog states driven by a `GeoPhase` type. The same pattern gates all error surfaces in Phase 7 — no toasts, no inline error text, no new UI components.

### Supabase Client Import
**Source:** `src/lib/supabase.ts` line 11
**Apply to:** `src/App.tsx` (already imported line 18), `src/screens/Home.tsx` (new import needed)

```typescript
import { supabase } from '../lib/supabase'   // screens use ../
import { supabase } from './lib/supabase'    // App.tsx uses ./
```

The singleton is already wired. Never call `createClient()` directly elsewhere.

### `coarsenCoordinates` Before Every DB Write
**Source:** `src/geolocation.ts` lines 45–50 (the function) and `src/screens/CreateRequest.tsx` line 176 (usage)
**Apply to:** `DonorProfileSetup.tsx` requestLocationAndSave, `App.tsx` handleSaveDonor (receives pre-coarsened coords from DonorProfile), `App.tsx` handlePosted (receives pre-coarsened coords from RequestDraft — CreateRequest already calls coarsenCoordinates)

```typescript
// Always coarsen before passing to onSave/onPosted:
const { lat, lng } = coarsenCoordinates(res.lat, res.lng)
// Then pass { lat, lng } in the draft/profile — NEVER pass res.lat/res.lng directly
```

### Phone E.164 Normalization
**Source:** 07-RESEARCH.md Pattern 4 (new utility, no existing analog in codebase)
**Apply to:** `App.tsx` `handleSaveDonor` (normalize `profile.phone` before profiles upsert), `App.tsx` `handlePosted` (normalize `draft.phone` before blood_requests insert)

```typescript
function normalizePhone(digits: string): string {
  const clean = digits.replace(/\D/g, '')
  return `+95${clean}`
}
```

Place this function in `App.tsx` (private, not exported) — it is only called from the two handlers. `Home.tsx`'s `formatPhone` (lines 54–61) expects E.164 as input and is unchanged.

### `formatNumber` for Burmese Numerals
**Source:** `src/i18n.ts` lines 7–11
**Apply to:** `Home.tsx` `formatDistanceLabel` and `formatTimeAgo` helper functions

```typescript
// Already exported from src/i18n.ts:
export function formatNumber(n: number, lang: Lang): string
// Usage: formatNumber(distKm, lang), formatNumber(diffMin, lang)
```

---

## No Analog Found

All Phase 7 files have analogs in the codebase. No new patterns without precedent are required. The RESEARCH.md provides complete reference patterns for the two cases closest to "no analog" (the `requests_within_radius` RPC has the exact `donors_within_radius` analog; `COMPATIBLE_REQUEST_TYPES` follows the exact `BLOOD_TYPES` const pattern).

---

## Metadata

**Analog search scope:** `src/`, `.planning/phases/06-foundation/`, `src/types/`, `src/lib/`
**Files read:** 12 source files + 2 planning documents
**Pattern extraction date:** 2026-06-22

**Critical pitfalls to carry into every plan:**
1. `set search_path = ''` → always prefix PostGIS functions with `extensions.`
2. `ST_DWithin` geography → `radius_km * 1000` (meters, not km)
3. Never include `donor_code` in `donors` upsert payload (trigger assigns it; payload would overwrite on UPDATE)
4. Use `.maybeSingle()` not `.single()` — avoids PGRST116 on 0-row returns
5. Bare `.insert()` without `.select()/.single()` chain — check `error.code === '23505'` explicitly
6. `DonorProfile` interface and `handleSaveDonor` must be updated in the same plan (coupled by `lat`/`lng` addition)
7. Guard `loadFeed()` on `donorLat !== null && donorLng !== null` before calling RPC
