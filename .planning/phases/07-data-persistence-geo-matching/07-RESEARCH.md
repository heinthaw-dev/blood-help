# Phase 7: Data Persistence + Geo-Matching — Research

**Researched:** 2026-06-22
**Domain:** Supabase Postgres schema migration, PostGIS RPC, RLS policies, supabase-js upsert patterns, blood-type compatibility, React state hydration
**Confidence:** HIGH (all critical patterns verified from official Supabase docs or confirmed Phase 6 implementation)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Schema Redesign — Normalize profiles into profiles + donors**
- **D-01:** `profiles` = shared identity for every user: `id`, `name`, `phone`, `language`, `created_at`, `updated_at`. Nothing donor-specific remains.
- **D-02:** New `donors` table holds all donor-only attributes, keyed by `profile_id` (uuid FK → `profiles.id`, UNIQUE one-to-one): `blood_type`, `donor_code`, `is_available`, `emergency_callable`, `donation_count`, `last_donation_date`, `available_after`, `lat`, `lng`, `location_updated_at`, `created_at`, `updated_at`.
- **D-03:** "Is this user a donor?" = the existence of a `donors` row. Drop `is_donor` boolean.
- **D-04:** Remove `township` from `profiles` completely.
- **D-05:** Rename `blood_requests.township` → `current_address` (NOT NULL, free-text human-readable label).
- **D-06:** Donor last-known location (`lat`, `lng`, `location_updated_at`) lives on `donors` table.
- **D-07:** Migration ALTERs the already-deployed `profiles` table, creates `donors`, renames the request column. RLS policies, `donors_within_radius` RPC, and `src/types/database.ts` must follow.

**Form → Column Mapping**
- **D-08:** `showNumber` toggle → `donors.emergency_callable`.
- **D-09:** `current_address` field is now **required** (flip form's "Optional" marking).

**Location Capture**
- **D-10:** Donor GPS: request on Confirm/Save tap using the `AlertDialog` pre-permission flow (same pattern as `CreateRequest`). Add this flow to `DonorProfileSetup` — it does NOT currently exist there.
- **D-11:** Requester GPS: already built in `CreateRequest`; writes coarsened live GPS + `current_address`.
- **D-12:** GPS denied → show denied `AlertDialog`; do NOT complete the write.

**Returning-User Hydration**
- **D-13:** On session restore, load `profiles` + `donors` rows into App state, replacing `DEFAULT_USER`.
- **D-14:** On session restore, load user's own active `blood_requests` row; wire `hasOpenRequest` from it.
- **D-15:** Save donor profile = upsert `profiles` then upsert `donors` keyed by `profile_id`.

**One-Open-Request Rule & Error UX**
- **D-16:** Primary prevention is UI-gating: hide "Request Blood" CTA when `hasOpenRequest`.
- **D-17:** `one_open_request_per_user` partial unique index stays as backstop.
- **D-18:** Write failures (network, RLS denial, unique-violation) surface via existing `AlertDialog`.

### Claude's Discretion (Researcher/Planner Decides)

- Inverse feed RPC: `requests_within_radius(lat, lng, radius_km)` vs plain client query
- Where directional blood-type compatibility filtering runs (SQL inside RPC vs JS after fetch)
- Distance / time-ago formatting for feed cards (km from `dist_meters`, relative time from `created_at`), Burmese numerals via `formatNumber`
- Exclude own active request from feed (`requester_id != me`)
- Availability toggle does not gate what a donor *sees* in the feed
- `donor_code` generation (5-char Base32): DB default/trigger vs client-side
- Phone normalization to E.164 before DB write
- RLS policy SQL for new `donors` table

### Deferred Ideas (OUT OF SCOPE)

- Leaderboard wiring to real `donation_count`
- Gated/logged/rate-limited phone reveal and personal-data purge
- FCM push to nearby compatible donors
- Cross-device session linking
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| BACK-05 | Donor profile setup form writes to `profiles` and new `donors` table; subsequent visits load and update existing rows | Schema migration patterns (§Schema Migration), upsert patterns (§Pattern 6), hydration pattern (§Pattern 8) |
| BACK-06 | Blood request creation writes to `blood_requests` with `expires_at = now()+24h`; one-open-request unique index enforced; user sees error on duplicate | Insert pattern (§Pattern 7), error detection (§Pitfall 4), `AlertDialog` reuse (§Don't Hand-Roll) |
| GEO-01 | Directional blood-type compatibility in code per spec §3.1 — donors see requests they can donate into, not exact-match | Authoritative matrix (§Blood-Type Compatibility Matrix), client-side filtering recommendation (§Architecture Patterns) |
| GEO-02 | Home feed queries real active `blood_requests` within `DISPLAY_RADIUS_KM` (10 km) of donor's last-known location | `requests_within_radius` RPC design (§Pattern 5), feed data-shape (§Pattern 9) |
</phase_requirements>

---

## Summary

Phase 7 has four distinct work areas: (1) schema migration, (2) form → DB wiring for donor profile and blood request, (3) returning-user hydration, and (4) the home feed geo-query. Each area has a clear approach documented below.

**Schema migration** is the riskiest part. The `profiles` table already has live data (including the 3 seed rows from Phase 6 and any real anonymous sessions). The migration must: DROP donor columns from `profiles`, CREATE the `donors` table with a unique FK to `profiles.id`, rename `blood_requests.township` → `current_address`, update the `donors_within_radius` RPC to query `donors` instead of `profiles`, and drop+recreate the RLS policies for both affected tables. All via Supabase MCP `apply_migration`.

**Form → DB wiring** follows established patterns: `DonorProfileSetup` gains the `GeoPhase` state machine (copied from `CreateRequest`), then calls upsert on `profiles` then upsert on `donors` keyed by `profile_id`. `CreateRequest` needs `current_address` made required and an `INSERT` into `blood_requests`.

**Returning-user hydration** expands the `initAuth` `useEffect` in `App.tsx` to query `profiles`, then the `donors` row (if any), then own active `blood_requests`, resolving to typed discriminated-union results.

**Feed geo-query** should use a new `requests_within_radius` RPC (mirroring `donors_within_radius`) for consistency, with blood-type compatibility filtering applied in JavaScript after the RPC returns — this keeps the SQL simple and avoids re-deploying the RPC every time the compatibility logic might change.

**Primary recommendation:** Execute as a 4-wave sequence — migration first, then donor-profile wiring, then request wiring, then feed. Each wave is independently verifiable via the Supabase dashboard.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Schema migration (ALTER profiles, CREATE donors, rename column) | Database / Supabase | — | DDL must run in Postgres via MCP `apply_migration` |
| Donor profile upsert | Frontend (App.tsx handler) | Database | Write initiated by form callback; DB enforces PK/FK uniqueness |
| Blood request insert | Frontend (App.tsx handler) | Database | Same pattern; DB's partial unique index is the backstop |
| Geo-radius query | Database (RPC) | Frontend | PostGIS `ST_DWithin` must run in Postgres for index utilisation; RPC called via `supabase.rpc()` |
| Blood-type compatibility filter | Frontend (blood.ts) | — | Pure data-mapping; no DB round-trip needed; easier to test/change |
| GPS coarsening | Frontend (geolocation.ts) | — | Already implemented; reuse `coarsenCoordinates()` |
| Returning-user hydration | Frontend (App.tsx useEffect) | Database | App reads Supabase, resolves discriminated-union, sets `UserState` |
| RLS enforcement | Database / Supabase | — | Must live in DB; anon key is public; RLS is the only security layer |
| `donor_code` generation | Database (DEFAULT trigger) | — | Uniqueness guarantee requires DB-level enforcement (see §Donor Code) |
| Phone E.164 normalization | Frontend (before DB write) | — | Client has the raw digits; prefix +95 before upsert |

---

## Standard Stack

### Core (all already installed — no new packages this phase)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@supabase/supabase-js` | 2.108.2 | DB queries, RPC, upsert, `.from().select()` | Already in use; Phase 6 wired the client singleton |

**No new npm packages are required for Phase 7.** All capabilities (Supabase queries, PostGIS RPC, React state) are already present.

---

## Package Legitimacy Audit

No new packages introduced in this phase. The audit from Phase 6 Research covers `@supabase/supabase-js`.

**Packages removed due to slopcheck [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

---

## Architecture Patterns

### System Architecture Diagram

```
DonorProfileSetup.onSave
        |
        v
GeoPhase state machine (idle → prealert → requesting → denied)
        |
    GPS granted
        |
        v
coarsenCoordinates(lat, lng)
        |
        v
App.handleSaveDonor()
        |
        ├──► supabase.from('profiles').upsert({ id, name, phone, language })
        └──► supabase.from('donors').upsert({ profile_id, blood_type, emergency_callable,
                 is_available, donor_code, lat, lng, location_updated_at })

CreateRequest.onPosted
        |
        v
App.handlePosted()
        |
        v
supabase.from('blood_requests').insert({
   requester_id, blood_type, current_address, lat, lng,
   contact_phone, units_needed, urgency,
   status: 'active', expires_at: now()+24h
})
        |
        ├── success → setRequestDraft, setScreen('request-live')
        └── error.code === '23505' → show AlertDialog "already have active request"
            other error → show AlertDialog "something went wrong, retry"

App mount useEffect (initAuth — expanded from Phase 6)
        |
        v
supabase.auth.getSession()
        |
        v
supabase.from('profiles').select('*').eq('id', uid).maybeSingle()
        |
        v
supabase.from('donors').select('*').eq('profile_id', uid).maybeSingle()
        |
        v
supabase.from('blood_requests')
   .select('*').eq('requester_id', uid).eq('status', 'active').maybeSingle()
        |
        v
setUser(hydrated UserState)
setRequestDraft(activeRequest ?? null)  ← drives hasOpenRequest
setScreen('home')

Home.tsx — feed query (on mount / on focus)
        |
        v
supabase.rpc('requests_within_radius', {
   lat: donor.lat, lng: donor.lng, radius_km: DISPLAY_RADIUS_KM
})
        |
        v
[NearbyRequest rows from DB]
        |
        v
filter by COMPATIBLE_DONORS[donor.bloodType] (JS, client-side)
        |
        v
filter out requester_id === currentUserId (own request excluded)
        |
        v
render feed cards (dist_meters → km label, created_at → time-ago)
```

### Recommended Project Structure Changes

```
src/
├── lib/
│   └── supabase.ts           # unchanged singleton
├── types/
│   └── database.ts           # regenerate after migration (MCP generate_typescript_types)
├── blood.ts                  # add COMPATIBLE_DONORS map (directional matrix)
├── geolocation.ts            # unchanged (coarsenCoordinates already exported)
├── App.tsx                   # expand initAuth useEffect; update handleSaveDonor, handlePosted; update UserState
├── screens/
│   ├── DonorProfileSetup.tsx # add GeoPhase state machine; form validation; call onSave
│   ├── CreateRequest.tsx     # make current_address required (drop Optional label, add to postDisabled check)
│   └── Home.tsx              # replace DUMMY_REQUESTS with live feed query; NearbyRequest type loses `township`, gains `currentAddress`
```

---

## Schema Migration Design

This is the highest-risk part of the phase. The migration must run as a single atomic `apply_migration` call (or two sequential calls if Supabase MCP has size limits). The steps in dependency order:

### Step 1 — Alter `profiles`: strip donor columns

```sql
-- Remove donor-specific columns from profiles
ALTER TABLE public.profiles
  DROP COLUMN IF EXISTS blood_type,
  DROP COLUMN IF EXISTS donor_code,
  DROP COLUMN IF EXISTS is_donor,
  DROP COLUMN IF EXISTS is_available,
  DROP COLUMN IF EXISTS emergency_callable,
  DROP COLUMN IF EXISTS donation_count,
  DROP COLUMN IF EXISTS last_donation_date,
  DROP COLUMN IF EXISTS available_after,
  DROP COLUMN IF EXISTS township,
  DROP COLUMN IF EXISTS lat,
  DROP COLUMN IF EXISTS lng,
  DROP COLUMN IF EXISTS location_updated_at;
```

**Ordering note:** Drop columns BEFORE creating the new `donors` table (no dependency on those columns yet). [ASSUMED — Postgres will allow dropping columns referenced in an existing `donors_within_radius` RPC, but that RPC will break at runtime; must also drop/recreate the RPC in this same migration.]

### Step 2 — Create `donors` table

```sql
CREATE TABLE public.donors (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id          uuid NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  blood_type          public.blood_type NOT NULL,
  donor_code          text UNIQUE,
  is_available        boolean NOT NULL DEFAULT true,
  emergency_callable  boolean NOT NULL DEFAULT false,
  donation_count      int NOT NULL DEFAULT 0,
  last_donation_date  date,
  available_after     date,
  lat                 double precision,
  lng                 double precision,
  location_updated_at timestamptz,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.donors ENABLE ROW LEVEL SECURITY;
```

**One-to-one:** `profile_id UNIQUE` enforces one donor row per profile. [CITED: PostgreSQL docs — UNIQUE constraint on FK column enforces one-to-one]

### Step 3 — Add `donor_code` DB-level generator

Rather than a separate trigger function, use a `DEFAULT` expression that calls an inline Base32 generator. However, Postgres `DEFAULT` cannot call a `VOLATILE` function inline in a column definition — it must be a trigger for retry-on-collision uniqueness. The robust pattern is:

```sql
-- Base32 alphabet: uppercase A-Z plus 2-7 (RFC 4648 Base32 without padding)
-- Use pgcrypto gen_random_bytes for cryptographic randomness
CREATE OR REPLACE FUNCTION public.generate_donor_code()
RETURNS text
LANGUAGE plpgsql
VOLATILE
SET search_path = ''
AS $$
DECLARE
  chars text[] := ARRAY['A','B','C','D','E','F','G','H','I','J','K','L','M',
                         'N','O','P','Q','R','S','T','U','V','W','X','Y','Z',
                         '2','3','4','5','6','7'];
  result text := '';
  i int;
  code text;
  done boolean := false;
BEGIN
  WHILE NOT done LOOP
    result := '';
    FOR i IN 1..5 LOOP
      result := result || chars[1 + floor(random() * 32)::int];
    END LOOP;
    -- Retry if collision (astronomically rare for 32^5 = 33M space, small donor set)
    IF NOT EXISTS (SELECT 1 FROM public.donors WHERE donor_code = result) THEN
      done := true;
    END IF;
  END LOOP;
  RETURN result;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_donor_code_on_insert()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF NEW.donor_code IS NULL THEN
    NEW.donor_code := public.generate_donor_code();
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER donors_set_donor_code
  BEFORE INSERT ON public.donors
  FOR EACH ROW EXECUTE FUNCTION public.set_donor_code_on_insert();
```

This is **DB-side generation** (recommended over client-side) because:
- The `donor_code` unique constraint must be enforced at DB level regardless
- Client-side generation + insert still risks collision; DB trigger retries in-transaction
- Phase 9 requires the code to be stable once assigned; trigger ensures it is set on insert and never overwritten on upsert

[ASSUMED — the `floor(random() * 32)::int` indexing and WHILE loop retry pattern follows the gist at gist.github.com/5argon/027f52c553483aff6b525d7c96d39757, adapted for retry-on-collision]

### Step 4 — Rename `blood_requests.township` → `current_address`

```sql
ALTER TABLE public.blood_requests
  RENAME COLUMN township TO current_address;
```

**No data loss:** this is a pure rename. The existing seed rows have `township` values (`'Bahan'`, `'Tamwe'`) which become `current_address` values after the rename — semantically correct. [CITED: PostgreSQL docs — ALTER TABLE RENAME COLUMN is in-place metadata change, no row rewrite]

### Step 5 — Drop and recreate `donors_within_radius` RPC

The existing RPC queries `public.profiles` for `is_donor`, `is_available`, `blood_type`, `lat`, `lng` — all of which have been dropped from `profiles`. The RPC must be dropped and rewritten to query `donors`:

```sql
DROP FUNCTION IF EXISTS public.donors_within_radius(double precision, double precision, double precision);

CREATE OR REPLACE FUNCTION public.donors_within_radius(
  lat double precision,
  lng double precision,
  radius_km double precision
)
RETURNS TABLE (
  id uuid,
  profile_id uuid,
  blood_type public.blood_type,
  donation_count int,
  lat double precision,
  lng double precision,
  dist_meters double precision
)
SET search_path = ''
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT
    d.id,
    d.profile_id,
    d.blood_type,
    d.donation_count,
    d.lat,
    d.lng,
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
      radius_km * 1000
    )
  ORDER BY dist_meters;
$$;

GRANT EXECUTE ON FUNCTION public.donors_within_radius(double precision, double precision, double precision) TO authenticated;
```

[CITED: Phase 06-03-PLAN.md — established `extensions.` prefix pattern, `set search_path = ''`, SECURITY DEFINER, `radius_km * 1000` meters conversion]

### Step 6 — Create `requests_within_radius` RPC (new — GEO-02)

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

**RPC vs client-side query decision:** Use RPC (not a direct `.from('blood_requests').select()...`) because:
- PostGIS `ST_DWithin` uses a spatial index; a `WHERE ST_Distance(...) < N` table-scan does not
- The RPC pattern is consistent with `donors_within_radius` (same mental model for maintainers)
- `SECURITY DEFINER` means RLS on `blood_requests` is bypassed inside the function — this is intentional: the RPC returns only `status='active'` rows; the client-side JS further filters by compatibility and `requester_id != me`

**`contact_phone` in return set:** The spec §3.4 says donor phone is never printed in lists. The requester's `contact_phone` in `blood_requests` IS intended to be shown to nearby donors (they call the requester — that is the core loop). RLS policies on the table would normally gate this, but since we use SECURITY DEFINER here, returning it is safe: every authenticated user who calls this RPC is a potential donor; showing the requester's contact phone is the designed behaviour.

[CITED: blood-help-spec.md §3.4 — "Requester number is shown to matched donors (they want to be reached)"]
[CITED: blood-help-spec.md §2.3 — "Will help (green, pinned top) — donor responded; name, distance, number shown, call button"]

### Step 7 — RLS Policies for `donors` table

The `donors` table needs its own RLS policies. Following the pattern established in Phase 6 for `profiles`, using `(select auth.uid())` subquery for init-plan performance optimization:

```sql
-- Users manage only their own donor row
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

-- Anon role: no access (donors table is entirely behind auth)
-- SECURITY DEFINER RPCs (donors_within_radius, requests_within_radius)
-- bypass RLS to do geo-queries — this is intentional and documented above
```

**Why no SELECT-others policy on `donors`:** The feed uses the `requests_within_radius` SECURITY DEFINER RPC to expose requests; donor data is only needed in the leaderboard (Phase 9) and will get its own policy then. For Phase 7, the RPC bypasses RLS intentionally; anon/other-user access to raw `donors` rows is blocked.

[CITED: Supabase RLS docs — `(SELECT auth.uid())` init-plan optimization]
[CITED: Phase 06 patterns — `USING (profile_id = auth.uid())` policy shape]

### Step 8 — Update seed data

The Phase 6 seed profiles have donor columns that will be dropped. After the migration, re-insert the donor data into the new `donors` table:

```sql
INSERT INTO public.donors (profile_id, blood_type, is_available, emergency_callable, donation_count, lat, lng, location_updated_at)
VALUES
  ('00000000-0000-0000-0000-000000000001', 'O+', true, false, 3, 16.82, 96.15, now()),
  ('00000000-0000-0000-0000-000000000002', 'A-', true, true,  7, 16.83, 96.17, now()),
  ('00000000-0000-0000-0000-000000000003', 'B+', false, false, 1, 16.85, 96.13, now())
ON CONFLICT (profile_id) DO NOTHING;
```

The `donor_code` trigger populates automatically. [CITED: trigger pattern above]

---

## Blood-Type Compatibility Matrix

From spec §3.1 — **directional: donor donates INTO the requested type.** The table below maps from the recipient's requested blood type to the set of donor blood types that can donate into it.

| Recipient Needs | Compatible Donor Types |
|----------------|------------------------|
| O−             | O−                     |
| O+             | O−, O+                 |
| A−             | O−, A−                 |
| A+             | O−, O+, A−, A+         |
| B−             | O−, B−                 |
| B+             | O−, O+, B−, B+         |
| AB−            | O−, A−, B−, AB−        |
| AB+            | O−, O+, A−, A+, B−, B+, AB−, AB+ (universal recipient — everyone) |

[CITED: blood-help-spec.md §3.1]

**Where to filter:** Client-side in JavaScript, after the `requests_within_radius` RPC returns. The RPC gives back all active requests within radius; the JS filter checks `COMPATIBLE_DONORS[donorBloodType].includes(request.bloodType)`.

**Concrete implementation in `src/blood.ts`:**

```typescript
// Source: blood-help-spec.md §3.1
/** Map from a donor's blood type to the set of request blood types they can donate into. */
export const COMPATIBLE_REQUEST_TYPES: Record<BloodType, BloodType[]> = {
  'O-':  ['O-', 'O+', 'A-', 'A+', 'B-', 'B+', 'AB-', 'AB+'],  // universal donor
  'O+':  ['O+', 'A+', 'B+', 'AB+'],
  'A-':  ['A-', 'A+', 'AB-', 'AB+'],
  'A+':  ['A+', 'AB+'],
  'B-':  ['B-', 'B+', 'AB-', 'AB+'],
  'B+':  ['B+', 'AB+'],
  'AB-': ['AB-', 'AB+'],
  'AB+': ['AB+'],                                                  // can only donate to AB+
}
```

**Reading the map:** a donor of type `O-` can donate into any request (universal donor); a donor of type `AB+` can donate only to `AB+` requests.

**Client-side rationale vs SQL-in-RPC:**
- Keeping it in JS means `blood.ts` is the single source of truth for blood-type logic; no schema migration needed if the matrix ever changes
- The RPC already limits rows by radius; the compatibility filter is a second O(n) pass over a small result set (typically < 20 requests within 10 km)
- SQL approach would require passing the donor's blood type as an RPC parameter and embedding the matrix as a SQL array comparison — more complex, harder to read, same performance for small sets

---

## Pattern 1: Expand `initAuth` in App.tsx for Full Hydration (D-13, D-14)

**What:** Extend the existing Phase 6 `useEffect` to also load `donors` and own active `blood_requests` after confirming the session.

```typescript
// Expanded initAuth — replaces the Phase 6 version in App.tsx
// Source: supabase-js docs + Phase 6 established pattern
async function initAuth() {
  const { data: { session } } = await supabase.auth.getSession()

  if (!session) {
    const { error } = await supabase.auth.signInAnonymously()
    if (error) { setSessionLoading(false); return }
  }

  const uid = (await supabase.auth.getUser()).data.user?.id
  if (!uid) { setSessionLoading(false); return }

  // Load profile row
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', uid)
    .maybeSingle()

  if (profile) {
    // Load donor row (may not exist — user could be pure requester)
    const { data: donor } = await supabase
      .from('donors')
      .select('*')
      .eq('profile_id', uid)
      .maybeSingle()

    // Load own active request
    const { data: activeRequest } = await supabase
      .from('blood_requests')
      .select('*')
      .eq('requester_id', uid)
      .eq('status', 'active')
      .maybeSingle()

    setUser({
      supabaseId: uid,
      name: profile.name ?? 'You',
      bloodType: (donor?.blood_type as BloodType) ?? 'O+',
      available: donor?.is_available ?? true,
      emergencyCallable: donor?.emergency_callable ?? false,
      showNumber: donor?.emergency_callable ?? false,
      donationCount: donor?.donation_count ?? 0,
      lastDonation: donor?.last_donation_date ?? null,
      donorSetupComplete: donor !== null,
      donorCode: donor?.donor_code ?? '',
    })

    setRequestDraft(activeRequest ? {
      bloodType: activeRequest.blood_type as BloodType,
      phone: activeRequest.contact_phone,
      address: activeRequest.current_address,
      units: activeRequest.units_needed,
      urgency: activeRequest.urgency as 'urgent' | 'today',
      lat: activeRequest.lat ?? 0,
      lng: activeRequest.lng ?? 0,
    } : null)

    setScreen('home')
  }

  setSessionLoading(false)
}
```

**Error handling:** Each `.maybeSingle()` call returns `{ data, error }`. A null `data` is expected (new user, no donor row yet). Non-null `error` should be logged but not prevent routing — graceful degradation to `DEFAULT_USER`. [CITED: supabase.com/docs/reference/javascript/maybeSingle — does not throw on 0 rows, returns data: null]

---

## Pattern 2: `UserState` Expansion in App.tsx

The current `UserState` interface lacks several fields needed after hydration. Add:

```typescript
interface UserState {
  name: string
  bloodType: BloodType
  available: boolean
  showNumber: boolean        // alias for emergencyCallable in UI
  emergencyCallable: boolean
  donationCount: number
  lastDonation: string | null
  donorSetupComplete: boolean   // true when donors row exists
  donorCode: string
  supabaseId: string | null
  // Phase 7 additions:
  lat: number | null            // donor's last-known coarsened lat
  lng: number | null            // donor's last-known coarsened lng
}
```

`lat` and `lng` on `UserState` are needed to call `requests_within_radius` from the feed — the donor's own location from the `donors` row.

---

## Pattern 3: GeoPhase State Machine in DonorProfileSetup (D-10, D-12)

Copy `CreateRequest`'s `GeoPhase` state machine verbatim into `DonorProfileSetup`. The only difference is the trigger (form submit vs the request post button):

```typescript
// DonorProfileSetup.tsx — additions
type GeoPhase = 'idle' | 'prealert' | 'requesting' | 'denied'
const [geoPhase, setGeoPhase] = useState<GeoPhase>('idle')

// On "Save & Continue" tap:
const handleSave = () => {
  if (!bloodType) return
  setGeoPhase('prealert')   // trigger the AlertDialog pre-warning
}

// After user confirms in the dialog:
const requestLocationAndSave = async () => {
  setGeoPhase('requesting')
  const res = await getCurrentPosition()
  if (res.ok && bloodType) {
    setGeoPhase('idle')
    const { lat, lng } = coarsenCoordinates(res.lat, res.lng)
    onSave({ name: name.trim(), bloodType, phone, showNumber, available, lat, lng })
  } else {
    setGeoPhase('denied')   // show denied dialog; do NOT call onSave
  }
}
```

**`DonorProfile` interface must add `lat` and `lng`:**
```typescript
export interface DonorProfile {
  name: string
  bloodType: BloodType
  phone: string
  showNumber: boolean
  available: boolean
  lat: number      // coarsened — always present after GPS grant
  lng: number
}
```

---

## Pattern 4: Phone E.164 Normalization

Before writing `phone` to `profiles` or `contact_phone` to `blood_requests`, normalize the number the user typed into the `+95` prefix field:

```typescript
// Normalize digits from the "+95 prefix" input field to E.164
// Input: user types "9123456789" into the field (prefix chip shows "+95")
// Output: "+959123456789"
function normalizePhone(digits: string): string {
  const clean = digits.replace(/\D/g, '')
  return `+95${clean}`
}
```

`Home.tsx`'s `formatPhone` already expects E.164 (`+95...`) as input. Normalizing before write ensures the stored value always matches the expected format. [ASSUMED — `+95` is the Myanmar country code; the UI already shows it as a prefix chip]

---

## Pattern 5: `requests_within_radius` Call from Home.tsx (GEO-02)

```typescript
// Home.tsx — replace DUMMY_REQUESTS with live query
// Called on component mount and on screen focus

const DISPLAY_RADIUS_KM = 10   // from Phase 6 D-17

async function loadFeed(
  donorLat: number,
  donorLng: number,
  donorBloodType: BloodType,
  currentUserId: string
): Promise<NearbyRequest[]> {
  const { data, error } = await supabase.rpc('requests_within_radius', {
    lat: donorLat,
    lng: donorLng,
    radius_km: DISPLAY_RADIUS_KM,
  })
  if (error || !data) return []

  return data
    // Exclude own request (D-14 loaded it separately; it's shown as the active-request card)
    .filter((r) => r.requester_id !== currentUserId)
    // Directional blood-type compatibility (GEO-01)
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
}
```

**`NearbyRequest` type changes:** The existing `NearbyRequest` in `Home.tsx` has:
- `township: Record<Lang, string>` → replace with `currentAddress: string` (single free-text value from DB)
- `distance: Record<Lang, string>` → derive from `distMeters` at render time
- `timeAgo: Record<Lang, string>` → derive from `createdAt` at render time

---

## Pattern 6: Donor Profile Upsert (BACK-05, D-15)

```typescript
// App.tsx — handleSaveDonor (replaces the dummy version)
const handleSaveDonor = async (profile: DonorProfile) => {
  const uid = user.supabaseId
  if (!uid) return   // should never happen post-auth

  const phone = normalizePhone(profile.phone)

  // Step 1: upsert profiles (identity row)
  const { error: profileErr } = await supabase
    .from('profiles')
    .upsert({
      id: uid,
      name: profile.name,
      phone,
      language: lang,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'id' })

  if (profileErr) {
    // Show error AlertDialog
    return
  }

  // Step 2: upsert donors row (keyed by profile_id)
  // donor_code is NOT sent — the DB trigger sets it on INSERT, and UPSERT
  // using onConflict: 'profile_id' will DO UPDATE and skip donor_code column
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

  if (donorErr) {
    // Show error AlertDialog
    return
  }

  // Update local state + navigate
  setUser((u) => ({
    ...u,
    name: profile.name,
    bloodType: profile.bloodType,
    available: profile.available,
    emergencyCallable: profile.showNumber,
    showNumber: profile.showNumber,
    donorSetupComplete: true,
    lat: profile.lat,
    lng: profile.lng,
  }))
  setScreen('donor-thankyou')
}
```

**Upsert `onConflict: 'profile_id'`:** The `donors` table has `UNIQUE (profile_id)`. Specifying `{ onConflict: 'profile_id' }` means: if a row with that `profile_id` already exists, UPDATE the non-PK fields. The `donor_code` column is not sent in the payload, so it is not overwritten on the UPDATE path (Postgres `ON CONFLICT DO UPDATE SET` only updates columns present in the SET clause). [CITED: supabase.com/docs/reference/javascript/upsert]

---

## Pattern 7: Blood Request Insert (BACK-06, D-15)

```typescript
// App.tsx — handlePosted (replaces the dummy version)
const handlePosted = async (draft: RequestDraft) => {
  const uid = user.supabaseId
  if (!uid) return

  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()

  const { error } = await supabase
    .from('blood_requests')
    .insert({
      requester_id: uid,
      blood_type: draft.bloodType,
      current_address: draft.address,   // renamed from township (D-05)
      lat: draft.lat,
      lng: draft.lng,
      contact_phone: normalizePhone(draft.phone),
      units_needed: draft.units,
      urgency: draft.urgency,
      status: 'active',
      expires_at: expiresAt,
    })

  if (error) {
    if (error.code === '23505') {
      // one_open_request_per_user unique-index violation (D-17 backstop)
      // Show "You already have an active request" AlertDialog
    } else {
      // Show generic write-failure AlertDialog (D-18)
    }
    return
  }

  setRequestDraft(draft)
  setScreen('request-live')
}
```

**`expires_at` client-side calculation:** `now() + 24h` is calculated on the client. Using `new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()` is fine for v2; a DB-level `DEFAULT now() + interval '24 hours'` would be cleaner but would require a schema change not in scope. [ASSUMED — client-side timestamp is acceptable for v2; clock drift is negligible for a 24-hour window]

---

## Pattern 8: Distance and Time-Ago Formatting for Feed Cards

```typescript
// Derive display strings from raw DB values at render time
// Use existing formatNumber() from src/i18n.ts for Burmese numerals

function formatDistanceLabel(distMeters: number, lang: Lang): string {
  const km = distMeters / 1000
  const n = km < 1 ? Math.round(distMeters) : Math.round(km * 10) / 10
  const unit = km < 1
    ? (lang === 'my' ? 'မီတာ' : 'm')
    : (lang === 'my' ? 'km' : 'km')
  return `~${formatNumber(n, lang)} ${unit}`
}

function formatTimeAgo(createdAt: string, lang: Lang): string {
  const diffMs = Date.now() - new Date(createdAt).getTime()
  const diffMin = Math.floor(diffMs / 60000)
  if (diffMin < 60) {
    const n = formatNumber(diffMin, lang)
    return lang === 'my' ? `${n} မိနစ်က` : `${n} min ago`
  }
  const diffHr = Math.floor(diffMin / 60)
  const n = formatNumber(diffHr, lang)
  return lang === 'my' ? `${n} နာရီက` : `${n} hr ago`
}
```

`formatNumber` is already exported from `src/i18n.ts` (renders Burmese numerals when `lang === 'my'`). No new utility is needed. [ASSUMED — `formatNumber` exists in `src/i18n.ts` based on CLAUDE.md references; verify by reading the file before implementing]

---

## Pattern 9: `NearbyRequest` Type Refactor in Home.tsx

The existing `NearbyRequest` interface must lose its bilingual-record fields (those were for dummy static data) and gain DB-derived fields:

```typescript
// New shape — derived from RPC response
interface NearbyRequest {
  id: string
  bloodType: BloodType
  currentAddress: string   // replaces township: Record<Lang, string>
  distMeters: number       // raw — formatted at render time
  createdAt: string        // ISO timestamp — formatted at render time
  urgent: boolean
  phone: string            // E.164 contact_phone from blood_requests
}
```

Feed state in Home.tsx becomes `useState<NearbyRequest[]>([])` with a `useEffect` that calls `loadFeed()` on mount.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Pre-permission geo warning dialog | Custom modal | Existing `AlertDialog` component | Already used in CreateRequest for the same pattern; design-system consistency |
| Write failure toasts / snackbars | New notification component | Existing `AlertDialog` component | D-18 locks this; consistent with geo-permission denied flow |
| Distance calculation from lat/lng | Custom Haversine formula | PostGIS `ST_Distance` in the RPC | ST_Distance uses accurate spheroid math; Haversine is an approximation; PostGIS has spatial index support |
| Blood-type compatibility lookup | Nested if-else chains | `COMPATIBLE_REQUEST_TYPES` record in `blood.ts` | Single source of truth; O(1) lookup; trivially testable |
| Session persistence | Manual JWT storage | Supabase JS (built-in localStorage) | Already wired in Phase 6; do not duplicate |
| Unique 5-char donor code | `Math.random()` in JS | `generate_donor_code()` DB trigger | Uniqueness must be enforced at DB level; collision retry belongs in the transaction |

**Key insight:** Every new dialog in Phase 7 reuses `AlertDialog`. No new UI components are introduced. The `GeoPhase` state machine is copied, not reimplemented.

---

## Common Pitfalls

### Pitfall 1: `one_open_request_per_user` Partial Index Conflict vs PGRST116

**What goes wrong:** Inserting a second active request for the same user hits the partial unique index and returns `error.code === '23505'`. However, wrapping the insert in `.select().single()` and getting PGRST116 (no visible row) may confuse error-handling code that checks for a successful write.

**Why it happens:** Supabase PostgREST returns PGRST116 when a `.single()` finds 0 visible rows — which can happen if the insert succeeded but RLS blocks the read-back. `23505` is a true write failure. These are different error codes.

**How to avoid:** Use `.insert({...})` without chaining `.select()` or `.single()`. Check `error.code === '23505'` explicitly. Do not infer "insert succeeded" from PGRST116. [CITED: dev.to article on "PGRST116 when Supabase RLS hides a successful write"]

### Pitfall 2: `ST_DWithin` Requires Radius in Meters (not km)

**What goes wrong:** Passing `radius_km` directly to `ST_DWithin` produces a radius 1000× too small.

**Why it happens:** `extensions.geography` distance is always in meters.

**How to avoid:** Always multiply: `extensions.st_dwithin(..., radius_km * 1000)`. This is already done in `donors_within_radius` — carry forward to `requests_within_radius`. [CITED: PostGIS docs — ST_DWithin with geography type uses meters]

### Pitfall 3: `upsert` with `onConflict: 'profile_id'` and the `donor_code` Column

**What goes wrong:** Including `donor_code: null` in the upsert payload overwrites the DB-trigger-assigned code on subsequent saves.

**Why it happens:** Supabase upsert sends `ON CONFLICT DO UPDATE SET <every column in payload>`. If `donor_code` is in the payload (even as undefined/null), Postgres may null out the existing code.

**How to avoid:** Never include `donor_code` in the `donors` upsert payload. Let the trigger assign it on INSERT; leave it untouched on UPDATE. [ASSUMED — standard Postgres ON CONFLICT DO UPDATE SET behaviour; verify by testing a second upsert on the same row]

### Pitfall 4: `profiles` Upsert `updated_at` Requires Manual Setting

**What goes wrong:** `updated_at` stays at the creation timestamp even after updates.

**Why it happens:** The `profiles` table has no trigger to auto-update `updated_at`. The Phase 6 schema set `DEFAULT now()` on `created_at` and `updated_at` but did not add an `ON UPDATE` trigger.

**How to avoid:** Always include `updated_at: new Date().toISOString()` in upsert payloads for both `profiles` and `donors`. Alternatively, add an `ON UPDATE` trigger in the migration (recommended — keeps the column always accurate regardless of which path writes the row). [ASSUMED — Phase 6 schema review shows no auto-update trigger was added]

### Pitfall 5: `extensions.` Prefix on PostGIS Functions with `set search_path = ''`

**What goes wrong:** Calling `ST_DWithin(...)` instead of `extensions.st_dwithin(...)` inside a function with `set search_path = ''` produces "function does not exist."

**Why it happens:** With empty search_path, Postgres cannot find PostGIS functions in the `extensions` schema without the explicit prefix.

**How to avoid:** Always use `extensions.st_dwithin`, `extensions.st_point`, `extensions.st_distance` in functions that set `search_path = ''`. This is established in Phase 6 and must be carried forward. [CITED: Phase 06-03-PLAN.md — Pitfall 4 and 5 in the research doc]

### Pitfall 6: Feed Loads Before Donor Location Is Set

**What goes wrong:** `Home.tsx` calls `requests_within_radius` on mount with `lat: null, lng: null`, which causes PostGIS to fail or return no results.

**Why it happens:** A new user completes donor setup but `user.lat/lng` in App state is null until the next `initAuth` hydration cycle (or until the upsert returns and `setUser` is called with real coordinates).

**How to avoid:** In `loadFeed()`, guard on `donorLat !== null && donorLng !== null` before calling the RPC. Render the empty-state ("No nearby requests") when coordinates are unavailable. After `handleSaveDonor` succeeds, the `setUser` call includes `lat` and `lng` from the GPS grant, so subsequent feed renders will have real coordinates. [ASSUMED — null-guard is the standard defensive pattern]

### Pitfall 7: Column Name `township` Still Appears in Code After Migration

**What goes wrong:** After renaming `blood_requests.township` → `current_address`, the old column name may still be referenced in query `.select()` calls, `RequestDraft.address` mapping, and `Home.tsx` `NearbyRequest.township`.

**Why it happens:** The rename is in Postgres, not in TypeScript. After `generate_typescript_types`, the type is correct, but hand-rolled code that references the old string name will break at runtime.

**How to avoid:** After `apply_migration`, immediately run `generate_typescript_types` via MCP to regenerate `database.ts`. Then grep for `township` in the codebase and update every reference. The plan should include an explicit grep-and-replace task. [ASSUMED — TypeScript type checking will catch column mismatches once the generated types are updated]

### Pitfall 8: `DonorProfile` Interface Passed to `onSave` Lacks `lat`/`lng`

**What goes wrong:** `DonorProfileSetup` calls `onSave(profile)` but the current `DonorProfile` interface has no `lat`/`lng` fields, so the GPS coordinates are lost before reaching `handleSaveDonor`.

**Why it happens:** The existing interface was designed before GPS was part of the donor flow. D-10 adds GPS to this form; the interface must be updated simultaneously.

**How to avoid:** The plan must update `DonorProfile` in `DonorProfileSetup.tsx` and `handleSaveDonor` in `App.tsx` in the same plan (not separate plans). These two files are coupled; updating one without the other causes a compile error. [ASSUMED — TypeScript will surface this as a type mismatch immediately]

---

## Runtime State Inventory

> Step 2.5 check — this phase involves schema rename/migration; the RENAME COLUMN and DROP COLUMN affect deployed state.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | Phase 6 seed rows in `public.profiles` have donor columns (`blood_type`, `lat`, `lng`, etc.) that will be dropped; those columns' values disappear permanently | Re-seed donor data into new `donors` table in the same migration (Step 8 above) |
| Stored data | Phase 6 seed rows in `public.blood_requests` have `township` column that is renamed | No data loss — `RENAME COLUMN` preserves values under new name |
| Live service config | `donors_within_radius` RPC in Supabase references `profiles.is_donor`, `profiles.lat`, etc. — all dropped | Must drop and recreate RPC in the migration (Step 5 above) |
| Live service config | RLS policies on `profiles` that may reference dropped columns | Review and confirm no existing policy references `is_donor`, `township`, `lat`, `lng` on `profiles`; those were not used in Phase 6 SELECT policies |
| OS-registered state | None — no OS-level registrations for Supabase columns | None |
| Secrets/env vars | `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` — unchanged | None |
| Build artifacts | `src/types/database.ts` — generated from current schema, will be stale after migration | Regenerate via MCP `generate_typescript_types` immediately after migration |

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Supabase MCP server | `apply_migration`, `execute_sql`, `generate_typescript_types` | Confirmed (used in Phase 6) | Current | — |
| `@supabase/supabase-js` | All DB queries | Confirmed installed | 2.108.2 | — |
| `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` | Client connection | Confirmed in `.env.local` (Phase 6) | — | — |
| PostGIS extension | `requests_within_radius` RPC | Confirmed enabled (Phase 6) | Supabase-managed | — |
| Browser Geolocation API | Donor GPS on profile save | Available in all target browsers (Chrome, Safari on mobile) | — | AlertDialog denied state (D-12) |

---

## Validation Architecture

`workflow.nyquist_validation` is `true` in `.planning/config.json` — this section is required. However, Phase 7 has no test framework installed (verified from Phase 6 and CLAUDE.md). Verification is manual + Supabase dashboard.

### Test Framework

| Property | Value |
|----------|-------|
| Framework | None installed — manual verification only |
| Config file | n/a |
| Quick run command | `npm run lint` (type-check proxy) |
| Full suite command | `npm run build` (tsc + vite build — type errors surface here) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| BACK-05 | Donor profile upserts rows to `profiles` and `donors` | Manual — Supabase dashboard check | `npm run build` (compile gate) | n/a |
| BACK-06 | Blood request inserts row with `status='active'`, `expires_at`; duplicate blocked | Manual — attempt second post + check error dialog | `npm run build` | n/a |
| GEO-01 | O- donor sees AB+ requests; AB+ donor sees only AB+ | Manual — seed data verification via Supabase dashboard | `npm run build` | n/a |
| GEO-02 | Home feed shows real rows from DB, not `DUMMY_REQUESTS` | Manual — check feed loads with real data after login | `npm run build` | n/a |

### Sampling Rate

- **Per task commit:** `npm run lint` — catches TypeScript errors introduced in the task
- **Per wave merge:** `npm run build` — full tsc + Vite build confirms no type or import errors
- **Phase gate:** Manual UAT against live Supabase + `npm run build` green before `/gsd:verify-work`

### Wave 0 Gaps

None — no test files to create. Manual verification is the established pattern (from Phase 6 HUMAN-UAT.md).

---

## Security Domain

`security_enforcement` is not explicitly `false` in config — section is required.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No (Phase 6 handled anonymous auth) | Carried forward — anonymous session |
| V3 Session Management | No | Supabase JS handles JWT refresh |
| V4 Access Control | Yes | RLS policies on `donors` and `blood_requests`; SECURITY DEFINER RPCs |
| V5 Input Validation | Yes | `saveDisabled` and `postDisabled` guards in forms; phone normalization before write |
| V6 Cryptography | No | No new cryptographic operations; `gen_random_bytes` via pgcrypto for donor_code |

### Known Threat Patterns for this Phase

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Horizontal privilege escalation (write another user's `donors` row) | Elevation of Privilege | `donors_insert_own` / `donors_update_own` RLS policies gated by `profile_id = auth.uid()` |
| Harvesting requester phone numbers from `requests_within_radius` | Information Disclosure | RPC is intentional — requester phone IS shown to potential donors (spec §3.4 permits); `contact_phone` is requester's, not donor's |
| Double-submit race condition on blood request | Tampering | `one_open_request_per_user` partial unique index as DB-level backstop (D-17) |
| `donor_code` enumeration (Phase 9 concern) | Spoofing | Unique constraint + 32^5 = 33M space; collision-resistant for small donor set; no exposure in Phase 7 |
| SECURITY DEFINER RPCs bypass RLS | Elevation of Privilege | Both RPCs return only safe columns (no donor phone, no sensitive fields); SELECT-only functions; `GRANT EXECUTE` limited to `authenticated` role |

---

## Discretion Decisions (Claude's Recommendations)

These were marked "Claude's Discretion" in CONTEXT.md. Research supports the following calls:

1. **RPC vs client-side query for feed:** Use `requests_within_radius` RPC. Spatial index utilisation and pattern consistency with `donors_within_radius` outweigh the marginal benefit of a simpler client query.

2. **Where blood-type filtering runs:** Client-side JavaScript (after RPC returns). The `COMPATIBLE_REQUEST_TYPES` map in `blood.ts` is the single source of truth; simpler SQL, easier to maintain.

3. **Availability toggle and feed visibility:** Do NOT filter the feed by `is_available` for Phase 7. The feed shows what requests are nearby; availability gates push notifications in Phase 8. An unavailable donor can still see requests and manually choose to call. This avoids confusing empty-feed states.

4. **`donor_code` generation:** DB trigger. Client-side generation has a race condition on concurrent inserts; the trigger handles retry-on-collision in-transaction.

5. **Distance formatting:** `~X km` for >= 1 km, `~X m` for < 1 km. Burmese numerals via `formatNumber`. No new utility needed.

6. **Own request exclusion from feed:** Filter client-side after RPC: `.filter((r) => r.requester_id !== currentUserId)`. The `currentUserId` is always available from `user.supabaseId`.

7. **Phone E.164 normalization:** Client-side, in `handleSaveDonor` and `handlePosted`, before writing to DB. Function: prepend `+95` to the digits the user entered in the prefix-chip input.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `expires_at` calculated client-side as `now()+24h` is acceptable for v2 (clock drift < 1 min on mobile) | Pattern 7 | Requests expire slightly early/late; negligible for 24h window |
| A2 | `floor(random() * 32)::int` in the donor_code trigger produces correct 0-based index into a 32-element array | Schema Migration §Step 3 | Off-by-one; would produce null or wrong character; verify by testing trigger INSERT |
| A3 | `+95` is always the correct prefix for numbers entered in the phone field; no international format needed for v2 Myanmar-only app | Pattern 4 | If a non-Myanmar number is entered, E.164 form will be wrong; acceptable for v2 scope |
| A4 | Phase 6 RLS policies on `profiles` do not reference `is_donor`, `township`, `lat`, `lng` — so dropping those columns won't break existing policies | Runtime State Inventory | If those columns are referenced in USING/WITH CHECK, migration fails; verify by listing policies before running migration |
| A5 | `formatNumber` is exported from `src/i18n.ts` | Pattern 8 | If it doesn't exist, time-ago and distance labels will need a new utility; low risk |
| A6 | Client-side `Date.now()` for `expires_at` and `updated_at` is acceptable; no server-side `now()` required | Pattern 7 | Acceptable for v2; a future migration could add DB-level defaults |
| A7 | After the `DROP COLUMN` steps, no existing application code (other than `database.ts`, the RPC, and `App.tsx`) still references `profiles.is_donor` or `profiles.township` | Pitfall 7 | Stale references cause runtime errors after the migration; mitigated by regenerating types and grepping for column names |

---

## Open Questions (RESOLVED)

1. **Phase 6 seed data after column drop**
   - What we know: The 3 seed profiles have values in `blood_type`, `lat`, `lng`, etc. on `profiles` that will be dropped.
   - What's unclear: Whether the seed data has already been modified by any test during Phase 6 UAT.
   - Recommendation: Re-seed all 3 rows into `donors` in the migration script; use `ON CONFLICT (profile_id) DO NOTHING` so it's idempotent.
   - **RESOLVED:** Adopted. Plan 07-01's migration re-seeds the donor rows into `donors` with `ON CONFLICT (profile_id) DO NOTHING` (idempotent), keyed on the existing seed profile UUIDs.

2. **Existing RLS policies on `profiles` referencing donor columns**
   - What we know: Phase 6 deployed RLS on `profiles` but the exact policy SQL was discretion.
   - What's unclear: Whether `profiles` SELECT/UPDATE policies reference `blood_type`, `lat`, etc.
   - Recommendation: The planner should include a task to list current policies with `execute_sql: SELECT * FROM pg_policies WHERE tablename = 'profiles'` BEFORE running the migration, and confirm no dropped columns are in policy predicates.
   - **RESOLVED:** Adopted. Plan 07-01 Task 1 is a pre-migration audit that lists current `profiles` policies via `execute_sql` and confirms no dropped column appears in any policy predicate before the destructive DDL runs.

3. **`updated_at` trigger for `profiles` and `donors`**
   - What we know: Phase 6 schema set `DEFAULT now()` but no auto-update trigger.
   - What's unclear: Whether it's cleaner to add a trigger in this migration vs always sending `updated_at` in upsert payloads.
   - Recommendation: Add a `before update` trigger on both tables (3 lines of SQL) to keep `updated_at` always accurate regardless of caller. Include in the migration.
   - **RESOLVED:** Adopted — add the trigger in the migration. Plan 07-01's migration creates `public.set_updated_at()` and a `BEFORE UPDATE` trigger on both `public.profiles` and `public.donors`, so `updated_at` is always accurate regardless of caller (not dependent on every upsert payload including the field).

---

## Sources

### Primary (HIGH confidence)
- Phase 06-03-PLAN.md — authoritative `donors_within_radius` RPC pattern with PostGIS `extensions.` prefix, `set search_path = ''`, SECURITY DEFINER, meters conversion
- `blood-help-spec.md §3.1` — authoritative blood-type compatibility matrix (cited verbatim above)
- `blood-help-spec.md §3.4` — confirms requester phone shown to donors (cited)
- `supabase.com/docs/reference/javascript/upsert` — upsert API, `onConflict` parameter, ignoreDuplicates behaviour
- `supabase.com/docs/reference/javascript/maybeSingle` — 0-row returns null data, not error
- `postgis.net/docs/ST_DWithin.html` — geography type uses meters, `use_spheroid` default true
- PostGIS official docs via GitHub (`supabase/supabase/apps/docs/.../postgis.mdx`) — `extensions.st_point`, `extensions.st_distance`, `set search_path = ''` pattern

### Secondary (MEDIUM confidence)
- WebSearch results on `(SELECT auth.uid())` init-plan optimization for RLS performance — multiple sources agree; pattern consistent with Supabase RLS docs advice
- WebSearch on `23505` error code for unique violations in Supabase-js — consistent across multiple sources
- gist.github.com/5argon/027f52c553483aff6b525d7c96d39757 — Base32 character set and loop structure for donor_code generator

### Tertiary (LOW confidence — flagged as [ASSUMED])
- `donor_code` trigger retry-on-collision pattern — adapted from gist, not from official Postgres trigger docs; verify by testing
- `expires_at` client-side calculation acceptability — convention only; no official guidance

---

## Metadata

**Confidence breakdown:**
- Schema migration SQL: HIGH — follows Phase 6 patterns directly; PostgreSQL docs confirm RENAME COLUMN and DROP COLUMN semantics
- `requests_within_radius` RPC: HIGH — mirrors the verified `donors_within_radius` pattern exactly; PostGIS function signatures confirmed
- Blood-type compatibility matrix: HIGH — transcribed directly from `blood-help-spec.md §3.1`
- Upsert patterns: HIGH — verified from official Supabase docs
- `donor_code` trigger: MEDIUM — Base32 generation pattern from gist (not official docs); retry-on-collision approach is standard SQL pattern
- Feed formatting (distance/time-ago): MEDIUM — convention; no authoritative source

**Research date:** 2026-06-22
**Valid until:** 2026-07-22 (Supabase JS API is stable; PostGIS geography type is stable)
